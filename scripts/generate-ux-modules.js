/**
 * One-shot generator for UX Module TSV catalogs + Playwright specs.
 * Usage: node scripts/generate-ux-modules.js
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "tests", "OneDirectBuy", "ux-modules");

const modules = [
  {
    slug: "variation-aggregates",
    spec: "VariationAggregates.spec.js",
    describe: "UX Modules — Variation Aggregates",
    file: "variationAggregates.test.js",
    runner: "jest",
    module: "Variation Aggregates",
    priority: "P1",
    cases: [
      ["ODB-UX-001", "summarizeListings picks cheapest listing"],
      ["ODB-UX-002", "computeVariationAggregates per variant"],
      ["ODB-UX-003", "listingsForEmbeddedVariant includes parent fallback"],
      [
        "ODB-UX-004",
        "listingsForProductAggregate excludes parent row when variant listings exist",
      ],
      ["ODB-UX-005", "paginateVariantsWithPin keeps deep-linked variant"],
    ],
  },
  {
    slug: "seller-rating",
    spec: "SellerRating.spec.js",
    describe: "UX Modules — Seller Rating",
    file: "sellerRatingService.test.js",
    runner: "node:test",
    module: "Seller Rating",
    priority: "P0",
    cases: [
      ["ODB-UX-006", "seller rating: cancelled order is ineligible"],
      ["ODB-UX-007", "seller rating: unpaid order is ineligible"],
      ["ODB-UX-008", "seller rating: shipped paid order is eligible"],
      ["ODB-UX-009", "seller rating: processing with shipped item is eligible"],
      [
        "ODB-UX-010",
        "seller rating: new paid order with no shipped items is ineligible",
      ],
    ],
  },
  {
    slug: "product-atlas-search",
    spec: "ProductAtlasSearch.spec.js",
    describe: "UX Modules — Product Atlas Search",
    file: "productAtlasSearch.test.js",
    runner: "jest",
    module: "Product Atlas Search",
    priority: "P1",
    cases: [
      [
        "ODB-UX-011",
        "buildFitmentKeysAtlasClause uses equals for a single YMM key",
      ],
      ["ODB-UX-012", "buildFitmentKeysAtlasClause uses in for multiple keys"],
      [
        "ODB-UX-013",
        "buildVehicleFitAtlasClause includes universal for fitMode all",
      ],
      [
        "ODB-UX-014",
        "buildVehicleFitAtlasClause returns null when trim/engine present",
      ],
      ["ODB-UX-015", "buildAtlasSearchCompound status filter is approved-only"],
      ["ODB-UX-016", "buildFallbackMongoFilter uses fitmentKeys for YMM"],
      [
        "ODB-UX-017",
        "buildFallbackMongoFilter uses fitmentIndex elemMatch for trim",
      ],
      ["ODB-UX-018", "Atlas index definition includes filter fields used by search"],
    ],
  },
  {
    slug: "multi-seller-order",
    spec: "MultiSellerOrder.spec.js",
    describe: "UX Modules — Multi-Seller Order",
    file: "multiSellerOrder.test.js",
    runner: "node:test",
    module: "Multi-Seller Order",
    priority: "P0",
    cases: [
      ["ODB-UX-019", "multi-seller: one seller shipped keeps parent processing"],
      ["ODB-UX-020", "multi-seller: all sellers shipped marks parent shipped"],
      ["ODB-UX-021", "multi-seller: parent totals reconcile per seller lines"],
    ],
  },
  {
    slug: "listing-variation-resolver",
    spec: "ListingVariationResolver.spec.js",
    describe: "UX Modules — Listing Variation Resolver",
    file: "listingVariationResolver.test.js",
    runner: "jest",
    module: "Listing Variation Resolver",
    priority: "P1",
    cases: [
      ["ODB-UX-022", "isListingBuyable accepts legacy rows without status"],
      ["ODB-UX-023", "resolveListingProductId returns the catalog product id"],
      [
        "ODB-UX-024",
        "resolveActiveListingForCart resolves by productId and variationId",
      ],
      [
        "ODB-UX-025",
        "resolveActiveListingForCart falls back from inactive listingId when productId is provided",
      ],
      [
        "ODB-UX-026",
        "parentListingFallbackForEmbeddedVariant matches parent listing rows",
      ],
    ],
  },
  {
    slug: "listing-pricing",
    spec: "ListingPricing.spec.js",
    describe: "UX Modules — Listing Pricing",
    file: "listingPricing.test.js",
    runner: "jest",
    module: "Listing Pricing",
    priority: "P1",
    cases: [
      ["ODB-UX-027", "normalizeB2bPricingInput sorts and dedupes tiers"],
      ["ODB-UX-028", "resolveB2bUnitPrice picks highest qualifying tier"],
      ["ODB-UX-029", "getListingLineUnitPrice uses min(consumer, b2b)"],
      ["ODB-UX-030", "sale price beats b2b when lower"],
    ],
  },
  {
    slug: "fitment-keys",
    spec: "FitmentKeys.spec.js",
    describe: "UX Modules — Fitment Keys",
    file: "fitmentKeys.test.js",
    runner: "jest",
    module: "Fitment Keys",
    priority: "P1",
    cases: [
      ["ODB-UX-031", "buildProgressiveKeysFromVehicle base and full key"],
      ["ODB-UX-032", "buildUserFitmentKeys YMM exact"],
      ["ODB-UX-033", "computeFitmentKeysFromEntries dedupes"],
      ["ODB-UX-034", "extractYearsFromFitmentKeys"],
    ],
  },
  {
    slug: "fitment-index",
    spec: "FitmentIndex.spec.js",
    describe: "UX Modules — Fitment Index",
    file: "fitmentIndex.test.js",
    runner: "jest",
    module: "Fitment Index",
    priority: "P1",
    cases: [
      ["ODB-UX-035", "fitmentEntryMatchesVehicle honors empty trim wildcard"],
      ["ODB-UX-036", "computeProductVehicleFitFromIndex"],
      [
        "ODB-UX-037",
        "buildVehicleFitProductFilter all mode includes universal",
      ],
      ["ODB-UX-038", "buildVehicleFitProductFilter YMM-only uses fitmentKeys"],
    ],
  },
  {
    slug: "category-path-service",
    spec: "CategoryPathService.spec.js",
    describe: "UX Modules — Category Path Service",
    file: "categoryPathService.test.js",
    runner: "jest",
    module: "Category Path Service",
    priority: "P1",
    cases: [
      ["ODB-UX-039", "catalogSlugVariants covers hyphen and underscore"],
      ["ODB-UX-040", "pathSlugSegment is kebab-case"],
      [
        "ODB-UX-041",
        "buildPathFields emits kebab pathKey from underscore slugs",
      ],
      ["ODB-UX-042", "normalizePathKey joins segments"],
    ],
  },
  {
    slug: "catalog-validation",
    spec: "CatalogValidation.spec.js",
    describe: "UX Modules — Catalog Validation",
    file: "catalogValidation.test.js",
    runner: "node:test",
    module: "Catalog Validation",
    priority: "P0",
    cases: [
      [
        "ODB-UX-043",
        "product validation requires title, brand, category, images, mpn, gtin or exemption",
      ],
      ["ODB-UX-044", "product validation rejects missing images and mpn"],
      [
        "ODB-UX-045",
        "listing validation requires price greater than zero and qty",
      ],
    ],
  },
  {
    slug: "seller-status",
    spec: "SellerStatus.spec.js",
    describe: "UX Modules — Seller Status",
    file: "sellers/sellerStatusService.test.js",
    runner: "jest",
    module: "Seller Status",
    priority: "P0",
    cases: [
      ["ODB-UX-046", "resolveSellerStatus keeps pending applications blocked"],
      [
        "ODB-UX-047",
        "resolveSellerStatus does not treat pending+active as operational",
      ],
      ["ODB-UX-048", "active sellers can accept orders when permitted"],
      [
        "ODB-UX-049",
        "resolveSellerStatus honors active=false even when status is active",
      ],
      ["ODB-UX-050", "legacy sellers without status use active flag"],
    ],
  },
  {
    slug: "seller-onboarding-payload",
    spec: "SellerOnboardingPayload.spec.js",
    describe: "UX Modules — Seller Onboarding Payload",
    file: "sellers/sellerOnboardingPayload.test.js",
    runner: "jest",
    module: "Seller Onboarding Payload",
    priority: "P0",
    cases: [
      [
        "ODB-UX-051",
        "buildPublicSellerApplicationBody maps wizard fields and pending lifecycle",
      ],
      [
        "ODB-UX-052",
        "buildPublicSellerApplicationBody preserves minimal storefront pipeline version",
      ],
      ["ODB-UX-053", "buildSellerPayloadFromWizard keeps admin create defaults"],
    ],
  },
  {
    slug: "audit-logs",
    spec: "AuditLogs.spec.js",
    describe: "UX Modules — Audit Logs",
    file: "security/auditLogs.test.js",
    runner: "jest",
    module: "Audit Logs",
    priority: "P0",
    cases: [
      [
        "ODB-UX-054",
        "Security event logged — invalid token triggers audit log without sensitive data leakage",
      ],
      [
        "ODB-UX-055",
        "Security event logged — forbidden scope triggers audit log without sensitive data leakage",
      ],
      [
        "ODB-UX-056",
        "Security event logged — invalid API key triggers audit log without sensitive data leakage",
      ],
    ],
  },
  {
    slug: "verify-recaptcha",
    spec: "VerifyRecaptcha.spec.js",
    describe: "UX Modules — Verify reCAPTCHA",
    file: "recaptcha/verifyRecaptcha.test.js",
    runner: "jest",
    module: "Verify reCAPTCHA",
    priority: "P0",
    cases: [
      ["ODB-UX-057", "assertHoneypotClean rejects filled honeypot"],
      ["ODB-UX-058", "assertHumanTiming rejects too-fast submit"],
      [
        "ODB-UX-059",
        "verifyRecaptchaToken skips when bypass enabled and no secret",
      ],
      ["ODB-UX-060", "isRecaptchaEnforced when secret is set"],
    ],
  },
  {
    slug: "privacy-request",
    spec: "PrivacyRequest.spec.js",
    describe: "UX Modules — Privacy Request",
    file: "privacy/privacyRequest.test.js",
    runner: "jest",
    module: "Privacy Request",
    priority: "P0",
    cases: [
      [
        "ODB-UX-061",
        "Data access export includes allowed records and excludes restricted internal data",
      ],
      [
        "ODB-UX-062",
        "Deletion respects legal retention — orders retained and personal fields anonymized",
      ],
      [
        "ODB-UX-063",
        "Privacy request audit log records action, admin, timestamp, reason, and result",
      ],
    ],
  },
  {
    slug: "scheduled-jobs",
    spec: "ScheduledJobs.spec.js",
    describe: "UX Modules — Scheduled Jobs",
    file: "jobs/scheduledJobs.test.js",
    runner: "jest",
    module: "Scheduled Jobs",
    priority: "P0",
    cases: [
      [
        "ODB-UX-064",
        "Scheduled job runs once per period — duplicate trigger records only one logical run",
      ],
      [
        "ODB-UX-065",
        "Missed job recovery — scheduler restart logs missed critical periods per policy",
      ],
      [
        "ODB-UX-066",
        "Missed job recovery — run policy executes missed period once on restart",
      ],
    ],
  },
  {
    slug: "job-queue",
    spec: "JobQueue.spec.js",
    describe: "UX Modules — Job Queue",
    file: "jobs/jobQueue.test.js",
    runner: "jest",
    module: "Job Queue",
    priority: "P0",
    cases: [
      [
        "ODB-UX-067",
        "Failed job retry — worker retries according to retry policy",
      ],
      [
        "ODB-UX-068",
        "Dead-letter queue handling — repeated failures move job to DLQ with error details",
      ],
      [
        "ODB-UX-069",
        "Job idempotency — duplicate delivery does not create duplicate side effects",
      ],
    ],
  },
  {
    slug: "transaction-integrity",
    spec: "TransactionIntegrity.spec.js",
    describe: "UX Modules — Transaction Integrity",
    file: "database/transactionIntegrity.test.js",
    runner: "jest",
    module: "Transaction Integrity",
    priority: "P0",
    cases: [
      [
        "ODB-UX-070",
        "Checkout transaction rollback — mid-process failure leaves no partial records",
      ],
      [
        "ODB-UX-071",
        "Checkout transaction commit — successful checkout updates inventory and cart atomically",
      ],
    ],
  },
  {
    slug: "api-key",
    spec: "ApiKey.spec.js",
    describe: "UX Modules — API Keys",
    file: "api/apiKey.test.js",
    runner: "jest",
    module: "API Keys",
    priority: "P0",
    cases: [
      [
        "ODB-UX-072",
        "API key generated and shown once — raw key shown once and only hashed value stored",
      ],
      ["ODB-UX-073", "Revoked API key blocked — API returns unauthorized"],
      [
        "ODB-UX-074",
        "API key scope enforcement — endpoint outside scope returns forbidden",
      ],
      [
        "ODB-UX-075",
        "API key rate limit — exceeding threshold returns 429 and rate limit headers",
      ],
      [
        "ODB-UX-076",
        "API usage logging — records key ID, endpoint, status, latency, and timestamp",
      ],
    ],
  },
];

function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

fs.mkdirSync(dir, { recursive: true });

for (const mod of modules) {
  const tsvLines = [
    "Use Case ID\tModule\tActor\tUse Case\tDescription\tPriority\tAutomation\tCurrent Onedirectbuy Status",
  ];
  for (const [id, title] of mod.cases) {
    tsvLines.push(
      [id, mod.module, "System", title, title, mod.priority, "Yes", "Working"].join(
        "\t",
      ),
    );
  }
  fs.writeFileSync(path.join(dir, `${mod.slug}.tsv`), `${tsvLines.join("\n")}\n`, "utf8");

  const tests = mod.cases
    .map(
      ([id, title]) => `  test("${esc(id)}: ${esc(title)}", async ({ soft }) => {
    await soft("${esc(id)}", "${esc(title)}", async () => {
      await runUxModuleCase({
        file: "${esc(mod.file)}",
        testName: "${esc(title)}",
        runner: "${mod.runner}",
      });
    });
  });`,
    )
    .join("\n\n");

  const spec = `import { test } from "../../helpers/softTest.js";
import { runUxModuleCase, backendSkipReason } from "../../helpers/uxModules.js";

test.describe("${esc(mod.describe)}", () => {
  test.beforeEach(() => {
    const reason = backendSkipReason();
    test.skip(Boolean(reason), reason || "Backend unavailable");
    test.setTimeout(180000);
  });

${tests}
});
`;
  fs.writeFileSync(path.join(dir, mod.spec), spec, "utf8");
}

console.log(
  `wrote ${modules.length} modules, ${modules.reduce((n, m) => n + m.cases.length, 0)} cases`,
);
