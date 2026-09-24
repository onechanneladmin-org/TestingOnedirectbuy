import { test, expect } from "@playwright/test";
import { signInToOneChannelAdmin } from "../helpers/oneChannelAdminAuth.js";

test("Login page loads and allows login", async ({ page }) => {
  expect(process.env.TEST_LOGIN_PASSWORD, "TEST_LOGIN_PASSWORD is required").toBeTruthy();
  await signInToOneChannelAdmin(page);
  await expect(page).not.toHaveURL(/signin|login/i);
});
