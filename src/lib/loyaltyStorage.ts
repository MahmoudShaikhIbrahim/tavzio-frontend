const PHONE_KEY_PREFIX = 'tavzio_phone_';

// A customer's phone number, remembered per-business, in this browser
// only - the mechanism behind "recognized device" auto-checkin and
// auto-filling Pay Bill's loyalty credit. Previously this exact constant
// was defined independently in both LoyaltyWidget.tsx and BillPage.tsx -
// same value in both, so nothing was broken, but a real risk that they'd
// silently drift apart if only one was ever edited later. One source of
// truth now.
export function getSavedPhone(slug: string): string | null {
  return localStorage.getItem(PHONE_KEY_PREFIX + slug);
}

export function setSavedPhone(slug: string, phone: string) {
  localStorage.setItem(PHONE_KEY_PREFIX + slug, phone);
}
