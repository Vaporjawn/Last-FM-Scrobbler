/** Whether rectangle `a` overlaps rectangle `b` at all (touching edges don't count —
 * matches the everyday sense of "is any part of this actually visible on that
 * screen"). Used below to decide whether a restored window position is still usable. */
export function rectanglesIntersect(
  a: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  b: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
