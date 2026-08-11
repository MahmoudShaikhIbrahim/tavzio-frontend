// The sections an owner can restrict a staff account to. Keys match the
// `path` values used in DashboardLayout's TABS array exactly - this is
// deliberately just the primary working tabs (not every settings
// sub-page), since those map onto real job functions (a waiter needs
// Orders + Tables, a kitchen hand needs Kitchen, a front-desk agent
// needs Front Desk, etc.) the way "sections" reads in everyday use.
export interface SectionOption {
  key: string;
  label: string;
}

export const SECTION_OPTIONS: SectionOption[] = [
  { key: 'orders', label: 'Orders' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'pos', label: 'POS Terminal' },
  { key: 'tables', label: 'Tables' },
  { key: 'front-desk', label: 'Front Desk' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'payments', label: 'Payments' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'reconciliation', label: 'Bank Reconciliation' },
];
