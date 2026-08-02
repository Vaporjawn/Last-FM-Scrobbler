import type { JSX } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Radio from "@mui/material/Radio";
import Typography from "@mui/material/Typography";
import { useAuth } from "../hooks/use-auth.js";

/**
 * Preferences → Accounts. Login is deliberately a single button: `useAuth`'s `login()`
 * drives `packages/core`'s `AuthFlow`, which opens the user's browser to Last.fm's own
 * authorization page and polls silently until they approve access there — no token to
 * copy/paste, no extra screen in this app.
 */
export function PreferencesPage(): JSX.Element {
  const { isConfigured, accounts, activeAccount, isLoggingIn, error, login, logout, setActiveAccount } =
    useAuth();

  return (
    <Box sx={{ p: 3, maxWidth: 480 }}>
      <Typography variant="h5" gutterBottom>
        Preferences
      </Typography>
      <Typography variant="subtitle1" sx={{ mt: 2 }}>
        Accounts
      </Typography>
      <Divider sx={{ mb: 2 }} />

      {isConfigured === undefined ? (
        <CircularProgress size={24} />
      ) : !isConfigured ? (
        <Alert severity="warning">
          This build has no Last.fm API credentials configured, so logging in isn't
          available. See docs/modules/desktop.md.
        </Alert>
      ) : (
        <>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {accounts.length > 0 ? (
            <List dense>
              {accounts.map((username) => (
                <ListItem
                  key={username}
                  secondaryAction={
                    <Button size="small" color="inherit" onClick={() => void logout(username)}>
                      Log out
                    </Button>
                  }
                >
                  <Radio
                    checked={username === activeAccount}
                    onChange={() => void setActiveAccount(username)}
                    name="active-account"
                    slotProps={{ input: { "aria-label": `Use ${username} as the active account` } }}
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

          <Button
            variant="contained"
            onClick={() => void login()}
            disabled={isLoggingIn}
            sx={{ mt: 1 }}
          >
            {isLoggingIn ? "Waiting for approval on Last.fm…" : "Log in with Last.fm"}
          </Button>
        </>
      )}
    </Box>
  );
}
