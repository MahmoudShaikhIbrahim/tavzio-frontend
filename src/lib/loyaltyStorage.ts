const PHONE_KEY_PREFIX = 'tavzio_phone_';

// A customer's phone number, remembered per-business, in this browser
// only - the mechanism behind "recognized device" auto-checkin and
// auto-filling Pay Bill's loyalty credit.
//
// Real bug fix (confirmed by direct report: a business renaming itself
// silently orphaned every returning customer's saved number overnight,
// including staff's own testing). This used to be keyed by the URL
// slug directly - which is exactly what changes the moment a business
// renames (see businessController.js's own slug-follows-name fix) -
// so a customer who'd already verified once would suddenly be asked
// again, with no way to tell they'd ever been here before. Keyed by
// the business's own database id now, which never changes regardless
// of how many times the business renames itself - this class of bug
// structurally can't recur.
export function getSavedPhone(businessId: string): string | null {
  return localStorage.getItem(PHONE_KEY_PREFIX + businessId);
}

export function setSavedPhone(businessId: string, phone: string) {
  localStorage.setItem(PHONE_KEY_PREFIX + businessId, phone);
}
