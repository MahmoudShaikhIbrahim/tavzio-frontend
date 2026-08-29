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
  rewardClaimedPendingNote: string;
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

  // Hotel guest portal
  hotelWelcome: string; // "Welcome, {name}"
  hotelRoom: string; // "Room {number}"
  hotelFrontDesk: string;
  myRequests: string;
  myBill: string;
  tapToViewDetailsAndPay: string;
  order: string;
  services: string;
  noServicesConfigured: string;
  reception: string;
  feedback: string;
  links: string;
  nothingHereYet: string;
  nothingActiveRightNow: string;
  showCompleted: string; // "Show completed ({count})"
  hideCompleted: string; // "Hide completed ({count})"
  noChargesYet: string;
  subtotalExclVat: string;
  vatLabel: string;
  currentBalance: string;
  payByCard: string;
  startingPayment: string;
  howMany: string;
  anyDetailsOptional: string;
  sendRequest: string;
  requestSentConfirmation: string;
  done: string;
  howCanWeHelp: string;
  typeYourMessage: string;
  send: string;
  cancel: string;
  addNoteOptional: string;
  messageSentConfirmation: string;
  howWasYourStay: string;
  whatWouldYouLikeToTellUs: string;
  contactMeCheckbox: string;
  submitFeedback: string;
  thankYouForFeedback: string;
  statusSubmitted: string;
  statusInProgress: string;
  statusCompleted: string;
  paymentReceivedThankYou: string;
  paymentNotCompletedRetry: string;
  thisPortalNotAvailable: string;
  couldNotStartPayment: string;
  couldNotStartPaymentRetry: string;

  // Online table booking (new flow - distinct from the old service-appointment "booking*" keys above)
  tbNotAvailable: string;
  tbNotAvailableDesc: string;
  tbConfirmingPayment: string;
  tbOnlyTakesAMoment: string;
  tbPaymentFailed: string;
  tbTableNotReserved: string;
  tbTryAgain: string;
  tbRequestSent: string;
  tbWillConfirm: string; // "{business} will confirm your table shortly."
  tbFoodOrderNoted: string;
  tbTapStand: string;
  tbVerifyNumber: string;
  tbCodeSentTo: string; // "We sent a 6-digit code to {phone}."
  tbEnterCode: string;
  tbConfirming: string;
  tbConfirmBooking: string;
  tbResendCode: string;
  tbBookATable: string;
  tbYourName: string;
  tbDate: string;
  tbTime: string;
  tbSelectDate: string;
  tbClosedThatDay: string;
  tbSelectTime: string;
  tbGuests: string;
  menuSearchPlaceholder: string;
  menuNoSearchResults: string;
  tbSpecialRequests: string;
  tbPreOrderFood: string;
  tbPreOrderFoodDesc: string;
  tbAdd: string;
  tbOtherItems: string;
  tbNoMenuResults: string;
  tbYourOrder: string;
  tbRemove: string;
  tbInCart: string;
  tbCancel: string;
  tbItemNotePlaceholder: string;
  tbAddToOrder: string;
  tbTotal: string;
  tbWhenReady: string;
  tbReadyOnArrival: string;
  tbReady5: string;
  tbReady10: string;
  tbReady15: string;
  tbFullPaymentRequired: string;
  tbPercentDownPayment: string; // "A {percent}% down payment is required to confirm this booking."
  tbFixedDownPayment: string; // "A AED {amount} down payment is required to confirm this booking."
  tbSendingCode: string;
  tbSendVerificationCode: string;
  tbCancelBooking: string;
  tbCancelServiceOnly: string;
  tbCancelling: string;
  tbBookingCancelled: string;
  tbBookingCancelledDesc: string;
  tbManageBooking: string;
  tbManageBookingPrompt: string;
  tbManageBookingLink: string;
  tbYourBookings: string;
  tbNoUpcomingBookings: string;
  tbReschedule: string;
  tbSaveChanges: string;
  tbCancelEdit: string;
  tbStatusConfirmed: string;
  tbStatusPending: string;

  // Chooser page (/:slug/book) and Drive Through ordering - new for the
  // drive-through feature. Deliberately kept separate from the tb*
  // (table booking) keys above since the chooser sits ABOVE both
  // booking and drive-through, not inside either one.
  chChoosePrompt: string;
  chBookTable: string;
  chDriveThrough: string;
  chLocation: string;
  dtHeading: string;
  dtSubtitle: string;
  dtArrivalPrompt: string;
  dtArrivalMinutes: string; // "{minutes} min"
  dtHowToPay: string;
  dtPayNow: string;
  dtPayAtPickup: string;
  dtPlaceOrder: string;
  dtPlacingOrder: string;
  dtOrderConfirmed: string;
  dtOrderConfirmedDesc: string; // "See you in {minutes} minutes."
  dtOrderFailed: string;
  dtOrderFailedDesc: string;
  dtNotAvailable: string;
  dtNotAvailableDesc: string;
}
