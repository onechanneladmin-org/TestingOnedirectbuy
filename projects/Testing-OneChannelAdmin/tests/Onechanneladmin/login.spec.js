import { test } from "@playwright/test";
import { loginOneChannelAdmin } from "./loginSteps.js";

test("Login page loads and allows login", async ({ page }) => {
  await loginOneChannelAdmin(page);
});
