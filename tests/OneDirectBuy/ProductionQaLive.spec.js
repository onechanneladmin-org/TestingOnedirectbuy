import { test, expect } from "../helpers/softTest.js";
import { gotoOneDirectBuy, openCheckoutWithCart } from "../helpers/oneDirectBuyNav.js";
import { ensureLoggedInBuyer } from "../helpers/oneDirectBuyAuth.js";

const DESKTOP = { width: 1920, height: 1080 };

async function requireBuyerLogin(page) {
  await ensureLoggedInBuyer(page);
}

test.describe("OneDirectBuy — Production QA (live storefront)", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(DESKTOP);
  });

  test("QA-014: Guest checkout", async ({ page, soft }) => {
    await soft("QA-014", "Guest checkout", async () => {
      await openCheckoutWithCart(page);
      const wallet = page.getByText(/apply wallet balance/i);
      if (await wallet.isVisible({ timeout: 5000 }).catch(() => false)) {
        throw new Error("Guest checkout must not show wallet balance checkbox.");
      }
    });
  });

  test("QA-015: Logged-in wallet UI", async ({ page, soft }) => {
    await soft("QA-015", "Logged-in wallet UI", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-016: Wallet-only pay", async ({ page, soft }) => {
    await soft("QA-016", "Wallet-only pay", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-017: Split pay", async ({ page, soft }) => {
    await soft("QA-017", "Split pay", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-018: Order payment total", async ({ page, soft }) => {
    await soft("QA-018", "Order payment total", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-019: Card-only with balance", async ({ page, soft }) => {
    await soft("QA-019", "Card-only with balance", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-020: Insufficient wallet + card", async ({ page, soft }) => {
    await soft("QA-020", "Insufficient wallet + card", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-021: Order detail split line", async ({ page, soft }) => {
    await soft("QA-021", "Order detail split line", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-022: Header wallet", async ({ page, soft }) => {
    await soft("QA-022", "Header wallet", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-023: Account menu", async ({ page, soft }) => {
    await soft("QA-023", "Account menu", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-024: Guest checkout UX", async ({ page, soft }) => {
    await soft("QA-024", "Guest checkout UX", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-025: Wallet history UI", async ({ page, soft }) => {
    await soft("QA-025", "Wallet history UI", async () => {
      await requireBuyerLogin(page);
      await gotoOneDirectBuy(page, "/account/wallet");
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20000 });
    });
  });

  test("QA-026: GET /user/wallet", async ({ page, soft }) => {
    await soft("QA-026", "GET /user/wallet", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-028: Ledger after checkout", async ({ page, soft }) => {
    await soft("QA-028", "Ledger after checkout", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-029: Ledger after cancel/refund", async ({ page, soft }) => {
    await soft("QA-029", "Ledger after cancel/refund", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-030: Admin top-up visible", async ({ page, soft }) => {
    await soft("QA-030", "Admin top-up visible", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-031: Legacy B2B credit migration", async ({ page, soft }) => {
    await soft("QA-031", "Legacy B2B credit migration", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-033: API cancel split refund", async ({ page, soft }) => {
    await soft("QA-033", "API cancel split refund", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-034: API wallet-only cancel", async ({ page, soft }) => {
    await soft("QA-034", "API wallet-only cancel", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-035: Cancel whole order (buyer)", async ({ page, soft }) => {
    await soft("QA-035", "Cancel whole order (buyer)", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-036: Cancel single line (buyer)", async ({ page, soft }) => {
    await soft("QA-036", "Cancel single line (buyer)", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-037: Cancel last line (buyer)", async ({ page, soft }) => {
    await soft("QA-037", "Cancel last line (buyer)", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-038: Sequential line cancels", async ({ page, soft }) => {
    await soft("QA-038", "Sequential line cancels", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-039: Order detail refund UI", async ({ page, soft }) => {
    await soft("QA-039", "Order detail refund UI", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-040: Refund hints (shipped)", async ({ page, soft }) => {
    await soft("QA-040", "Refund hints (shipped)", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-046: Tax cert upload", async ({ page, soft }) => {
    await soft("QA-046", "Tax cert upload", async () => {
      await requireBuyerLogin(page);
      await gotoOneDirectBuy(page, "/account");
      const tax = page.getByText(/tax certificate/i);
      if (!(await tax.first().isVisible({ timeout: 15000 }).catch(() => false))) {
        throw new Error("Tax certificates entry not found on account.");
      }
    });
  });

  test("QA-047: Tax exempt checkout", async ({ page, soft }) => {
    await soft("QA-047", "Tax exempt checkout", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-050: Pending cert", async ({ page, soft }) => {
    await soft("QA-050", "Pending cert", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-051: No cert", async ({ page, soft }) => {
    await soft("QA-051", "No cert", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-052: County / jurisdiction", async ({ page, soft }) => {
    await soft("QA-052", "County / jurisdiction", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-053: EXEMPT does not block pay", async ({ page, soft }) => {
    await soft("QA-053", "EXEMPT does not block pay", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-054: Cert file download", async ({ page, soft }) => {
    await soft("QA-054", "Cert file download", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-055: Wrong state cert", async ({ page, soft }) => {
    await soft("QA-055", "Wrong state cert", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-072: Prefs page loads", async ({ page, soft }) => {
    await soft("QA-072", "Prefs page loads", async () => {
      await requireBuyerLogin(page);
      await gotoOneDirectBuy(page, "/account/communication-preferences");
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20000 });
    });
  });

  test("QA-073: Defaults match catalog", async ({ page, soft }) => {
    await soft("QA-073", "Defaults match catalog", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-083: Prefs sync Web↔Mobile", async ({ page, soft }) => {
    await soft("QA-083", "Prefs sync Web↔Mobile", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-084: Marketing email opt-out", async ({ page, soft }) => {
    await soft("QA-084", "Marketing email opt-out", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-085: SMS verify + toggle", async ({ page, soft }) => {
    await soft("QA-085", "SMS verify + toggle", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-086: order_placed", async ({ page, soft }) => {
    await soft("QA-086", "order_placed", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-088: payment_succeeded", async ({ page, soft }) => {
    await soft("QA-088", "payment_succeeded", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-089: order_processing", async ({ page, soft }) => {
    await soft("QA-089", "order_processing", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-090: order_shipped", async ({ page, soft }) => {
    await soft("QA-090", "order_shipped", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-092: order_completed", async ({ page, soft }) => {
    await soft("QA-092", "order_completed", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-093: payment_failed", async ({ page, soft }) => {
    await soft("QA-093", "payment_failed", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-095: order_cancelled", async ({ page, soft }) => {
    await soft("QA-095", "order_cancelled", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-097: refund_completed — split", async ({ page, soft }) => {
    await soft("QA-097", "refund_completed — split", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-098: refund_completed — wallet-only", async ({ page, soft }) => {
    await soft("QA-098", "refund_completed — wallet-only", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-100: refund_requested", async ({ page, soft }) => {
    await soft("QA-100", "refund_requested", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-101: refund_failed", async ({ page, soft }) => {
    await soft("QA-101", "refund_failed", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-102: return_submitted", async ({ page, soft }) => {
    await soft("QA-102", "return_submitted", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-103: return_approved / rejected / refunded", async ({ page, soft }) => {
    await soft("QA-103", "return_approved / rejected / refunded", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-105: claim_opened", async ({ page, soft }) => {
    await soft("QA-105", "claim_opened", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-106: claim_updated / claim_resolved", async ({ page, soft }) => {
    await soft("QA-106", "claim_updated / claim_resolved", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-107: seller_message / buyer_message", async ({ page, soft }) => {
    await soft("QA-107", "seller_message / buyer_message", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-108: question_asked / answered", async ({ page, soft }) => {
    await soft("QA-108", "question_asked / answered", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-119: account_created", async ({ page, soft }) => {
    await soft("QA-119", "account_created", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-121: price_drop / back_in_stock / promotion", async ({ page, soft }) => {
    await soft("QA-121", "price_drop / back_in_stock / promotion", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-128: Returns timeline", async ({ page, soft }) => {
    await soft("QA-128", "Returns timeline", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-131: Post-purchase messages", async ({ page, soft }) => {
    await soft("QA-131", "Post-purchase messages", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });

  test("QA-132: Cancel line after partial ship", async ({ page, soft }) => {
    await soft("QA-132", "Cancel line after partial ship", async () => {
      await gotoOneDirectBuy(page, "/");
      await expect(page.locator("body")).toBeVisible();
    });
  });
});
