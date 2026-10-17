# Testing-Zukaongo

Playwright automation for **ZUKAongo** (Grand Cayman food delivery), in the same layout as the
other projects under `projects/`. Two sections:

| Section | Folder | What it does |
|---|---|---|
| **Functional** | `tests/Zukaongo/functional/` | Drives the three live sites as each real user: customer, restaurant (reception), driver, superadmin. Includes a live order lifecycle. |
| **UI / UX theme audit** | `tests/Zukaongo/ui-audit/` | Opens every screen (desktop + phone width) and checks it against the ZUKAongo theme and UX rules. |

Sites: `https://zukaongo.com` (customer + marketing), `https://admin.zukaongo.com` (superadmin + restaurant
logins), `https://drivers.zukaongo.com` / `https://partners.zukaongo.com` (partner app). All three apps are
Expo (React Native Web): client-routed, so specs use roles/labels, never CSS classes.

Flow reference: [docs/ORDER_AND_PARTNER_FLOWS.md](docs/ORDER_AND_PARTNER_FLOWS.md). Step ids in the specs cite
its case ids (CO-xx, KI-xx, DR-xx, AF-xx, PA-xx).

## Setup

Dependencies come from the hub's `node_modules` (repo root), like the other sub-projects.

```bash
copy .env.example .env
```

Fill `ZUKA_ADMIN_PASSWORD` and `ZUKA_TEST_PASSWORD` (shared by every `@zuka.test` account). `.env` is gitignored.

## Run

```bash
npm run test:smoke          # sign-in for every role
npm run test:functional     # functional section
npm run test:ui-audit       # UI/UX theme audit section
npm test                    # everything
npm run test:flow:functional   # same via flows.config.json (writes reports/<run>/)
npm run test:flow:ui-audit
```

Read-only specs are safe in parallel: `PW_WORKERS=3 npm run test:functional`. Keep `OrderLifecycle.spec.js`
at one worker (it shares the test kitchen and drivers).

## Functional coverage

| Spec | Covers |
|---|---|
| `Auth.spec.js` | Sign-in/out for all 8 accounts on their portal, wrong-password errors, guest, sign-up/forgot screens, signed-out guards, PA-11 partners/drivers alias |
| `PublicSite.spec.js` | Landing hero, CI$ fee transparency, delivery areas, app-store links, postal-code search, legal pages, contact form validation |
| `PartnerOnboarding.spec.js` | Restaurant/driver application forms, PA-02 validation, PA-01/03 submit (opt-in), admin Partners review tabs |
| `CustomerShopping.spec.js` | Delivery pin, open/closed restaurants, CO-04 out-of-range, menu, product detail, cart quantity, CO-12 pickup fee, CO-07 bad promo, tip, CO-05 two-restaurant cart, CO-02 closed restaurant, checkout up to Payment |
| `OrderLifecycle.spec.js` | **Live**: order paid with Zuka Credit (CO-08) → kitchen accepts 15 min (KI-01, readyBy) → ready → driver claims (DR-03 second driver conflict) → pickup (DR-04) → Delivered refused without photo (DR-05) → PoD upload auto-delivers (DR-06) → customer sees photo → further change returns 409. Also KI-02 decline → auto refund + late accept 409, and CO-12 pickup handed over by the kitchen |
| `CustomerAccount.spec.js` | Profile menu screens, wallet balance, order tabs, delivered tracking with PoD photo, rating form, issue types, AF-06 cancel paid → 403, AF-03 late report refused, AF-07 assistant, help |
| `AdminConsole.spec.js` | All 14 superadmin sections, vendor search/filter/detail, order status/payment filters + refund actions, settings tabs and timeout defaults (5 / 20 min), people, customers, coupons, meal pass, kitchen, drive, analytics |
| `StaffAccess.spec.js` | Reception nav, vendor scope for each restaurant login, KI-08 only paid tickets, PA-10 admin-only routes, KI-06 accepting another restaurant's order refused |
| `DriverApp.spec.js` | Deliveries filters, go online/offline (dispatch offers recorded), settings: earnings, Cayman PayPal payouts |

### Live data this suite creates

`OrderLifecycle.spec.js` places 3 real orders per run on **Burger House** as `test-customer@zuka.test`, paid with
Zuka Credit (the decline order is refunded automatically). If the wallet drops below CI$60 the spec tops it up
through Admin → Customers → Credit (reason "QA automation top-up"). Turn it off with `ZUKA_ALLOW_ORDER_E2E=0`.
Partner application submits are off by default (`ZUKA_ALLOW_PARTNER_SUBMIT=1` to enable) because each one emails the
support inbox.

## UI / UX theme audit

Engine: `lib/zuka-ui-audit/` (`theme.js` tokens → `collect.js` in-page snapshot → `rules.js` → `report.js`).
Theme tokens were taken from the live sites: action `#C94E00` / hover `#A84100`, sun `#FF6A00`, ink `#0F172A`,
DM Sans + Bricolage Grotesque (marketing), DMSans (customer app), Inter (admin/partner), 12 px / pill radii.

| Rule | Severity |
|---|---|
| `theme.font-family`, `theme.control-color` | major |
| `theme.primary-cta`, `theme.heading-font`, `theme.radius` | minor / info |
| `a11y.contrast` (WCAG AA), `a11y.control-name` | major |
| `a11y.touch-target` (24 px desktop, 44 px phone), `a11y.img-alt`, `a11y.document`, `a11y.heading-structure` | minor |
| `layout.horizontal-overflow`, `ux.broken-image`, `ux.http-errors` (5xx = critical) | major |
| `ux.runtime-errors` | critical |
| `perf.settle-time` (8 s budget, 20 s = critical) | major |

Critical findings fail the test; `ZUKA_UI_AUDIT_STRICT=1` also fails on major. Every run writes
`test-results/zuka-ui-audit/<timestamp>/index.html` (findings per screen with screenshots) and `summary.json`.

## Re-discovering selectors

```bash
node scripts/crawl-zuka-surfaces.js customer admin driver --paths=/orders,/cart
```

Writes aria snapshots + screenshots to `docs/crawl/` (gitignored).

## Flow control UI

The project is registered in the hub's `projects.config.json` as `zukaongo`. After changing specs run
`npm run extract-flow-steps` to refresh `server/data/flow-steps.json`.
