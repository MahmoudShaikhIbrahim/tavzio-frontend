# Tavzio Frontend

## Setup

```bash
npm install
npm run dev
```

Requires the backend running locally at `http://localhost:5000`. Vite's
dev server proxies `/api` requests there automatically — no `.env` needed
for local dev of the public pages. For live Realtime updates in the
dashboard, you do need `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set
(see `.env.example`) — same values as the backend's own `.env`.

Opens at `http://localhost:5173`.

## What's here now (complete inventory)

**Public (no login):**
- `/` — minimal placeholder, not a full marketing site (low priority until
  you're selling Tavzio itself rather than running client pages)
- `/:slug` — the landing page, one per business
- `/t/:cardUid` — the tap handler, the actual URL programmed onto NFC chips

**Super admin (you only, real email/password login):**
- `/admin/login`
- `/admin/super/businesses` — list, search
- `/admin/super/businesses/new` — onboarding form (creates owner account +
  business together)
- `/admin/super/businesses/:id` — activate/suspend/delete, issue the
  owner's tap card, invite staff + issue their cards, add customer card
  batches

**Owner/staff dashboard (tap-login only — no password screen):**
- `/admin/dashboard/analytics` — taps-over-time and click-breakdown charts,
  per-card performance, **live updates** via Supabase Realtime (a tap
  literally bumps the counter on screen without a refresh)
- `/admin/dashboard/loyalty` — program setup (all 4 types), member list
  with search, manual adjust, redeem
- `/admin/dashboard/cards` — manage customer-facing cards; view and
  disable (not issue — that's still you) admin cards
- `/admin/dashboard/staff` — owner-only tab; invite/deactivate staff
- `/admin/dashboard/settings` — owner-only tab; business profile and the
  per-button enable/value toggles (the "everything adjustable" feature)

**Device confirmation flow** (dormant — only reachable if
`REQUIRE_DEVICE_CONFIRMATION=true` on the backend, off by default):
- `/admin/check-email`
- `/admin/confirm-device/:pendingId`

## Known gaps, stated plainly rather than glossed over

- **Some minor code duplication**: the super admin pages
  (`CreateBusiness.tsx`) have their own local `Field`/`Section`/`ActionButton`
  helpers, written before `components/ui.tsx` existed. Most dashboard pages
  and `BusinessDetail.tsx` now use the shared version. Not fully
  consolidated yet, but harmless.
- **No marketing homepage** — `/` is intentionally minimal.
- **Requires all 9 backend migrations, in order**: `0001` through `0009` —
  see the backend README for what each one adds.
- **`Home.tsx` has a placeholder WhatsApp number** (`971500000000`) - needs
  to be swapped for the real business number before this goes live, or
  every inquiry from the new landing page goes nowhere.
- **Foodics and Loyverse both have real, honest gaps, not placeholders**:
  Foodics needs real developer credentials to finish one TODO-marked
  request; Loyverse needs each menu item mapped to a Loyverse product
  variant before it can push anything. Square and Zenoti are built against
  confirmed, fully public API docs with no such gap. Fresha has **no**
  confirmed API at all — enabling it will simply fail with a clear message
  until Fresha grants private/partner access. All of this is explained in
  the backend README.
- **No "forgot password" page** — now that website login is a real path
  for some businesses (not just super admin), this is worth adding before
  relying on it. Not built yet.

## Ordering (new)

Only reachable for businesses with `features.ordering.menuView` /
`.submission` (super_admin-granted, not self-service):

- **`/:slug/menu`** — the customer-facing menu/cart/checkout, rendered by
  `PrimaryActionButtons.tsx` on the landing page as an "Order now" button
  when `ordering.menuView` is on. Requires a fresh tap, same rule as
  loyalty check-in.
- **Call Waiter / Request Bill** — also rendered by `PrimaryActionButtons.tsx`,
  gated by their own `ordering.callWaiter` / `ordering.requestBill` flags.
  One tap sends a lightweight request with no items straight to the same
  live Orders screen.
- **Dashboard → Menu tab** — owner/staff manage categories and items.
- **Dashboard → Orders tab** — Tavzio's own live order screen, works for
  every business regardless of POS integration. Updates instantly via
  Realtime.
- **Super admin → Business detail** — every ordering sub-toggle
  individually, plus the POS integration setup (provider, credentials,
  enable/disable) once `ordering.submission` is on.

## Booking (new, parallel structure to ordering)

Same shape, for appointment-based businesses (salons, clinics, gyms):

- **`/:slug/book`** — pick a service, pick a date/time, submit a request.
  Deliberately simple — a *request* staff confirm or decline, not a real
  staff-availability scheduling engine.
- **Dashboard → Services tab** — owner/staff manage bookable services.
- **Dashboard → Bookings tab** — confirm/decline requests, live via Realtime.
- **Super admin → Business detail** — `booking.menuView` / `.submission` /
  `.integration` toggles, plus Zenoth/Fresha/Square integration setup.

## Access methods (new) — card, website, or both

`AdminLogin.tsx` is no longer super_admin-only. Whether an owner/staff
account can use it at all depends entirely on
`features.accessMethods.website` for their business — a
super_admin-only toggle, set on the business detail page. Tap-login is
unaffected either way; `features.accessMethods.card` independently
controls whether a business's admin cards still work at all (so a
business switched to website-only can't have an old card silently keep
working).

## Everything toggleable, from one place

Every feature discussed above — the 7 external link buttons, ordering (5
sub-toggles), booking (3 sub-toggles), loyalty, staff accounts, and
access methods — is now controlled exclusively from
`/admin/super/businesses/:id`, per business. Owners/staff never see an
on/off switch for any of it — only the content underneath whatever's been
turned on (fill in a URL, add menu items, write loyalty rules, etc.). Two
buttons were removed entirely per product decision: **Call** (WhatsApp
covers the same need) and **Special Offers** (now just a menu category,
not a separate button).

## What's new since the last pass

- **Pay Bill / split payments** (`BillPage.tsx`) - itemized bill, pick any
  combination of items (yours, a friend's, whatever), or pay the full
  remaining balance. Tip selector included. **One real, clearly-marked
  gap**: the actual Apple Pay/Google Pay tokenization step needs Tap
  Payments' live JS SDK, which needs a real deployed HTTPS domain to even
  initialize (Apple Pay refuses on localhost) - everything else on this
  page is complete and wired to a real backend.
- **Admin cards removed entirely** - owner/staff sign in via website only
  now (`/admin/login`). Every card-related admin UI is gone from both
  dashboards; customer-facing table cards are completely untouched.
- **Self-service feature toggles** - `FeaturesPage.tsx`, new dashboard tab,
  available to owner AND staff, mirrors what used to be super_admin-only.
- **Notification sounds** - `NotificationsPage.tsx`, 4 independent events,
  each with on/off, a preset dropdown (real synthesized tones via
  `soundPlayer.ts`, no bundled audio files needed), and custom upload.
  Wired into `OrdersPage.tsx`, `BookingsPage.tsx`, and `PaymentsPage.tsx`
  so the right sound actually plays on the right event.
- **Custom button builder** - beyond the fixed 7 links, a genuinely new
  button with its own label/icon/link. Owner, staff, and super_admin all
  have identical access.
- **Card rename + Copy URL**, everywhere cards are managed - no delete
  button anywhere, "Disable" is the only retirement path.
- **Menu item photos** - wired up in `MenuManagementPage.tsx` (upload) and
  shown on the customer-facing `MenuPage.tsx`.
- **CSV/PDF export buttons** on Orders, Bookings, and the new Payments tab.
- **A real marketing landing page at `/`** - previously intentionally
  bare; now a proper page, since customers who see the Tavzio brand at a
  table might want to check out Tavzio for their own business. Still no
  self-serve signup anywhere - the CTA is a WhatsApp link, matching the
  door-to-door sales model.

- **Loyalty auto-checkin on a recognized device.** Previously, a returning
  customer's browser only showed their existing status on a repeat tap —
  it didn't credit the new visit. Now, if a fresh tap happens and this
  browser already has a saved number for the business, the real check-in
  runs automatically and silently (`LoyaltyWidget.tsx`) — no retyping.
- **Loyalty cooldown, owner-configurable.** Added specifically because
  auto-checkin made it necessary — without one, rapid re-tapping could
  farm unlimited credits. Owner picks none/daily/weekly/custom hours per
  program (`LoyaltyPage.tsx`); a tap inside the cooldown window shows
  "Already counted for today" instead of double-crediting. Doesn't apply
  to `spend` (staff-entered, can't be gamed by re-tapping).
- **Read-only menu mode.** If a business has menu viewing on but order
  submission off, the menu now correctly shows as browse-only — items,
  descriptions, and prices, no add-to-cart, no cart bar (`MenuPage.tsx`).
  Previously a customer could build a whole cart and only find out it
  couldn't be submitted at the very last step. Browsing no longer requires
  a fresh tap either, since only actual order submission needs that
  guarantee.

- **Image upload** (Settings → logo/cover) now uploads directly to
  Supabase Storage (`src/lib/supabaseClient.ts` →
  `uploadBusinessImage()`), with a plain URL field still available as a
  fallback if you'd rather paste a hosted link. No third-party service
  (Cloudinary etc.) needed — reuses Supabase, which you're already on.
- **Tiered loyalty editing** is fully built — add/edit/remove tiers (name,
  visits required, perk) directly in the Loyalty tab, no more "coming
  soon" placeholder or raw API calls needed.
- **Returning-visitor %** shows on the Analytics page, backed by an
  anonymous per-browser visitor id (`src/lib/visitor.ts` — never tied to a
  phone number or identity, entirely separate from the opt-in loyalty
  program).
- **Country breakdown was built, then removed.** IP-based geolocation only
  reflects the network connection, not customer origin — for a UAE-only
  business, nearly every tap would've just shown "UAE," which wasn't a
  useful stat. Removed cleanly rather than left half-working; see the
  backend README for the full reasoning.

## Design

One template, ~1000 businesses. The visual identity — warm charcoal
background, brass accent, `Fraunces` display serif — lives in the shell so
it stays consistent regardless of which business is loaded; each business's
own logo, cover photo, and description are what actually change. See
`tailwind.config.js` for the token system.

The one deliberate signature touch: a brief brass ring "ripple" animates out
from the logo medallion on page load (`animate-tap-ripple` in
`LandingPage.tsx`) — a quiet nod to the physical tap that got the customer
here. Respects `prefers-reduced-motion`.

## Structure

- `src/pages/TapHandler.tsx` — the actual URL programmed onto NFC chips
  (`/t/:cardUid`). Resolves the tap via the backend, then either redirects
  to the business's landing page (customer card) or straight into the
  dashboard already logged in (admin card).
- `src/pages/LandingPage.tsx` — the public page, one per business
  (`/:slug`), pulling logo/name/links/loyalty from the backend.
- `src/components/LinkButton.tsx` — renders one enabled link button; logs
  the click before navigating.
- `src/components/LoyaltyWidget.tsx` — phone check-in (gated by the tap
  token from `TapHandler`) plus progress display for all four loyalty
  types.
- `src/lib/api.ts` — public endpoint calls (no auth).
- `src/lib/authApi.ts` — every protected endpoint call (super admin +
  owner/staff dashboards).
- `src/lib/session.ts` — token storage, the authenticated fetch wrapper.
- `src/lib/supabaseClient.ts` — the one place the frontend talks to
  Supabase directly, for live dashboard updates (Realtime) and image
  uploads (Storage).
- `src/lib/visitor.ts` — the anonymous per-browser visitor id.
- `src/pages/superadmin/` — your onboarding/management screens.
- `src/pages/dashboard/` — the owner/staff shared dashboard screens.

**One manual step that stays manual, by design**: there's no self-service
way to become `super_admin` — sign up normally, then flip that one row's
`role` in Supabase's `profiles` table.

## Testing without a physical card yet

Since the NFC cards haven't arrived, exercise the whole flow through the
actual UI now — no more raw API calls needed for this:

1. **Bootstrap your own account** (one-time, unavoidably manual): `POST
   http://localhost:5000/api/auth/register` with any test business details
   — this is the only raw API call left in this whole process, since you
   can't use the super admin form before you *are* a super admin. Then flip
   your new account's `role` to `super_admin` in Supabase's `profiles`
   table, and log in at `/admin/login`. Everything below uses the real UI.
2. **Onboard a test business** at `/admin/super/businesses/new`.
3. **Activate it** from its detail page (`/admin/super/businesses/:id`).
4. **Issue the owner's tap card** from that same page — grab the card's
   `uid` from Supabase's Table Editor afterward.
5. **Visit `/t/<that-uid>`** — this is exactly what happens once the
   physical chip gets tapped: logs straight into the owner/staff dashboard.
6. **Visit the landing page** at `/<slug>` — exactly what a customer sees.

