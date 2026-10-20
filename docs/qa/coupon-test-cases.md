# Coupon test cases: ODB admin and onedirectbuy.com

Manual test cases for coupon codes, written from the current code on `main` (`aa11925`).

## How coupons work today (read first)

- The old ODB `Coupon` collection is **retired**. A coupon is now a **DiscountCampaign with `campaignMethod: "coupon"`** and a code in `coupouncode`.
- Two kinds of coupon rows exist:
  - **ODB platform campaigns**, created in ODB admin (`sourceId` starts with `odb-admin-`). Fully editable.
  - **1CA mirrors**, created in 1CA and synced to ODB. In ODB admin they can only be activated or deactivated.
- **Where:** ODB admin, `/marketplacecore/discounts` (the "Discount campaigns" page). The old `/marketplacecore/coupons` route points at the same tab.
- **Storefront:** the cart page "Coupon" box, web checkout, and the mobile app cart and checkout screens.
- **Engine:** `apps/api/utils/discountCampaignEngine.js`. Cart routes are `POST /cart/:id/coupon` and `DELETE /cart/:id/coupon`.
- **Rules the engine enforces:** only **one coupon** per cart, applied after the automatic campaigns. The campaign must be active, inside its date window, carry the `onedirectbuy` label, be platform-wide or seller-scoped to the cart, and be inside its usage limits.
- **Amounts:** percent or fixed. Percent is capped at 100. A discount never exceeds the base it applies to.
- Section 10 lists behaviours that look odd in the code. Record what you see there; they are not necessarily bugs.

Run the cases on a **test** environment with Stripe in **sandbox** mode and Stripe test cards only. Do not use real customer data.

## 0. Fixtures

| Placeholder | What |
|---|---|
| `<ADMIN>` | ODB marketplace superadmin user (can open Discount campaigns and create platform campaigns) |
| `<SELLER_ADMIN>` | ODB seller portal user (optional, for permission checks) |
| `<BUYER_A>` | registered storefront customer with a few past orders |
| `<BUYER_NEW>` | registered customer with **no** past orders |
| `<GUEST>` | not signed in, checkout with a guest email |
| `<SKU_1>`, `<SKU_2>` | two listings from **different sellers**, in stock, priced above $25 each |
| `<LST_1>`, `<LST_2>` | listing ids of `<SKU_1>` and `<SKU_2>` |
| `<SKU_NOCOST>` | a listing with no `pricing.cost` |
| `<SKU_MAP>` | a listing with a MAP price set |
| `<CODE>` | a unique test code, e.g. `QA10-<date>` (always upper case in the UI) |
| `$BASE` | `https://<env>/api` |
| `$TOKEN_ADMIN`, `$TOKEN_BUYER` | Firebase ID tokens of `<ADMIN>` and `<BUYER_A>` |

Cleanup: deactivate every `QA*` campaign after the run (hard delete is not supported).

## 1. Admin: Discount campaigns list

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| ADM-LST-01 | `<ADMIN>` logged in | Open `/marketplacecore/discounts`. | Page "Discount campaigns" loads. Columns: Name, Method, Type, Code, Value, Org, Status, Flags, Window. "Create platform campaign" and "Refresh" buttons are visible. |
| ADM-LST-02 | Same | Open `/marketplacecore/coupons`. | Lands on the same Discount campaigns tab. |
| ADM-LST-03 | At least one coupon and one auto campaign exist | Method filter = "Coupon". | Only rows with the "Coupon" tag. |
| ADM-LST-04 | Same | Method filter = "Auto". | Only rows with the "Auto" tag, no code shown ("—"). |
| ADM-LST-05 | Active and inactive rows exist | Status filter = "Active only", then "Inactive only". | Each filter shows only matching rows; "All statuses" shows both. |
| ADM-LST-06 | `<CODE>` campaign exists | Search by name, then by code, then by source id. | Matching rows only; no match shows an empty list, no error. |
| ADM-LST-07 | Many campaigns | Page through the list. | Pager works; row count and page size stay consistent. |
| ADM-LST-08 | Percent and fixed campaigns exist | Look at the Value column. | Percent shows `10%`; fixed shows `$10.00`. |
| ADM-LST-09 | Campaign with "No end date" and one with an end date | Look at the Window column. | First shows `start → open`; second shows `start → end`. |
| ADM-LST-10 | Platform campaign with all three checkboxes ticked | Look at the Flags column. | Chips "Platform", "No below cost", "No below MAP", "1× / customer", "ODB admin" as applicable. |
| ADM-LST-11 | A product campaign with no SKUs and no listings (legacy row) | Look at the Flags column. | Red "All products" chip. |
| ADM-LST-12 | 1CA mirror and ODB admin rows exist | Look at the Name column sub-text. | `ODB odb-admin-…` for platform rows, `1CA <id>` for mirrors. |
| ADM-LST-13 | Click the eye icon on a row | Open detail. | Detail dialog shows the campaign; "Edit" is offered for ODB admin rows; "Activate" / "Deactivate" for all rows. |
| ADM-LST-14 | API down (stop the API or block the request) | Open the page / click Refresh. | Error toast; page does not crash. |

## 2. Admin: create a coupon campaign

Create dialog: "Create platform campaign". Fields: Name, Type, Method, Coupon code, Amount + Percent checkbox, Listings and Catalog SKUs (product type only), "No end date", "Do not discount below cost", "Do not discount below MAP", "Limit to one use per customer".

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| ADM-CRT-01 | `<ADMIN>` | Create: Name `QA order 10%`, Type "Amount off order (platform)", Method "Coupon code", code `qa10` typed in lower case, Amount 10, Percent ticked. Create. | Code field forces upper case (`QA10`). Toast "Campaign created / Live on storefront for label onedirectbuy". Dialog closes, row appears: Coupon, moneyOffOrder, `QA10`, `10%`, Active, flag "Platform". |
| ADM-CRT-02 | Same | Create a fixed coupon: Amount 15, Percent **un**ticked. | Value column `$15.00`. |
| ADM-CRT-03 | Same | Create a "Free / shipping discount (platform)" coupon. | No Amount field; text "Free shipping discount (shippingDiscountType=free)". Row type `shipping`. |
| ADM-CRT-04 | Same | Create "Amount off products (listings)" coupon: "Choose listings" and pick `<LST_1>` (from seller 1) and `<LST_2>` (from seller 2). | Picker lists listings; chosen listings show as tags with title and SKU; button reads "Edit listings (2)". Row created. |
| ADM-CRT-05 | Same | Same type, but enter only "Catalog SKUs" `<SKU_1>, <SKU_2>` (comma or space separated), no listings. | Created. The campaign applies to every seller that lists those SKUs. |
| ADM-CRT-06 | Product type, listings chosen | Click "Clear" next to the listings button. | Listing tags removed; button back to "Choose listings". |
| ADM-CRT-07 | Same | Leave "No end date" ticked. | Window shows `start → open`. |
| ADM-CRT-08 | Same | Untick "Do not discount below cost" and "Do not discount below MAP"; tick "Limit to one use per customer". Create. | Flags column shows "1× / customer" and no cost/MAP chips. |
| ADM-CRT-09 | Same | Create an **Automatic** campaign (Method "Automatic"). | Coupon code field is hidden; row shows Method "Auto"; no code. |
| ADM-CRT-10 | A coupon with code `QA10` exists | Create a second coupon with the same code `QA10`. | Record the result (rejected, or created). If created, applying `QA10` on the storefront must still behave predictably (see CPN-EDGE-05). |
| ADM-CRT-11 | Form open | Name empty, click Create. | Warning toast "Name required". Nothing saved. |
| ADM-CRT-12 | Product type, no listings and no SKUs | Click Create. | Warning toast "Scope required: Choose at least one listing and/or add catalog SKUs for product discounts." Nothing saved. |
| ADM-CRT-13 | Method "Coupon code", code empty | Click Create. | Warning toast "Coupon code required". Nothing saved. |
| ADM-CRT-14 | Form open | Amount 0; amount 150 with Percent ticked; negative amount; very large fixed amount; 3 decimals (`10.555`). | Record each. Expected: percent is capped at 100% by the engine; the amount field allows 0-2 decimals. Check the saved value and what a customer actually gets. |
| ADM-CRT-15 | Form open | Code with spaces (` QA 10 `), symbols (`QA-10_%`), 1 character, 60 characters. | Record the saved code. The code is trimmed and upper-cased; confirm the storefront accepts exactly what was saved. |
| ADM-CRT-16 | Form open | Fill in the form, click Cancel, reopen. | Dialog closes; reopened form is empty (defaults: Amount 10, no end date ticked, below cost ticked, below MAP ticked). |
| ADM-CRT-17 | Server error (e.g. API stopped) | Click Create. | Red toast "Create failed" with the server message; dialog stays open; "Create" button usable again. |
| ADM-CRT-18 | `<ADMIN>` | Click Create twice quickly. | Only one campaign is created (button disabled while saving). |

## 3. Admin: edit, activate, deactivate

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| ADM-EDT-01 | ODB admin coupon row | Open detail, "Edit". | Form prefilled (name, code, amount, percent, listings, flags). Text "Discount type and method cannot be changed after creation." Type and Method are disabled. |
| ADM-EDT-02 | Same | Change the amount 10 to 20, "Save changes". | Toast "Campaign updated / Changes are live on the storefront." List and detail show the new value. A cart that applies the code afterwards gets 20. |
| ADM-EDT-03 | Same | Change the coupon code `QA10` to `QA20`, save. | Old code stops working on the storefront; new code works. |
| ADM-EDT-04 | Product coupon | Remove all listings and SKUs, save. | Warning "Scope required"; nothing saved. |
| ADM-EDT-05 | Same | Add a listing, save. | Saved; discount now covers the added listing. |
| ADM-EDT-06 | Coupon in use in an open cart | Edit the amount, then reload that cart. | Cart total re-calculated with the new amount (the cart recalculates on every load). |
| ADM-EDT-07 | Active coupon | "Deactivate". | Toast "Deactivated"; Status "Inactive". Storefront: the code is rejected (see CPN-ELG-02). |
| ADM-EDT-08 | Inactive coupon | "Activate". | Toast "Activated"; code works again. |
| ADM-EDT-09 | **1CA mirror** coupon (`sourceId` not `odb-admin-`) | Open detail. | No "Edit" button. "Activate" / "Deactivate" are available. |
| ADM-EDT-10 | Same | `PATCH $BASE/marketplace-core/.../discount-campaigns/<id>` with `{"name":"x"}` as `<ADMIN>`. | 400, code `DISCOUNT_CAMPAIGN_1CA_MIRROR`: mirrored campaigns can only be activated/deactivated. |
| ADM-EDT-11 | Any row | Try to hard-delete (`DELETE .../discount-campaigns/<id>`). | 405 "Use PATCH isActive=false to deactivate. Hard delete is not supported." |
| ADM-EDT-12 | Two admins | Both open the same campaign; admin 1 saves a new amount; admin 2 saves a different amount. | Record which value wins. No crash; last save wins is acceptable, but confirm the list shows the final value. |
| ADM-EDT-13 | Failure while saving | Stop the API, click "Save changes". | Red toast "Update failed"; dialog stays open. |

## 4. Admin: permissions and legacy coupon endpoints

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| ADM-SEC-01 | `<SELLER_ADMIN>` (not platform admin) | Open `/marketplacecore/discounts`; try to create a platform campaign. | Page or action refused for users without the platform-admin permission. Record exactly what is shown. |
| ADM-SEC-02 | Not logged in | `POST $BASE/marketplace-core/.../discount-campaigns` with a body. | 401 / 403. |
| ADM-SEC-03 | `<BUYER_A>` token | Same request. | 401 / 403. A storefront customer cannot create campaigns. |
| ADM-SEC-04 | `<ADMIN>` | `POST $BASE/admin/coupons` and `POST $BASE/coupons` with any body. | 405, `code: "COUPONS_RETIRED"`, message "ODB coupons are retired. Create DiscountCampaigns in 1CA (auto or coupon)." |
| ADM-SEC-05 | `<ADMIN>` | `PATCH $BASE/admin/coupons/<id>` and `DELETE $BASE/admin/coupons/<id>`. | 405 `COUPONS_RETIRED`. |
| ADM-SEC-06 | none | `GET $BASE/coupons`. | 200. `{items, page, limit, total, pages, source:"discountCampaigns", retiredCouponsCollection:true}`. Only active coupon campaigns inside their window. Items have `code, title, discountType, value, minOrderAmount, validFrom, validUntil, isActive, firstOrderOnly`. |
| ADM-SEC-07 | Active and inactive coupons exist | `GET $BASE/coupons?active=false`. | Only inactive coupons. |
| ADM-SEC-08 | `<CODE>` exists | `GET $BASE/coupons?code=qa10` (lower case). | The matching coupon (code is upper-cased before the lookup). |
| ADM-SEC-09 | none | `GET $BASE/coupons/not-an-id`. | 400 "Invalid id" (or "Invalid coupon id" on the admin mount). |
| ADM-SEC-10 | An **auto** campaign id | `GET $BASE/coupons/<auto campaign id>`. | 404 "Coupon not found" (only coupon-method campaigns are returned). |
| ADM-SEC-11 | Expired coupon exists | `GET $BASE/coupons`. | Expired coupon not listed (unless `active=false` is requested). |

## 5. Storefront (onedirectbuy.com): apply and remove a coupon

Cart page: "Order summary" > "Coupon" box with an input (placeholder "Code"), "Apply" button, "Remove <CODE>" button, applied-campaign list, and (signed-in only) an "available coupons" list.

Setup for this section: `QA10` = 10% off the whole order, no minimum, active, label `onedirectbuy`, cart holds `<SKU_1>` x1 (price P).

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| CPN-APL-01 | `<BUYER_A>` cart with `<SKU_1>` | Type `QA10`, click Apply. | Message "Coupon applied." Summary shows "Discount (QA10)  -$X" where X = 10% of the merchandise subtotal; Total = subtotal - X. Button shows "Remove QA10". The applied-campaign list shows the campaign. |
| CPN-APL-02 | Same | Press Enter in the input instead of clicking Apply. | Same as CPN-APL-01. |
| CPN-APL-03 | Same | Type ` qa10 ` (lower case, spaces). | Applied. The code is trimmed and matched case-insensitively. |
| CPN-APL-04 | Coupon applied | Reload the page / open the cart in a new tab. | Coupon still applied; the input is pre-filled with the code. |
| CPN-APL-05 | Coupon applied | Click "Remove QA10". | Message "Coupon removed." Discount line disappears; Total back to subtotal; input cleared. |
| CPN-APL-06 | Empty input | Click Apply. | Warning "Enter a coupon code."; no request sent. |
| CPN-APL-07 | Cart open | Type a code that does not exist (`NOPE123`), Apply. | Error message "Invalid or ineligible discount code" (or the generic "Could not apply coupon."). Totals unchanged. |
| CPN-APL-08 | Coupon applied | Add one more unit of `<SKU_1>`. | Discount recalculates on the new subtotal. |
| CPN-APL-09 | Coupon applied | Reduce the quantity / remove the item. | Discount recalculates; with an empty cart the discount is 0. |
| CPN-APL-10 | `QA10` applied | Type a second, different valid coupon `QA15` and Apply. | Only one coupon is kept: either `QA15` replaces `QA10`, or the second is refused. Record which. Never both. |
| CPN-APL-11 | Cart open | Apply, remove, apply again, repeat 3 times. | Same result every time; no leftover discount after remove. |
| CPN-APL-12 | Network offline | Click Apply. | Error message; page does not freeze; Apply button usable again. |
| CPN-APL-13 | Slow network | Click Apply twice quickly. | One discount only (not 2x); button shows "…" while busy and is disabled. |
| CPN-APL-14 | Cart open in two browser tabs | Apply in tab A, remove in tab B, reload tab A. | Tab A shows the real server state (no coupon). |
| CPN-APL-15 | Signed-in `<BUYER_A>` | Open the "available coupons" list in the cart summary (it only appears if coupons exist). | Each row: code, discount label, description, and restriction text ("Min. order: $X", "First order only" or "All orders"). The "Apply" button applies it; after applying it reads "Applied" and is disabled. |
| CPN-APL-16 | `<GUEST>` (not signed in) | Look at the cart summary. | The "available coupons" list is **not** shown for guests. The manual code box still works. |
| CPN-APL-17 | Guest cart | Enter `QA10`, Apply. | Applies on the guest cart (same as signed-in), unless the coupon is marked for specific customers or one-use-per-customer (see section 6). |
| CPN-APL-18 | Guest cart with coupon, then sign in | Sign in on the same browser. | Record whether the cart and coupon carry over. Totals must stay correct either way. |
| CPN-APL-19 | Coupon applied; sign out | Sign out and reopen the cart. | Cart and coupon behave according to the guest cart rules; no other customer's data is visible. |
| CPN-APL-20 | Cart page | Check the layout at mobile width (375 px). | Coupon box, buttons and messages stay readable; no horizontal scroll. |
| CPN-APL-21 | Cart page | Use the keyboard only (Tab to the input, type, Enter). | Works; the label "Coupon" is tied to the input. |

## 6. Eligibility rules (one case per rule)

Create each campaign in ODB admin (or 1CA for rules that ODB admin does not expose), apply it from the storefront, and check both the success and the failure side. Failure result for all of these: HTTP 400, `code: "DISCOUNT_CODE_INVALID"`, message "Invalid or ineligible discount code", totals unchanged.

### 6.1 Status and dates

| ID | Setup | Steps | Expected result |
|---|---|---|---|
| CPN-ELG-01 | Active coupon | Apply. | Works. |
| CPN-ELG-02 | Same coupon, deactivated in admin | Apply. | Rejected. |
| CPN-ELG-03 | Coupon applied to a cart, then deactivated in admin | Reload the cart, then try to check out. | Discount disappears from the cart on reload; checkout charges the full price. No stale discount. |
| CPN-ELG-04 | Start date in the future (set in 1CA or the DB) | Apply. | Rejected. |
| CPN-ELG-05 | End date in the past, "No end date" off | Apply. | Rejected. Also not listed by `GET /coupons`. |
| CPN-ELG-06 | End date in the future | Apply before the end date. | Works. |
| CPN-ELG-07 | End date a few minutes ahead | Apply, wait for the end time to pass, reload the cart and try to pay. | Coupon drops at the next recalculation; the payment amount matches the discount-free total. |
| CPN-ELG-08 | "No end date" ticked and an old end date saved | Apply. | Works (open end overrides the end date). |
| CPN-ELG-09 | Start = now | Apply. | Works. |
| CPN-ELG-10 | Campaign `labels` do not include `onedirectbuy` (1CA mirror without the label) | Apply. | Rejected. A campaign with **no** labels at all is accepted. |

### 6.2 Minimum requirements

| ID | Setup | Steps | Expected result |
|---|---|---|---|
| CPN-MIN-01 | Coupon with "minimum purchase amount" $100 | Cart subtotal $99.99. | Rejected. |
| CPN-MIN-02 | Same | Cart subtotal exactly $100.00. | Applies. |
| CPN-MIN-03 | Same | Cart $150. | Applies. |
| CPN-MIN-04 | Same, coupon applied at $150 | Remove items until the subtotal is $80. | Discount disappears at the next recalculation; if the code stays on the cart, the discount is 0. Record what the UI shows. |
| CPN-MIN-05 | Coupon with minimum quantity 3 | 2 items, then 3 items. | Rejected with 2; applies with 3. |
| CPN-MIN-06 | No minimum | Cart of $0.01. | Discount never exceeds the subtotal (total never negative). |
| CPN-MIN-07 | Minimum amount and the cart holds a second, discounted (automatic campaign) item | Compare against the subtotal before and after automatic discounts. | Record which subtotal the minimum uses. |

### 6.3 Amount maths

| ID | Setup | Steps | Expected result |
|---|---|---|---|
| CPN-AMT-01 | 10% order coupon, subtotal $200 | Apply. | Discount $20.00; total $180.00 + shipping + tax. |
| CPN-AMT-02 | $15 fixed order coupon, subtotal $200 | Apply. | Discount $15.00. |
| CPN-AMT-03 | $50 fixed coupon, subtotal $30 | Apply. | Discount capped at $30.00 (never more than the subtotal). Total merchandise = $0. |
| CPN-AMT-04 | 100% coupon | Apply. | Merchandise free. Check that checkout still works for a $0 merchandise total plus shipping/tax. |
| CPN-AMT-05 | 33.33% coupon, subtotal $99.99 | Apply. | Discount rounded to cents; displayed discount, cart total, payment total and order total are all identical. |
| CPN-AMT-06 | Percent coupon on a cart with two quantities of an item priced $19.99 | Apply. | Rounded once at the right level; no 1-cent drift between cart and order. |
| CPN-AMT-07 | Tax enabled in the test region | Apply an order coupon, go to checkout. | Tax is computed on the discounted merchandise (not the full price). |
| CPN-AMT-08 | Free-shipping coupon (type `shipping`) | Apply before choosing a shipping method, then choose one. | Code is held while there is no shipping quote; after the quote the shipping line is 0 (or the discounted amount). |
| CPN-AMT-09 | Free-shipping coupon with "exclude shipping rates over $X" (1CA) | Pick a shipping method that costs more than X. | No shipping discount; the code does not stick to the cart. |
| CPN-AMT-10 | Free-shipping coupon | Change the shipping address / method after applying. | Discount recalculates for the new rate. |

### 6.4 Product scope

| ID | Setup | Steps | Expected result |
|---|---|---|---|
| CPN-SCP-01 | Product coupon for `<LST_1>` only | Cart has `<SKU_1>` only. | Discount on `<SKU_1>` only. |
| CPN-SCP-02 | Same | Cart has `<SKU_2>` only (not in scope). | Rejected. |
| CPN-SCP-03 | Same | Cart has `<SKU_1>` and `<SKU_2>`. | Discount only on the `<SKU_1>` line; `<SKU_2>` at full price. |
| CPN-SCP-04 | Product coupon via catalog SKU for a SKU sold by two sellers | Add each seller's listing. | Both listings are discounted. |
| CPN-SCP-05 | Coupon with excluded SKU / excluded listing (1CA) | Cart has the excluded item and a normal item. | Excluded item gets no discount. |
| CPN-SCP-06 | Percent product coupon, quantity 3 of an in-scope item | Apply. | Discount on all 3 units. |
| CPN-SCP-07 | Buy X get Y coupon (1CA) | Cart meets the "buy" quantity; then below it. | Applies only when the buy quantity is met; "max uses per order" is respected. |
| CPN-SCP-08 | Order-wide coupon from a **seller's** 1CA campaign that is not marked `platformDiscount` | Apply. | Ignored/rejected (order and shipping campaigns without the platform flag do not apply). |
| CPN-SCP-09 | Multi-seller cart, coupon scoped to one seller | Apply. | Only that seller's lines are discounted; the order split per seller keeps the right discount on each. |

### 6.5 Floors: below cost and below MAP

| ID | Setup | Steps | Expected result |
|---|---|---|---|
| CPN-FLR-01 | Coupon with "Do not discount below cost" on, a 50% discount on a listing with cost 80% of price | Apply. | Discount is reduced so the line price stays at or above cost. |
| CPN-FLR-02 | Same coupon, `<SKU_NOCOST>` | Apply. | Full discount applies (the cost floor is skipped when cost is unknown). |
| CPN-FLR-03 | "Do not discount below MAP" on, `<SKU_MAP>`, 50% discount | Apply. | Price after discount stays at or above MAP x quantity. |
| CPN-FLR-04 | Cost and MAP both on | Apply. | The higher of cost and MAP is the floor. |
| CPN-FLR-05 | Floors on, coupon stacked with an automatic campaign | Apply. | The total of automatic + coupon never takes the line below the floor. |
| CPN-FLR-06 | Floors off | Apply a 90% coupon. | Full 90% applies (check with the seller before using on real stock). |
| CPN-FLR-07 | Floors on | Open the cart API response. | `pricing.cost` is **not** present in any cart/listing response (cost is internal). |

### 6.6 Customer limits

| ID | Setup | Steps | Expected result |
|---|---|---|---|
| CPN-USR-01 | Coupon "one use per customer", `<BUYER_A>` has not used it | Apply and complete an order. | Order placed; a redemption row is recorded for `<BUYER_A>`. |
| CPN-USR-02 | Same | `<BUYER_A>` starts a new cart and applies the code again. | Rejected. |
| CPN-USR-03 | Same | `<BUYER_NEW>` applies the code. | Applies (limit is per customer). |
| CPN-USR-04 | Same | Guest checks out with email `a@x.com` using the code; guest tries again with `A@X.com`. | Second attempt rejected (email compared case-insensitively). A different email applies. |
| CPN-USR-05 | One use per customer | Guest cart with no email known yet. | Record: the code is rejected until the customer identity (email) is known. |
| CPN-USR-06 | Same | Same person signs in after a guest order with the same email. | Record whether the guest redemption counts against the account. |
| CPN-USR-07 | Coupon with a total usage limit of 2 (1CA) | Three different customers complete orders with the code. | First two orders succeed; the third attempt is rejected. `usageCount` = 2. |
| CPN-USR-08 | Total limit 1; two customers both hold the code in their carts | Both pay at nearly the same time. | Record the outcome. Ideally only one order gets the discount; if both do, note the overshoot (see section 10). |
| CPN-USR-09 | Coupon limited to specific customers by email (1CA "specific customers") | Apply as a listed customer, as another customer, and as a guest. | Works only for listed emails (case-insensitive). Others get the invalid-code error. |
| CPN-USR-10 | "First order only" shown for a coupon in the available-coupons list | Apply as `<BUYER_NEW>` and as `<BUYER_A>`. | Record whether first-order is enforced for `<BUYER_A>`; the list label says "First order only". |

## 7. Checkout, payment and order

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| CPN-CHK-01 | `QA10` applied, `<BUYER_A>` | Continue to checkout. | Order summary shows the discount line and the discounted total. |
| CPN-CHK-02 | Same | Pay with Stripe test card `4242 4242 4242 4242`. | Payment succeeds. The Stripe PaymentIntent amount equals the discounted total (goods - discount + tax on discounted goods + shipping). |
| CPN-CHK-03 | Same | Open the order in the storefront account and in ODB admin. | Order shows `couponCode = QA10`, discount amount, applied campaigns, and totals that match the payment. |
| CPN-CHK-04 | Same | Check the redemption data. | One redemption row for the order (campaign, order, user/email, code, merchandise and shipping discount). Campaign `usageCount` increased by 1. |
| CPN-CHK-05 | Coupon applied, PaymentIntent already created | Remove the coupon on the cart, return to checkout. | The pending PaymentIntent amount is updated to the full price; no stale discounted amount is charged. |
| CPN-CHK-06 | Same | Apply a coupon after the PaymentIntent exists. | PaymentIntent amount follows the new total. |
| CPN-CHK-07 | Coupon applied | Tamper with the amount in the browser (dev tools) before paying. | Server ignores browser amounts; the charge equals the server-calculated total. |
| CPN-CHK-08 | Coupon applied | Place the order, then press Back and place it again. | No double charge; redemption not created twice (unique per campaign + order). |
| CPN-CHK-09 | Coupon expires/deactivates after the customer has the PaymentIntent but before paying | Pay. | Charge matches what the server calculates at payment time; the customer is not charged a discount that is no longer valid. Record the exact behaviour. |
| CPN-CHK-10 | Coupon with a total limit that is reached just before payment | Pay. | Payment is refused or the discount removed; no free discount past the limit. |
| CPN-CHK-11 | Multi-seller cart with a platform coupon | Pay. | One order per seller; the discount is split across the seller orders so the sum equals the cart discount (no cent lost or added). |
| CPN-CHK-12 | Shipping-only coupon | Pay. | Order shows `shippingDiscountAmount`; merchandise unchanged. |
| CPN-CHK-13 | Order confirmation email and invoice | Open both. | Discount / coupon line shown with the right amount; totals match the order. |
| CPN-CHK-14 | Order placed with a coupon | Cancel the order / issue a refund from admin. | Refund amount equals what the customer paid (the discounted amount). Record whether the redemption and `usageCount` are released; the code reviewed does not describe this (see section 10). |
| CPN-CHK-15 | Partial refund or return of one line on a discounted order | Refund one line. | Refund is proportional to the discount allocated to that line. |
| CPN-CHK-16 | Guest checkout with a coupon | Complete the order. | Order works; the redemption stores the guest email in lower case. |
| CPN-CHK-17 | Failed payment (card `4000 0000 0000 0002`) | Try to pay, then retry with a good card. | No redemption recorded for the failed attempt; one redemption after the successful payment. |
| CPN-CHK-18 | Checkout page | Look at the displayed total with an **order-level** coupon. | Record whether the displayed total equals the charged total. (The system guide for the store site repos lists a known display gap for order-level coupons on some store sites; ODB should match.) |

## 8. Mobile app (CartScreen and CheckoutScreen)

| ID | Preconditions | Steps | Expected result |
|---|---|---|---|
| CPN-MOB-01 | Mobile app, signed in, item in cart | Cart screen: enter `QA10`, tap apply. | Discount shown; the input switches to a remove button. |
| CPN-MOB-02 | Same | Enter an invalid code. | Alert titled "Coupon" with "Invalid coupon code." (or the server message). |
| CPN-MOB-03 | Same | Tap remove. | Discount removed; input cleared. |
| CPN-MOB-04 | Coupon applied on the cart screen | Go to checkout. | The code is pre-filled; discount and total match the cart. |
| CPN-MOB-05 | Checkout screen | Apply an empty code. | Alert "Coupon: Enter a coupon code." |
| CPN-MOB-06 | Checkout screen | Apply a valid code, then remove it. | Alert on failure "Could not remove coupon." shown only if the call fails; otherwise totals update. |
| CPN-MOB-07 | Coupon applied in the app | Open the same cart on the website. | Same coupon and totals on both. |
| CPN-MOB-08 | Pay in the app with a coupon | Complete the order. | Same result as CPN-CHK-02 to CPN-CHK-04. |
| CPN-MOB-09 | Small phone and large phone | Check the coupon row layout. | Input and button fit; keyboard does not hide the apply button. |

## 9. API cases (cart coupon routes)

Helper: `api <token> <args>` adds `Authorization: Bearer <token>`, JSON headers and the `clientname` header. Cart ids come from the storefront (`localStorage.cartId`) or `GET $BASE/cart`.

| ID | Request | Expected |
|---|---|---|
| API-CPN-01 | `POST $BASE/cart/<cartId>/coupon` `{"code":"QA10"}` as the cart owner | 200 with the populated cart: `couponCode: "QA10"`, `discountAmount` > 0, `appliedDiscountCampaigns[]` contains the coupon (`campaignMethod:"coupon"`, `code:"QA10"`), `totals` updated. |
| API-CPN-02 | Same with `{"code":"  qa10 "}` | 200, code stored as `QA10`. |
| API-CPN-03 | Same with `{}` or `{"code":""}` | 400 `{"error":"Discount code is required"}`. |
| API-CPN-04 | Same with `{"code":"NOPE"}` | 400 `{"error":"Invalid or ineligible discount code","code":"DISCOUNT_CODE_INVALID"}`; cart `couponCode` is null afterwards. |
| API-CPN-05 | `POST $BASE/cart/not-an-id/coupon` | 400 `{"error":"Invalid cartId"}`. |
| API-CPN-06 | `POST $BASE/cart/000000000000000000000000/coupon` | 404 `{"error":"Cart not found"}`. |
| API-CPN-07 | Cart id of **another** customer, other customer's token | 403 (cart is not owned by the requester). No discount applied to that cart. |
| API-CPN-08 | Cart whose status is not `active` (checked out) | 400 `{"error":"Cannot apply coupon to inactive cart"}`. |
| API-CPN-09 | `POST $BASE/cart/new/coupon` `{"code":"QA10"}` as a signed-in user with an existing active cart | Uses the user's active cart. |
| API-CPN-10 | `POST $BASE/cart/new/coupon` as a guest | Creates a guest cart. With no items there is nothing to discount, so expect the invalid-code 400; record the actual response. |
| API-CPN-11 | `DELETE $BASE/cart/<cartId>/coupon` as the owner | 200; `couponCode` null, `discountAmount` 0, `appliedDiscountCampaigns` only keeps **automatic** campaigns. |
| API-CPN-12 | `DELETE` with an invalid or unknown cart id; non-owner; inactive cart | 400 "Invalid cartId"; 404 "Cart not found"; 403; 400 "Cannot remove coupon from inactive cart". |
| API-CPN-13 | `DELETE` when no coupon is applied | 200, cart unchanged (idempotent). |
| API-CPN-14 | Apply the same code twice in a row | 200 both times; discount not doubled. |
| API-CPN-15 | `POST` with `{"code":{"$ne":null}}` or an array | 400 / invalid code. No NoSQL injection: the code is converted to a string before the lookup. |
| API-CPN-16 | `POST` with a 10,000 character code, emoji, `<script>` | Invalid-code 400 (or a validation error); no 500. |
| API-CPN-17 | 30 requests with random codes within a minute | Record whether the endpoint is rate limited. Without a limit, codes can be guessed (see section 10). |
| API-CPN-18 | Apply a coupon, then `GET $BASE/cart/<cartId>` | Same totals as the apply response; PaymentIntent amount (if one exists) matches `totals`. |

## 10. Things to watch (observed in the code)

Record what you see for each. These are not confirmed bugs; they are places where the code leaves a question open.

| ID | Observation | What to check |
|---|---|---|
| CPN-EDGE-01 | A failed apply sets `cart.couponCode = null` before returning 400. | With coupon A applied, try an invalid code B. Does coupon A disappear from the cart without the customer asking? |
| CPN-EDGE-02 | Only the first matching coupon (`coupons[0]`) is applied; the lookup limits to 5 rows per code. | Two active campaigns with the same code: which one applies, and is it the better one? |
| CPN-EDGE-03 | A shipping coupon is held while the shipping amount is 0 and dropped when a quote exists but the discount is 0. | Apply a free-shipping code before and after choosing a shipping method. |
| CPN-EDGE-04 | The engine checks `usageCount` and per-customer redemptions at apply time, redemptions are written at checkout. | Two carts both holding a one-use code: do both pass checkout? (CPN-USR-08) |
| CPN-EDGE-05 | No uniqueness check on `coupouncode` in the admin create path (the legacy `Coupon` model had one). | Create two campaigns with the same code (ADM-CRT-10) and apply it. |
| CPN-EDGE-06 | The available-coupons list is only requested for signed-in customers and shows `firstOrderOnly` from the "one use per customer" flag. | Does the list label match the real rule (CPN-USR-10)? |
| CPN-EDGE-07 | Refund / cancel does not obviously release a redemption in the code reviewed. | After a cancelled order, can the same customer reuse a one-use code? Does `usageCount` go down? |
| CPN-EDGE-08 | Legacy `Coupon` / `CouponRedemption` models still exist in `packages/odb-models/admin/Coupon.js` (fields such as `maxDiscountAmount`, `firstOrderOnly`, category and seller restrictions). | Confirm no screen or API still reads or writes the old collection; old codes in that collection must not work on the storefront. |
| CPN-EDGE-09 | The legacy admin page `CouponPage.jsx` builds the old coupon payload (`maxDiscountAmount`, `usageLimitPerCustomer`, category ids). | Confirm it is not reachable from the admin menu; if it is, any save must be refused with `COUPONS_RETIRED`. |

## 11. Regression pass (run after any change to discounts)

- [ ] ADM-CRT-01, ADM-CRT-04, ADM-EDT-02, ADM-EDT-07, ADM-EDT-09
- [ ] CPN-APL-01, CPN-APL-05, CPN-APL-07, CPN-APL-16
- [ ] CPN-ELG-02, CPN-ELG-05, CPN-MIN-01, CPN-MIN-02, CPN-AMT-03, CPN-SCP-03, CPN-FLR-01, CPN-USR-02
- [ ] CPN-CHK-02 to CPN-CHK-05, CPN-CHK-11
- [ ] API-CPN-01, API-CPN-03, API-CPN-04, API-CPN-07, API-CPN-08

## 12. Automated coverage already in the repo

Run these before the manual pass (details in `docs/discount-campaigns-odb.md`):

```bash
pnpm run qa:discount:unit                 # engine unit tests
QA_SKIP_BUYER=1 API_BASE_URL=https://<env>/api pnpm run qa:discount   # guest-only API steps
QA_BUYER_EMAIL=… QA_BUYER_PASSWORD=… STRIPE_SECRET_KEY=sk_test_… \
  QA_ADMIN_ID_TOKEN=… API_BASE_URL=https://<env>/api pnpm run qa:discount:orders   # paid Stripe checkouts with coupons
QA_ADMIN_ID_TOKEN=… API_BASE_URL=https://<env>/api pnpm run qa:discount:policy    # seller vs platform rules
```

| Script | Covers (coupon-related) |
|---|---|
| `test-discount-campaigns.mjs` | Guest and signed-in apply, label, expiry, minimum |
| `test-discount-campaigns-deep.mjs` | Stacking, usage limit, fixed amounts, tax on merchandise |
| `test-discount-campaigns-v2.mjs` | Exclude SKU / listing, BOGO options, below-cost orders |
| `test-discount-below-cost.mjs` | Below-cost floor; cost stripped from cart API |
| `test-discount-1ca-mirror.mjs` | 1CA to ODB mirror of coupon and auto campaigns |
| `test-discount-marketplace-policy.mjs` | Seller vs superadmin rules, platform admin create |
| `test-discount-orders.mjs` | Paid checkouts with coupon: totals, `couponCode`, redemptions |

Still manual: the admin UI cases (sections 1 to 3), all UI messages, the mobile app (section 8), emails and invoices (CPN-CHK-13), refunds (CPN-CHK-14, 15), and the "things to watch" in section 10.
