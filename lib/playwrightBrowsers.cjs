/**
 * Cursor injects PLAYWRIGHT_BROWSERS_PATH into a sandbox cache that often
 * lacks Chromium/ffmpeg. Control-plane CMD inherits it, so every test
 * dies in browserContext.newPage and the UI shows "skip".
 */
const fs = require("fs");
const path = require("path");

function looksLikeSandboxCache(dir) {
  return /cursor-sandbox-cache/i.test(String(dir || ""));
}

function hasChromium(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  try {
    return fs.readdirSync(dir).some((name) => /^chromium/i.test(name));
  } catch {
    return false;
  }
}

function hasFfmpeg(dir) {
  if (!dir || !fs.existsSync(dir)) return false;
  // Windows build used by Playwright when video/traces are enabled.
  const win64 = path.join(dir, "ffmpeg-1011", "ffmpeg-win64.exe");
  const linux = path.join(dir, "ffmpeg-1011", "ffmpeg");
  return fs.existsSync(win64) || fs.existsSync(linux);
}

function sanitizePlaywrightBrowsersPath(env = process.env) {
  const current = env.PLAYWRIGHT_BROWSERS_PATH || "";
  // Trust paths deliberately supplied by the runtime (notably the official
  // Playwright Docker image's /ms-playwright). Only Cursor's injected cache
  // needs validation/replacement because it is often incomplete.
  if (current && !looksLikeSandboxCache(current)) {
    return env.PLAYWRIGHT_BROWSERS_PATH;
  }

  delete env.PLAYWRIGHT_BROWSERS_PATH;

  const candidates = [
    path.resolve(process.cwd(), ".playwright-browsers"),
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "ms-playwright")
      : "",
  ].filter(Boolean);

  for (const dir of candidates) {
    if (hasChromium(dir) && hasFfmpeg(dir)) {
      env.PLAYWRIGHT_BROWSERS_PATH = dir;
      return dir;
    }
  }
  return env.PLAYWRIGHT_BROWSERS_PATH || "";
}

module.exports = {
  sanitizePlaywrightBrowsersPath,
  looksLikeSandboxCache,
};
