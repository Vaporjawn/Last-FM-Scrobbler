import type { JSX, ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export interface PageHeaderProps {
  readonly title: string;
  /** Optional context line under the title — e.g. "Showing recent activity for
   * {username}" or a count once one is known. Omitted entirely (not rendered as an
   * empty line) when there's nothing meaningful to say yet, rather than reserving
   * space for it up front. */
  readonly subtitle?: ReactNode;
}

/**
 * The page-title scaffold every page in this app used to repeat independently
 * (`<Box sx={{ p: 3 }}><Typography variant="h5" gutterBottom>{Name}</Typography>`,
 * copy-pasted five times with no shared component). Centralizing it here means every
 * page's title has identical spacing, and gains an optional secondary context line
 * for free. Deliberately doesn't include the page-level `p: 3` padding wrapper —
 * that stays on each page's own outer `Box`, since this is a title-block component,
 * not a page-layout one.
 */
export function PageHeader({ title, subtitle }: PageHeaderProps): JSX.Element {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h5" gutterBottom={Boolean(subtitle)}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  );
}
