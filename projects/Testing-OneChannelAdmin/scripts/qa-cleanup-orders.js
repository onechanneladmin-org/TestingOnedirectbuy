#!/usr/bin/env node
// Cancel the flows' own leftover test orders on the test org (a write test that failed half-way
// leaves its order open and its stock held).
//   E2E_ALLOW_PROD_WRITES=1 E2E_READ_ONLY=0 node scripts/qa-cleanup-orders.js [--dry-run] [extra order ids…]
// Only ids in the ledger written by createTestOrder (playwright/.auth/qa-orders.jsonl) — or passed on
// the command line — are touched. Other suites create look-alike "QA qa-e2e-…" orders on the same org.
const fs = require("fs");
const { chromium } = require("@playwright/test");
const { trackBackend } = require("../tests/support/api");
const O = require("../tests/support/orders");
const G = require("../tests/support/guard");
const { LEDGER } = require("../tests/support/testOrder");
const { e2eSettings, AUTH_FILE } = require("../tests/support/env");

const dryRun = process.argv.includes("--dry-run");
const extra = process.argv.slice(2).filter((a) => !a.startsWith("--"));

(async () => {
  const s = e2eSettings();
  G.assertTestOrg(s.orgId, process.env);
  if (!dryRun && !G.writesAllowed(s.baseURL, process.env).ok) throw new Error("writes not allowed (set E2E_ALLOW_PROD_WRITES=1, E2E_READ_ONLY=0)");
  const ids = new Set(extra);
  if (fs.existsSync(LEDGER)) {
    for (const line of fs.readFileSync(LEDGER, "utf8").split("\n").filter(Boolean)) ids.add(JSON.parse(line).orderId);
  }
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({ storageState: AUTH_FILE, baseURL: s.baseURL });
  const page = await context.newPage();
  const api = trackBackend(page);
  await page.goto(O.LIST_PATH);
  await page.waitForLoadState("networkidle").catch(() => {});
  let cancelled = 0;
  for (const orderId of ids) {
    const order = await api.readOrder(orderId).catch(() => null);
    if (!order || !order.canCancelCompleteOrder) continue;
    console.log(`${dryRun ? "would cancel" : "cancel"} ${orderId} (${order.fullname || ""}, ${order.status || ""})`);
    if (dryRun) continue;
    const res = await api.write(O.MODIFY_ORDER, {
      orderId,
      status: "cancelled",
      marketplace: order.marketplace,
      cancelState: "Approve",
      reason: "qa-e2e cleanup",
      cancelDetails: { cancelReason: "custom", customReason: "qa-e2e cleanup" },
    });
    if (res.status >= 400 || (res.json && res.json.error)) console.log(`  failed: HTTP ${res.status} ${res.text.slice(0, 160)}`);
    else cancelled += 1;
  }
  console.log(`${ids.size} ledger order(s) checked, ${cancelled} cancelled`);
  await browser.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
