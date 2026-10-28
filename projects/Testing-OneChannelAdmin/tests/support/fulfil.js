// Fulfilment + WMS helpers for A3 / A4 / A6 / E1. Text and ids from the 1CA source:
//   - order Fulfillment panel: OrderDetails/FulfillmentDialogs/FullfilmentDialog.js (Sidebar
//     "Order Fulfillment - <id>"): Source → "Continue Shipping" → Shipping Options / Shipping Type →
//     TrackingNumbersUI ("Add Manual Tracking", Tracking Number, Shipping Carrier) → "Save Shipping" /
//     "Mark Shipping In Transit" (confirm "Confirmation" → Yes). All POST inventory/orders/modifyOrder.
//   - WMS: /wms/orders?orderId=&warehouse= (WMSorders.js). "pick Unassigned" chip → dialog "Assign Pick/Pack"
//     (Assign Type, PICK Location, Assigned To, Assigned QTY., "Update" → POST createWmsOrder, toast
//     "Order Updated"); assigned chip → Sidebar h6 "Confirm pick" (PICKED QTY., "Confirm" → POST
//     wmsMarkasCompleteTask, toast "<n> qty is picked").
//   - WMS Returns: /wms/returns, dialog "Quantity Received" (Received Quantity*, Quality Check Good/Damaged,
//     Restock Type Option, Location, "Update" → POST modifyWMSOrder, toast "Order has been updated.").
const { expect } = require("@playwright/test");
const { settle } = require("./page-health");
const O = require("./orders");

const WMS_TASK = "/inventory/orders/wmsMarkasCompleteTask";
const WMS_ASSIGN = /\/inventory\/orders\/create(Bulk)?WmsOrder/;
const WMS_MODIFY = "/inventory/orders/modifyWMSOrder";

async function chooseOption(page, scope, dropdownText, option) {
  await scope.locator(".p-dropdown").filter({ hasText: dropdownText }).first().click();
  await page.locator(".p-dropdown-panel:visible").getByRole("option", { name: option }).first().click();
}

/** Assigned-To autocomplete (AutocompleteInput: placeholder "User", dropdown button). */
async function pickUser(page, scope, email) {
  const input = scope.getByPlaceholder("User").first();
  await input.fill(email ? email.split("@")[0] : "");
  await scope.locator(".p-autocomplete-dropdown").first().click();
  const options = page.locator(".p-autocomplete-panel:visible [role=option], .p-autocomplete-panel:visible li");
  const match = email ? options.filter({ hasText: email }).first() : options.first();
  await match.click();
}

// ---------------------------------------------------------------- order Fulfillment panel

async function openFulfillmentPanel(page, orderId) {
  await O.action(page, O.BUTTONS.fulfillment).first().click();
  const panel = O.sidebar(page, `Order Fulfillment - ${orderId}`);
  await expect(panel, "Order Fulfillment panel opens").toBeVisible();
  return panel;
}

/** Source (warehouse) → Continue Shipping → Shipping / Parcel. Returns the panel. */
async function startShipping(page, panel, { warehouse } = {}) {
  // Source is preselected from the order's warehouse ("ONEDIRECTBUY WAREHOUSE - WH, Quantity: 1"): only
  // choose when it is empty. Options name the warehouse, not its id (wh1), so prefer a non-supplier
  // source with stock.
  const source = panel.locator(".p-dropdown").filter({ hasText: /Quantity:|Select|Source/ }).first();
  if ((await source.isVisible().catch(() => false)) && !/Quantity:/.test(await source.innerText())) {
    await source.click();
    const opts = page.locator(".p-dropdown-panel:visible").getByRole("option");
    const byId = warehouse ? opts.filter({ hasText: new RegExp(`\\b${warehouse}\\b`, "i") }) : opts.filter({ hasText: /$^/ });
    const stocked = opts.filter({ hasNotText: /supplier/i }).filter({ hasText: /Quantity: [1-9]/ });
    await ((await byId.count()) ? byId : stocked).first().click();
  }
  const cont = panel.getByRole("button", { name: "Continue Shipping" });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  await expect(panel.getByText("Shipping Options").first(), "shipping options shown after Continue Shipping").toBeVisible();
  await chooseOption(page, panel, /Select|Dropshipping|Shipping|Store/, /^Shipping$/);
  const type = panel.locator(".p-dropdown").filter({ hasText: /Parcel|Truckload|Select/ });
  if (await type.first().isVisible().catch(() => false)) await chooseOption(page, panel, /Parcel|Truckload|Select/, /^Parcel$/);
}

/** Add Manual Tracking → number + carrier → Save Shipping. Returns the modifyOrder body sent. */
async function saveManualTracking(page, panel, { trackingNumber, carrier = "UPS" }) {
  await panel.getByRole("button", { name: /Add Manual Tracking/ }).click();
  const numberBox = panel.getByPlaceholder(/Tracking Number/i).or(panel.locator("label:has-text('Tracking Number') + * input, label:has-text('Tracking Number') ~ input")).first();
  await numberBox.fill(trackingNumber);
  // The carrier dropdown starts empty (no placeholder text): find it by its "Shipping Carrier" label.
  const carrierBox = panel.locator("div").filter({ has: page.locator("label, span, b", { hasText: /^Shipping Carrier$/ }) }).locator(".p-dropdown").last();
  await carrierBox.click();
  await page.locator(".p-dropdown-panel:visible").getByRole("option", { name: new RegExp(`^${carrier}$`, "i") }).first().click();
  const sent = await O.expectModifyOrder(page, () => panel.getByRole("button", { name: /^\W*Save( Shipping)?\s*$/ }).click());
  expect(sent.status, "Save Shipping succeeded").toBeLessThan(400);
  await O.expectSuccessToast(page, "save shipping");
  return sent.body;
}

async function markInTransit(page, panel) {
  await panel.getByRole("button", { name: "Mark Shipping In Transit" }).click();
  const sent = await O.expectModifyOrder(page, () => O.confirmYes(page, /in transit/i), { status: "shippingInTransit" });
  expect(sent.status, "in transit call succeeded").toBeLessThan(400);
  return sent.body;
}

// ---------------------------------------------------------------- WMS orders: assign + confirm

async function openWmsOrder(page, orderId, warehouse = "wh1") {
  await page.goto(`/wms/orders?orderId=${encodeURIComponent(orderId)}&warehouse=${encodeURIComponent(warehouse)}`);
  await settle(page);
  await expect(page.locator(".p-datatable").first()).toBeVisible();
  await expect(page.locator(".p-datatable").getByText(String(orderId)).first(), "WMS lists the order").toBeVisible();
}

/** Click the "<kind> Unassigned" chip and assign it (location, user, qty). Returns the API body. */
async function assignTask(page, { kind = "pick", location, email, qty } = {}) {
  await page.locator(".status-unassigned").filter({ hasText: new RegExp(kind, "i") }).first().click();
  const dlg = O.dialog(page, /Assign (Pick\/Pack|Putaway)/);
  await expect(dlg, "Assign Pick/Pack dialog").toBeVisible();
  await chooseOption(page, dlg, /Pick|Pack|Select/, new RegExp(`^${kind === "pick" ? "Pick" : "Pack"}$`));
  if (location) {
    await dlg.locator(".pi-pencil").first().click();
    await dlg.locator("#picklocationcommonlocation0 input, #picklocationcommonlocation0.p-inputtext, span#picklocationcommonlocation0 > input").first().fill(location);
  }
  await pickUser(page, dlg, email);
  if (qty != null) {
    // JobAssignedCommon.js: the field under "Assigned QTY." (the last number box is the read-only PICKED QTY.).
    const q = dlg.locator(".p-field").filter({ has: page.locator("label", { hasText: /Assigned QTY/i }) }).locator("input").first();
    if ((await q.inputValue()) !== String(qty)) await q.fill(String(qty));
  }
  const [res] = await Promise.all([
    page.waitForResponse((r) => WMS_ASSIGN.test(r.url()) && r.request().method() === "POST"),
    dlg.getByRole("button", { name: "Update" }).click(),
  ]);
  expect(res.status(), "assign task call").toBeLessThan(400);
  await O.expectSuccessToast(page, "order update");
  return JSON.parse(res.request().postData() || "{}");
}

/** Open the assigned task, set the done qty and Confirm. Returns { body, toast }. */
async function confirmTask(page, { kind = "pick", qty }) {
  // The Assign dialog stays open after Update: close it, then click the assignee chip
  // (WMSorders.js getAssignedToUI: span.status-picked → HandleConfirm → "Confirm <kind>" sidebar).
  const assign = O.dialog(page, /Assign (Pick\/Pack|Putaway)/);
  if (await assign.isVisible().catch(() => false)) {
    await assign.getByRole("button", { name: /close/i }).first().click().catch(() => page.keyboard.press("Escape"));
    await expect(assign).toBeHidden();
  }
  await page.locator("span.status-picked").first().click();
  const panel = page.locator(".p-sidebar:visible").filter({ has: page.locator("h6", { hasText: new RegExp(`Confirm ${kind}`, "i") }) }).last();
  await expect(panel, `Confirm ${kind} panel`).toBeVisible();
  const label = `${kind.toUpperCase()}ED QTY.`;
  const block = panel.locator("div").filter({ hasText: label }).last();
  const pencil = block.locator(".pi-pencil");
  if (await pencil.first().isVisible().catch(() => false)) await pencil.first().click();
  const input = block.locator(".p-inputnumber input").first();
  await input.fill(String(qty));
  await input.blur();
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(WMS_TASK) && r.request().method() === "POST"),
    panel.getByRole("button", { name: /^\W*Confirm\s*$/ }).click(),
  ]);
  expect(res.status(), `confirm ${kind} call`).toBeLessThan(400);
  const toast = O.toasts(page).filter({ hasText: new RegExp(`qty is ${kind}ed`, "i") }).first();
  await expect(toast).toBeVisible();
  return { body: JSON.parse(res.request().postData() || "{}"), toast: await toast.innerText() };
}

/** WMS jobs of an order line from the API: [{type, jobsAssigned:[{assignedQuantity, completedQuantity, isComplete}]}]. */
function wmsJobs(order, type) {
  const line = O.linesOf(order)[0] || {};
  const procs = (line.WMSProcesses || []).filter((p) => !type || p.type === type);
  return procs.flatMap((p) => p.jobsAssigned || []);
}

const sumQty = (jobs, field) => jobs.reduce((s, j) => s + (Number(j[field]) || 0), 0);

module.exports = {
  WMS_TASK,
  WMS_MODIFY,
  chooseOption,
  pickUser,
  openFulfillmentPanel,
  startShipping,
  saveManualTracking,
  markInTransit,
  openWmsOrder,
  assignTask,
  confirmTask,
  wmsJobs,
  sumQty,
};
