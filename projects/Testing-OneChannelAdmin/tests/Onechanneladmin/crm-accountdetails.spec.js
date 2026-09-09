import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

test("test", async ({ page }) => {
  await loginOneChannelAdmin(page);
  await page.getByRole("button", { name: "CRM" }).click();
  await page.getByRole("link", { name: "B2B Accounts" }).click();
  await page.getByText("AUTO10", { exact: true }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Enter Company Name" }).click();
  await page
    .getByRole("textbox", { name: "Enter Company Name" })
    .fill("AUTO10 Edit");
  await page.getByRole("textbox", { name: "Enter Email" }).click();
  await page.getByRole("textbox", { name: "Enter Email" }).click();
  await page.getByRole("textbox", { name: "Enter Email" }).click();
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowRight");
  await page
    .getByRole("textbox", { name: "Enter Email" })
    .fill("persisedit@1channeladmin.com");
  await page
    .locator("span")
    .filter({ hasText: /^Active$/ })
    .click();
  await page.getByRole("option", { name: "Inactive" }).click();
  await page.locator(".p-button.p-component.p-autocomplete-dropdown").click();
  await page.getByRole("option", { name: "sudhapsk@yahoo.com" }).click();
  await page
    .locator("span")
    .filter({ hasText: /^Vendor$/ })
    .click();
  await page.getByRole("option", { name: "Prospect" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("textbox", { name: "Enter Company Name" }).click();
  await page
    .getByRole("textbox", { name: "Enter Company Name" })
    .fill("AUTO10");
  await page.getByRole("textbox", { name: "Enter Email" }).click();
  await page.getByRole("textbox", { name: "Enter Email" }).click();
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Email" }).press("ArrowRight");
  await page
    .getByRole("textbox", { name: "Enter Email" })
    .fill("persis@1channeladmin.com");
  await page.locator("span").filter({ hasText: "Inactive" }).click();
  await page.getByRole("option", { name: "Active", exact: true }).click();
  await page.getByRole("searchbox", { name: "User" }).click();
  await page.locator(".p-button.p-component.p-autocomplete-dropdown").click();
  await page
    .getByRole("option", { name: "hamzashaikh@1channeladmin.com" })
    .click();
  await page
    .locator(
      "div:nth-child(6) > div:nth-child(2) > .p-dropdown > .p-dropdown-trigger"
    )
    .click();
  await page.getByRole("option", { name: "Partner" }).click();
  await page.getByRole("button", { name: "Save" }).click();
});
