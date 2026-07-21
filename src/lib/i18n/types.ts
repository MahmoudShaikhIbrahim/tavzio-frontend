export type LanguageCode = 'en' | 'ar' | 'ru' | 'es' | 'hi' | 'ur' | 'tl' | 'zh' | 'fr';

export interface LanguageMeta {
  code: LanguageCode;
  label: string;
  flag: string;
  rtl: boolean;
}

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', label: 'English', flag: '🇬🇧', rtl: false },
  { code: 'ar', label: 'العربية', flag: '🇦🇪', rtl: true },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', rtl: false },
  { code: 'es', label: 'Español', flag: '🇪🇸', rtl: false },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳', rtl: false },
  { code: 'ur', label: 'اردو', flag: '🇵🇰', rtl: true },
  { code: 'tl', label: 'Filipino', flag: '🇵🇭', rtl: false },
  { code: 'zh', label: '中文', flag: '🇨🇳', rtl: false },
  { code: 'fr', label: 'Français', flag: '🇫🇷', rtl: false },
];

// Every key that appears anywhere in the 5 customer-facing surfaces
// (landing page, menu, loyalty, booking, bill/pay). Deliberately NOT
// included: menu item names/descriptions/notes (owner-typed content,
// never auto-translated) and the digital receipt (English only, by
// explicit decision).
export interface TranslationDict {
  poweredBy: string;

  // Primary action buttons (landing page)
  orderNow: string;
  bookAppointment: string;
  payBill: string;
  callWaiter: string;
  requestBill: string;
  sending: string;
  staffNotified: string;
  tapAgainToTry: string;

  // Loyalty widget
  loyalty: string;
  loyaltyStartPrompt: string;
  loyaltyCheckPrompt: string;
  phoneNumber: string;
  checking: string;
  startEarning: string;
  checkStatus: string;
  rewardUnlocked: string;
  showToStaff: string;
  alreadyCountedToday: string;
  visitsProgress: string; // "{filled}/{required} visits"
  pointsProgress: string; // "{points}/{threshold} points"
  noTierYet: string;
  moreVisitsTo: string; // "{n} more visits to {tier}"
  claimReward: string;
  claiming: string;
  rewardClaimed: string;
  yourReward: string;

  // Menu
  menu: string;
  menuNotAvailable: string;
  unavailable: string;
  menuNotAvailableDesc: string;
  orderSent: string;
  orderSentDesc: string;
  backTo: string; // "Back to {slug}"
  orderingNeedsFreshTap: string;
  orderingNeedsFreshTapDesc: string;
  addonsAvailable: string;
  addons: string;
  orderNoteePlaceholder: string;
  sendOrder: string; // "Send order — {total}"
  itemNotePlaceholder: string;
  addToOrder: string;
  saveChanges: string;
  nothingToPayHeading: string;
  nothingToPayDesc: string;

  // Booking
  bookingNotAvailable: string;
  bookingNotAvailableDesc: string;
  bookingNeedsFreshTap: string;
  bookingNeedsFreshTapDesc: string;
  requestSent: string;
  requestSentDesc: string;
  noServicesYet: string;
  minutesAbbrev: string;
  back: string;
  phoneForConfirm: string;
  noteOptionalPlaceholder: string;
  requestThisTime: string;
  bookingDisclaimer: string;

  // Pay Bill
  payBillNotAvailable: string;
  payBillNotAvailableDesc: string;
  payBillNeedsFreshTap: string;
  payBillNeedsFreshTapDesc: string;
  payBillInstructions: string;
  addTip: string;
  noTip: string;
  selectedItems: string;
  fullBill: string;
  tip: string;
  processing: string;
  payAmount: string; // "Pay {total} AED"
  paymentSuccessful: string;
}
