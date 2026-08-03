import type { JSX, SubmitEvent } from "react";
import { useEffect, useRef, useState } from "react";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import HubIcon from "@mui/icons-material/Hub";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SearchIcon from "@mui/icons-material/Search";
import TuneIcon from "@mui/icons-material/Tune";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Link from "@mui/material/Link";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "../contexts/snackbar-context.js";
import { ConfirmDialog } from "../components/shared/ConfirmDialog.js";
import { PageHeader } from "../components/PageHeader.js";
import { SettingsRow } from "../components/SettingsRow.js";
import { SettingsSaveStatus, type SettingsSaveState } from "../components/SettingsSaveStatus.js";
import { SettingsSectionCard } from "../components/SettingsSectionCard.js";
import { useAccountAvatars } from "../hooks/use-account-avatars.js";
import { useAppVersion } from "../hooks/use-app-version.js";
import { useAuth } from "../hooks/use-auth.js";
import { useLibrefmAuth } from "../hooks/use-librefm-auth.js";
import { useListenBrainzAuth } from "../hooks/use-listenbrainz-auth.js";
import { useSettings } from "../contexts/settings-context.js";
import { useUpdates } from "../hooks/use-updates.js";
import type { PageProps } from "./page-props.js";
import type { AspectRatioOption } from "../../../shared/settings-api.js";
import type { UpdateStatus } from "../../../shared/update-status.js";

const ASPECT_RATIO_OPTIONS: readonly {
  readonly value: AspectRatioOption;
  readonly label: string;
}[] = [
  { value: "free", label: "Free" },
  { value: "16:9", label: "16:9 (widescreen)" },
  { value: "4:3", label: "4:3 (standard)" },
  { value: "1:1", label: "1:1 (square)" },
  { value: "9:16", label: "9:16 (vertical)" },
  { value: "9:14", label: "9:14 (vertical, default)" },
];

/**
 * Pre-fills Last.fm's "create an API account" form via query string, so all the user
 * has to do is click "Submit" — no typing. **Best-effort, not independently
 * verified**: that form requires being logged in to Last.fm to view at all (Last.fm's
 * own login page handles that redirect before this URL is ever reached — nothing in
 * this app needs to broker it), and its real field `name` attributes couldn't be
 * inspected from here — `name`/`description`/`homepage` are a reasonable guess based
 * on the form's known labels (Application name / description / homepage), not a
 * confirmed contract. If these don't actually populate the form when tested live,
 * Last.fm uses different field names than guessed here; whoever notices should update
 * this against the real page source (view-source once logged in) rather than
 * re-guessing.
 */
function buildCreateApiAccountUrl(): string {
  const url = new URL("https://www.last.fm/api/account/create");
  url.searchParams.set("name", "Last.fm Scrobbler");
  url.searchParams.set(
    "description",
    "Cross-platform desktop scrobbler — reads Now Playing from the OS media session " +
      "and submits scrobbles to Last.fm.",
  );
  url.searchParams.set("homepage", "https://github.com/Vaporjawn/Last-FM-Scrobbler");
  return url.toString();
}

const CREATE_API_ACCOUNT_URL = buildCreateApiAccountUrl();

/** Human-readable summary of `UpdateStatus` for the Settings "Updates" row —
 * `undefined` for "idle" (nothing worth saying before the first check has even run). */
function describeUpdateStatus(status: UpdateStatus): string | undefined {
  switch (status.phase) {
    case "idle":
      return undefined;
    case "checking":
      return "Checking for updates…";
    case "available":
      return `Update ${status.version} found — downloading…`;
    case "not-available":
      return "You're up to date.";
    case "downloading":
      return `Downloading update… ${Math.round(status.percent)}%`;
    case "downloaded":
      return `Update ${status.version} downloaded — restart to install it.`;
    case "error":
      return `Couldn't check for updates: ${status.message}`;
  }
}

/** Case-insensitive substring match against every non-empty candidate — used to
 * decide whether a section stays visible for the current search query. Empty query
 * always matches (nothing typed yet = show everything). */
function sectionMatches(query: string, ...candidates: (string | undefined)[]): boolean {
  if (!query) {
    return true;
  }
  return candidates.some((candidate) => candidate?.toLowerCase().includes(query));
}

/**
 * Settings → General, Window, Accounts, and (when needed) a Last.fm API key form.
 * Laid out as a search-filterable card grid — see `SettingsSectionCard`/`SettingsRow`
 * — modeled on a reference design the UI was asked to look more like, restyled onto
 * this app's own theme (`theme/index.ts`'s red/amber palette) rather than adopting
 * the reference's own colors.
 *
 * Login is deliberately a single button: `useAuth`'s `login()` drives
 * `packages/core`'s `AuthFlow`, which opens the user's browser to Last.fm's own
 * authorization page and polls silently until they approve access there — no token to
 * copy/paste, no extra screen in this app.
 *
 * Login needs *some* Last.fm API key/secret pair to exist first, though. This build
 * either has one baked in (`credentialsSource === "environment"`, configured by
 * whoever built it via LASTFM_API_KEY/LASTFM_API_SECRET — not user-editable here), or
 * the end user supplies their own below ("bring your own key") — both paths unlock the
 * exact same login flow above once a key is in place.
 */
export function SettingsPage({ onNavigateToProfile }: PageProps): JSX.Element {
  const {
    isConfigured,
    credentialsSource,
    accounts,
    activeAccount,
    isLoggingIn,
    isSavingCredentials,
    error,
    login,
    logout,
    setActiveAccount,
    saveAppCredentials,
    clearAppCredentials,
    relaunch,
  } = useAuth();
  const {
    isConfigured: librefmIsConfigured,
    credentialsSource: librefmCredentialsSource,
    activeAccount: librefmActiveAccount,
    isLoggingIn: librefmIsLoggingIn,
    isSavingCredentials: librefmIsSavingCredentials,
    login: librefmLogin,
    logout: librefmLogout,
    saveCredentials: librefmSaveCredentials,
    clearCredentials: librefmClearCredentials,
  } = useLibrefmAuth();
  const {
    activeAccount: listenBrainzActiveAccount,
    isConnecting: listenBrainzIsConnecting,
    connect: listenBrainzConnect,
    disconnect: listenBrainzDisconnect,
  } = useListenBrainzAuth();
  const { settings, updateSettings, resetSettings } = useSettings();
  const avatarsByUsername = useAccountAvatars(accounts);
  const appVersion = useAppVersion();
  const { status: updateStatus, isChecking: isCheckingForUpdate, checkNow: checkForUpdatesNow } =
    useUpdates();
  const { notify } = useSnackbar();

  // `window.platform` is absent outside a real Electron renderer (e.g. component
  // tests) — default to the more common "tray" phrasing in that case.
  const isMac = window.platform === "darwin";
  const updateStatusText = describeUpdateStatus(updateStatus);
  const trayLabel = isMac
    ? "Keep running in the menu bar when the window is closed"
    : "Keep running in the tray when the window is closed";

  const [query, setQuery] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [librefmApiKey, setLibrefmApiKey] = useState("");
  const [librefmApiSecret, setLibrefmApiSecret] = useState("");
  const [listenBrainzToken, setListenBrainzToken] = useState("");
  const [saveState, setSaveState] = useState<SettingsSaveState>("saved");
  // Local, editable copy of the persisted filter expression — not bound directly to
  // `settings.filterExpression`/`handleUpdateSetting` on every keystroke the way the
  // Switches/Radio rows above are, since most intermediate states while typing an
  // expression are syntactically invalid and shouldn't get persisted (or repeatedly
  // trigger the save-status indicator) on every character. Synced from the persisted
  // value once it loads (and again after this page's own save updates it) via the
  // effect below; explicit "Save filter" commits it, matching the API-key form's same
  // local-state-plus-explicit-submit pattern just below.
  const [filterExpressionInput, setFilterExpressionInput] = useState(settings.filterExpression ?? "");
  const [filterValidationError, setFilterValidationError] = useState<string | undefined>(undefined);
  // Bumped on every window.filter.validate() call (from either handler below) and
  // captured by each call's own closure — a response only gets applied if no newer
  // call has started since. Without this, handleFilterExpressionBlur (on blur) and
  // handleSaveFilterExpression (on click) each independently call validate() with no
  // ordering guard: blurring with an invalid draft, quickly fixing it, then blurring
  // again fires two overlapping calls, and if the first (slower, for the stale
  // invalid text) resolves after the second (faster, correct) one, its stale error
  // clobbers the correct state — showing an error for text the user already fixed,
  // and leaving "Save filter" wrongly disabled until the next validate() call.
  const filterValidationGenerationRef = useRef(0);

  useEffect(() => {
    setFilterExpressionInput(settings.filterExpression ?? "");
  }, [settings.filterExpression]);

  const q = query.trim().toLowerCase();

  const handleSaveCredentials = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void (async () => {
      const result = await saveAppCredentials(apiKey, apiSecret);
      if (result.success) {
        setApiKey("");
        setApiSecret("");
        // Stays up longer than the default (see SnackbarProvider) and carries the
        // actual "restart now" action — this is a more consequential outcome than a
        // routine success toast, since nothing takes effect until the app restarts.
        notify({
          message: "Saved. Restart the app for it to take effect.",
          severity: "success",
          autoHideDurationMs: 15_000,
          action: { label: "Restart now", onClick: () => void relaunch() },
        });
      } else {
        notify({ message: result.error, severity: "error" });
      }
    })();
  };

  const handleLogin = (): void => {
    // Once `AuthFlow` confirms the session (the user approved access on Last.fm in
    // their browser), jump straight to Profile so they see confirmation of who
    // they're now logged in as, rather than sitting on this plain account list.
    void login().then((result) => {
      if (result.success) {
        notify({ message: "Logged in.", severity: "success" });
        onNavigateToProfile?.();
      } else {
        notify({ message: result.error, severity: "error" });
      }
    });
  };

  const handleLogout = (username: string): void => {
    void logout(username).then((result) => {
      notify(
        result.success
          ? { message: `Logged out ${username}.`, severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleSetActiveAccount = (username: string): void => {
    void setActiveAccount(username).then((result) => {
      notify(
        result.success
          ? { message: `Switched to ${username}.`, severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleClearAppCredentials = (): void => {
    void clearAppCredentials().then((result) => {
      notify(
        result.success
          ? { message: "API key removed. Restart the app for it to take effect.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleLibrefmConnect = (): void => {
    // Unlike Last.fm's two-step "save a key, then separately log in" flow, Libre.fm's
    // saved key takes effect immediately (see useLibrefmAuth's saveCredentials
    // docstring) — so a single "Connect" button chains both steps, since there's no
    // reason to make the user click twice for something that needs no restart between
    // them.
    void librefmSaveCredentials(librefmApiKey, librefmApiSecret).then((saveResult) => {
      if (!saveResult.success) {
        notify({ message: saveResult.error, severity: "error" });
        return;
      }
      void librefmLogin().then((loginResult) => {
        if (loginResult.success) {
          setLibrefmApiKey("");
          setLibrefmApiSecret("");
          notify({ message: "Connected to Libre.fm.", severity: "success" });
        } else {
          notify({ message: loginResult.error, severity: "error" });
        }
      });
    });
  };

  const handleLibrefmLoginOnly = (): void => {
    // Used when credentials are already available (baked into this build via
    // LIBREFM_API_KEY/LIBREFM_API_SECRET, or previously saved) — no key/secret form
    // to fill in first, unlike handleLibrefmConnect above; this is the "just click
    // login" path the environment-credentials source exists to enable.
    void librefmLogin().then((result) => {
      notify(
        result.success
          ? { message: "Connected to Libre.fm.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleLibrefmLogout = (): void => {
    void librefmLogout().then((result) => {
      notify(
        result.success
          ? { message: "Disconnected from Libre.fm.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleLibrefmClearCredentials = (): void => {
    void librefmClearCredentials().then((result) => {
      notify(
        result.success
          ? { message: "Libre.fm API key removed.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleListenBrainzConnect = (): void => {
    void listenBrainzConnect(listenBrainzToken).then((result) => {
      if (result.success) {
        setListenBrainzToken("");
        notify({ message: "Connected to ListenBrainz.", severity: "success" });
      } else {
        notify({ message: result.error, severity: "error" });
      }
    });
  };

  const handleListenBrainzDisconnect = (): void => {
    void listenBrainzDisconnect().then((result) => {
      notify(
        result.success
          ? { message: "Disconnected from ListenBrainz.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  const handleUpdateSetting = (patch: Parameters<typeof updateSettings>[0]): void => {
    setSaveState("saving");
    void updateSettings(patch).then((result) => {
      if (result.success) {
        setSaveState("saved");
      } else {
        setSaveState("error");
        notify({ message: result.error, severity: "error" });
      }
    });
  };

  const handleResetToDefaults = (): void => {
    setResetting(true);
    void resetSettings().then((result) => {
      setResetting(false);
      setResetDialogOpen(false);
      if (result.success) {
        setSaveState("saved");
        notify({ message: "Settings reset to their defaults.", severity: "success" });
      } else {
        setSaveState("error");
        notify({ message: result.error, severity: "error" });
      }
    });
  };

  const handleFilterExpressionBlur = (): void => {
    const trimmed = filterExpressionInput.trim();
    if (!trimmed || !window.filter) {
      setFilterValidationError(undefined);
      return;
    }
    const generation = (filterValidationGenerationRef.current += 1);
    void window.filter.validate(trimmed).then((result) => {
      if (generation !== filterValidationGenerationRef.current) {
        return; // Superseded by a newer validate() call — this result is stale.
      }
      setFilterValidationError(result.valid ? undefined : result.error);
    });
  };

  const handleSaveFilterExpression = (): void => {
    const trimmed = filterExpressionInput.trim();
    if (!trimmed) {
      setFilterValidationError(undefined);
      handleUpdateSetting({ filterExpression: undefined });
      notify({ message: "Filter cleared. Restart the app for it to take effect.", severity: "success" });
      return;
    }
    if (!window.filter) {
      return;
    }
    // Always re-validates before saving, independent of whether onBlur already ran —
    // covers pasting text and clicking "Save filter" directly without ever tabbing
    // away first.
    const generation = (filterValidationGenerationRef.current += 1);
    void window.filter.validate(trimmed).then((result) => {
      if (generation !== filterValidationGenerationRef.current) {
        return; // Superseded by a newer validate() call — this result is stale.
      }
      if (!result.valid) {
        setFilterValidationError(result.error);
        return;
      }
      setFilterValidationError(undefined);
      handleUpdateSetting({ filterExpression: trimmed });
      // Same "needs a restart" messaging as the API-key form above — Tracker
      // (packages/core) has no way to apply a new filter to an already-running
      // instance, see AppSettings.filterExpression's docstring.
      notify({
        message: "Saved. Restart the app for the filter to take effect.",
        severity: "success",
        autoHideDurationMs: 15_000,
        action: { label: "Restart now", onClick: () => void relaunch() },
      });
    });
  };

  const handleCheckForUpdatesNow = (): void => {
    void checkForUpdatesNow().then((result) => {
      notify(
        result.success
          ? { message: "Checked for updates.", severity: "success" }
          : { message: result.error, severity: "error" },
      );
    });
  };

  // An "environment"-sourced key was a deliberate choice by whoever built/launched
  // this instance — not something to let the end user change/clear from in here.
  // Otherwise (no key yet, or a user-supplied one already active) the form is always
  // shown — no gating on some prior "log in" step that this app has no way to
  // actually verify happened.
  const showKeyForm = credentialsSource !== "environment";

  const generalVisible = sectionMatches(
    q,
    "general",
    "dark mode",
    "light mode",
    "appearance",
    "theme",
    trayLabel,
    `show application icon in the ${isMac ? "menu bar" : "tray"}`,
    "menu bar icon",
    "tray icon",
    "show dock icon",
    "dock icon",
    "automatically check for updates",
    "check for updates",
    updateStatusText,
    "version",
    appVersion,
    "launch at login",
    "start minimized",
    "login item",
    "open at login",
    "reset to defaults",
    "reset settings",
  );
  const windowVisible = sectionMatches(
    q,
    "window",
    "aspect ratio",
    ...ASPECT_RATIO_OPTIONS.map((option) => option.label),
  );
  const notificationsVisible = sectionMatches(
    q,
    "notifications",
    "notify",
    "notify when a track is scrobbled",
    "notify when scrobbling fails",
    "scrobbled",
    "scrobble failed",
  );
  const filterVisible = sectionMatches(
    q,
    "filter",
    "excluded sources",
    "exclude",
    "filter expression",
    "sourceapp",
    "youtube",
    "non-music",
    "skip long",
  );
  const accountsVisible = sectionMatches(
    q,
    "accounts",
    "log in with last.fm",
    "log out",
    activeAccount,
    ...accounts,
  );
  const apiKeyVisible =
    showKeyForm && sectionMatches(q, "last.fm api key", "api key", "shared secret");
  const additionalServicesVisible = sectionMatches(
    q,
    "additional services",
    "librefm",
    "libre.fm",
    "listenbrainz",
    "listen brainz",
    "connect",
    "disconnect",
    librefmActiveAccount,
    listenBrainzActiveAccount,
  );
  const noResults =
    q.length > 0 &&
    !generalVisible &&
    !windowVisible &&
    !notificationsVisible &&
    !filterVisible &&
    !accountsVisible &&
    !apiKeyVisible &&
    !additionalServicesVisible;

  return (
    <Box sx={{ p: 3 }}>
      {/* `md` rather than the usual `sm` — same reasoning as ScrobbleDetailPage's
          avatar+text Stack: this breakpoint reacts to the whole window's width, not
          this Box's actual available width, and the sidebar (200px expanded) eats
          into that. At this app's own 680px minimum window width, `sm` (600px) would
          already force the title block to share a row with the search box, leaving
          the subtitle only ~150px to wrap into. `md` (900px) keeps the header stacked
          until there's genuinely enough room for a row. */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { md: "flex-start" }, mb: 3 }}
      >
        <PageHeader
          title="Settings"
          subtitle="Your background app behavior, window sizing, and connected Last.fm account"
        />
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="Search settings…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="disabled" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              minWidth: 200,
              "& .MuiOutlinedInput-root": { borderRadius: 999 },
            }}
          />
          <SettingsSaveStatus state={saveState} />
        </Stack>
      </Stack>

      {noResults ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          No settings match "{query}"
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2.5,
          }}
        >
          {generalVisible ? (
            <SettingsSectionCard icon={<TuneIcon fontSize="small" />} title="General">
              <SettingsRow
                label="Dark mode"
                description={
                  settings.themeMode === "dark"
                    ? "Switch to a light color scheme — takes effect immediately"
                    : "Switch to a dark color scheme — takes effect immediately"
                }
                control={
                  <Switch
                    checked={settings.themeMode === "dark"}
                    onChange={(event) => {
                      handleUpdateSetting({ themeMode: event.target.checked ? "dark" : "light" });
                    }}
                    slotProps={{ input: { "aria-label": "Dark mode" } }}
                  />
                }
              />
              <SettingsRow
                label={trayLabel}
                description={
                  "Last.fm Scrobbler is a background app — playback tracking and scrobbling " +
                  "only happen while it's running. This keeps it running after you close the " +
                  `window; quit it from the ${isMac ? "menu bar" : "tray"} icon instead.`
                }
                control={
                  <Switch
                    checked={settings.closeToTray}
                    onChange={(event) => {
                      handleUpdateSetting({ closeToTray: event.target.checked });
                    }}
                    slotProps={{ input: { "aria-label": trayLabel } }}
                  />
                }
              />
              <SettingsRow
                label={`Show application icon in the ${isMac ? "menu bar" : "tray"}`}
                description="Restart the app for this to take effect"
                control={
                  <Switch
                    checked={settings.showTrayIcon}
                    onChange={(event) => {
                      handleUpdateSetting({ showTrayIcon: event.target.checked });
                    }}
                    slotProps={{
                      input: { "aria-label": `Show application icon in the ${isMac ? "menu bar" : "tray"}` },
                    }}
                  />
                }
              />
              {/* macOS-only — there's no Dock (or equivalent) on Windows/Linux, see
                  AppSettings.showDockIcon's docstring. */}
              {isMac ? (
                <SettingsRow
                  label="Show dock icon"
                  control={
                    <Switch
                      checked={settings.showDockIcon}
                      onChange={(event) => {
                        handleUpdateSetting({ showDockIcon: event.target.checked });
                      }}
                      slotProps={{ input: { "aria-label": "Show dock icon" } }}
                    />
                  }
                />
              ) : null}
              {/* Electron's `setLoginItemSettings` has no Linux support at all
                  (verified against Electron's own current docs — see
                  `AppSettings.launchAtLogin`'s docstring) — hiding this row there
                  rather than presenting a control that can't do anything. */}
              {window.platform !== "linux" ? (
                <SettingsRow
                  label="Launch at login"
                  description="Start Last.fm Scrobbler automatically when you log in"
                  control={
                    <Switch
                      checked={settings.launchAtLogin}
                      onChange={(event) => {
                        handleUpdateSetting({ launchAtLogin: event.target.checked });
                      }}
                      slotProps={{ input: { "aria-label": "Launch at login" } }}
                    />
                  }
                />
              ) : null}
              {window.platform !== "linux" && settings.launchAtLogin ? (
                <SettingsRow
                  label="Start minimized"
                  description={
                    "Don't open the window when launched at login — bring it up later " +
                    `from the ${isMac ? "menu bar" : "tray"} icon`
                  }
                  control={
                    <Switch
                      checked={settings.startMinimized}
                      onChange={(event) => {
                        handleUpdateSetting({ startMinimized: event.target.checked });
                      }}
                      slotProps={{ input: { "aria-label": "Start minimized" } }}
                    />
                  }
                />
              ) : null}
              <SettingsRow
                label="Automatically check for updates"
                control={
                  <Switch
                    checked={settings.autoUpdateEnabled}
                    onChange={(event) => {
                      handleUpdateSetting({ autoUpdateEnabled: event.target.checked });
                    }}
                    slotProps={{ input: { "aria-label": "Automatically check for updates" } }}
                  />
                }
              />
              <SettingsRow
                label="Check for updates"
                description={updateStatusText}
                control={
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleCheckForUpdatesNow}
                    disabled={isCheckingForUpdate}
                  >
                    {isCheckingForUpdate ? "Checking…" : "Check for updates now"}
                  </Button>
                }
              />
              <SettingsRow
                label="Version"
                control={
                  <Typography variant="body2" color="text.secondary">
                    {appVersion ?? "…"}
                  </Typography>
                }
              />
              <SettingsRow
                label="Reset to defaults"
                description="Restores every setting above to its original value. Doesn't affect your logged-in accounts."
                control={
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      setResetDialogOpen(true);
                    }}
                  >
                    Reset to defaults
                  </Button>
                }
              />
            </SettingsSectionCard>
          ) : null}

          {windowVisible ? (
            <SettingsSectionCard
              icon={<AspectRatioIcon fontSize="small" />}
              title="Window"
              description="Locks resizing to a ratio — takes effect immediately, no restart needed"
            >
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Aspect ratio
              </Typography>
              <RadioGroup
                row
                value={settings.aspectRatio}
                onChange={(event) => {
                  handleUpdateSetting({ aspectRatio: event.target.value as AspectRatioOption });
                }}
              >
                {ASPECT_RATIO_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio size="small" />}
                    label={option.label}
                    sx={{ mr: 2 }}
                  />
                ))}
              </RadioGroup>
            </SettingsSectionCard>
          ) : null}

          {notificationsVisible ? (
            <SettingsSectionCard icon={<NotificationsIcon fontSize="small" />} title="Notifications">
              <SettingsRow
                label="Notify when a track is scrobbled"
                description="Shows a native notification each time a batch of scrobbles is accepted by Last.fm"
                control={
                  <Switch
                    checked={settings.notifyOnScrobble}
                    onChange={(event) => {
                      handleUpdateSetting({ notifyOnScrobble: event.target.checked });
                    }}
                    slotProps={{ input: { "aria-label": "Notify when a track is scrobbled" } }}
                  />
                }
              />
              <SettingsRow
                label="Notify when scrobbling fails"
                description="Shows a native notification if Last.fm can't be reached after several attempts"
                control={
                  <Switch
                    checked={settings.notifyOnScrobbleFailure}
                    onChange={(event) => {
                      handleUpdateSetting({ notifyOnScrobbleFailure: event.target.checked });
                    }}
                    slotProps={{ input: { "aria-label": "Notify when scrobbling fails" } }}
                  />
                }
              />
            </SettingsSectionCard>
          ) : null}

          {filterVisible ? (
            <SettingsSectionCard
              icon={<FilterAltIcon fontSize="small" />}
              title="Filter"
              description="Matching tracks are excluded from now-playing and scrobbling entirely — takes effect on next restart"
              fullWidth
            >
              <SettingsRow
                label="Skip long non-music videos"
                description={
                  "For browser tabs (YouTube, etc.) longer than 15 minutes — long-form video " +
                  "content, not a single song. Best-effort: this app can't actually tell a " +
                  "YouTube video from a YouTube Music track apart (they expose identical " +
                  "metadata), so this works by duration and source instead, which means it " +
                  "can occasionally skip a deliberately long track too."
                }
                control={
                  <Switch
                    checked={settings.skipNonMusicVideos}
                    onChange={(event) => {
                      handleUpdateSetting({ skipNonMusicVideos: event.target.checked });
                    }}
                    slotProps={{ input: { "aria-label": "Skip long non-music videos" } }}
                  />
                }
              />
              <TextField
                label="Filter expression"
                placeholder='e.g. sourceApp == "firefox" or sourceApp == "chrome"'
                value={filterExpressionInput}
                onChange={(event) => {
                  setFilterExpressionInput(event.target.value);
                  setFilterValidationError(undefined);
                }}
                onBlur={handleFilterExpressionBlur}
                size="small"
                fullWidth
                multiline
                minRows={2}
                autoComplete="off"
                error={Boolean(filterValidationError)}
                helperText={
                  filterValidationError ??
                  'Fields: artist, title, album, albumArtist, durationSec, sourceApp. Operators: ==, !=, ' +
                    'contains "text", matches /regex/, <, >, <=, >=. Combine with and / or / not. Leave ' +
                    "empty for no filtering."
                }
                sx={{
                  maxWidth: 640,
                  "& textarea": {
                    fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace',
                    fontSize: "0.875rem",
                  },
                }}
              />
              <Box sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSaveFilterExpression}
                  disabled={Boolean(filterValidationError)}
                >
                  Save filter
                </Button>
              </Box>
            </SettingsSectionCard>
          ) : null}

          {accountsVisible ? (
            <SettingsSectionCard icon={<AccountCircleIcon fontSize="small" />} title="Accounts" fullWidth>
              {isConfigured === undefined ? (
                <CircularProgress size={24} />
              ) : (
                <>
                  {error ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  ) : null}

                  {isConfigured ? (
                    <>
                      {accounts.length > 0 ? (
                        <Box sx={{ mb: 2 }}>
                          {accounts.map((username) => (
                            <SettingsRow
                              key={username}
                              label={username}
                              description={username === activeAccount ? "Active account" : undefined}
                              leading={
                                <Avatar
                                  src={avatarsByUsername[username]}
                                  alt={username}
                                  sx={{
                                    width: 48,
                                    height: 48,
                                    bgcolor: "action.selected",
                                    color: "text.secondary",
                                  }}
                                >
                                  {username.slice(0, 1).toUpperCase()}
                                </Avatar>
                              }
                              control={
                                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                  <Radio
                                    size="small"
                                    checked={username === activeAccount}
                                    onChange={() => {
                                      handleSetActiveAccount(username);
                                    }}
                                    name="active-account"
                                    slotProps={{
                                      input: { "aria-label": `Use ${username} as the active account` },
                                    }}
                                  />
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="inherit"
                                    onClick={() => {
                                      handleLogout(username);
                                    }}
                                  >
                                    Log out
                                  </Button>
                                </Stack>
                              }
                            />
                          ))}
                        </Box>
                      ) : (
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                          No Last.fm account connected yet.
                        </Typography>
                      )}

                      <Button variant="contained" onClick={handleLogin} disabled={isLoggingIn} sx={{ mt: 1 }}>
                        {isLoggingIn ? "Waiting for approval on Last.fm…" : "Log in with Last.fm"}
                      </Button>
                      {isLoggingIn ? (
                        // Last.fm's own desktop-auth flow has no way to redirect the browser
                        // back to this app automatically once you click "Allow Access" —
                        // their docs say the user is expected to close the browser and return
                        // here manually. This app *does* try to bring itself to the front and
                        // fire a notification when that happens (best-effort — the OS doesn't
                        // guarantee a background app can steal focus), but the one thing
                        // that's always true is what this line says: come back here yourself
                        // once you've approved it, and it'll already be showing you logged in.
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 480 }}>
                          Click "Allow Access" on the Last.fm page that just opened, then come back to
                          this window — we'll try to bring it to the front automatically, but if it
                          doesn't, your profile will already be here waiting for you.
                        </Typography>
                      ) : null}

                      {credentialsSource === "user-supplied" ? (
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          sx={{ mt: 1, display: "block" }}
                          onClick={handleClearAppCredentials}
                        >
                          Remove saved API key
                        </Button>
                      ) : null}
                    </>
                  ) : (
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Logging in needs a Last.fm API key first — either baked into the build
                      you're running, or your own free one below.
                    </Alert>
                  )}
                </>
              )}
            </SettingsSectionCard>
          ) : null}

          {additionalServicesVisible ? (
            <SettingsSectionCard
              icon={<HubIcon fontSize="small" />}
              title="Additional services"
              description="Scrobbles and now-playing updates go to every connected service at once, alongside Last.fm."
              fullWidth
            >
              {/* Libre.fm — same browser-authorization flow as Last.fm. Three states:
                  connected (Disconnect row); credentials already available, baked
                  into this build via LIBREFM_API_KEY/LIBREFM_API_SECRET or
                  previously saved (a single "Log in" button, no key entry — this is
                  the "instead of asking for the API key" path); or nothing
                  configured yet (the bring-your-own-key form, where "Connect"
                  chains saveCredentials + login into one click — see
                  handleLibrefmConnect). */}
              {librefmActiveAccount ? (
                <SettingsRow
                  label="Libre.fm"
                  description={`Connected as ${librefmActiveAccount}`}
                  control={
                    <Button size="small" variant="outlined" color="inherit" onClick={handleLibrefmLogout}>
                      Disconnect
                    </Button>
                  }
                />
              ) : librefmIsConfigured ? (
                // A compact label + button-row control — the exact shape
                // `SettingsRow` (see line ~987's "already connected" branch above, and
                // the account rows above that) exists for, unlike the bring-your-own-
                // key form just below, which stays its own free-form `Box` (see that
                // branch's own comment for why).
                <SettingsRow
                  label="Libre.fm"
                  control={
                    // `flexWrap` for the same reason as SettingsRow's own outer
                    // container (see its comment): "Waiting for approval on Libre.fm…"
                    // plus a second "Remove saved key" button can combine to just about
                    // the width of a settings card at this app's narrowest window size
                    // — safe to wrap onto two lines rather than risk overflowing.
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleLibrefmLoginOnly}
                        disabled={librefmIsLoggingIn}
                      >
                        {librefmIsLoggingIn ? "Waiting for approval on Libre.fm…" : "Log in with Libre.fm"}
                      </Button>
                      {librefmCredentialsSource === "user-supplied" ? (
                        <Button
                          size="small"
                          variant="outlined"
                          color="inherit"
                          onClick={handleLibrefmClearCredentials}
                        >
                          Remove saved key
                        </Button>
                      ) : null}
                    </Stack>
                  }
                />
              ) : (
                // Deliberately not a `SettingsRow` like the two branches above/below
                // it: this is a two-field form plus a submit button, not a single
                // compact control — squeezed into `SettingsRow`'s label-left/
                // control-right row it would either overflow narrow widths or read as
                // oddly cramped next to a one-word "Libre.fm" label. Keeps its own
                // vertical layout, but a real `Divider` (matching every other section
                // boundary on this page) instead of a manually-styled `borderBottom`.
                <Box sx={{ py: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    Libre.fm
                  </Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ maxWidth: 560, mb: 1 }}>
                    <TextField
                      // Deliberately not "Libre.fm API key" — SettingsPage.test.tsx's
                      // existing Last.fm API-key tests query via a bare
                      // /api key/i-style regex, which would otherwise ambiguously
                      // match both this field and Last.fm's own (see this section's
                      // sibling card below). "Key"/"Secret" alone stay unambiguous
                      // while the adjacent "Libre.fm" heading above still makes it
                      // clear what they're for.
                      label="Key"
                      value={librefmApiKey}
                      onChange={(event) => {
                        setLibrefmApiKey(event.target.value);
                      }}
                      size="small"
                      fullWidth
                      autoComplete="off"
                    />
                    <TextField
                      label="Secret"
                      type="password"
                      value={librefmApiSecret}
                      onChange={(event) => {
                        setLibrefmApiSecret(event.target.value);
                      }}
                      size="small"
                      fullWidth
                      autoComplete="off"
                    />
                  </Stack>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleLibrefmConnect}
                    disabled={
                      librefmIsLoggingIn ||
                      librefmIsSavingCredentials ||
                      !librefmApiKey.trim() ||
                      !librefmApiSecret.trim()
                    }
                  >
                    {librefmIsLoggingIn
                      ? "Waiting for approval on Libre.fm…"
                      : librefmIsSavingCredentials
                        ? "Saving…"
                        : "Connect to Libre.fm"}
                  </Button>
                  <Divider sx={{ mt: 1.25 }} />
                </Box>
              )}

              {/* ListenBrainz — genuinely has no browser-authorization/OAuth flow for
                  third-party listen submission (verified against its own API docs
                  and source: only a manually-copied per-account token is supported —
                  see `ListenBrainzApi`'s docstring in packages/core), so a token
                  paste is unavoidable here, unlike Libre.fm/Last.fm above. The link
                  below at least opens the exact page the token lives on, so there's
                  nothing to hunt for. */}
              {listenBrainzActiveAccount ? (
                <SettingsRow
                  label="ListenBrainz"
                  description={`Connected as ${listenBrainzActiveAccount}`}
                  control={
                    <Button size="small" variant="outlined" color="inherit" onClick={handleListenBrainzDisconnect}>
                      Disconnect
                    </Button>
                  }
                />
              ) : (
                <Box sx={{ py: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    ListenBrainz
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    ListenBrainz has no "log in" step to offer here — just{" "}
                    <Link
                      href="https://listenbrainz.org/settings/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      open your ListenBrainz token
                    </Link>{" "}
                    and paste it below.
                  </Typography>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ maxWidth: 560 }}>
                    <TextField
                      label="User token"
                      type="password"
                      value={listenBrainzToken}
                      onChange={(event) => {
                        setListenBrainzToken(event.target.value);
                      }}
                      size="small"
                      fullWidth
                      autoComplete="off"
                    />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleListenBrainzConnect}
                      disabled={listenBrainzIsConnecting || !listenBrainzToken.trim()}
                      sx={{ flexShrink: 0, alignSelf: { xs: "flex-start", md: "center" } }}
                    >
                      {listenBrainzIsConnecting ? "Connecting…" : "Connect"}
                    </Button>
                  </Stack>
                </Box>
              )}
            </SettingsSectionCard>
          ) : null}

          {isConfigured !== undefined && apiKeyVisible ? (
            <SettingsSectionCard icon={<VpnKeyIcon fontSize="small" />} title="Last.fm API key" fullWidth>
              <Box component="form" onSubmit={handleSaveCredentials}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Don't have one?{" "}
                  <Link href={CREATE_API_ACCOUNT_URL} target="_blank" rel="noreferrer">
                    Get your free Last.fm API key
                  </Link>
                  , then paste it and its shared secret below.
                </Typography>
                {/* `md`, not `sm` — same sidebar-width reasoning as the page header
                    Stack above. */}
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ maxWidth: 560 }}>
                  <TextField
                    label="API key"
                    value={apiKey}
                    onChange={(event) => {
                      setApiKey(event.target.value);
                    }}
                    size="small"
                    fullWidth
                    autoComplete="off"
                  />
                  <TextField
                    label="Shared secret"
                    type="password"
                    value={apiSecret}
                    onChange={(event) => {
                      setApiSecret(event.target.value);
                    }}
                    size="small"
                    fullWidth
                    autoComplete="off"
                  />
                </Stack>
                <Box sx={{ mt: 1.5, mb: 1 }}>
                  <Button
                    type="submit"
                    variant="outlined"
                    disabled={isSavingCredentials || !apiKey.trim() || !apiSecret.trim()}
                  >
                    {isSavingCredentials ? "Saving…" : "Save API key"}
                  </Button>
                </Box>
              </Box>
            </SettingsSectionCard>
          ) : null}
        </Box>
      )}
      <ConfirmDialog
        open={resetDialogOpen}
        title="Reset to defaults?"
        description="This restores every setting above to its original value. It doesn't affect your logged-in accounts."
        confirmLabel="Reset to defaults"
        confirming={resetting}
        onConfirm={handleResetToDefaults}
        onCancel={() => {
          setResetDialogOpen(false);
        }}
      />
    </Box>
  );
}
