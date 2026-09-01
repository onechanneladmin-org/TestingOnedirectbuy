import { test } from "../helpers/softTest.js";
import {
  brandApprovalWorkspaceVisible,
  sellerPortalNotOnStorefrontError,
} from "../helpers/oneDirectBuySeller.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireBrandWorkspace(page, feature) {
  if (await brandApprovalWorkspaceVisible(page)) return;
  throw new Error(sellerPortalNotOnStorefrontError(feature));
}

function laterVersion(feature) {
  return `${feature} is not implemented on the storefront (sheet: Later versions to include).`;
}

test.describe("OneDirectBuy — Brand approval (seller/admin)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("ODB-UC-203: request existing brand approval", async ({ page, soft }) => {
    await soft("ODB-UC-203", "Seller can request an existing brand (no live submit)", async () => {
      await requireBrandWorkspace(page, "Request existing brand approval");
    });
  });

  test("ODB-UC-204: request new brand creation", async ({ page, soft }) => {
    await soft("ODB-UC-204", "Seller can request a new brand (no live submit)", async () => {
      await requireBrandWorkspace(page, "Request new brand creation");
    });
  });

  test("ODB-UC-205: upload brand authorization is later-version", async ({
    soft,
  }) => {
    await soft("ODB-UC-205", "Upload brand authorization (Later versions to include)", async () => {
      throw new Error(laterVersion("Upload brand authorization"));
    });
  });

  test("ODB-UC-206: missing brand proof is later-version", async ({ soft }) => {
    await soft("ODB-UC-206", "Missing brand proof validation (Later versions to include)", async () => {
      throw new Error(laterVersion("Missing brand proof validation"));
    });
  });

  test("ODB-UC-207: approve brand selling request", async ({ page, soft }) => {
    await soft("ODB-UC-207", "Admin approve brand selling request", async () => {
      await requireBrandWorkspace(page, "Approve brand selling request");
    });
  });

  test("ODB-UC-208: reject brand request is later-version", async ({ soft }) => {
    await soft("ODB-UC-208", "Reject brand request (Later versions to include)", async () => {
      throw new Error(laterVersion("Reject brand request"));
    });
  });

  test("ODB-UC-209: approve new brand", async ({ page, soft }) => {
    await soft("ODB-UC-209", "Admin approve new brand", async () => {
      await requireBrandWorkspace(page, "Approve new brand");
    });
  });

  test("ODB-UC-210: merge duplicate brand", async ({ page, soft }) => {
    await soft("ODB-UC-210", "Admin merge duplicate brand", async () => {
      await requireBrandWorkspace(page, "Merge duplicate brand");
    });
  });

  test("ODB-UC-211: view brand request status is later-version", async ({
    soft,
  }) => {
    await soft("ODB-UC-211", "View brand request status (Later versions to include)", async () => {
      throw new Error(laterVersion("View brand request status"));
    });
  });

  test("ODB-UC-212: apply for more brands is later-version", async ({ soft }) => {
    await soft("ODB-UC-212", "Apply for more brands (Later versions to include)", async () => {
      throw new Error(laterVersion("Apply for more brands"));
    });
  });

  test("ODB-UC-213: block unapproved brand listing is later-version", async ({
    soft,
  }) => {
    await soft(
      "ODB-UC-213",
      "Block unapproved brand listing (Later versions to include)",
      async () => {
        throw new Error(laterVersion("Block unapproved brand listing"));
      },
    );
  });

  test("ODB-UC-214: request brand info is later-version", async ({ soft }) => {
    await soft("ODB-UC-214", "Admin request brand info (Later versions to include)", async () => {
      throw new Error(laterVersion("Request brand info"));
    });
  });
});
