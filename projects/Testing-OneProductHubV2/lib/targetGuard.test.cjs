const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const g = require("./targetGuard.cjs");

const SPECS = path.resolve(__dirname, "..", "tests", "OneproducthubV2");
const LIVE = "https://oneproducthub.com";
const LIVE_API = "https://oneproducthub-backend.onechanneladmin.com";

test("defaults to local UI and API", () => {
  const r = g.checkTarget({});
  assert.equal(r.ok, true);
  assert.equal(r.prod, false);
  assert.equal(r.baseUrl, "http://localhost:3000");
  assert.equal(r.apiUrl, "http://localhost:4000");
});

test("live site is refused without ALLOW_PROD_READONLY", () => {
  for (const key of ["ONEPRODUCTHUB_BASE_URL", "ONEPRODUCTHUB_V2_BASE_URL", "BASE_URL", "PLAYWRIGHT_BASE_URL"]) {
    const r = g.checkTarget({ [key]: LIVE });
    assert.equal(r.ok, false, key);
    assert.match(r.reason, /Refusing/);
  }
});

test("local or staging UI with the live API is refused, even with the flag", () => {
  for (const env of [
    { ONEPRODUCTHUB_API_BASE_URL: LIVE_API },
    { ONEPRODUCTHUB_BASE_URL: "https://staging.oneproducthub.com", ONEPRODUCTHUB_API_BASE_URL: LIVE_API },
    { ONEPRODUCTHUB_API_BASE_URL: LIVE_API, ALLOW_PROD_READONLY: "1" },
    { ONEPRODUCTHUB_BASE_URL: LIVE, ONEPRODUCTHUB_API_BASE_URL: "http://localhost:4000", ALLOW_PROD_READONLY: "1" },
  ]) {
    const r = g.checkTarget(env);
    assert.equal(r.ok, false, JSON.stringify(env));
    assert.match(r.reason, /different environments/);
  }
});

test("ALLOW_PROD_READONLY=1 runs only the read-only allowlist, with the live API", () => {
  const r = g.checkTarget({ ONEPRODUCTHUB_BASE_URL: LIVE, ALLOW_PROD_READONLY: "1" });
  assert.equal(r.ok, true);
  assert.equal(r.prod, true);
  assert.equal(r.apiUrl, LIVE_API);
  assert.deepEqual(r.readOnlySpecs, g.PRODUCTION_READ_ONLY_SPECS);
});

test("write specs can never be allow-listed for production", () => {
  const env = { ONEPRODUCTHUB_BASE_URL: LIVE, ALLOW_PROD_READONLY: "1" };
  for (const f of [
    "BrandAddProduct.spec.js",
    "E2E_BrandProductLifecycle.spec.js",
    "E2E_BrandAdminSharedAccess.spec.js",
    "E2E_ClientRequestAccess.spec.js",
    "E2E_ApproveAccessUiOnly.spec.js",
    "ForgotPasswordSubmit.spec.js",
  ]) {
    const r = g.checkTarget(env, ["LoginAdmin.spec.js", f]);
    assert.equal(r.ok, false, f);
    assert.match(r.reason, /never run against production/);
  }
});

test("every allow-listed spec exists and none is a write spec", () => {
  const files = new Set(fs.readdirSync(SPECS));
  for (const f of g.PRODUCTION_READ_ONLY_SPECS) {
    assert.ok(files.has(f), `missing ${f}`);
    assert.equal(g.isWriteSpec(f), false, f);
  }
});

test("non-prod runs block the live hosts in the browser; prod read-only does not", () => {
  const [arg] = g.hostResolverArgs(g.checkTarget({}));
  assert.match(arg, /MAP oneproducthub\.com ~NOTFOUND/);
  assert.match(arg, /MAP oneproducthub-backend\.onechanneladmin\.com ~NOTFOUND/);
  assert.deepEqual(
    g.hostResolverArgs(g.checkTarget({ ONEPRODUCTHUB_BASE_URL: LIVE, ALLOW_PROD_READONLY: "1" })),
    [],
  );
});

test("no test or script falls back to a live URL or a literal password", () => {
  const offenders = [];
  for (const dir of ["tests", "scripts"]) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|cjs|mjs|ts)$/.test(e.name)) {
          const t = fs.readFileSync(p, "utf8");
          if (/\|\|\s*["'`]https:\/\/(oneproducthub\.com|oneproducthub-backend\.)/.test(t)) offenders.push(`${p}: live URL fallback`);
          if (/PASSWORD\s*\|\|\s*["'`][^"'`]+["'`]/.test(t)) offenders.push(`${p}: password fallback`);
        }
      }
    };
    walk(path.resolve(__dirname, "..", dir));
  }
  assert.deepEqual(offenders, []);
});
