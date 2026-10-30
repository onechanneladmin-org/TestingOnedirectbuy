const fs = require("fs");
const path = require("path");

const hubReports = path.resolve(process.cwd(), "../../reports");
/** Hard ceiling so a runaway run cannot fill the disk. Override with UX_MAX_SHOTS. */
const MAX_SHOTS_PER_RUN = Math.max(
  1,
  Number(process.env.UX_MAX_SHOTS || 5000) || 5000,
);
/** Prefer element crops until this many PNGs exist; then reuse page fallbacks. */
const MAX_ELEMENT_SHOTS_PER_RUN = Math.max(
  1,
  Number(process.env.UX_MAX_ELEMENT_SHOTS || 2000) || 2000,
);

function occurrenceId() {
  return process.env.RUNNING_OCCURRENCE_ID || "";
}

function appendLive(event) {
  const id = occurrenceId();
  if (!id) return;
  const dir = path.join(hubReports, "live-steps");
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(path.join(dir, `${id}.ndjson`), `${JSON.stringify(event)}\n`);
}

function shotsRoot(id) {
  return path.join(hubReports, "issue-shots", id || "local");
}

function safeShotName(issueId) {
  return String(issueId || "issue")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function countShots(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => name.endsWith(".png")).length;
  } catch {
    return 0;
  }
}

/**
 * Capture a PNG for a UX finding. Prefers element screenshot with a red outline;
 * falls back to viewport. Returns filename (basename) or "".
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} issueId
 * @param {string|null} selector
 * @param {{ force?: boolean }} [opts] force=true bypasses the element-shot budget
 *   (used for per-page viewport fallbacks so later pages still get images).
 */
async function captureIssueScreenshot(page, issueId, selector, opts = {}) {
  const id = occurrenceId() || "local";
  const dir = shotsRoot(id);
  fs.mkdirSync(dir, { recursive: true });

  const force = Boolean(opts.force);
  const existing = countShots(dir);
  if (existing >= MAX_SHOTS_PER_RUN) return "";
  if (!force && selector && existing >= MAX_ELEMENT_SHOTS_PER_RUN) return "";

  const file = `${safeShotName(issueId)}.png`;
  const full = path.join(dir, file);

  try {
    if (page?.isClosed?.()) return "";

    if (selector) {
      const handle = await page.$(selector).catch(() => null);
      if (handle) {
        await handle
          .evaluate((el) => {
            el.setAttribute("data-ux-audit-highlight", "1");
            el.style.setProperty("outline", "3px solid #ef4444", "important");
            el.style.setProperty("outline-offset", "2px", "important");
          })
          .catch(() => {});
        await handle.scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(80);
        try {
          await handle.screenshot({ path: full, timeout: 4000 });
        } catch {
          await page.screenshot({ path: full, fullPage: false, timeout: 8000 });
        }
        await handle
          .evaluate((el) => {
            el.removeAttribute("data-ux-audit-highlight");
            el.style.removeProperty("outline");
            el.style.removeProperty("outline-offset");
          })
          .catch(() => {});
        await handle.dispose().catch(() => {});
        return file;
      }
    }
    await page.screenshot({ path: full, fullPage: false, timeout: 8000 });
    return file;
  } catch {
    return "";
  }
}

async function flowStep(stepId, title, fn) {
  appendLive({ kind: "step", stepId, title, status: "running" });
  try {
    await fn();
    appendLive({ kind: "step", stepId, title, status: "passed" });
  } catch (err) {
    const error = String(err?.message || err).slice(0, 2000);
    appendLive({ kind: "step", stepId, title, status: "failed", error });
    throw err;
  }
}

async function reportFlowIssue(issue) {
  const payload = { ...(issue || {}) };
  appendLive({ kind: "issue", issue: payload });
}

module.exports = {
  flowStep,
  appendLive,
  reportFlowIssue,
  captureIssueScreenshot,
  occurrenceId,
  MAX_SHOTS_PER_RUN,
  MAX_ELEMENT_SHOTS_PER_RUN,
};
