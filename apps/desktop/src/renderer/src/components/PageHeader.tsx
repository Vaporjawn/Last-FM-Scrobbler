import type { JSX, ReactNode } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

export interface PageHeaderProps {
  readonly title: string;
  /** Optional context line — e.g. "Showing recent activity for {username}" or a
   * count once one is known. Omitted entirely (not rendered as an empty line) when
   * there's nothing meaningful to say yet, rather than reserving space for it up
   * front. Stacked under the title by default; pass `inlineSubtitle` for a short,
   * label-like value (a count, a status word) that reads better sitting right next
   * to the title than on its own line — see that prop's docstring. */
  readonly subtitle?: ReactNode;
  /** Renders `subtitle` on the same line as `title` instead of on its own line
   * below it — for a short value (e.g. FriendsPage's "50 friends") where a whole
   * extra line is more vertical space than the content needs. Leave unset (the
   * default, stacked layout) for a full sentence — inline reads badly once the
   * subtitle is long enough to wrap or crowd the title. */
  readonly inlineSubtitle?: boolean;
  /** Rendered at the header's trailing edge, vertically centered against the title
   * line — e.g. a `RefreshButton`. Omitted entirely (no layout change at all, same
   * markup as before this prop existed) when not given, so every page that doesn't
   * need a header action keeps its exact current look. */
  readonly action?: ReactNode;
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
export function PageHeader({ title, subtitle, inlineSubtitle, action }: PageHeaderProps): JSX.Element {
  const titleBlock =
    subtitle && inlineSubtitle ? (
      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline" }}>
        <Typography variant="h5">{title}</Typography>
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      </Stack>
    ) : (
      <>
        <Typography variant="h5" gutterBottom={Boolean(subtitle)}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </>
    );

  if (!action) {
    return <Box sx={{ mb: 3 }}>{titleBlock}</Box>;
  }

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 3, alignItems: "center", justifyContent: "space-between" }}>
      {/* `minWidth: 0` — this sits next to `action` (a `RefreshButton` on most
          callers, which has a fixed intrinsic size and won't shrink) in a flex row;
          without it, a long single-word title (e.g. ProfilePage's own `title`, a
          friend's raw username with no spaces to wrap at) sets this box's minimum
          width to that unbreakable word's full rendered width, which can exceed the
          available space at this app's narrower window sizes instead of the title
          Typography's own wrapping taking over. */}
      <Box sx={{ minWidth: 0 }}>{titleBlock}</Box>
      {action}
    </Stack>
  );
}
