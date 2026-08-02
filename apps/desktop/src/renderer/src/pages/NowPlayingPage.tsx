import type { JSX } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { useNowPlaying } from "../hooks/use-now-playing.js";

const STATE_LABEL = { playing: "Playing", paused: "Paused", stopped: "Stopped" } as const;

export function NowPlayingPage(): JSX.Element {
  const { track, state } = useNowPlaying();

  if (!track) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Now Playing
        </Typography>
        <Typography color="text.secondary">Nothing is playing right now.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Now Playing
      </Typography>
      <Typography variant="h6">{track.title}</Typography>
      <Typography color="text.secondary">{track.artist}</Typography>
      {track.album ? <Typography color="text.secondary">{track.album}</Typography> : null}
      <Chip label={STATE_LABEL[state]} size="small" sx={{ mt: 1.5 }} />
    </Box>
  );
}
