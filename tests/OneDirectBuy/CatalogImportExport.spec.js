import { test } from "../helpers/softTest.js";
import {
  catalogMasterDataVisible,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireMasterData(page, feature) {
  if (await catalogMasterDataVisible(page)) return;
  throw new Error(sellerPortalNotOnStorefrontError(feature));
}

async function notRequiredIfAbsent(page, feature) {
  if (await catalogMasterDataVisible(page)) {
    throw new Error(
      `${feature} is present; sheet marks this as Not Required.`,
    );
  }
}

test.describe("OneDirectBuy — Catalog import, export, and master data", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-238: download import template is not required", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-238", "Download import template absent (Not Required)", async () => {
      await notRequiredIfAbsent(page, "Download import template");
    });
  });

  test("ODB-UC-239: missing required columns is not required", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-239", "Missing required columns absent (Not Required)", async () => {
      await notRequiredIfAbsent(page, "Missing required columns");
    });
  });

  test("ODB-UC-240: duplicate SKU import is not required", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-240", "Duplicate SKU import absent (Not Required)", async () => {
      await notRequiredIfAbsent(page, "Duplicate SKU import");
    });
  });

  test("ODB-UC-241: partial import success is not required", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-241", "Partial import success absent (Not Required)", async () => {
      await notRequiredIfAbsent(page, "Partial import success");
    });
  });

  test("ODB-UC-242: export seller catalog", async ({ page, soft }) => {
    await soft("ODB-UC-242", "Export seller catalog (no live export)", async () => {
      await requireMasterData(page, "Export seller catalog");
    });
  });

  test("ODB-UC-243: export full catalog is not required", async ({
    page,
    soft,
  }) => {
    await soft("ODB-UC-243", "Export full catalog absent (Not Required)", async () => {
      await notRequiredIfAbsent(page, "Export full catalog");
    });
  });

  test("ODB-UC-244: create category", async ({ page, soft }) => {
    await soft("ODB-UC-244", "Create category (no live catalog change)", async () => {
      await requireMasterData(page, "Create category");
    });
  });

  test("ODB-UC-245: edit category", async ({ page, soft }) => {
    await soft("ODB-UC-245", "Edit category (no live catalog change)", async () => {
      await requireMasterData(page, "Edit category");
    });
  });

  test("ODB-UC-246: disable category", async ({ page, soft }) => {
    await soft("ODB-UC-246", "Disable category (no live catalog change)", async () => {
      await requireMasterData(page, "Disable category");
    });
  });

  test("ODB-UC-247: create category attribute", async ({ page, soft }) => {
    await soft("ODB-UC-247", "Create category attribute (no live catalog change)", async () => {
      await requireMasterData(page, "Create category attribute");
    });
  });

  test("ODB-UC-248: required attribute validation", async ({ page, soft }) => {
    await soft("ODB-UC-248", "Required attribute validation (no live catalog change)", async () => {
      await requireMasterData(page, "Required attribute validation");
    });
  });

  test("ODB-UC-249: create brand manually", async ({ page, soft }) => {
    await soft("ODB-UC-249", "Create brand manually (no live catalog change)", async () => {
      await requireMasterData(page, "Create brand manually");
    });
  });

  test("ODB-UC-250: disable brand is not required", async ({ page, soft }) => {
    await soft("ODB-UC-250", "Disable brand absent (Not Required)", async () => {
      await notRequiredIfAbsent(page, "Disable brand");
    });
  });
});
