import { test, expect } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

test("test", async ({ page }) => {
  await loginOneChannelAdmin(page);
  await page.getByRole("button", { name: "CRM" }).click();
  await page.getByRole("link", { name: "B2B Accounts" }).click();
  await page
    .getByRole("row", { name: "AUTO10 persis@1channeladmin." })
    .getByRole("checkbox")
    .click();
  await page
    .getByRole("row", { name: " AUTO10 persis@1channeladmin" })
    .getByRole("checkbox")
    .click();
  await page.getByRole("button", { name: " Accounts" }).click();
  await page.getByRole("textbox", { name: "Company *" }).click();
  await page.getByRole("textbox", { name: "Company *" }).fill("New Company 12");
  await page.getByRole("textbox", { name: "Enter Website" }).click();
  await page
    .getByRole("textbox", { name: "Enter Website" })
    .fill("newcompanywebsite12");
  await page.getByRole("textbox", { name: "Enter Description" }).click();
  await page
    .getByRole("textbox", { name: "Enter Description" })
    .fill("Test Description");
  await page.locator("span").filter({ hasText: "Select Company Type" }).click();
  await page.getByRole("option", { name: "Partner" }).click();
  await page.locator("span").filter({ hasText: "Select Industry" }).click();
  await page.getByRole("option", { name: "Accounting" }).click();
  await page.getByRole("searchbox", { name: "Select Owner" }).click();
  await page.getByRole("searchbox", { name: "Select Owner" }).click();
  await page.getByRole("searchbox", { name: "Select Owner" }).fill("admin");
  await page
    .getByRole("option", { name: "hamzashaikh@1channeladmin.com" })
    .click();
  await page.getByRole("textbox", { name: "Enter Email" }).click();
  await page
    .getByRole("textbox", { name: "Enter Email" })
    .fill("testcomp@gmail.com");
  await page.locator(".p-inputtext.p-component.p-inputmask").click();
  await page.getByRole("button", { name: " Submit" }).click();
  await page
    .getByRole("textbox", { name: "Enter Website" })
    .fill("newcompanywebsite12.com");
  await page.getByRole("textbox", { name: "Enter Website" }).click();
  await page.getByRole("textbox", { name: "Enter Website" }).click();
  await page.getByRole("textbox", { name: "Enter Website" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Website" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Website" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Website" }).press("ArrowLeft");
  await page.getByRole("textbox", { name: "Enter Website" }).press("ArrowLeft");
  await page
    .getByRole("textbox", { name: "Enter Website" })
    .fill("https://testnewcompanywebsite12.com");
  await page.getByRole("textbox", { name: "Enter Website" }).press("End");
  await page.getByRole("button", { name: " Submit" }).click();
  await page
    .getByRole("columnheader", { name: "Account  " })
    .locator("button")
    .click();
  await page.getByRole("textbox", { name: "Search by Account" }).click();
  await page.getByRole("textbox", { name: "Search by Account" }).fill("test");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button").filter({ hasText: /^$/ }).nth(1).click();
  await page.getByRole("textbox", { name: "Search by Account" }).click();
  await page.getByRole("textbox", { name: "Search by Account" }).fill("New ");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.getByRole("button", { name: "Clear all" }).click();
  await page.getByRole("tab", { name: "Contacts" }).click();
  await page.getByRole("button", { name: " Contacts" }).click();
  await page
    .getByRole("button", { name: " Use AI to Autofill (BETA)" })
    .click();
  await page.getByRole("textbox", { name: "First Name *" }).click();
  await page.getByRole("textbox", { name: "First Name *" }).fill("anurag");
  await page.getByText("Email*").click();
  await page.getByText("Email*").click();
  await page.getByRole("textbox", { name: "First Name *" }).click();
  await page
    .getByRole("textbox", { name: "First Name *" })
    .fill("anuragsingh@onechanneladmin.com");
  await page.getByRole("textbox", { name: "Enter First Name" }).click();
  await page.getByRole("textbox", { name: "Enter First Name" }).fill("Anurag");
  await page.getByRole("textbox", { name: "Enter Last Name" }).click();
  await page.getByRole("textbox", { name: "Enter Last Name" }).fill("Singh");
  await page.getByRole("textbox", { name: "Enter Website" }).click();
  await page
    .getByRole("textbox", { name: "Enter Website" })
    .fill("testanu.com");
  await page.locator("div").filter({ hasText: "empty" }).nth(5).click();
  await page.getByRole("option", { name: "CEO" }).click();
  await page.locator("span").filter({ hasText: /^All$/ }).click();
  await page.getByRole("option", { name: "AUTOMAXX DISTRIBUTORS" }).click();
  await page
    .getByRole("textbox", { name: "Address line", exact: true })
    .click();
  await page
    .locator("div")
    .filter({ hasText: /^Address line 1$/ })
    .click();
  await page
    .getByRole("textbox", { name: "Address line", exact: true })
    .fill("testadd");
  await page.getByRole("button", { name: " Submit" }).click();
});
