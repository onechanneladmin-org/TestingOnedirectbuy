import { test } from "../helpers/softTest.js";

const DESKTOP = { width: 1920, height: 1080 };

function laterVersion(feature) {
  return `${feature} is not implemented on the storefront (sheet: Later versions to include).`;
}

test.describe("OneDirectBuy — OneFulfillmentCenter / 3PL fulfillment", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-280: enroll product in 3PL", async ({ soft }) => {
    await soft(
      "ODB-UC-280",
      "Enroll product in 3PL (Later versions to include)",
      async () => {
        throw new Error(laterVersion("Enroll product in OneFulfillmentCenter / 3PL"));
      },
    );
  });
});
