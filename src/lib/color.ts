// Real, safe conversion for a custom request color - validates the hex
// so a malformed value (a stray manual edit, an old bad save) can never
// produce broken inline CSS, and is meant to be applied only via inline
// style on the one element it belongs to. Never touches a shared class
// or CSS variable, so a bad color choice can only ever affect its own
// element, never anything else in the app.
export function hexToRgba(hex: string, alpha: number): string | null {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
