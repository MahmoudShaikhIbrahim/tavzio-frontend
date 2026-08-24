// The sections an owner can restrict a staff account to. Keys match the
// `path` values used in DashboardLayout's TABS array exactly - this is
// deliberately just the primary working tabs (not every settings
// sub-page), since those map onto real job functions (a waiter needs
// Orders + Tables, a kitchen hand needs Kitchen, a front-desk agent
// needs Front Desk, etc.) the way "sections" reads in everyday use.
//
// `scope` mirrors DashboardLayout's own tabAllowed() classification for
// these same paths exactly - 'hotel' (front-desk, housekeeping) and
// 'restaurant' (tables) are real, mutually-exclusive business categories,
// not different tiers of the same list, so a restaurant owner assigning
// sections was seeing hotel-only job functions with no way to tell they'd
// never apply (and vice versa for a hotel). null = offered to both, same
// as tabAllowed's own shared/no-`requires` tabs.
export interface SectionOption {
  key: string;
  label: string;
  scope: 'hotel' | 'restaurant' | null;
}

export const SECTION_OPTIONS: SectionOption[] = [
  { key: 'orders', label: 'Orders', scope: null },
  { key: 'kitchen', label: 'Kitchen', scope: null },
  { key: 'pos', label: 'POS Terminal', scope: null },
  { key: 'tables', label: 'Tables', scope: 'restaurant' },
  { key: 'front-desk', label: 'Front Desk', scope: 'hotel' },
  { key: 'housekeeping', label: 'Housekeeping', scope: 'hotel' },
  { key: 'payments', label: 'Payments', scope: null },
  { key: 'inventory', label: 'Inventory', scope: null },
  { key: 'reconciliation', label: 'Bank Reconciliation', scope: null },
];

// The actual fix: filters the list above down to what applies to THIS
// business, given its category - a restaurant never sees Front Desk/
// Housekeeping as an assignable section, a hotel never sees Tables.
// Call this everywhere SECTION_OPTIONS was being used directly (the
// invite form's checkbox grid, the per-staff SectionAssignmentForm) -
// the raw export stays available for anything that genuinely needs
// every key regardless of business type (e.g. validating a stored
// assigned_sections value against the full universe of keys).
export function sectionOptionsFor(isHotel: boolean): SectionOption[] {
  return SECTION_OPTIONS.filter((o) => o.scope === null || (o.scope === 'hotel') === isHotel);
}

