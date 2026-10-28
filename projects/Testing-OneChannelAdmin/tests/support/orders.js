// Fulfill → Orders screen helpers for the 1CA flows (A2–A7, E1).
// Selectors come from the 1CA source (apps/web/src/containers/Fulfill/Orders):
//   - test orgs get the new details UI (OrderDetailsNew, /fulfill/orders/orderdetails); Nexus/oneauto
//     get the classic page (/fulfill/orders/fulfill-orderdetails). Both open the SAME action panels:
//     RefundDilaog, ReturnDialog, CancelDialog, FullfilmentDialog — PrimeReact Sidebars (not Dialogs)
//     titled by an <h6>, closed with the X (.p-sidebar-close), never with a Cancel button.
//   - read-only popups (Refund Details, Return Details, Purchase Details, Email Logs, Fulfilled Qty) are Dialogs.
//   - every action is POST inventory/orders/modifyOrder with a different `status`.
const { expect } = require("@playwright/test");
const { settle, findErrorScreen } = require("./page-health");

const LIST_PATH = "/fulfill/orders/fulfill-orders";
const DETAIL_PATH = "/fulfill/orders/orderdetails";
const MODIFY_ORDER = "/inventory/orders/modifyOrder";

/** Header / line action buttons (exact text in OrderHeader.tsx, ProductSummary.tsx, NewOrderDetails.js). */
const BUTTONS = {
  fulfillment: /^\s*(Fulfillment|Work Action)\s*$/,
  markAsPaid: /^\s*Mark as paid\s*$/i,
  cancel: /^\s*Cancel Order\s*$/,
  refund: /^\s*(Refund|Request Refund)\s*$/,
  approveReturn: /^\s*(Approve Return|Approve Pickup)\s*$/,
  refundDetails: /^\s*Refund Details\s*$/,
  returnDetails: /^\s*(Return Details|Pickup Details)\s*$/,
  orderCost: /^\s*Order Cost\s*$/,
  fulfilledSources: /Fulfilled (Sources|Destination)/,
  emailLogs: /^\s*Email Logs\s*$/,
  pickPack: /Pick\/Pack/,
};

/**
 * An action button/link in the page content — never the app's left nav ("Home navigation" also has a
 * "Fulfillment" button). Text-matched so it works for buttons, links and menu items alike.
 */
function action(page, name) {
  return page
    .locator('button:not([aria-label="Home navigation"] *), a:not([aria-label="Home navigation"] *), [role=menuitem]')
    .filter({ hasText: name })
    .filter({ visible: true });
}

/**
 * Close a sidebar/dialog without saving: Esc clears open dropdown overlays, then the panel's own
 * close (×). If it still won't close, reload the page and record the finding.
 */
async function closePanel(page, panel, testInfo, id = "") {
  await page.keyboard.press("Escape");
  if (!(await panel.isVisible().catch(() => false))) return;
  const close = panel.getByRole("button", { name: /^close$/i }).or(panel.locator(".p-sidebar-close, .p-dialog-header-close")).first();
  await close.click({ timeout: 5_000 }).catch(() => {});
  const hidden = await panel.waitFor({ state: "hidden", timeout: 5_000 }).then(() => true, () => false);
  if (!hidden) {
    testInfo && testInfo.annotations.push({ type: "finding", description: `${id}: panel did not close with × — page reloaded` });
    await page.reload();
    await settle(page);
  }
  expect.soft(hidden, `${id}: × closes the panel`).toBe(true);
}

/** Sidebar panel with the given <h6> title ("Refund Order", "Approve Return", "Cancel Order", "Order Fulfillment - …"). */
function sidebar(page, title) {
  return page.locator(".p-sidebar:visible").filter({ has: page.locator("h6", { hasText: title }) }).last();
}

/** Visible dialog by header text ("Refund Details", "Return Details", "Email Logs", "Purchase Details" …). */
function dialog(page, header) {
  return page.locator(".p-dialog:visible").filter({ has: page.locator(".p-dialog-header", { hasText: header }) }).last();
}

function toasts(page) {
  return page.locator(".p-toast-message");
}

/**
 * Success feedback after a save. Soft: the toast text is the backend's message (it varies) and a
 * missing toast is a UX finding, not a failed save; the API read-back is the hard check.
 */
async function expectSuccessToast(page, what) {
  await expect.soft(page.locator(".p-toast-message-success").first(), `success toast after ${what}`).toBeVisible({ timeout: 5000 });
}

/** The global confirmDialog ("Confirmation", "Cancel Confirmation" …) → click Yes. */
async function confirmYes(page, header) {
  const box = page.locator(".p-confirm-dialog:visible, .p-dialog:visible").filter({ hasText: header || /Confirm/ }).last();
  await expect(box, `confirm dialog ${header || ""} appears`).toBeVisible();
  await box.getByRole("button", { name: /^\W*Yes\s*$/ }).click();
}

async function openOrdersList(page, { search } = {}) {
  await page.goto(LIST_PATH);
  await settle(page);
  await expect(page.locator(".p-datatable").first(), "orders table rendered").toBeVisible();
  if (search) {
    const box = page.getByPlaceholder(/Search OrderID,? SKU,? UPC/i).first();
    await box.fill(search);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/inventory/orders/allOrders") && r.request().method() === "POST"),
      box.press("Enter"),
    ]);
    await settle(page);
  }
}

/** Order ids linked from the visible list rows (both details routes). */
async function orderIdsOnList(page) {
  const hrefs = await page
    .locator('a[href*="orderdetails?"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const ids = hrefs
    .map((h) => {
      try {
        return new URL(h, "https://x.invalid").searchParams.get("id");
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return [...new Set(ids)];
}

async function openOrder(page, orderId) {
  await page.goto(`${DETAIL_PATH}?id=${encodeURIComponent(orderId)}`);
  await settle(page);
  let body = await page.locator("body").innerText();
  if (!body.includes(String(orderId))) {
    // A just-created order can take a moment to become readable: one reload before failing.
    await page.waitForTimeout(3000);
    await page.reload();
    await settle(page);
    body = await page.locator("body").innerText();
  }
  expect(findErrorScreen(body), "order details: no error screen").toBeNull();
  expect(body, "details page shows the order id").toContain(String(orderId));
}

/**
 * First order of the test org whose backend flags allow `want` (e.g. o => o.canRefundCompleteOrder).
 * Scans the list API (read-only) instead of clicking through rows.
 */
async function findOrder(api, want, { pages = 4, limit = 50, searchText = "" } = {}) {
  for (let p = 1; p <= pages; p++) {
    const { rows } = await api.listOrders({ page: p, limit, searchText });
    if (!rows.length) break;
    const hit = rows.find((o) => {
      try {
        return want(o);
      } catch {
        return false;
      }
    });
    if (hit) return hit;
  }
  return null;
}

/** Line items of an order (items[] or the order itself for single-line rows). */
function linesOf(order) {
  if (!order) return [];
  return Array.isArray(order.items) && order.items.length ? order.items : [order];
}

/** Count modifyOrder calls the page makes while `action` runs (to prove "no API call made"). */
async function countModifyCalls(page, action) {
  let n = 0;
  const onReq = (r) => {
    if (r.url().includes(MODIFY_ORDER) && r.method() === "POST") n++;
  };
  page.on("request", onReq);
  try {
    await action();
  } finally {
    page.off("request", onReq);
  }
  return n;
}

/** Wait for the modifyOrder response the next click triggers; returns { status, json }. */
async function expectModifyOrder(page, action, { status } = {}) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(MODIFY_ORDER) && r.request().method() === "POST", { timeout: 60_000 }),
    action(),
  ]);
  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  if (status) {
    const sent = JSON.parse(res.request().postData() || "{}");
    expect(sent.status, "modifyOrder status sent").toBe(status);
  }
  return { status: res.status(), json, body: JSON.parse(res.request().postData() || "{}") };
}

module.exports = {
  expectSuccessToast,
  LIST_PATH,
  DETAIL_PATH,
  MODIFY_ORDER,
  BUTTONS,
  action,
  closePanel,
  sidebar,
  dialog,
  toasts,
  confirmYes,
  openOrdersList,
  orderIdsOnList,
  openOrder,
  findOrder,
  linesOf,
  countModifyCalls,
  expectModifyOrder,
};
