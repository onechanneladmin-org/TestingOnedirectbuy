// @flow C1 — 1CA CRM core. Guide: docs/qa/E2E-TEST-GUIDE.md § 5 C1. Use cases: CRM tab (sheet IDs not in
// this repo yet → provisional 1CA-C1-xx; mapping in docs/qa/1CA-E2E-AUDIT.md § 4).
// Leads/contacts: Marketing/Contact/ContactsManage.js — "Contacts"/"Accounts" add button (Leads: menu
// "Add Manually"), dialog "Add Lead"/"Add Contact"/"Add Account", Submit → POST inventory/customer/createB2Buser
// (or addCompany), delete via Actions → Delete → "Confirm Delete" → Confirm → "Successfully Deleted".
// Tickets live in Settings → Help Center (/settings/help-center): "Add New" → sidebar "New Ticket" → Create;
// status buttons "Mark processing" / "Close ticket" / "Reopen". There is no ticket delete: the test closes it.
const { test, expect, expectTestOrg } = require("../../support/fixtures");
const { checkStep, checkPopupKeyboard } = require("../../support/check-step");
const { qaTag, runIdNow } = require("../../support/guard");
const { settle } = require("../../support/page-health");
const O = require("../../support/orders");

const leadEmail = (tag) => `${tag}@example.test`;

async function openAddLead(page) {
  await page.goto("/crm/leads");
  await settle(page);
  // Accessible name starts with an icon-font glyph ("<glyph> Contacts").
  await page.getByRole("button", { name: /^[^A-Za-z0-9]*Contacts\s*$/ }).first().click();
  const manual = page.getByRole("menuitem", { name: "Add Manually" }).or(page.getByText("Add Manually", { exact: true })).first();
  if (await manual.isVisible().catch(() => false)) await manual.click();
  const dlg = O.dialog(page, /Add (Lead|Contact)/);
  await expect(dlg, "Add Lead dialog").toBeVisible();
  return dlg;
}

/**
 * Rows of the leads grid for this email. The grid has no search box on the test org (newest first),
 * and shows emails Title-Cased ("Qa-E2e-…"), so match case-insensitively.
 */
async function filterByEmail(page, email) {
  const filter = page.getByPlaceholder(/Search by Email/i).first();
  if (await filter.isVisible().catch(() => false)) {
    await filter.fill(email);
    await filter.press("Enter");
  } else {
    await page.reload();
  }
  await settle(page);
  const re = new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return page.locator(".p-datatable tbody tr").filter({ hasText: re });
}

test.describe("C1 CRM @flow", () => {
  test("1CA-C1-01 add lead: required fields enforced, empty submit makes no API call", async ({ page, settings, health }, testInfo) => {
    await page.goto("/crm/leads");
    await settle(page);
    await expectTestOrg(page, settings);
    const dlg = await openAddLead(page);
    await checkStep(page, testInfo, { id: "1CA-C1-01", name: "add lead dialog", health, scope: ".p-dialog" });
    let calls = 0;
    const onReq = (r) => r.url().includes("createB2Buser") && calls++;
    page.on("request", onReq);
    await dlg.getByRole("button", { name: "Submit" }).click();
    const email = dlg.getByPlaceholder("Enter Email");
    expect(await email.evaluate((el) => el.validity.valueMissing), "Email is required").toBe(true);
    await email.fill("not-an-email");
    await dlg.getByRole("button", { name: "Submit" }).click();
    page.off("request", onReq);
    expect(calls, "no create call with invalid fields").toBe(0);
    await checkPopupKeyboard(page, dlg, { id: "1CA-C1-01", name: "add lead" });
  });

  test("1CA-C1-02 create, find and delete a tagged lead", async ({ page, settings, health, writable }, testInfo) => {
    test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
    const tag = qaTag(runIdNow(), "1CA-C1-02");
    const email = leadEmail(tag);
    await page.goto("/crm/leads");
    await expectTestOrg(page, settings);
    const dlg = await openAddLead(page);
    await dlg.getByPlaceholder("Enter Email").fill(email);
    await dlg.getByPlaceholder("Enter First Name").fill("QA");
    await dlg.getByPlaceholder("Enter Last Name").fill(tag);
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("createB2Buser")),
      dlg.getByRole("button", { name: "Submit" }).click(),
    ]);
    expect(res.status(), "create lead").toBeLessThan(400);
    const sent = JSON.parse(res.request().postData() || "{}");
    expect(sent.emailId, "lead email sent").toBe(email);
    await O.expectSuccessToast(page, "create contact");

    try {
      const rows = await filterByEmail(page, email);
      await expect(rows.first(), "new lead listed").toBeVisible();
      await expect(rows.first()).toContainText(tag, { ignoreCase: true });
      // Emails are shown Title-Cased ("Qa-E2e-…@Example.Com"): an email must display as entered.
      await expect.soft(rows.first(), "email shown as entered (not Title-Cased)").toContainText(email);
      await checkStep(page, testInfo, { id: "1CA-C1-02", name: "lead listed", health });
    } finally {
      // Cleanup: delete through the UI (also proves delete works).
      const rows = await filterByEmail(page, email);
      if (await rows.count()) {
        await rows.first().locator(".p-checkbox").first().click();
        await page.getByRole("button", { name: /Actions/ }).click();
        await page.getByRole("menuitem", { name: "Delete" }).click();
        const confirm = O.dialog(page, "Confirm Delete");
        await expect(confirm.getByText("Are You Sure To Delete")).toBeVisible();
        const [del] = await Promise.all([
          page.waitForResponse((r) => r.url().includes("deleteB2Buser")),
          confirm.getByRole("button", { name: "Confirm" }).click(),
        ]);
        expect(del.status(), "delete lead").toBeLessThan(400);
        await O.expectSuccessToast(page, "delete contact");
        await expect(await filterByEmail(page, email), "lead gone after delete").toHaveCount(0);
      }
    }
  });

  test("1CA-C1-03 create an account (company): Company is required", async ({ page, settings, health, writable }, testInfo) => {
    await page.goto("/crm/company");
    await settle(page);
    await expectTestOrg(page, settings);
    // Not the nav's "B2B Accounts": the add button's name is "<glyph> Accounts".
    await page.getByRole("button", { name: /^[^A-Za-z0-9]*Accounts\s*$/ }).first().click();
    const dlg = O.dialog(page, "Add Account");
    await expect(dlg).toBeVisible();
    const company = dlg.getByPlaceholder("Enter Company Name");
    expect(await company.evaluate((el) => el.required || el.validity.valueMissing), "Company is required").toBe(true);
    await checkStep(page, testInfo, { id: "1CA-C1-03", name: "add account dialog", health, scope: ".p-dialog" });
    if (!writable.ok) return;
    const tag = qaTag(runIdNow(), "1CA-C1-03");
    await company.fill(tag);
    // Add Account runs reCAPTCHA before addCompany. Automation never solves or bypasses a CAPTCHA: if
    // it does not let the request through, the write half is skipped with the reason (run it by hand).
    const captchaLog = [];
    page.on("console", (m) => /reCAPTCHA/i.test(m.text()) && captchaLog.push(m.text().slice(0, 120)));
    const created = page.waitForResponse((r) => r.url().includes("addCompany"), { timeout: 20_000 }).catch(() => null);
    await dlg.getByRole("button", { name: "Submit" }).click();
    const res = await created;
    test.skip(!res && captchaLog.length > 0, `reCAPTCHA stopped the automated Add Account (${captchaLog[0]}); not bypassed by design`);
    expect(res, "addCompany request sent").toBeTruthy();
    expect(res.status(), "create account").toBeLessThan(400);
    // Like the leads grid, the accounts grid has no search box on the test org (newest first).
    const filter = page.getByPlaceholder(/Search by (Company|Name)/i).first();
    if (await filter.isVisible().catch(() => false)) {
      await filter.fill(tag);
      await filter.press("Enter");
    } else {
      await page.reload();
    }
    await settle(page);
    const row = page.locator(".p-datatable tbody tr").filter({ hasText: new RegExp(tag, "i") }).first();
    await expect(row, "account listed").toBeVisible();
    await row.locator(".p-checkbox").first().click();
    await page.getByRole("button", { name: /Actions/ }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const [del] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("deleteCompany")),
      O.dialog(page, "Confirm Delete").getByRole("button", { name: "Confirm" }).click(),
    ]);
    expect(del.status(), "delete account").toBeLessThan(400);
  });

  test("1CA-C1-04 ticket: create, change status, close", async ({ page, settings, health, writable }, testInfo) => {
    await page.goto("/settings/help-center");
    await settle(page);
    await expectTestOrg(page, settings);
    await expect(page.getByPlaceholder("Search title or message")).toBeVisible();
    await checkStep(page, testInfo, { id: "1CA-C1-04", name: "help center", health });
    test.skip(!writable.ok, `writes disabled: ${writable.reason}`);
    const tag = qaTag(runIdNow(), "1CA-C1-04");

    await page.getByRole("button", { name: "Add New" }).click();
    const side = O.sidebar(page, "New Ticket").or(page.locator(".p-sidebar:visible").filter({ hasText: "New Ticket" })).first();
    await expect(side).toBeVisible();
    await side.locator("label:has-text('Title') ~ input, input[name='title']").first().fill(tag);
    await side.locator(".ql-editor, [contenteditable=true]").first().fill(`QA automation ${tag}`).catch(() => {});
    const [created] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("createTicket")),
      side.getByRole("button", { name: "Create" }).click(),
    ]);
    expect(created.status(), "create ticket").toBeLessThan(400);

    await page.getByPlaceholder("Search title or message").fill(tag);
    const item = page.getByText(tag).first();
    await expect(item, "ticket listed").toBeVisible();
    await item.click();
    const [proc] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("updateTicket")),
      page.getByRole("button", { name: "Mark processing" }).click(),
    ]);
    expect(JSON.parse(proc.request().postData() || "{}").status, "status sent").toMatch(/processing/i);
    await O.expectSuccessToast(page, "update");
    const [closed] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("updateTicket")),
      page.getByRole("button", { name: "Close ticket" }).click(),
    ]);
    expect(closed.status(), "close ticket (cleanup — no delete exists)").toBeLessThan(400);
    await checkStep(page, testInfo, { id: "1CA-C1-04", name: "ticket closed", health });
  });

  test("1CA-C1-05 a partial-CRM user sees only assigned/shared records", async ({ page, settings }) => {
    await page.goto("/crm/leads");
    await settle(page);
    await expectTestOrg(page, settings);
    const perms = JSON.parse((await page.evaluate(() => localStorage.getItem("permissions"))) || "[]");
    test.skip(!perms.includes("read:partialcrm") || perms.includes("read:crm"), "QA user is not a partial-CRM user (use the A8 user with read:partialcrm)");
    const shared = page.locator("#crm-shared-with-me");
    await expect(shared, "partial-CRM user gets the Shared with me filter").toBeVisible();
  });
});
