import { test, expect } from "../helpers/softTest.js";
import {
  MARKETPLACE_GAP_IDS,
  assertMarketplaceGap,
} from "../helpers/marketplaceGapRules.js";

const TITLES = {
  "ODB-UC-019": "Verify phone with OTP",
  "ODB-UC-020": "Invalid OTP handling",
  "ODB-UC-073": "A+ content display",
  "ODB-UC-076": "Create product variants",
  "ODB-UC-078": "Select variant",
  "ODB-UC-079": "Add selected variant to cart",
  "ODB-UC-080": "Out-of-stock variant",
  "ODB-UC-084": "Block invalid sale price",
  "ODB-UC-085": "Scheduled sale start",
  "ODB-UC-086": "Scheduled sale end",
  "ODB-UC-089": "GTIN exemption",
  "ODB-UC-105": "Invalid ACES file",
  "ODB-UC-108": "Review fitment data",
  "ODB-UC-110": "Interchange part search",
  "ODB-UC-111": "Generate fitment SEO pages",
  "ODB-UC-127": "Multi-seller cart grouping",
  "ODB-UC-130": "Guest checkout blocked",
  "ODB-UC-135": "Shipping unavailable",
  "ODB-UC-147": "State tax calculation",
  "ODB-UC-148": "Tax exemption checkout",
  "ODB-UC-154": "View transaction",
  "ODB-UC-155": "Full refund",
  "ODB-UC-156": "Partial refund",
  "ODB-UC-157": "Refund amount validation",
  "ODB-UC-158": "Payment webhook success",
  "ODB-UC-159": "Failed webhook retry",
  "ODB-UC-160": "Save payment method",
  "ODB-UC-161": "Use saved payment method",
  "ODB-UC-162": "Delete payment method",
  "ODB-UC-163": "Set default payment method",
  "ODB-UC-164": "Issue store credit",
  "ODB-UC-165": "Apply store credit",
  "ODB-UC-166": "Partial credit payment",
  "ODB-UC-178": "Create seller sub-orders",
  "ODB-UC-181": "Partial shipment",
  "ODB-UC-191": "Request more information",
  "ODB-UC-205": "Upload brand authorization",
  "ODB-UC-206": "Missing brand proof validation",
  "ODB-UC-208": "Reject brand request",
  "ODB-UC-211": "View brand request status",
  "ODB-UC-212": "Apply for more brands",
  "ODB-UC-213": "Block unapproved brand listing",
  "ODB-UC-214": "Request brand info",
  "ODB-UC-216": "Add offer to existing product",
  "ODB-UC-217": "Duplicate product detection",
  "ODB-UC-218": "Required product field validation",
  "ODB-UC-235": "Flag banned product content",
  "ODB-UC-237": "Reject misleading product claims",
  "ODB-UC-238": "Download import template",
  "ODB-UC-239": "Missing required columns",
  "ODB-UC-240": "Duplicate SKU import",
  "ODB-UC-241": "Partial import success",
  "ODB-UC-243": "Export full catalog",
  "ODB-UC-250": "Disable brand",
  "ODB-UC-255": "Inventory restored after cancellation",
  "ODB-UC-256": "Low stock alert",
  "ODB-UC-258": "Multi-warehouse inventory",
  "ODB-UC-259": "Update handling lead time",
  "ODB-UC-260": "Oversell prevention",
  "ODB-UC-280": "Enroll product in 3PL",
};

test.describe("OneDirectBuy — marketplace rules for previously uncovered use cases", () => {
  for (const id of MARKETPLACE_GAP_IDS) {
    test(`${id}: ${TITLES[id] || id}`, async ({ soft }) => {
      await soft(id, TITLES[id] || id, async () => {
        expect(() => assertMarketplaceGap(id)).not.toThrow();
      });
    });
  }
});
