/**
 * Run AutopartMarketplaceBackend Jest / node:test cases from Playwright UX Module specs.
 * Backend root: ODB_BACKEND_ROOT, else this-repo local/AutopartMarketplaceBackend.
 */
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const TESTING_ROOT = process.cwd();
const CASE_TIMEOUT_MS = 180000;

function isBackendRoot(dir) {
  return Boolean(dir) && fs.existsSync(path.join(dir, "package.json"));
}

export function resolveBackendRoot() {
  const fromEnv = String(process.env.ODB_BACKEND_ROOT || "").trim();
  const candidates = [
    fromEnv ? path.resolve(fromEnv) : "",
    path.resolve(TESTING_ROOT, "local/AutopartMarketplaceBackend"),
    path.resolve(TESTING_ROOT, "AutopartMarketplaceBackend"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isBackendRoot(candidate)) return candidate;
  }
  return "";
}

function ensureBackendDeps(root) {
  if (fs.existsSync(path.join(root, "node_modules"))) return true;
  const pnpmLock = fs.existsSync(path.join(root, "pnpm-lock.yaml"));
  const npmLock = fs.existsSync(path.join(root, "package-lock.json"));
  const cmd = pnpmLock
    ? ["pnpm", "install"]
    : npmLock
      ? ["npm", "ci"]
      : ["npm", "install"];
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd: root,
    encoding: "utf8",
    timeout: 10 * 60 * 1000,
    stdio: "pipe",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) return false;
  return fs.existsSync(path.join(root, "node_modules"));
}

export function backendReady() {
  const root = resolveBackendRoot();
  if (!root) return { ok: false, root: "", reason: "missing-root" };
  if (!fs.existsSync(path.join(root, "node_modules"))) {
    const installed = ensureBackendDeps(root);
    if (!installed) return { ok: false, root, reason: "missing-deps" };
  }
  return { ok: true, root, reason: "" };
}

export function backendSkipReason() {
  const state = backendReady();
  if (state.ok) return "";
  if (state.reason === "missing-deps") {
    return `Backend dependencies missing at ${state.root}. Run pnpm install in AutopartMarketplaceBackend.`;
  }
  return "AutopartMarketplaceBackend not found. Set ODB_BACKEND_ROOT to the backend repo.";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveTestFile(root, file) {
  const rel = String(file || "").replace(/\\/g, "/").replace(/^tests\//, "");
  return path.join(root, "tests", rel);
}

export async function runUxModuleCase(opts) {
  const file = opts.file;
  const testName = opts.testName;
  const runner = opts.runner || "jest";
  const state = backendReady();
  if (!state.ok) {
    throw new Error(
      state.reason === "missing-deps"
        ? `Backend dependencies missing at ${state.root}. Run pnpm install.`
        : "AutopartMarketplaceBackend not found. Set ODB_BACKEND_ROOT.",
    );
  }

  const testFile = resolveTestFile(state.root, file);
  if (!fs.existsSync(testFile)) {
    throw new Error(`Backend test file not found: ${testFile}`);
  }

  const relFile = path.relative(state.root, testFile).replace(/\\/g, "/");
  const pattern = escapeRegex(testName);
  let result;

  if (runner === "node:test") {
    result = spawnSync(
      process.execPath,
      ["--test", "--test-name-pattern", `^${pattern}$`, testFile],
      {
        cwd: state.root,
        encoding: "utf8",
        timeout: CASE_TIMEOUT_MS,
        env: { ...process.env, FORCE_COLOR: "0" },
      },
    );
  } else {
    const jestBin = path.join(state.root, "node_modules", "jest", "bin", "jest.js");
    if (!fs.existsSync(jestBin)) {
      throw new Error(`Jest not installed in ${state.root}. Run pnpm install.`);
    }
    result = spawnSync(
      process.execPath,
      [
        jestBin,
        "--runInBand",
        "--forceExit",
        "--testTimeout=120000",
        relFile,
        "--testNamePattern",
        pattern,
      ],
      {
        cwd: state.root,
        encoding: "utf8",
        timeout: CASE_TIMEOUT_MS,
        env: { ...process.env, FORCE_COLOR: "0", CI: "1" },
      },
    );
  }

  if (result.error) {
    if (result.error.code === "ETIMEDOUT") {
      throw new Error(
        `UX module case timed out (${file} -- ${testName}) after ${CASE_TIMEOUT_MS}ms`,
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    const out = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(
      `UX module case failed (${file} -- ${testName})\n${out.slice(-4000)}`,
    );
  }
}
