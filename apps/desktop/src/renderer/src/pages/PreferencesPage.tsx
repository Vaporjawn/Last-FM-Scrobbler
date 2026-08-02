import type { JSX, SubmitEvent } from "react";
import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Radio from "@mui/material/Radio";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "../contexts/snackbar-context.js";
import { useAuth } from "../hooks/use-auth.js";
import { useSettings } from "../hooks/use-settings.js";
import { useUpdates } from "../hooks/use-updates.js";
import type { PageProps } from "./page-props.js";
import type { UpdateStatus } from "../../../shared/update-status.js";

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

/** Human-readable summary of `UpdateStatus` for the Preferences "Updates" section —
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

/**
 * Preferences → General + Accounts. Login is deliberately a single button: `useAuth`'s
 * `login()` drives `packages/core`'s `AuthFlow`, which opens the user's browser to
 * Last.fm's own authorization page and polls silently until they approve access there
 * — no token to copy/paste, no extra screen in this app.
 *
 * Login needs *some* Last.fm API key/secret pair to exist first, though. This build
 * either has one baked in (`credentialsSource === "environment"`, configured by
 * whoever built it via LASTFM_API_KEY/LASTFM_API_SECRET — not user-editable here), or
 * the end user supplies their own below ("bring your own key") — both paths unlock the
 * exact same login flow above once a key is in place.
 */
export function PreferencesPage({ onNavigateToProfile }: PageProps): JSX.Element {
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
  const { settings, updateSettings } = useSettings();
  const { status: updateStatus, isChecking: isCheckingForUpdate, checkNow: checkForUpdatesNow } =
    useUpdates();
  const { notify } = useSnackbar();

  // `window.platform` is absent outside a real Electron renderer (e.g. component
  // tests) — default to the more common "tray" phrasing in that case.
  const isMac = window.platform === "darwin";
  const updateStatusText = describeUpdateStatus(updateStatus);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");

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

  const handleUpdateSetting = (patch: Parameters<typeof updateSettings>[0]): void => {
    void updateSettings(patch).then((result) => {
      if (!result.success) {
        notify({ message: result.error, severity: "error" });
      }
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

  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" gutterBottom>
        Preferences
      </Typography>

      <Typography variant="subtitle1" sx={{ mt: 2 }}>
        General
      </Typography>
      <Divider sx={{ mb: 2 }} />

      <FormControlLabel
        control={
          <Switch
            checked={settings.closeToTray}
            onChange={(event) => { handleUpdateSetting({ closeToTray: event.target.checked }); }}
          />
        }
        label={
          isMac
            ? "Keep running in the menu bar when the window is closed"
            : "Keep running in the tray when the window is closed"
        }
      />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        Last.fm Scrobbler is a background app — playback tracking and scrobbling only
        happen while it's running. This keeps it running after you close the window;
        quit it from the {isMac ? "menu bar" : "tray"} icon instead.
      </Typography>

      <FormControlLabel
        control={
          <Switch
            checked={settings.autoUpdateEnabled}
            onChange={(event) => { handleUpdateSetting({ autoUpdateEnabled: event.target.checked }); }}
          />
        }
        label="Automatically check for updates"
      />
      <Stack direction="row" spacing={1.5} sx={{ mt: 1, mb: 3, alignItems: "center" }}>
        <Button
          size="small"
          variant="outlined"
          onClick={handleCheckForUpdatesNow}
          disabled={isCheckingForUpdate}
        >
          {isCheckingForUpdate ? "Checking…" : "Check for updates now"}
        </Button>
        {updateStatusText ? (
          <Typography variant="body2" color="text.secondary">
            {updateStatusText}
          </Typography>
        ) : null}
      </Stack>

      <Typography variant="subtitle1">Accounts</Typography>
      <Divider sx={{ mb: 2 }} />

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
                <List dense>
                  {accounts.map((username) => (
                    <ListItem
                      key={username}
                      secondaryAction={
                        <Button
                          size="small"
                          color="inherit"
                          onClick={() => {
                            handleLogout(username);
                          }}
                        >
                          Log out
                        </Button>
                      }
                    >
                      <Radio
                        checked={username === activeAccount}
                        onChange={() => {
                          handleSetActiveAccount(username);
                        }}
                        name="active-account"
                        slotProps={{
                          input: { "aria-label": `Use ${username} as the active account` },
                        }}
                      />
                      <ListItemText primary={username} />
                    </ListItem>
                  ))}
                </List>
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
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 360 }}>
                  Click "Allow Access" on the Last.fm page that just opened, then come back to
                  this window — we'll try to bring it to the front automatically, but if it
                  doesn't, your profile will already be here waiting for you.
                </Typography>
              ) : null}

              {credentialsSource === "user-supplied" ? (
                <Button
                  size="small"
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

          {showKeyForm ? (
            <Box component="form" onSubmit={handleSaveCredentials} sx={{ mt: isConfigured ? 3 : 0 }}>
              <Typography variant="subtitle1">Last.fm API key</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Don't have one?{" "}
                <Link href={CREATE_API_ACCOUNT_URL} target="_blank" rel="noreferrer">
                  Get your free Last.fm API key
                </Link>
                , then paste it and its shared secret below.
              </Typography>
              <Stack spacing={1.5} sx={{ maxWidth: 360 }}>
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
                <Box>
                  <Button
                    type="submit"
                    variant="outlined"
                    disabled={isSavingCredentials || !apiKey.trim() || !apiSecret.trim()}
                  >
                    {isSavingCredentials ? "Saving…" : "Save API key"}
                  </Button>
                </Box>
              </Stack>
            </Box>
          ) : null}
        </>
      )}
    </Box>
  );
}
