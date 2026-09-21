/**
 * Live storefront pages used when a UX module validates UI, screenshots, then
 * feeds OpenAI UI analysis. Paths match existing OneDirectBuy routes only.
 */
import { gotoOneDirectBuy } from "./oneDirectBuyNav.js";
import { runUxModuleCase } from "./uxModules.js";

/** @type {Record<string, string>} */
export const UX_MODULE_UI_PATH = {
  "variation-aggregates": "/",
  "seller-rating": "/",
  "product-atlas-search": "/",
  "multi-seller-order": "/cart",
  "listing-variation-resolver": "/",
  "listing-pricing": "/",
  "fitment-keys": "/",
  "fitment-index": "/",
  "category-path-service": "/",
  "catalog-validation": "/",
  "seller-status": "/vendor/become-a-vendor",
  "seller-onboarding-payload": "/vendor/become-a-vendor",
  "audit-logs": "/account/login",
  "verify-recaptcha": "/account/register",
  "privacy-request": "/info/privacy-policy",
  "scheduled-jobs": "/",
  "job-queue": "/",
  "transaction-integrity": "/cart",
  "api-key": "/account/login",
};

export function uiPathForUxFile(file = "") {
  const rel = String(file).replace(/\\/g, "/");
  for (const [slug, uiPath] of Object.entries(UX_MODULE_UI_PATH)) {
    if (rel.includes(slug) || rel.toLowerCase().includes(slug.replace(/-/g, ""))) {
      return uiPath;
    }
  }
  return "/";
}

/**
 * Open the mapped live page, run the backend UX case, then screenshot for analysis.
 * @param {import('@playwright/test').Page} page
 * @param {(name: string, fn: () => Promise<void>) => Promise<unknown>} captureStep
 * @param {{ id: string, title: string, file: string, testName: string, runner?: string, uiPath?: string, slug?: string }} opts
 */
export async function runUxValidatedCase(page, captureStep, opts) {
  const uiPath =
    opts.uiPath ||
    (opts.slug && UX_MODULE_UI_PATH[opts.slug]) ||
    "/";

  await captureStep(`${opts.id} — UI validation`, async () => {
    await gotoOneDirectBuy(page, uiPath);
    await runUxModuleCase({
      file: opts.file,
      testName: opts.testName,
      runner: opts.runner || "jest",
    });
  });
}
