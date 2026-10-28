// Shared fixtures for the ODB buyer flows (tests/OneDirectBuy/flows). Guide: docs/qa/E2E-TEST-GUIDE.md § 5 (B*).
//
//   import { test, expect, go } from "./fixtures.js";
//   test("ODB-UC-030 …", async ({ page, health }, testInfo) => { … await checkStep(page, testInfo, { id, name, health }); });
//
// Target (lib/targetEnv.cjs): ONEDIRECTBUY_BASE_URL. There is no hosted dev storefront — "dev" means the
// storefront (OneDirectBuy/AutopartMarketplace, `next dev`) running locally against the dev API
// https://dev.onedirectbuy.com. Production (onedirectbuy.com) needs ALLOW_PROD=1 and runs read-only specs only.
//
// Fixtures:
//   health   — console errors, page errors and our 5xx since the last checkStep.
//   odb      — { baseURL, local, prod, writable }: writes (cart, address, orders) only on a local/dev target.
//   corsShim — AUTO on a local storefront that is not on port 3000: the dev API only allows the origin
//              http://localhost:3000, so its calls are fetched with that origin and handed back with CORS
//              headers for the real one. Nothing about the request body or response is changed.
import { test as base, expect } from "@playwright/test";
import targetEnv from "../../../lib/targetEnv.cjs";
import { watchHealth } from "../../helpers/checkStep.js";
import { gotoOneDirectBuy, dismissAssistantOverlay, dismissCookieBanner } from "../../helpers/oneDirectBuyNav.js";

const API_ORIGIN_RE = /^https:\/\/dev\.onedirectbuy\.com\//;
const ALLOWED_DEV_ORIGIN = "http://localhost:3000";

export function odbTarget(env = process.env) {
  const baseURL = targetEnv.resolveBaseUrl(env);
  const host = new URL(baseURL).hostname;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(host);
  const prod = !targetEnv.isNonProdTarget(env);
  // The storefront's API (src/api/core/config.js): dev API for local/dev, /api on production.
  const apiURL = (env.ONEDIRECTBUY_API_URL || (prod ? `${new URL(baseURL).origin}/api` : "https://dev.onedirectbuy.com")).replace(/\/+$/, "");
  return { baseURL, apiURL, local, prod, writable: !prod };
}

/** GET on the storefront API (public reads: search, product, cart). Returns parsed JSON; fails on non-200. */
export async function apiGet(odb, path) {
  const res = await fetch(`${odb.apiURL}${path}`, { headers: { accept: "application/json" } });
  const text = await res.text();
  expect(res.status, `GET ${path} → ${res.status} ${text.slice(0, 160)}`).toBe(200);
  return JSON.parse(text);
}

/** Money shown on screen ("$1,234.56") → cents. */
export function centsFromText(text) {
  const m = String(text || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Math.round(Number(m[0]) * 100) : NaN;
}
export const cents = (n) => Math.round(Number(n) * 100);

export const test = base.extend({
  odb: async ({}, use) => use(odbTarget()),
  health: async ({ page }, use) => use(watchHealth(page)),
  // `next dev` compiles each route on first visit (minutes on this app): give local runs room.
  localTimeouts: [
    async ({ page, odb }, use) => {
      if (odb.local) {
        page.setDefaultNavigationTimeout(180_000);
        test.setTimeout(Math.max(test.info().timeout, 300_000));
      }
      await use(true);
    },
    { auto: true },
  ],
  corsShim: [
    async ({ context, odb }, use) => {
      const origin = new URL(odb.baseURL).origin;
      if (odb.local && origin !== ALLOWED_DEV_ORIGIN) {
        await context.route(API_ORIGIN_RE, async (route) => {
          const req = route.request();
          const cors = {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
            "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            "access-control-allow-headers": req.headers()["access-control-request-headers"] || "authorization,content-type",
            vary: "Origin",
          };
          if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
          const res = await route.fetch({ headers: { ...req.headers(), origin: ALLOWED_DEV_ORIGIN } }).catch(() => null);
          if (!res) return route.abort();
          return route.fulfill({ response: res, headers: { ...res.headers(), ...cors } });
        });
      }
      await use(true);
    },
    { auto: true },
  ],
});

export { expect };

/** Open a storefront path, dismiss the cookie banner and the assistant overlay. */
export async function go(page, path = "/") {
  await gotoOneDirectBuy(page, path);
  await dismissCookieBanner(page);
  await dismissAssistantOverlay(page);
}

/** Product links on a listing / search page (unique hrefs, in page order). */
export async function productHrefs(page) {
  return page.locator('a[href*="/product/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
}

/** qa tag for anything a flow creates (guide § 2.2). */
export function qaTag(caseId) {
  const run = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `qa-e2e-${run}-${String(caseId).toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}
