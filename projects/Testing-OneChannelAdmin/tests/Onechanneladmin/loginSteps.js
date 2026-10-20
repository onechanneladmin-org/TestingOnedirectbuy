/**
 * One Channel Admin sign-in — same steps as login.spec.js.
 * @param {import('@playwright/test').Page} page
 * @param {{ email?: string; password?: string }} [credentials]
 */
export async function loginOneChannelAdmin(page, credentials = {}) {
  const email = credentials.email ?? "admin@onechanneladmin.com";
  const password = credentials.password ?? (process.env.TEST_LOGIN_PASSWORD || "");

  await page.goto("https://admin.onechanneladmin.com/signin?returnUrl=%2F");
  await page.getByRole("textbox", { name: "Email address" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}
