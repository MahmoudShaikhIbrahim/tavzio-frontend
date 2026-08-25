const KEY = 'tavzio_last_dashboard_path';

// Real fix for a confirmed bug: the dashboard's index route used to
// hardcode a redirect straight to 'orders' - which also happens to be
// one of the pages that auto-enters focus mode, so every fresh login
// landed the person in full-page Orders with zero chrome, with no
// action on their part that would explain why. Remembering the actual
// last page visited (persisted across sign-outs, browser closes, the
// works) and returning there instead is the real fix, not just picking
// a different hardcoded default.
export function saveLastDashboardPath(path: string) {
  try {
    localStorage.setItem(KEY, path);
  } catch {
    // Private browsing / storage disabled - never worth breaking
    // navigation over, this is a nice-to-have, not a requirement.
  }
}

export function getLastDashboardPath(): string {
  try {
    return localStorage.getItem(KEY) || 'orders';
  } catch {
    return 'orders';
  }
}
