using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Windows.Media.Control;

namespace LastfmScrobbler.SmtcHelper;

/// <summary>
/// One now-playing snapshot, serialized as a single line of JSON to stdout. `null` when
/// nothing is currently the "current session" per SMTC's own arbitration (unlike MPRIS on
/// Linux, Windows itself decides which session the user would most likely want to
/// control — see GlobalSystemMediaTransportControlsSessionManager.GetCurrentSession).
/// </summary>
internal sealed class NowPlayingSnapshot
{
    [JsonPropertyName("title")]
    public string? Title { get; init; }

    [JsonPropertyName("artist")]
    public string? Artist { get; init; }

    [JsonPropertyName("album")]
    public string? Album { get; init; }

    [JsonPropertyName("albumArtist")]
    public string? AlbumArtist { get; init; }

    [JsonPropertyName("durationSec")]
    public double? DurationSec { get; init; }

    [JsonPropertyName("elapsedSec")]
    public double? ElapsedSec { get; init; }

    [JsonPropertyName("playbackStatus")]
    public string? PlaybackStatus { get; init; }

    [JsonPropertyName("sourceAppUserModelId")]
    public string? SourceAppUserModelId { get; init; }
}

/// <summary>
/// Prints one line of JSON to stdout for the current SMTC session's now-playing state,
/// and again on every relevant change, until killed. See
/// docs/adr/0009-windows-smtc-integration.md for why this is a separate helper process
/// (WinRT's GlobalSystemMediaTransportControlsSessionManager has no Node.js binding) and
/// docs/modules/adapter-windows.md for the wire format and how this is invoked.
/// </summary>
internal static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new();

    private static async Task Main()
    {
        var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();

        manager.CurrentSessionChanged += async (sender, _) =>
        {
            await SafeAsync(() => AttachToCurrentSessionAsync(sender));
        };

        await AttachToCurrentSessionAsync(manager);

        // Keep the process alive; the Node host kills it when done.
        await Task.Delay(Timeout.Infinite);
    }

    private static async Task AttachToCurrentSessionAsync(
        GlobalSystemMediaTransportControlsSessionManager manager
    )
    {
        var session = manager.GetCurrentSession();

        if (session is null)
        {
            EmitSnapshot(null);
            return;
        }

        // No effort is made to unsubscribe from a previous session's events: this
        // process is short-lived and per-session re-subscription is cheap, so a leaked
        // handler on an now-unreferenced session object is harmless — the session
        // becomes eligible for GC once nothing else (including WinRT) references it.
        session.MediaPropertiesChanged += async (s, _) => await SafeAsync(() => EmitForSessionAsync(s));
        session.PlaybackInfoChanged += async (s, _) => await SafeAsync(() => EmitForSessionAsync(s));
        session.TimelinePropertiesChanged += async (s, _) => await SafeAsync(() => EmitForSessionAsync(s));

        await EmitForSessionAsync(session);
    }

    private static async Task EmitForSessionAsync(GlobalSystemMediaTransportControlsSession session)
    {
        var snapshot = await BuildSnapshotAsync(session);
        EmitSnapshot(snapshot);
    }

    private static async Task<NowPlayingSnapshot> BuildSnapshotAsync(
        GlobalSystemMediaTransportControlsSession session
    )
    {
        var mediaProperties = await session.TryGetMediaPropertiesAsync();
        var playbackInfo = session.GetPlaybackInfo();
        var timeline = session.GetTimelineProperties();

        double? durationSec = null;
        double? elapsedSec = null;
        if (timeline is not null)
        {
            var duration = timeline.EndTime - timeline.StartTime;
            if (duration > TimeSpan.Zero)
            {
                durationSec = duration.TotalSeconds;
            }
            elapsedSec = (timeline.Position - timeline.StartTime).TotalSeconds;
        }

        return new NowPlayingSnapshot
        {
            Title = mediaProperties?.Title,
            Artist = mediaProperties?.Artist,
            Album = mediaProperties?.AlbumTitle,
            AlbumArtist = mediaProperties?.AlbumArtist,
            DurationSec = durationSec,
            ElapsedSec = elapsedSec,
            PlaybackStatus = playbackInfo?.PlaybackStatus.ToString(),
            SourceAppUserModelId = session.SourceAppUserModelId,
        };
    }

    private static void EmitSnapshot(NowPlayingSnapshot? snapshot)
    {
        Console.WriteLine(JsonSerializer.Serialize(snapshot, JsonOptions));
        Console.Out.Flush();
    }

    /// <summary>
    /// WinRT event handlers that are `async` compile to fire-and-forget (`async void`
    /// semantics) — an unhandled exception in one would crash the whole process. Session
    /// state is inherently racy (the app that owns it can close mid-fetch), so errors here
    /// are expected occasionally and are logged to stderr rather than fatal.
    /// </summary>
    private static async Task SafeAsync(Func<Task> action)
    {
        try
        {
            await action();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"SmtcHelper: {ex}");
            Console.Error.Flush();
        }
    }
}
