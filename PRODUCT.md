# Tavzio

NFC-powered hospitality/restaurant SaaS platform. Restaurants and hotels
issue NFC tap cards to customers; tapping opens a business's public
digital card/menu/booking experience. Staff run day-to-day operations
(orders, kitchen, POS, inventory, bookings, payroll) through a role-gated
dashboard. Multi-location groups are supported via self-service and
super-admin-managed organizations sharing menu/suppliers/reporting.

## Surfaces and register

Per-surface register (brand.md vs product.md) for `impeccable`:

- **brand** (design IS the product - marketing/conversion surfaces):
  - `Home.tsx` - main marketing homepage (tavzio.ae)
  - `LandingPage.tsx` (`/:slug`) - a business's public NFC-tap landing page
  - `BookingPage.tsx` - public online booking flow
  - `HotelGuestPortalPage.tsx` - guest-facing hotel portal
  - `BillPage.tsx`, `DemoPage.tsx` - other public-facing surfaces

- **product** (design SERVES the product - internal tools):
  - `pages/dashboard/*` - business owner/staff dashboard (Orders, Kitchen,
    POS, Staff, Inventory, Payroll, Accounting, Bookings, ...)
  - `pages/superadmin/*` - Tavzio's own internal admin (Organizations,
    Businesses, Contracts, ...)

## Existing identity (do not reinvent)

Real, deliberate tokens already exist in `tailwind.config.js` +
`src/index.css` - warm brass/ink/ivory palette, theme-aware (light/dark
via CSS variables, not fixed hex), Fraunces (display serif) + IBM Plex
Sans (body) + IBM Plex Mono. A custom `tap-ripple` animation already uses
a considered cubic-bezier easing curve, not a default. This is an
identity worth preserving and extending, not replacing - see DESIGN.md
for the extracted values.

## Users

- **Customers** - tap an NFC card or scan a QR, land on a business's
  public page, browse menu, order, book, pay. No account required for
  most flows.
- **Staff** - role-gated dashboard access (Orders/Kitchen/POS/Tables,
  scoped by assigned sections). Often on a shared device (POS terminal,
  kitchen display) or their own phone.
- **Business owners** - full dashboard access, Staff/Team management,
  billing, settings, reporting. Frequently on desktop during setup,
  mobile day-to-day.
- **Org owners** - cross-location management (shared menu, suppliers,
  consolidated reporting) for multi-location groups.
- **Super admin (Tavzio's own team)** - platform-wide admin: businesses,
  contracts, organizations, platform health.
