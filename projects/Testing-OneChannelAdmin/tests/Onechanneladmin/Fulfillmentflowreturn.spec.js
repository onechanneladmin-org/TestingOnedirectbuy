import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

test("test", async ({ page }) => {
  await loginOneChannelAdmin(page);
  await page.getByRole("button", { name: "Fulfillment" }).click();
  await page.getByRole("link", { name: "Returns" }).click();
  await page.getByRole("tab", { name: "All" }).click();
  await page.getByRole("button", { name: "Fulfillment" }).click();
  await page.getByRole("link", { name: "Orders", exact: true }).click();
  await page.goto(
    "https://admin.onechanneladmin.com/fulfill/orders/fulfill-orders",
  );
  await page.getByRole("button", { name: " Add New " }).click();
  await page.getByRole("menuitem", { name: "SO - D2C Order" }).click();
  await page.locator("span").filter({ hasText: "Select SKU" }).click();
  await page.getByText("AIR_LIFT57230_DUPLICATE1 |").click();
  await page.getByRole("button", { name: " Add Product" }).click();
  await page.getByRole("searchbox", { name: "User" }).click();
  await page.getByRole("searchbox", { name: "User" }).fill("admin");
  await page.locator(".p-button.p-component.p-autocomplete-dropdown").click();
  await page.locator(".p-button.p-component.p-autocomplete-dropdown").click();
  await page.getByRole("option", { name: "admin@1channeladmin.com" }).click();
  await page.locator(".p-button.p-component.p-autocomplete-dropdown").click();
  await page.getByRole("option", { name: "admin@onechanneladmin.com" }).click();
  await page.locator("span").filter({ hasText: "Payment Details" }).click();
  await page.getByRole("option", { name: "Pay Later" }).click();
  await page.getByRole("button", { name: " Create Order" }).click();
  await page.goto(
    "https://admin.onechanneladmin.com/fulfill/orders/fulfill-orders",
  );
  await page.getByRole("button", { name: " Fulfillment" }).first().click();
  await page.getByRole("button", { name: "Continue Shipping" }).click();
  await page
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .click();
  await page.getByRole("option", { name: "Shipping" }).click();
  await page.getByRole("button", { name: " Add Manual Tracking" }).click();
  await page.locator(".p-xl-6 > div:nth-child(2) > .p-dropdown").click();
  await page
    .locator(".p-dropdown.p-component.p-inputwrapper.p-inputwrapper-focus")
    .click();
  await page.locator(".p-col-6 > .p-inputtext").click();
  await page.locator(".p-col-6 > .p-inputtext").fill("testtrack");
  await page
    .locator("div")
    .filter({ hasText: /^empty$/ })
    .click();
  await page.getByRole("option", { name: "Fedex" }).click();
  await page.getByRole("button", { name: "Save Shipping" }).click();
  await page.goto(
    "https://admin.onechanneladmin.com/fulfill/orders/fulfill-orders",
  );
  await page.getByRole("link", { name: "-000500 D2C" }).click();
  await page
    .getByLabel("Orders Details")
    .getByRole("button", { name: "Fulfillment" })
    .click();
  await page.getByRole("button", { name: "Mark Shipping In Transit" }).click();
  await page.getByRole("button", { name: "Yes" }).click();
  await page.getByRole("button", { name: "close" }).click();
  const page1Promise = page.waitForEvent("popup");
  await page.getByRole("button", { name: " Pick/Pack" }).click();
  const page1 = await page1Promise;
  await page1.goto(
    "https://admin.onechanneladmin.com/wms/orders?orderId=2026-000500&warehouse=wh1",
  );
  await page1.getByText("pick Unassigned").click();
  await page1
    .locator("#fulfillLpn > div > .p-dropdown > .p-dropdown-trigger")
    .click();
  await page1.getByText("C2-C03").click();
  await page1.locator(".p-button.p-component.p-autocomplete-dropdown").click();
  await page1
    .getByRole("option", { name: "Admin - admin@onechanneladmin" })
    .click();
  await page1.getByRole("button", { name: "Update" }).click();
  await page1.getByText("Pick", { exact: true }).click();
  await page1
    .locator("div")
    .filter({ hasText: "Assign Pick/PackOrder" })
    .first()
    .click();
  await page1.getByRole("button", { name: "Close" }).click();
  await page1.getByText("a Pending").click();
  await page1.getByRole("button", { name: "Start PICK" }).click();
  await page1.locator(".p-xl-6 > div > .p-button").click();
  await page1.getByRole("button", { name: "Submit" }).click();
  await page1.getByRole("button", { name: "Confirm" }).click();
  await page1.goto(
    "https://admin.onechanneladmin.com/wms/orders?orderId=2026-000500&warehouse=wh1",
  );
  await page1.getByText("pack", { exact: true }).click();
  await page1
    .locator("#fulfillLpn > div > .p-dropdown > .p-dropdown-trigger")
    .click();
  await page1.getByText("A Block").nth(1).click();
  await page1.getByRole("button", { name: "Update" }).click();
  await page1.getByRole("button", { name: "Update" }).click();
  await page1.getByRole("spinbutton").nth(1).click();
  await page1.getByRole("button", { name: "Close" }).click();
});
