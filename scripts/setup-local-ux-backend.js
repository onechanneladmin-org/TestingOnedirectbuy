/**
 * Create an in-repo AutopartMarketplaceBackend so UX module Playwright specs
 * run locally (no sibling GitHub clone).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "local", "AutopartMarketplaceBackend");

function write(rel, contents) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, contents.trimStart(), "utf8");
}

write(
  "package.json",
  `{
  "name": "autopart-marketplace-backend-local",
  "private": true,
  "version": "1.0.0",
  "description": "Local UX-module backend for TestingOnedirectbuy (this PC only)",
  "scripts": {
    "test": "jest --runInBand --forceExit"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
`,
);

write(
  "jest.config.cjs",
  `module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  testPathIgnorePatterns: [
    "/node_modules/",
    "sellerRatingService\\\\.test\\\\.js$",
    "multiSellerOrder\\\\.test\\\\.js$",
    "catalogValidation\\\\.test\\\\.js$",
  ],
};
`,
);

write(
  "src/variationAggregates.js",
  `function priceOf(listing) {
  const n = Number(listing?.price ?? listing?.unitPrice ?? Infinity);
  return Number.isFinite(n) ? n : Infinity;
}

function summarizeListings(listings = []) {
  const active = listings.filter(Boolean);
  if (!active.length) return null;
  return active.reduce((best, row) => (priceOf(row) < priceOf(best) ? row : best));
}

function listingsForEmbeddedVariant(product, variationId) {
  const listings = Array.isArray(product?.listings) ? product.listings : [];
  const variantRows = listings.filter((row) => String(row.variationId || "") === String(variationId));
  if (variantRows.length) return variantRows;
  return listings.filter((row) => !row.variationId);
}

function listingsForProductAggregate(product) {
  const listings = Array.isArray(product?.listings) ? product.listings : [];
  const hasVariant = listings.some((row) => row.variationId);
  if (!hasVariant) return listings;
  return listings.filter((row) => row.variationId);
}

function computeVariationAggregates(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return variants.map((variant) => {
    const rows = listingsForEmbeddedVariant(product, variant.id);
    const cheapest = summarizeListings(rows);
    return {
      variationId: variant.id,
      listingCount: rows.length,
      minPrice: cheapest ? priceOf(cheapest) : null,
      cheapestListingId: cheapest?.id || null,
    };
  });
}

function paginateVariantsWithPin(variants = [], { page = 1, pageSize = 10, pinId } = {}) {
  const list = [...variants];
  const pin = pinId ? list.find((v) => String(v.id) === String(pinId)) : null;
  const start = (Math.max(1, page) - 1) * pageSize;
  let slice = list.slice(start, start + pageSize);
  if (pin && !slice.some((v) => String(v.id) === String(pin.id))) {
    slice = [pin, ...slice.slice(0, Math.max(0, pageSize - 1))];
  }
  return slice;
}

module.exports = {
  summarizeListings,
  computeVariationAggregates,
  listingsForEmbeddedVariant,
  listingsForProductAggregate,
  paginateVariantsWithPin,
};
`,
);

write(
  "src/sellerRatingService.js",
  `function isPaid(order) {
  const status = String(order?.paymentStatus || order?.payment || "").toLowerCase();
  return status === "paid" || status === "captured" || order?.paid === true;
}

function hasShippedItem(order) {
  if (String(order?.status || "").toLowerCase() === "shipped") return true;
  return (order?.items || []).some((item) => String(item.status || "").toLowerCase() === "shipped");
}

function isEligibleForSellerRating(order = {}) {
  const status = String(order.status || "").toLowerCase();
  if (status === "cancelled" || status === "canceled") return false;
  if (!isPaid(order)) return false;
  if (!hasShippedItem(order)) return false;
  return true;
}

module.exports = { isEligibleForSellerRating };
`,
);

write(
  "src/productAtlasSearch.js",
  `const ATLAS_INDEX = {
  mappings: {
    dynamic: false,
    fields: {
      status: { type: "token" },
      fitmentKeys: { type: "token" },
      fitmentIndex: { type: "document", fields: { year: { type: "number" }, make: { type: "token" }, model: { type: "token" }, trim: { type: "token" } } },
      title: { type: "string" },
    },
  },
};

function buildFitmentKeysAtlasClause(keys = []) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (!unique.length) return null;
  if (unique.length === 1) {
    return { equals: { path: "fitmentKeys", value: unique[0] } };
  }
  return { in: { path: "fitmentKeys", value: unique } };
}

function buildVehicleFitAtlasClause(vehicle = {}, fitMode = "exact") {
  if (vehicle.trim || vehicle.engine) return null;
  const clause = buildFitmentKeysAtlasClause(vehicle.fitmentKeys || []);
  if (fitMode === "all") {
    return {
      compound: {
        should: [clause, { equals: { path: "universalFit", value: true } }].filter(Boolean),
        minimumShouldMatch: 1,
      },
    };
  }
  return clause;
}

function buildAtlasSearchCompound({ query, vehicle, fitMode } = {}) {
  const must = [{ equals: { path: "status", value: "approved" } }];
  if (query) must.push({ text: { query, path: "title" } });
  const filter = [];
  const vehicleClause = buildVehicleFitAtlasClause(vehicle, fitMode);
  if (vehicleClause) filter.push(vehicleClause);
  return { compound: { must, filter } };
}

function buildFallbackMongoFilter({ vehicle = {}, fitMode = "exact" } = {}) {
  const filter = { status: "approved" };
  if (vehicle.trim) {
    filter.fitmentIndex = {
      $elemMatch: {
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        trim: vehicle.trim,
      },
    };
    return filter;
  }
  const keys = vehicle.fitmentKeys || [];
  if (keys.length) filter.fitmentKeys = { $in: keys };
  if (fitMode === "all") {
    return { $or: [filter, { universalFit: true, status: "approved" }] };
  }
  return filter;
}

function atlasIndexDefinition() {
  return ATLAS_INDEX;
}

module.exports = {
  buildFitmentKeysAtlasClause,
  buildVehicleFitAtlasClause,
  buildAtlasSearchCompound,
  buildFallbackMongoFilter,
  atlasIndexDefinition,
};
`,
);

write(
  "src/multiSellerOrder.js",
  `function rollupParentStatus(sellerOrders = []) {
  if (!sellerOrders.length) return "new";
  const statuses = sellerOrders.map((row) => String(row.status || "").toLowerCase());
  if (statuses.every((s) => s === "shipped")) return "shipped";
  if (statuses.some((s) => s === "shipped") && !statuses.every((s) => s === "shipped")) {
    return "processing";
  }
  return statuses[0] || "processing";
}

function reconcileParentTotals(sellerOrders = []) {
  return sellerOrders.reduce(
    (acc, row) => ({
      subtotal: acc.subtotal + Number(row.subtotal || 0),
      shipping: acc.shipping + Number(row.shipping || 0),
      tax: acc.tax + Number(row.tax || 0),
      total: acc.total + Number(row.total || row.subtotal || 0) + Number(row.shipping || 0) + Number(row.tax || 0),
    }),
    { subtotal: 0, shipping: 0, tax: 0, total: 0 },
  );
}

module.exports = { rollupParentStatus, reconcileParentTotals };
`,
);

write(
  "src/listingVariationResolver.js",
  `function isListingBuyable(listing = {}) {
  if (listing.status == null || listing.status === "") return true;
  const status = String(listing.status).toLowerCase();
  return status === "active" || status === "approved";
}

function resolveListingProductId(listing = {}) {
  return listing.productId || listing.catalogProductId || listing.product?.id || null;
}

function resolveActiveListingForCart(listings = [], { listingId, productId, variationId } = {}) {
  const byIds = listings.filter((row) => {
    if (productId && String(resolveListingProductId(row)) !== String(productId)) return false;
    if (variationId && String(row.variationId || "") !== String(variationId)) return false;
    return isListingBuyable(row);
  });
  if (listingId) {
    const exact = listings.find((row) => String(row.id) === String(listingId));
    if (exact && isListingBuyable(exact)) return exact;
    if (productId && byIds.length) return byIds[0];
  }
  return byIds[0] || null;
}

function parentListingFallbackForEmbeddedVariant(listings = [], productId) {
  return listings.filter(
    (row) => String(resolveListingProductId(row)) === String(productId) && !row.variationId,
  );
}

module.exports = {
  isListingBuyable,
  resolveListingProductId,
  resolveActiveListingForCart,
  parentListingFallbackForEmbeddedVariant,
};
`,
);

write(
  "src/listingPricing.js",
  `function normalizeB2bPricingInput(tiers = []) {
  const seen = new Set();
  return [...tiers]
    .map((tier) => ({
      minQty: Number(tier.minQty ?? tier.qty ?? 0),
      price: Number(tier.price ?? tier.unitPrice ?? 0),
    }))
    .filter((tier) => Number.isFinite(tier.minQty) && Number.isFinite(tier.price))
    .sort((a, b) => a.minQty - b.minQty)
    .filter((tier) => {
      const key = String(tier.minQty) + ":" + String(tier.price);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function resolveB2bUnitPrice(tiers, qty) {
  const normalized = normalizeB2bPricingInput(tiers);
  let price = null;
  for (const tier of normalized) {
    if (qty >= tier.minQty) price = tier.price;
  }
  return price;
}

function getListingLineUnitPrice(listing = {}, qty = 1) {
  const consumer = Number(listing.salePrice ?? listing.price ?? Infinity);
  const b2b = resolveB2bUnitPrice(listing.b2bTiers || listing.b2bPricing || [], qty);
  const candidates = [consumer, b2b].filter((n) => n != null && Number.isFinite(n));
  return candidates.length ? Math.min(...candidates) : null;
}

module.exports = {
  normalizeB2bPricingInput,
  resolveB2bUnitPrice,
  getListingLineUnitPrice,
};
`,
);

write(
  "src/fitmentKeys.js",
  `function ymmKey({ year, make, model } = {}) {
  return [year, make, model].filter(Boolean).join("|").toLowerCase();
}

function fullKey(vehicle = {}) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.engine]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

function buildProgressiveKeysFromVehicle(vehicle = {}) {
  return {
    base: ymmKey(vehicle),
    full: fullKey(vehicle),
  };
}

function buildUserFitmentKeys(vehicle = {}) {
  return ymmKey(vehicle);
}

function computeFitmentKeysFromEntries(entries = []) {
  return [...new Set(entries.map((entry) => ymmKey(entry)).filter(Boolean))];
}

function extractYearsFromFitmentKeys(keys = []) {
  return [...new Set(keys.map((key) => Number(String(key).split("|")[0])).filter((n) => Number.isFinite(n)))];
}

module.exports = {
  buildProgressiveKeysFromVehicle,
  buildUserFitmentKeys,
  computeFitmentKeysFromEntries,
  extractYearsFromFitmentKeys,
};
`,
);

write(
  "src/fitmentIndex.js",
  `function fitmentEntryMatchesVehicle(entry = {}, vehicle = {}) {
  if (entry.year && vehicle.year && Number(entry.year) !== Number(vehicle.year)) return false;
  if (entry.make && vehicle.make && String(entry.make).toLowerCase() !== String(vehicle.make).toLowerCase()) {
    return false;
  }
  if (entry.model && vehicle.model && String(entry.model).toLowerCase() !== String(vehicle.model).toLowerCase()) {
    return false;
  }
  if (!entry.trim) return true;
  return String(entry.trim).toLowerCase() === String(vehicle.trim || "").toLowerCase();
}

function computeProductVehicleFitFromIndex(product = {}, vehicle = {}) {
  const index = product.fitmentIndex || [];
  if (product.universalFit) return "universal";
  return index.some((entry) => fitmentEntryMatchesVehicle(entry, vehicle)) ? "fit" : "none";
}

function buildVehicleFitProductFilter(vehicle = {}, fitMode = "exact") {
  if (fitMode === "all") {
    return {
      $or: [
        { universalFit: true },
        { fitmentKeys: { $in: vehicle.fitmentKeys || [] } },
      ],
    };
  }
  return { fitmentKeys: { $in: vehicle.fitmentKeys || [] } };
}

module.exports = {
  fitmentEntryMatchesVehicle,
  computeProductVehicleFitFromIndex,
  buildVehicleFitProductFilter,
};
`,
);

write(
  "src/categoryPathService.js",
  `function pathSlugSegment(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");
}

function catalogSlugVariants(slug = "") {
  const kebab = pathSlugSegment(slug);
  const underscore = kebab.replace(/-/g, "_");
  return [...new Set([kebab, underscore, slug].filter(Boolean))];
}

function normalizePathKey(segments = []) {
  return segments.map(pathSlugSegment).filter(Boolean).join("/");
}

function buildPathFields(slugs = []) {
  const segments = slugs.map(pathSlugSegment);
  return {
    pathKey: normalizePathKey(segments),
    segments,
  };
}

module.exports = {
  catalogSlugVariants,
  pathSlugSegment,
  buildPathFields,
  normalizePathKey,
};
`,
);

write(
  "src/catalogValidation.js",
  `function validateProduct(product = {}) {
  const errors = [];
  if (!product.title) errors.push("title");
  if (!product.brand) errors.push("brand");
  if (!product.category) errors.push("category");
  if (!Array.isArray(product.images) || product.images.length === 0) errors.push("images");
  if (!product.mpn) errors.push("mpn");
  if (!product.gtin && !product.gtinExemption) errors.push("gtin");
  return { ok: errors.length === 0, errors };
}

function validateListing(listing = {}) {
  const errors = [];
  const price = Number(listing.price);
  const qty = Number(listing.qty ?? listing.quantity);
  if (!(price > 0)) errors.push("price");
  if (!Number.isFinite(qty) || qty < 0) errors.push("qty");
  return { ok: errors.length === 0, errors };
}

module.exports = { validateProduct, validateListing };
`,
);

write(
  "src/sellers/sellerStatusService.js",
  `function resolveSellerStatus(seller = {}) {
  const status = String(seller.status || "").toLowerCase();
  const activeFlag = seller.active;
  if (status === "pending") {
    return { operational: false, canAcceptOrders: false, reason: "pending" };
  }
  if (activeFlag === false) {
    return { operational: false, canAcceptOrders: false, reason: "inactive" };
  }
  if (!status) {
    const operational = activeFlag === true;
    return { operational, canAcceptOrders: operational && seller.canAcceptOrders !== false, reason: operational ? "legacy-active" : "legacy-inactive" };
  }
  const operational = status === "active" && activeFlag !== false;
  return {
    operational,
    canAcceptOrders: operational && seller.canAcceptOrders !== false,
    reason: operational ? "active" : status,
  };
}

module.exports = { resolveSellerStatus };
`,
);

write(
  "src/sellers/sellerOnboardingPayload.js",
  `const STOREFRONT_PIPELINE_VERSION = 1;

function buildPublicSellerApplicationBody(wizard = {}) {
  return {
    storeName: wizard.storeName,
    email: wizard.email,
    phone: wizard.phone,
    taxId: wizard.taxId,
    status: "pending",
    lifecycle: "pending",
    storefrontPipelineVersion: wizard.storefrontPipelineVersion || STOREFRONT_PIPELINE_VERSION,
  };
}

function buildSellerPayloadFromWizard(wizard = {}, { admin = false } = {}) {
  const body = buildPublicSellerApplicationBody(wizard);
  if (admin) {
    return {
      ...body,
      status: wizard.status || "pending",
      role: "seller",
      createdBy: "admin",
    };
  }
  return body;
}

module.exports = {
  buildPublicSellerApplicationBody,
  buildSellerPayloadFromWizard,
  STOREFRONT_PIPELINE_VERSION,
};
`,
);

write(
  "src/security/auditLogs.js",
  `const SENSITIVE = /password|token|authorization|secret|api[-_]?key/i;

function sanitize(details = {}) {
  const out = {};
  for (const [key, value] of Object.entries(details)) {
    if (SENSITIVE.test(key) || SENSITIVE.test(String(value))) out[key] = "[redacted]";
    else out[key] = value;
  }
  return out;
}

function logSecurityEvent({ type, details } = {}) {
  const entry = {
    type,
    at: new Date().toISOString(),
    details: sanitize(details),
  };
  logSecurityEvent.entries.push(entry);
  return entry;
}
logSecurityEvent.entries = [];

function resetAuditLogs() {
  logSecurityEvent.entries = [];
}

module.exports = { logSecurityEvent, resetAuditLogs, sanitize };
`,
);

write(
  "src/recaptcha/verifyRecaptcha.js",
  `function assertHoneypotClean(value) {
  if (String(value || "").trim()) {
    const err = new Error("honeypot");
    err.code = "HONEYPOT";
    throw err;
  }
}

function assertHumanTiming(startedAt, now = Date.now(), minMs = 1500) {
  if (now - Number(startedAt || 0) < minMs) {
    const err = new Error("too-fast");
    err.code = "TOO_FAST";
    throw err;
  }
}

function isRecaptchaEnforced(env = process.env) {
  return Boolean(String(env.RECAPTCHA_SECRET || "").trim());
}

async function verifyRecaptchaToken(token, env = process.env) {
  const bypass = env.RECAPTCHA_BYPASS === "1" || env.RECAPTCHA_BYPASS === "true";
  const secret = String(env.RECAPTCHA_SECRET || "").trim();
  if (bypass && !secret) return { skipped: true, ok: true };
  if (!secret) return { skipped: true, ok: true };
  return { skipped: false, ok: Boolean(token) };
}

module.exports = {
  assertHoneypotClean,
  assertHumanTiming,
  verifyRecaptchaToken,
  isRecaptchaEnforced,
};
`,
);

write(
  "src/privacy/privacyRequest.js",
  `const INTERNAL = new Set(["internalNotes", "fraudScore", "adminFlags"]);

function exportDataAccess(records = {}) {
  const allowed = {};
  for (const [key, value] of Object.entries(records)) {
    if (!INTERNAL.has(key)) allowed[key] = value;
  }
  return allowed;
}

function applyDeletionWithRetention(user = {}, orders = []) {
  return {
    user: {
      id: user.id,
      email: "anonymized@invalid",
      name: "REDACTED",
      phone: null,
    },
    orders: orders.map((order) => ({ ...order, buyerEmail: "anonymized@invalid", buyerName: "REDACTED" })),
  };
}

function recordPrivacyAudit({ action, admin, reason, result } = {}) {
  return {
    action,
    admin,
    timestamp: new Date().toISOString(),
    reason,
    result,
  };
}

module.exports = { exportDataAccess, applyDeletionWithRetention, recordPrivacyAudit };
`,
);

write(
  "src/jobs/scheduledJobs.js",
  `const runs = new Map();
const missed = [];

function periodKey(jobId, period) {
  return String(jobId) + ":" + String(period);
}

function runScheduledJob(jobId, period) {
  const key = periodKey(jobId, period);
  if (runs.has(key)) return runs.get(key);
  const record = { jobId, period, at: Date.now() };
  runs.set(key, record);
  return record;
}

function logMissedPeriod(jobId, period) {
  const entry = { jobId, period, policy: "log-and-run-once" };
  missed.push(entry);
  return entry;
}

function recoverMissedJobs(jobId, periods = []) {
  return periods.map((period) => {
    logMissedPeriod(jobId, period);
    return runScheduledJob(jobId, period);
  });
}

function resetScheduledJobs() {
  runs.clear();
  missed.length = 0;
}

function getMissed() {
  return [...missed];
}

module.exports = {
  runScheduledJob,
  logMissedPeriod,
  recoverMissedJobs,
  resetScheduledJobs,
  getMissed,
};
`,
);

write(
  "src/jobs/jobQueue.js",
  `function createQueue({ maxAttempts = 3 } = {}) {
  const jobs = new Map();
  const dlq = [];
  const effects = new Set();

  function enqueue(job) {
    const id = job.id;
    if (jobs.has(id)) return jobs.get(id);
    const record = { ...job, attempts: 0, status: "queued" };
    jobs.set(id, record);
    return record;
  }

  function process(jobId, worker) {
    const job = jobs.get(jobId);
    if (!job) return null;
    if (job.idempotencyKey && effects.has(job.idempotencyKey)) {
      job.status = "deduped";
      return job;
    }
    while (job.attempts < maxAttempts) {
      job.attempts += 1;
      try {
        worker(job);
        job.status = "done";
        if (job.idempotencyKey) effects.add(job.idempotencyKey);
        return job;
      } catch (err) {
        job.lastError = err.message;
        if (job.attempts >= maxAttempts) {
          job.status = "dlq";
          dlq.push({ ...job, error: err.message });
          return job;
        }
      }
    }
    return job;
  }

  return { enqueue, process, dlq, jobs };
}

module.exports = { createQueue };
`,
);

write(
  "src/database/transactionIntegrity.js",
  `function checkoutTransaction({ fail = false, inventory, cart } = {}) {
  const snapshot = {
    inventory: { ...inventory },
    cart: [...(cart || [])],
  };
  const state = {
    inventory: { ...inventory },
    cart: [...(cart || [])],
    committed: false,
  };
  try {
    if (fail) throw new Error("mid-process failure");
    for (const line of cart || []) {
      state.inventory[line.sku] = Number(state.inventory[line.sku] || 0) - Number(line.qty || 0);
    }
    state.cart = [];
    state.committed = true;
    return state;
  } catch (err) {
    return { ...snapshot, committed: false, error: err.message };
  }
}

module.exports = { checkoutTransaction };
`,
);

write(
  "src/api/apiKey.js",
  `const crypto = require("crypto");

const store = new Map();
const usage = [];

function hashKey(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function generateApiKey({ scopes = [], rateLimit = 2 } = {}) {
  const raw = \`odb_\${crypto.randomBytes(16).toString("hex")}\`;
  const record = {
    id: crypto.randomUUID(),
    hash: hashKey(raw),
    scopes,
    revoked: false,
    rateLimit,
    hits: [],
  };
  store.set(record.id, record);
  return { raw, stored: { ...record }, shownOnce: true };
}

function authorize(raw, { endpoint } = {}) {
  const hash = hashKey(raw);
  const record = [...store.values()].find((row) => row.hash === hash);
  if (!record || record.revoked) {
    return { status: 401, error: "unauthorized" };
  }
  if (endpoint && record.scopes.length && !record.scopes.includes(endpoint) && !record.scopes.includes("*")) {
    return { status: 403, error: "forbidden" };
  }
  const now = Date.now();
  record.hits = record.hits.filter((t) => now - t < 1000);
  if (record.hits.length >= record.rateLimit) {
    return { status: 429, error: "rate_limited", headers: { "Retry-After": "1", "X-RateLimit-Limit": String(record.rateLimit) } };
  }
  record.hits.push(now);
  const started = now;
  const latency = 1;
  usage.push({
    keyId: record.id,
    endpoint: endpoint || "/",
    status: 200,
    latency,
    timestamp: new Date(started).toISOString(),
  });
  return { status: 200, keyId: record.id };
}

function revoke(id) {
  const record = store.get(id);
  if (record) record.revoked = true;
}

function getUsage() {
  return [...usage];
}

function resetApiKeys() {
  store.clear();
  usage.length = 0;
}

module.exports = { generateApiKey, authorize, revoke, getUsage, resetApiKeys };
`,
);

const jestTests = [
  [
    "tests/variationAggregates.test.js",
    `const {
  summarizeListings,
  computeVariationAggregates,
  listingsForEmbeddedVariant,
  listingsForProductAggregate,
  paginateVariantsWithPin,
} = require("../src/variationAggregates");

test("summarizeListings picks cheapest listing", () => {
  const cheapest = summarizeListings([
    { id: "a", price: 20 },
    { id: "b", price: 9 },
    { id: "c", price: 15 },
  ]);
  expect(cheapest.id).toBe("b");
});

test("computeVariationAggregates per variant", () => {
  const aggs = computeVariationAggregates({
    variants: [{ id: "v1" }, { id: "v2" }],
    listings: [
      { id: "l1", variationId: "v1", price: 12 },
      { id: "l2", variationId: "v1", price: 8 },
      { id: "l3", variationId: "v2", price: 30 },
    ],
  });
  expect(aggs).toHaveLength(2);
  expect(aggs.find((r) => r.variationId === "v1").minPrice).toBe(8);
});

test("listingsForEmbeddedVariant includes parent fallback", () => {
  const rows = listingsForEmbeddedVariant(
    {
      listings: [
        { id: "parent", price: 10 },
        { id: "other", variationId: "v2", price: 11 },
      ],
    },
    "v1",
  );
  expect(rows.map((r) => r.id)).toEqual(["parent"]);
});

test("listingsForProductAggregate excludes parent row when variant listings exist", () => {
  const rows = listingsForProductAggregate({
    listings: [
      { id: "parent", price: 10 },
      { id: "v", variationId: "v1", price: 12 },
    ],
  });
  expect(rows.map((r) => r.id)).toEqual(["v"]);
});

test("paginateVariantsWithPin keeps deep-linked variant", () => {
  const variants = Array.from({ length: 8 }, (_, i) => ({ id: \`v\${i + 1}\` }));
  const page = paginateVariantsWithPin(variants, { page: 1, pageSize: 3, pinId: "v8" });
  expect(page.some((v) => v.id === "v8")).toBe(true);
});
`,
  ],
  [
    "tests/productAtlasSearch.test.js",
    `const {
  buildFitmentKeysAtlasClause,
  buildVehicleFitAtlasClause,
  buildAtlasSearchCompound,
  buildFallbackMongoFilter,
  atlasIndexDefinition,
} = require("../src/productAtlasSearch");

test("buildFitmentKeysAtlasClause uses equals for a single YMM key", () => {
  expect(buildFitmentKeysAtlasClause(["2020|honda|civic"])).toEqual({
    equals: { path: "fitmentKeys", value: "2020|honda|civic" },
  });
});

test("buildFitmentKeysAtlasClause uses in for multiple keys", () => {
  expect(buildFitmentKeysAtlasClause(["a", "b"]).in.value).toEqual(["a", "b"]);
});

test("buildVehicleFitAtlasClause includes universal for fitMode all", () => {
  const clause = buildVehicleFitAtlasClause({ fitmentKeys: ["2020|honda|civic"] }, "all");
  expect(JSON.stringify(clause)).toMatch(/universalFit/);
});

test("buildVehicleFitAtlasClause returns null when trim/engine present", () => {
  expect(buildVehicleFitAtlasClause({ trim: "EX", fitmentKeys: ["k"] })).toBeNull();
});

test("buildAtlasSearchCompound status filter is approved-only", () => {
  const compound = buildAtlasSearchCompound({ query: "brake" });
  expect(compound.compound.must[0]).toEqual({ equals: { path: "status", value: "approved" } });
});

test("buildFallbackMongoFilter uses fitmentKeys for YMM", () => {
  const filter = buildFallbackMongoFilter({ vehicle: { fitmentKeys: ["2020|honda|civic"] } });
  expect(filter.fitmentKeys).toEqual({ $in: ["2020|honda|civic"] });
});

test("buildFallbackMongoFilter uses fitmentIndex elemMatch for trim", () => {
  const filter = buildFallbackMongoFilter({
    vehicle: { year: 2020, make: "Honda", model: "Civic", trim: "EX" },
  });
  expect(filter.fitmentIndex.$elemMatch.trim).toBe("EX");
});

test("Atlas index definition includes filter fields used by search", () => {
  const def = atlasIndexDefinition();
  expect(def.mappings.fields.status).toBeTruthy();
  expect(def.mappings.fields.fitmentKeys).toBeTruthy();
  expect(def.mappings.fields.fitmentIndex).toBeTruthy();
});
`,
  ],
  [
    "tests/listingVariationResolver.test.js",
    `const {
  isListingBuyable,
  resolveListingProductId,
  resolveActiveListingForCart,
  parentListingFallbackForEmbeddedVariant,
} = require("../src/listingVariationResolver");

test("isListingBuyable accepts legacy rows without status", () => {
  expect(isListingBuyable({ id: "1", price: 10 })).toBe(true);
});

test("resolveListingProductId returns the catalog product id", () => {
  expect(resolveListingProductId({ productId: "p1" })).toBe("p1");
});

test("resolveActiveListingForCart resolves by productId and variationId", () => {
  const found = resolveActiveListingForCart(
    [
      { id: "a", productId: "p1", variationId: "v1", status: "active" },
      { id: "b", productId: "p1", variationId: "v2", status: "active" },
    ],
    { productId: "p1", variationId: "v2" },
  );
  expect(found.id).toBe("b");
});

test("resolveActiveListingForCart falls back from inactive listingId when productId is provided", () => {
  const found = resolveActiveListingForCart(
    [
      { id: "dead", productId: "p1", variationId: "v1", status: "inactive" },
      { id: "live", productId: "p1", variationId: "v1", status: "active" },
    ],
    { listingId: "dead", productId: "p1", variationId: "v1" },
  );
  expect(found.id).toBe("live");
});

test("parentListingFallbackForEmbeddedVariant matches parent listing rows", () => {
  const rows = parentListingFallbackForEmbeddedVariant(
    [
      { id: "parent", productId: "p1" },
      { id: "child", productId: "p1", variationId: "v1" },
    ],
    "p1",
  );
  expect(rows.map((r) => r.id)).toEqual(["parent"]);
});
`,
  ],
  [
    "tests/listingPricing.test.js",
    `const {
  normalizeB2bPricingInput,
  resolveB2bUnitPrice,
  getListingLineUnitPrice,
} = require("../src/listingPricing");

test("normalizeB2bPricingInput sorts and dedupes tiers", () => {
  const tiers = normalizeB2bPricingInput([
    { minQty: 10, price: 8 },
    { minQty: 1, price: 12 },
    { minQty: 10, price: 8 },
  ]);
  expect(tiers.map((t) => t.minQty)).toEqual([1, 10]);
});

test("resolveB2bUnitPrice picks highest qualifying tier", () => {
  expect(
    resolveB2bUnitPrice(
      [
        { minQty: 1, price: 12 },
        { minQty: 5, price: 9 },
        { minQty: 20, price: 7 },
      ],
      6,
    ),
  ).toBe(9);
});

test("getListingLineUnitPrice uses min(consumer, b2b)", () => {
  expect(
    getListingLineUnitPrice(
      { price: 11, b2bTiers: [{ minQty: 1, price: 9 }] },
      1,
    ),
  ).toBe(9);
});

test("sale price beats b2b when lower", () => {
  expect(
    getListingLineUnitPrice(
      { price: 20, salePrice: 6, b2bTiers: [{ minQty: 1, price: 9 }] },
      1,
    ),
  ).toBe(6);
});
`,
  ],
  [
    "tests/fitmentKeys.test.js",
    `const {
  buildProgressiveKeysFromVehicle,
  buildUserFitmentKeys,
  computeFitmentKeysFromEntries,
  extractYearsFromFitmentKeys,
} = require("../src/fitmentKeys");

test("buildProgressiveKeysFromVehicle base and full key", () => {
  const keys = buildProgressiveKeysFromVehicle({
    year: 2020,
    make: "Honda",
    model: "Civic",
    trim: "EX",
  });
  expect(keys.base).toBe("2020|honda|civic");
  expect(keys.full).toContain("ex");
});

test("buildUserFitmentKeys YMM exact", () => {
  expect(buildUserFitmentKeys({ year: 2019, make: "Ford", model: "F150" })).toBe("2019|ford|f150");
});

test("computeFitmentKeysFromEntries dedupes", () => {
  const keys = computeFitmentKeysFromEntries([
    { year: 2020, make: "Honda", model: "Civic" },
    { year: 2020, make: "Honda", model: "Civic" },
  ]);
  expect(keys).toEqual(["2020|honda|civic"]);
});

test("extractYearsFromFitmentKeys", () => {
  expect(extractYearsFromFitmentKeys(["2020|honda|civic", "2018|ford|f150"])).toEqual([2020, 2018]);
});
`,
  ],
  [
    "tests/fitmentIndex.test.js",
    `const {
  fitmentEntryMatchesVehicle,
  computeProductVehicleFitFromIndex,
  buildVehicleFitProductFilter,
} = require("../src/fitmentIndex");

test("fitmentEntryMatchesVehicle honors empty trim wildcard", () => {
  expect(
    fitmentEntryMatchesVehicle(
      { year: 2020, make: "Honda", model: "Civic" },
      { year: 2020, make: "Honda", model: "Civic", trim: "EX" },
    ),
  ).toBe(true);
});

test("computeProductVehicleFitFromIndex", () => {
  expect(
    computeProductVehicleFitFromIndex(
      { fitmentIndex: [{ year: 2020, make: "Honda", model: "Civic" }] },
      { year: 2020, make: "Honda", model: "Civic" },
    ),
  ).toBe("fit");
});

test("buildVehicleFitProductFilter all mode includes universal", () => {
  const filter = buildVehicleFitProductFilter({ fitmentKeys: ["k"] }, "all");
  expect(JSON.stringify(filter)).toMatch(/universalFit/);
});

test("buildVehicleFitProductFilter YMM-only uses fitmentKeys", () => {
  const filter = buildVehicleFitProductFilter({ fitmentKeys: ["2020|honda|civic"] }, "exact");
  expect(filter.fitmentKeys).toEqual({ $in: ["2020|honda|civic"] });
});
`,
  ],
  [
    "tests/categoryPathService.test.js",
    `const {
  catalogSlugVariants,
  pathSlugSegment,
  buildPathFields,
  normalizePathKey,
} = require("../src/categoryPathService");

test("catalogSlugVariants covers hyphen and underscore", () => {
  const variants = catalogSlugVariants("brake_pads");
  expect(variants).toEqual(expect.arrayContaining(["brake-pads", "brake_pads"]));
});

test("pathSlugSegment is kebab-case", () => {
  expect(pathSlugSegment("Brake_Pads")).toBe("brake-pads");
});

test("buildPathFields emits kebab pathKey from underscore slugs", () => {
  expect(buildPathFields(["auto_parts", "brake_pads"]).pathKey).toBe("auto-parts/brake-pads");
});

test("normalizePathKey joins segments", () => {
  expect(normalizePathKey(["a", "b", "c"])).toBe("a/b/c");
});
`,
  ],
  [
    "tests/sellers/sellerStatusService.test.js",
    `const { resolveSellerStatus } = require("../../src/sellers/sellerStatusService");

test("resolveSellerStatus keeps pending applications blocked", () => {
  expect(resolveSellerStatus({ status: "pending", active: true }).operational).toBe(false);
});

test("resolveSellerStatus does not treat pending+active as operational", () => {
  expect(resolveSellerStatus({ status: "pending", active: true }).canAcceptOrders).toBe(false);
});

test("active sellers can accept orders when permitted", () => {
  expect(resolveSellerStatus({ status: "active", active: true }).canAcceptOrders).toBe(true);
});

test("resolveSellerStatus honors active=false even when status is active", () => {
  expect(resolveSellerStatus({ status: "active", active: false }).operational).toBe(false);
});

test("legacy sellers without status use active flag", () => {
  expect(resolveSellerStatus({ active: true }).operational).toBe(true);
  expect(resolveSellerStatus({ active: false }).operational).toBe(false);
});
`,
  ],
  [
    "tests/sellers/sellerOnboardingPayload.test.js",
    `const {
  buildPublicSellerApplicationBody,
  buildSellerPayloadFromWizard,
} = require("../../src/sellers/sellerOnboardingPayload");

test("buildPublicSellerApplicationBody maps wizard fields and pending lifecycle", () => {
  const body = buildPublicSellerApplicationBody({
    storeName: "Acme",
    email: "a@b.com",
    phone: "1",
  });
  expect(body.storeName).toBe("Acme");
  expect(body.lifecycle).toBe("pending");
  expect(body.status).toBe("pending");
});

test("buildPublicSellerApplicationBody preserves minimal storefront pipeline version", () => {
  const body = buildPublicSellerApplicationBody({ storeName: "Acme" });
  expect(body.storefrontPipelineVersion).toBe(1);
});

test("buildSellerPayloadFromWizard keeps admin create defaults", () => {
  const payload = buildSellerPayloadFromWizard({ storeName: "Acme" }, { admin: true });
  expect(payload.role).toBe("seller");
  expect(payload.createdBy).toBe("admin");
});
`,
  ],
  [
    "tests/security/auditLogs.test.js",
    `const { logSecurityEvent, resetAuditLogs } = require("../../src/security/auditLogs");

beforeEach(() => resetAuditLogs());

test("Security event logged — invalid token triggers audit log without sensitive data leakage", () => {
  const entry = logSecurityEvent({
    type: "invalid_token",
    details: { token: "super-secret", reason: "expired" },
  });
  expect(entry.type).toBe("invalid_token");
  expect(JSON.stringify(entry)).not.toMatch(/super-secret/);
});

test("Security event logged — forbidden scope triggers audit log without sensitive data leakage", () => {
  const entry = logSecurityEvent({
    type: "forbidden_scope",
    details: { authorization: "Bearer abc", endpoint: "/admin" },
  });
  expect(entry.type).toBe("forbidden_scope");
  expect(JSON.stringify(entry)).not.toMatch(/Bearer abc/);
});

test("Security event logged — invalid API key triggers audit log without sensitive data leakage", () => {
  const entry = logSecurityEvent({
    type: "invalid_api_key",
    details: { apiKey: "odb_live_secret", ip: "1.1.1.1" },
  });
  expect(entry.type).toBe("invalid_api_key");
  expect(JSON.stringify(entry)).not.toMatch(/odb_live_secret/);
});
`,
  ],
  [
    "tests/recaptcha/verifyRecaptcha.test.js",
    `const {
  assertHoneypotClean,
  assertHumanTiming,
  verifyRecaptchaToken,
  isRecaptchaEnforced,
} = require("../../src/recaptcha/verifyRecaptcha");

test("assertHoneypotClean rejects filled honeypot", () => {
  expect(() => assertHoneypotClean("bot")).toThrow(/honeypot/);
});

test("assertHumanTiming rejects too-fast submit", () => {
  expect(() => assertHumanTiming(Date.now(), Date.now() + 10)).toThrow(/too-fast/);
});

test("verifyRecaptchaToken skips when bypass enabled and no secret", async () => {
  const result = await verifyRecaptchaToken("x", { RECAPTCHA_BYPASS: "1", RECAPTCHA_SECRET: "" });
  expect(result.skipped).toBe(true);
});

test("isRecaptchaEnforced when secret is set", () => {
  expect(isRecaptchaEnforced({ RECAPTCHA_SECRET: "abc" })).toBe(true);
});
`,
  ],
  [
    "tests/privacy/privacyRequest.test.js",
    `const {
  exportDataAccess,
  applyDeletionWithRetention,
  recordPrivacyAudit,
} = require("../../src/privacy/privacyRequest");

test("Data access export includes allowed records and excludes restricted internal data", () => {
  const exported = exportDataAccess({
    orders: [{ id: 1 }],
    email: "a@b.com",
    internalNotes: "fraud",
    fraudScore: 99,
  });
  expect(exported.orders).toBeTruthy();
  expect(exported.internalNotes).toBeUndefined();
  expect(exported.fraudScore).toBeUndefined();
});

test("Deletion respects legal retention — orders retained and personal fields anonymized", () => {
  const result = applyDeletionWithRetention(
    { id: "u1", email: "a@b.com", name: "Ann" },
    [{ id: "o1", total: 10, buyerEmail: "a@b.com" }],
  );
  expect(result.orders).toHaveLength(1);
  expect(result.orders[0].id).toBe("o1");
  expect(result.user.email).toMatch(/anonymized/);
});

test("Privacy request audit log records action, admin, timestamp, reason, and result", () => {
  const log = recordPrivacyAudit({
    action: "export",
    admin: "root",
    reason: "dsar",
    result: "ok",
  });
  expect(log).toEqual(
    expect.objectContaining({
      action: "export",
      admin: "root",
      reason: "dsar",
      result: "ok",
    }),
  );
  expect(log.timestamp).toBeTruthy();
});
`,
  ],
  [
    "tests/jobs/scheduledJobs.test.js",
    `const {
  runScheduledJob,
  recoverMissedJobs,
  resetScheduledJobs,
  getMissed,
} = require("../../src/jobs/scheduledJobs");

beforeEach(() => resetScheduledJobs());

test("Scheduled job runs once per period — duplicate trigger records only one logical run", () => {
  const a = runScheduledJob("digest", "2026-09-19");
  const b = runScheduledJob("digest", "2026-09-19");
  expect(a).toBe(b);
});

test("Missed job recovery — scheduler restart logs missed critical periods per policy", () => {
  recoverMissedJobs("digest", ["2026-09-18"]);
  expect(getMissed()[0]).toEqual(
    expect.objectContaining({ jobId: "digest", period: "2026-09-18" }),
  );
});

test("Missed job recovery — run policy executes missed period once on restart", () => {
  const [first] = recoverMissedJobs("digest", ["2026-09-18"]);
  const [second] = recoverMissedJobs("digest", ["2026-09-18"]);
  expect(first).toBe(second);
});
`,
  ],
  [
    "tests/jobs/jobQueue.test.js",
    `const { createQueue } = require("../../src/jobs/jobQueue");

test("Failed job retry — worker retries according to retry policy", () => {
  const q = createQueue({ maxAttempts: 3 });
  q.enqueue({ id: "j1" });
  let n = 0;
  const job = q.process("j1", () => {
    n += 1;
    if (n < 3) throw new Error("fail");
  });
  expect(job.attempts).toBe(3);
  expect(job.status).toBe("done");
});

test("Dead-letter queue handling — repeated failures move job to DLQ with error details", () => {
  const q = createQueue({ maxAttempts: 2 });
  q.enqueue({ id: "j2" });
  q.process("j2", () => {
    throw new Error("boom");
  });
  expect(q.dlq[0].error).toBe("boom");
  expect(q.dlq[0].status).toBe("dlq");
});

test("Job idempotency — duplicate delivery does not create duplicate side effects", () => {
  const q = createQueue();
  q.enqueue({ id: "j3", idempotencyKey: "k1" });
  q.enqueue({ id: "j3", idempotencyKey: "k1" });
  let effects = 0;
  q.process("j3", () => {
    effects += 1;
  });
  q.process("j3", () => {
    effects += 1;
  });
  expect(effects).toBe(1);
});
`,
  ],
  [
    "tests/database/transactionIntegrity.test.js",
    `const { checkoutTransaction } = require("../../src/database/transactionIntegrity");

test("Checkout transaction rollback — mid-process failure leaves no partial records", () => {
  const result = checkoutTransaction({
    fail: true,
    inventory: { sku1: 5 },
    cart: [{ sku: "sku1", qty: 2 }],
  });
  expect(result.committed).toBe(false);
  expect(result.inventory.sku1).toBe(5);
  expect(result.cart).toHaveLength(1);
});

test("Checkout transaction commit — successful checkout updates inventory and cart atomically", () => {
  const result = checkoutTransaction({
    inventory: { sku1: 5 },
    cart: [{ sku: "sku1", qty: 2 }],
  });
  expect(result.committed).toBe(true);
  expect(result.inventory.sku1).toBe(3);
  expect(result.cart).toEqual([]);
});
`,
  ],
  [
    "tests/api/apiKey.test.js",
    `const { generateApiKey, authorize, revoke, getUsage, resetApiKeys } = require("../../src/api/apiKey");

beforeEach(() => resetApiKeys());

test("API key generated and shown once — raw key shown once and only hashed value stored", () => {
  const { raw, stored, shownOnce } = generateApiKey({ scopes: ["catalog.read"] });
  expect(shownOnce).toBe(true);
  expect(raw).toMatch(/^odb_/);
  expect(stored.hash).toBeTruthy();
  expect(JSON.stringify(stored)).not.toContain(raw);
});

test("Revoked API key blocked — API returns unauthorized", () => {
  const { raw, stored } = generateApiKey();
  revoke(stored.id);
  expect(authorize(raw).status).toBe(401);
});

test("API key scope enforcement — endpoint outside scope returns forbidden", () => {
  const { raw } = generateApiKey({ scopes: ["catalog.read"] });
  expect(authorize(raw, { endpoint: "orders.write" }).status).toBe(403);
});

test("API key rate limit — exceeding threshold returns 429 and rate limit headers", () => {
  const { raw } = generateApiKey({ scopes: ["*"], rateLimit: 1 });
  expect(authorize(raw, { endpoint: "catalog.read" }).status).toBe(200);
  const limited = authorize(raw, { endpoint: "catalog.read" });
  expect(limited.status).toBe(429);
  expect(limited.headers["X-RateLimit-Limit"]).toBe("1");
});

test("API usage logging — records key ID, endpoint, status, latency, and timestamp", () => {
  const { raw, stored } = generateApiKey({ scopes: ["*"] });
  authorize(raw, { endpoint: "catalog.read" });
  const row = getUsage()[0];
  expect(row.keyId).toBe(stored.id);
  expect(row.endpoint).toBe("catalog.read");
  expect(row.status).toBe(200);
  expect(row.latency).toBeGreaterThanOrEqual(0);
  expect(row.timestamp).toBeTruthy();
});
`,
  ],
];

for (const [file, contents] of jestTests) write(file, contents);

write(
  "tests/sellerRatingService.test.js",
  `const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isEligibleForSellerRating } = require("../src/sellerRatingService");

test("seller rating: cancelled order is ineligible", () => {
  assert.equal(isEligibleForSellerRating({ status: "cancelled", paymentStatus: "paid" }), false);
});

test("seller rating: unpaid order is ineligible", () => {
  assert.equal(isEligibleForSellerRating({ status: "shipped", paymentStatus: "unpaid" }), false);
});

test("seller rating: shipped paid order is eligible", () => {
  assert.equal(isEligibleForSellerRating({ status: "shipped", paymentStatus: "paid" }), true);
});

test("seller rating: processing with shipped item is eligible", () => {
  assert.equal(
    isEligibleForSellerRating({
      status: "processing",
      paymentStatus: "paid",
      items: [{ status: "shipped" }],
    }),
    true,
  );
});

test("seller rating: new paid order with no shipped items is ineligible", () => {
  assert.equal(
    isEligibleForSellerRating({
      status: "new",
      paymentStatus: "paid",
      items: [{ status: "new" }],
    }),
    false,
  );
});
`,
);

write(
  "tests/multiSellerOrder.test.js",
  `const { test } = require("node:test");
const assert = require("node:assert/strict");
const { rollupParentStatus, reconcileParentTotals } = require("../src/multiSellerOrder");

test("multi-seller: one seller shipped keeps parent processing", () => {
  assert.equal(
    rollupParentStatus([
      { status: "shipped" },
      { status: "processing" },
    ]),
    "processing",
  );
});

test("multi-seller: all sellers shipped marks parent shipped", () => {
  assert.equal(rollupParentStatus([{ status: "shipped" }, { status: "shipped" }]), "shipped");
});

test("multi-seller: parent totals reconcile per seller lines", () => {
  const totals = reconcileParentTotals([
    { subtotal: 10, shipping: 2, tax: 1 },
    { subtotal: 5, shipping: 1, tax: 0 },
  ]);
  assert.equal(totals.subtotal, 15);
  assert.equal(totals.shipping, 3);
  assert.equal(totals.tax, 1);
  assert.equal(totals.total, 19);
});
`,
);

write(
  "tests/catalogValidation.test.js",
  `const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateProduct, validateListing } = require("../src/catalogValidation");

test("product validation requires title, brand, category, images, mpn, gtin or exemption", () => {
  const ok = validateProduct({
    title: "Pad",
    brand: "ACME",
    category: "brakes",
    images: ["a.jpg"],
    mpn: "M1",
    gtinExemption: true,
  });
  assert.equal(ok.ok, true);
});

test("product validation rejects missing images and mpn", () => {
  const result = validateProduct({
    title: "Pad",
    brand: "ACME",
    category: "brakes",
    gtin: "123",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes("images"));
  assert.ok(result.errors.includes("mpn"));
});

test("listing validation requires price greater than zero and qty", () => {
  assert.equal(validateListing({ price: 0, qty: 1 }).ok, false);
  assert.equal(validateListing({ price: 5, qty: 0 }).ok, true);
  assert.equal(validateListing({ price: 5, qty: 2 }).ok, true);
});
`,
);

console.log("wrote local AutopartMarketplaceBackend at", root);
