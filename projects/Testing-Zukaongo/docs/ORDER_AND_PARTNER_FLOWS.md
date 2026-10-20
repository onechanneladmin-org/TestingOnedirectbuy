# ZUKAongo: order flow and partner onboarding (QA reference)

How an order moves from the customer site to the restaurant and the driver until delivery, and how restaurants and drivers join. Written for test cases. Values below are code defaults on 2026-10-16; settings that admins can change are marked **(config)**.

- **Customer:** zukaongo.com (web) and the ZukaOngo app
- **Restaurant and driver:** ZukaOngo Partner app, or partners.zukaongo.com on the web (drivers.zukaongo.com is an alias)
- **Admin:** admin.zukaongo.com
- **API:** api.zukaongo.com

Test accounts are listed in [tests/api/TEST_USERS.md](../tests/api/TEST_USERS.md).

---

## 1. Roles

| Role | Who | Where | Can do |
|---|---|---|---|
| Customer | Shopper (signed in; guests can't check out) | zukaongo.com, ZukaOngo app | Order, pay, track, cancel unpaid orders, request a refund, report an issue, rate |
| Restaurant admin (`reception`) | Restaurant owner or staff, scoped to their restaurant(s) | admin.zukaongo.com, Partner app (kitchen mode) | Menu, hours, address, delivery settings, open/pause; accept, decline, prepare and ready orders |
| Driver (`delivery`) | Courier | Partner app, partners.zukaongo.com | Go online, accept offers or claim orders, pick up, share location, proof of delivery |
| Marketplace admin (`admin`, `superadmin`) | ZUKAongo team | admin.zukaongo.com | Everything above, plus payouts, refunds, partner approvals and settings |

---

## 2. Order statuses

`placed → preparing → ready → out_for_delivery → delivered`, and `cancelled` from most statuses.

What the customer sees: Placed / Preparing / Ready / In Transit / Delivered / Cancelled. A scheduled order shows **Scheduled** while it's held.

| From → To | Customer | Restaurant | Driver | Admin |
|---|---|---|---|---|
| placed → preparing (accept) | | ✓ | | ✓ |
| placed → cancelled (decline) | only unpaid orders | ✓ | | ✓ |
| preparing → ready | | ✓ | | ✓ |
| preparing → cancelled | | ✓ | | ✓ |
| preparing → placed | | | | ✓ |
| ready → out_for_delivery (pick up) | | | ✓ assigned driver only | ✓ |
| ready → delivered | | ✓ pickup orders only | | ✓ |
| ready → preparing / cancelled | | | | ✓ |
| out_for_delivery → delivered | | | ✓ needs proof of delivery | ✓ |
| out_for_delivery → ready / cancelled | | | | ✓ |

**Rules**
- `delivered` and `cancelled` are final. Any further status change returns `409`. Later money changes go through refunds.
- Pickup orders never go to `out_for_delivery`.
- Moving an unpaid order forward returns `402`.

---

## 3. Order flow, step by step

### 3.1 Customer places the order (zukaongo.com or the app)

1. **Address.** The customer enters a Grand Cayman address or postal code (e.g. `KY1-1201`). US addresses are also supported. The restaurant list only shows restaurants that deliver to that pin.
2. **Cart.**
   - Dishes from more than one restaurant can share a cart **(config `allowMultiVendorCart`, on)**. Checkout pays one restaurant at a time unless `combinedCheckoutEnabled` is on (off by default).
   - Mixing currencies returns `409 CURRENCY_MISMATCH`.
3. **Checkout checks** (all happen on the server):
   - Prices are re-read from the live menu. Unavailable items return `409 ITEMS_UNAVAILABLE`. A total that doesn't match the server's returns a refusal.
   - The restaurant must be `open`, and open at the scheduled time if one is set.
   - Delivery or pickup must be enabled for both the marketplace and the restaurant.
   - The subtotal must reach the restaurant's `minOrderAmount`.
   - Delivery needs a map pin within the restaurant's range.
4. **Options.**
   - Delivery or pickup.
   - Drop-off: `hand_to_me` or `leave_at_door`, with a note up to 250 characters.
   - Tip as a percentage or an amount.
   - Promo code (`409 PROMO_UNAVAILABLE` if it can't be applied).
   - Loyalty points (100 points = 1.00).
   - Zuka Credit: pays the full order or part of it; not enough balance returns `402`.
5. **Scheduled order.** `scheduledFor` must be 15 minutes to 14 days ahead. If it's more than 20 minutes ahead, the order is **held** (`kitchenHeld`) and shows as Scheduled.
6. **Payment.**
   - **Grand Cayman (KY):** PayPal, charged in US$ at CI$1 = US$1.20. **US:** Stripe or PayPal. Processors without keys are hidden **(config)**.
   - **Steps in order:** stock, then promo, then points, then wallet, then the charge. If any step fails, the earlier ones are undone.
   - **Duplicate taps:** an `Idempotency-Key` makes a repeated submit return the same order. Each user can only have one checkout running at a time.
7. **Payment status.** `pending → paid`, or `requires_action / failed / expired`. An unpaid order expires 30 minutes after creation. The job that expires it runs every 15 minutes, so it can take up to about 45 minutes.
8. **When the order is paid:**
   - `paidAt` is set.
   - The restaurant is credited (`order_credit`).
   - The customer gets `order.placed`.
   - The kitchen is alerted, unless the order is held.

### 3.2 Restaurant accepts and prepares (Partner app kitchen mode, or admin)

1. **Alert.** The kitchen gets a new-order push plus a restaurant email or SMS, but only for **paid, not held** orders.
2. **Accept:** `placed → preparing`. The kitchen picks a prep time: the app offers 10, 15, 20, 30 or 45 minutes; the API allows 5 to 120. This sets `acceptedAt`, `prepMins` and `readyBy`, and the customer gets `order.accepted`.
3. **Decline:** reason `out_of_stock`, `too_busy`, `closing` or `other`, plus a note. Placed orders only. A paid order is **refunded automatically**, and the customer gets `order.cancelled`.
4. **Add time:** +5 or +10 minutes, while preparing only. The customer gets `order.delayed` the first time only.
5. **Ready:** `preparing → ready`. This sets `readyAt`.
   - **Pickup orders:** the customer gets `order.ready`, and the restaurant marks the order delivered at handover.
6. **No response (auto-cancel)** **(config `orderAcceptEscalateMins` = 5, `orderAutoCancelMins` = 20; set the cancel time to 0 to turn it off):**
   - After 5 minutes unaccepted: the kitchen is pushed again, the restaurant gets an email or SMS, ops is alerted, and `escalatedAt` is set.
   - After 20 minutes: the order is cancelled ("Restaurant didn't confirm in time") and refunded.
   - The kitchen can't accept after that (`409`). Orders already more than 120 minutes past the cancel time are skipped.
7. **Scheduled (held) orders:**
   - They're released **20 minutes before** `scheduledFor`, the same lead an ASAP order gets. The release check runs every minute and whenever the list loads; staff can also release by hand. The kitchen is alerted on release.
   - Manually holding an order resets it to placed, so it has to be accepted again.
8. **Kitchen order list:** restaurant logins only ever see paid orders (paid, partially refunded, refunded, chargeback). Unpaid, failed and expired checkouts aren't tickets. Admins see everything.

### 3.3 Driver delivers (Partner app or partners.zukaongo.com)

1. **Go online.** The driver allows location and notifications.
2. **Dispatch** **(config `dispatch`, on):**
   - Starts when the order is accepted or ready.
   - Offers the order to the nearest online driver within 8 miles whose location is less than 5 minutes old.
   - Each offer lasts **45 seconds**, for up to **5 rounds**. After that, the order goes to the open pool and every driver gets a "first to claim" push.
   - It can offer an order that's still preparing once its ready time is no more than the travel time + 5 minutes.
3. **Claim or accept.** The driver accepts an offer, or claims from the pool, which lists ready, paid, unassigned delivery orders. This sets `claimedAt`. With `driverOffersEnabled` (off by default), a pool claim instead creates a 60-second offer.
4. **Pick up:** `ready → out_for_delivery`. Assigned driver only; sets `pickedUpAt`. The customer gets `order.out_for_delivery`.
5. **Live location.** Sent while the driver has an assigned order that's preparing, ready, or out for delivery. The customer sees it only while the order is out for delivery, and not if the last fix is more than 5 minutes old. The ETA assumes about 25 km/h.
6. **Proof of delivery (PoD).**
   - **When it's needed:** a photo is required to complete delivery **(config `requireProofOfDelivery`, on)**. It's always required for **leave at door**.
   - **How the photo is handled:** the app shrinks it before upload, and the API stores it.
   - **Auto-complete (new 2026-10-16):** when the assigned driver uploads PoD on an out-for-delivery order, the order is **marked delivered automatically**. It runs the same checks and side effects as the Delivered button, and the response includes `autoDelivered: true`.
   - **Retaking PoD** on a delivered order only replaces the photo.
7. **Delivered.**
   - `deliveredAt` is set.
   - The customer gets `order.delivered`.
   - The driver is credited the tip (`tip_credit` from `tipHeld`) and base pay.
   - Loyalty points are awarded: subtotal × `loyaltyPointsPerDollar` (1) × tier multiplier.

### 3.4 After delivery (customer)

- **Proof photo:** shown on the order screen, and opens full screen in the app.
- **Rate the order:** restaurant, delivery and each dish, 1 to 5. The popup only asks about orders delivered in the last 3 days, at most once per app session, and only once per order.
- **Report an issue:**
  - Delivered orders only, within 48 hours, one per order, and at most 3 per day.
  - Types: `missing_items`, `wrong_items`, `quality`, `never_arrived`, `late`, with an optional photo and comment (up to 1000 characters).
  - Missing or wrong items worth **25 or less are refunded automatically**, unless the customer filed 3 or more issues in 90 days. Everything else goes to admin review: approve full, approve partial, or deny (deny needs a note).
  - Issue refunds always go back to the **original payment method**.
- **Refund request:** paid orders only, one pending at a time. The admin resolves it to the original payment method (the default) or to **Zuka Credit**.
- **Cancel:** the customer can only cancel unpaid orders that are still placed, or a Meal Pass day before its cutoff. Paid orders return `403`.
- **Support chat:**
  - On zukaongo.com, signed-in customers can ask "where is my order?" and the chat answers with status, items, total and a track link.
  - Guests are asked to sign in.
  - The chat can't cancel, refund or reorder.

### 3.5 Money

| When | Restaurant | Driver |
|---|---|---|
| Paid | Order credited | |
| Delivered | | Tip and base pay credited |
| Refund | Proportional debit | Tip reversed proportionally |
| Settlement | Payouts (manual by default; **(config)** auto every 24 hours) | Tip payouts (PayPal in Grand Cayman) |

**Refund rules:** the Zuka Credit share is refunded first, then the card. A full refund cancels the order.

### 3.6 Notifications

| Who | What |
|---|---|
| **Customer** (push, in-app and email) | `order.placed`, `payment_required`, `accepted`, `delayed`, `out_for_delivery`, `delivered`, `cancelled`, `kitchen_released`, `payment_failed`, `payment_expired`, `refund_requested`, `refund_declined`, `issue_received`, `issue_resolved`; `order.ready` for pickup only |
| **Kitchen** | New order (push plus email or SMS), escalation after 5 minutes |
| **Drivers** | Dispatch offer, "first to claim" pool push, "assigned" when reassigned |

### 3.7 Variants

- **Pickup:** no driver and no PoD. The restaurant marks the order delivered at handover.
- **Meal Pass day:**
  - Created at the change cutoff, already paid, with no fees or tip, and held if it's more than 20 minutes ahead.
  - The customer gets `meal_pass.day_scheduled`.
  - Refunds are blocked. Cancelling before `cancelCutoffAt` returns that day's share as Zuka Credit, and issues always go to admin review.
- **Order chat** **(config `orderChatEnabled`, off):**
  - The customer and the assigned driver can message, up to 1000 characters per message. The kitchen can read but not post.
  - Chat closes once the order is delivered or cancelled.

---

## 4. Partner onboarding

There are two paths: **restaurant** and **driver**. Both start at **zukaongo.com/partner** (`?type=driver` preselects driver). The landing page buttons "Become a partner" and "Apply to drive" link there.

### 4.1 Apply (public, no account needed)

1. Choose **List my restaurant** or **Deliver with ZUKAongo**.
2. **Form fields:**
   - **Both:** name, email, phone, area, an optional message, and a hidden anti-bot field.
   - **Restaurant only:** restaurant name and street address (both required), and cuisine (optional).
   - **Driver only:** vehicle (car, scooter or motorbike, or bicycle).
3. **Submit** (`POST /public/partner-applications`, limited to 5 per minute per IP).
   - **Invalid input:** the page shows the error message.
   - **Same email and type already pending:** the page says "We already have your application", and no new record is created.
   - **Success:** the page shows a reference `par-…`. The applicant gets a "We received your application" email, and the support inbox gets "New … partner application" with a review link.

### 4.2 Review (admin → **Partners**)

- **Tabs:** New, Approved, Rejected.
- **Approve** (restaurant: "Approve & create restaurant"; driver: "Approve driver"):

| | Restaurant | Driver |
|---|---|---|
| Created | Restaurant **paused** (KY, America/Cayman, the given address, placeholder hours 09:00–22:00 every day, delivery and pickup on) | (none) |
| Login | Restaurant admin (`reception`) scoped to that restaurant | Driver (`delivery`) |
| Existing ZUKAongo user with the same email | The role is added to their account; the email tells them to use their existing password | Same |
| New user | Firebase account created; the email has a **set-password link** | Same |
| Welcome email | Set password; sign in at admin.zukaongo.com; add menu; set hours, address, delivery area and minimum order; reply with payout details (the team sets up payouts); take orders in the Partner app (kitchen mode); restaurant stays paused until the team reviews and sets it live | Set password; install the Partner app (or use partners.zukaongo.com); allow location and notifications; add PayPal payout details in Settings; go online; at handover tap **Capture PoD**, which completes the delivery |

- **If the login can't be created:** the new restaurant is removed and the application stays **New**, so it can be approved again.
- **Approving twice:** returns `409` "Application is already approved".
- **Reject:** takes an optional note (up to 1000 characters). The applicant gets an email that includes the note. A second approve or reject returns `409`.
- **Audit log:** every decision is recorded as `partner.approve` or `partner.reject`.

### 4.3 First steps after approval

**Restaurant**
1. Set a password from the email link, then sign in at admin.zukaongo.com.
2. Add menu items: dishes, prices, photos and add-ons.
3. Update hours, address, delivery radius and minimum order.
4. Send payout details by email. Only the ZUKAongo team can set up restaurant payouts.
5. Sign in to the Partner app in kitchen mode to receive orders.
6. The team reviews everything and sets the restaurant to **Open**. Only an admin or superadmin can make a restaurant live the first time; until then, the restaurant's own login gets `403` ("Your restaurant goes live after the ZUKAongo team reviews it"). After go-live, staff can pause and reopen on their own (`goLiveApprovedAt` is set the first time an admin sets Open).

**Driver**
1. Set a password, then sign in to the Partner app or partners.zukaongo.com.
2. Allow location and notifications.
3. In Settings, add a PayPal payout email (Grand Cayman) or set up Stripe payouts (US).
4. Go online, then follow section 3.3.

---

## 5. Test case seeds

### Checkout

| ID | Case | Expected |
|---|---|---|
| CO-01 | Order from an open restaurant to a Grand Cayman address and pay with PayPal | Paid; `order.placed`; the kitchen is alerted |
| CO-02 | Order from a closed or paused restaurant | Refused |
| CO-03 | Subtotal below `minOrderAmount` | Refused, showing the amount still needed |
| CO-04 | Delivery pin outside the restaurant's range | Refused |
| CO-05 | Dishes from 2 restaurants in one cart | Both stay in the cart; checkout pays one restaurant at a time |
| CO-06 | Mixed currencies in the cart | `409 CURRENCY_MISMATCH` |
| CO-07 | Promo code applied, then the code is used up | `409 PROMO_UNAVAILABLE`; nothing is charged |
| CO-08 | Pay fully with Zuka Credit; pay partly; not enough credit | Paid; split payment; `402` |
| CO-09 | Double-tap Place order | One order (idempotency) |
| CO-10 | Schedule for 10 minutes ahead; 1 hour ahead; 15 days ahead | Refused; held as Scheduled; refused |
| CO-11 | Leave payment unfinished | Expires after about 30–45 minutes; `payment_expired` |
| CO-12 | Pickup order | No delivery fee; no driver step |

### Kitchen

| ID | Case | Expected |
|---|---|---|
| KI-01 | Accept with 15 minutes | Preparing; `readyBy` = now + 15 minutes; customer gets `accepted` |
| KI-02 | Decline with `too_busy` on a paid order | Cancelled; refunded automatically; customer told why |
| KI-03 | Add +5 minutes twice | `delayed` sent only once |
| KI-04 | Don't accept for 5 minutes, then 20 minutes | Escalation; then auto-cancel and refund; a late accept returns `409` |
| KI-05 | Held scheduled order | Not alerted until `scheduledFor`; alerted on release |
| KI-06 | Restaurant login opens another restaurant's order | `403` |
| KI-07 | Advance an unpaid order | `402` |
| KI-08 | Restaurant login lists orders while a customer's checkout is unpaid or expired | That order isn't in the list; an admin still sees it |
| KI-09 | Order scheduled 2 hours ahead | Held; released about 1 h 40 m ahead, i.e. 20 min before its time (within a minute); kitchen alerted |

### Driver

| ID | Case | Expected |
|---|---|---|
| DR-01 | Online driver near the restaurant when the order is accepted | Gets an offer that lasts 45 seconds |
| DR-02 | Ignore the offer | Next driver gets it; after 5 rounds it goes to the pool with a "first to claim" push |
| DR-03 | Two drivers claim at once | One wins; the other gets a conflict message |
| DR-04 | Pick up a claimed order | Out for delivery; the customer sees the live map |
| DR-05 | Tap Delivered without a photo | "Upload proof of delivery before marking delivered" |
| DR-06 | **Capture PoD while out for delivery** | **Order becomes Delivered automatically**; the tip is credited |
| DR-07 | Retake PoD on a delivered order | Photo replaced; status unchanged |
| DR-08 | Leave-at-door order with PoD turned off in settings | Photo still required |
| DR-09 | Driver who isn't assigned tries to pick up or upload PoD | Refused |
| DR-11 | Driver assigned (dispatch offer) while the order is still preparing sends GPS | Accepted; customer map appears only once out for delivery |
| DR-10 | Deliveries tab sorting | Each tab is newest first by its own time: Delivered by delivery time, Out for delivery by pickup time, Ready by ready time; All by creation time |

### After delivery

| ID | Case | Expected |
|---|---|---|
| AF-01 | Report missing items worth 25 or less | Refunded automatically to the card or PayPal |
| AF-02 | Report quality or never arrived | Admin review; full, partial or deny (deny needs a note) |
| AF-03 | Report after 48 hours, or a second report on the same order | Refused |
| AF-04 | Refund request resolved to Zuka Credit | Wallet credited; restaurant debited proportionally |
| AF-05 | Rate-order popup | Shows once for an order delivered in the last 3 days; not again after "Rate order" or "Later" |
| AF-06 | Customer tries to cancel a paid order | `403` |
| AF-07 | Signed-in chat "where is my order?" | Lists recent orders with status, total, items and track link |

### Partner onboarding

| ID | Case | Expected |
|---|---|---|
| PA-01 | Restaurant application with all fields | Success with `par-…`; applicant and support emails sent |
| PA-02 | Restaurant without an address; bad email; phone with fewer than 7 digits | Field error shown; nothing saved |
| PA-03 | Same email and type submitted twice while pending | "We already have your application" |
| PA-04 | Approve a restaurant | Paused restaurant plus scoped login; welcome email with set-password link; the restaurant isn't visible to customers |
| PA-05 | Approve a driver | Delivery login; Partner app sign-in works; welcome email |
| PA-06 | Approve an applicant who already has a customer account | Role added; email says to use the existing password |
| PA-07 | Reject with a note | Email includes the note; the application moves to Rejected |
| PA-08 | Approve or reject an application that's already decided | `409` |
| PA-09 | More than 5 submissions in a minute from one IP | Rate limited |
| PA-10 | Restaurant login tries to open payout setup | Not allowed (only the ZUKAongo team can) |
| PA-11 | partners.zukaongo.com and drivers.zukaongo.com | Both open the Partner web app; sign-in works on both |
| PA-12 | New partner restaurant login sets status Open before review | `403`; after an admin sets Open, the restaurant can pause and reopen itself |

---

## 6. Known gaps

All four gaps found while writing this doc were fixed on 2026-10-16:
- **Unpaid orders on the kitchen list:** the API now hides them from restaurant logins, not just the app (KI-08).
- **Driver location while preparing:** drivers assigned while the food is preparing can share location (DR-11).
- **Scheduled orders with no cooking time:** held orders are released 20 minutes before their time, checked every minute (KI-09).
- **Restaurants opening themselves:** a new restaurant can't go live until an admin sets it Open (PA-12).
