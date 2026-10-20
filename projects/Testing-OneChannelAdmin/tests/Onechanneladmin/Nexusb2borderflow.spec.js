import { test, expect } from "@playwright/test";

test("test", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByRole("link", { name: "Catalog" }).click();
  await page.goto("http://localhost:3000/products");
  await page
    .locator("div")
    .filter({ hasText: /^Home\/Catalog$/ })
    .nth(1)
    .click();
  await page.getByRole("button", { name: "Add to cart" }).nth(1).click();
  await page.getByRole("button").filter({ hasText: /^$/ }).nth(2).click();
  await page.getByRole("button").filter({ hasText: /^$/ }).nth(3).click();
  await page.getByRole("button", { name: "Accept All" }).click();
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await page.getByRole("button").nth(5).click();
  await page.getByText("Login").click();
  await page.getByRole("button").nth(5).click();
  await page.getByText("Login").click();
  await page.goto("http://localhost:3000/login");
  await page.getByRole("textbox", { name: "Email address" }).click();
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("admin@onechanneladmin.com");
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill((process.env.TEST_LOGIN_PASSWORD || ""));
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("button").filter({ hasText: /^$/ }).nth(4).click();
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).click();
  await page.getByRole("textbox", { name: "Password" }).fill((process.env.TEST_LOGIN_PASSWORD || ""));
  await page.getByRole("button", { name: "Login" }).click();
  await page.goto("http://localhost:3000/");
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Proceed to Checkout" }).click();
  await page.goto("http://localhost:3000/checkout");
  await page.getByRole("textbox", { name: "John", exact: true }).click();
  await page.getByRole("textbox", { name: "John", exact: true }).fill("Admin");
  await page.getByRole("textbox", { name: "Doe", exact: true }).click();
  await page.getByRole("textbox", { name: "Doe", exact: true }).fill("Test");
  await page.getByRole("textbox", { name: "(555) 123-" }).click();
  await page.getByRole("textbox", { name: "(555) 123-" }).fill("1234567891");
  await page.getByRole("textbox", { name: "Main Street" }).click();
  await page.getByRole("textbox", { name: "Main Street" }).fill("Orlando");
  await page.getByRole("combobox").selectOption("Alaska");
  await page.getByRole("textbox", { name: "10001" }).click();
  await page.getByRole("textbox", { name: "10001" }).fill("32189");
  await page.getByRole("textbox", { name: "New York" }).click();
  await page.getByRole("textbox", { name: "New York" }).fill("Texas");
  await page.getByRole("textbox", { name: "10001" }).click();
  await page.getByRole("textbox", { name: "10001" }).fill("32003");
  await page.getByRole("heading", { name: "Delivery Method" }).click();
  await page.getByRole("textbox", { name: "New York" }).click();
  await page
    .getByRole("textbox", { name: "New York" })
    .press("ControlOrMeta+a");
  await page.getByRole("textbox", { name: "New York" }).fill("Florida");
  await page.getByText("First Name *Last Name *Email").click();
  await page.getByRole("button", { name: "Continue to Payment" }).click();
  await page
    .locator('iframe[name="single-card-60a1cbc7-397b-ee97-0428-62f4b6d47f94"]')
    .contentFrame()
    .getByRole("textbox", { name: "Card number" })
    .click();
  await page
    .locator('iframe[name="single-card-60a1cbc7-397b-ee97-0428-62f4b6d47f94"]')
    .contentFrame()
    .getByRole("textbox", { name: "Card number" })
    .fill("4111 1111 1111 1111");
  await page
    .locator('iframe[name="single-card-60a1cbc7-397b-ee97-0428-62f4b6d47f94"]')
    .contentFrame()
    .getByRole("textbox", { name: "MM/YY" })
    .fill("12/33");
  await page
    .locator('iframe[name="single-card-60a1cbc7-397b-ee97-0428-62f4b6d47f94"]')
    .contentFrame()
    .getByRole("textbox", { name: "CVV" })
    .fill("123");
  await page
    .locator('iframe[name="single-card-60a1cbc7-397b-ee97-0428-62f4b6d47f94"]')
    .contentFrame()
    .getByRole("textbox", { name: "ZIP" })
    .fill("32003");
  await page.getByRole("button", { name: "Pay" }).click();
});
