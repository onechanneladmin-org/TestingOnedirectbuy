const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const {
  flowStep: soft,
  reportFlowIssue,
  captureIssueScreenshot,
} = require("../../helpers/flowStep");
const {
  openSignIn,
  signIn,
  openAdminPage,
  runFullUxAudit,
  runUserActionSteps,
  writeBatchSummary,
} = require("./uxAuditSteps");

// Full-app batch: ~112 pages. Default Playwright timeout (5m) kills the browser
// mid-run and every later page fails with "Target page, context or browser has been closed".
test.setTimeout(Number(process.env.UX_BATCH_TIMEOUT_MS) || 3 * 60 * 60 * 1000);

function loadPages() {
  if (process.env.UX_AUDIT_PAGES) {
    return JSON.parse(process.env.UX_AUDIT_PAGES);
  }
  const pages = [{ hub: "Home", name: "Dashboard", path: "/home/dashboard", stepPrefix: "HD" }];
  for (const file of fs.readdirSync(__dirname).sort()) {
    if (!file.endsWith(".spec.js") || file === "ux-audit-batch.spec.js") continue;
    const text = fs.readFileSync(path.join(__dirname, file), "utf8");
    const hub = (text.match(/"hub":\s*"([^"]+)"/) || [])[1];
    const name = (text.match(/"name":\s*"([^"]+)"/) || [])[1];
    const pagePath = (text.match(/"path":\s*"([^"]+)"/) || [])[1];
    const stepPrefix = (text.match(/"stepPrefix":\s*"([^"]+)"/) || [])[1];
    if (!pagePath) continue;
    pages.push({
      hub: hub || "Page",
      name: name || file.replace(/\.spec\.js$/, ""),
      path: pagePath,
      stepPrefix: stepPrefix || "UX",
    });
  }
  const seen = new Set();
  const uniq = [];
  for (const page of pages) {
    if (seen.has(page.path)) continue;
    seen.add(page.path);
    uniq.push(page);
  }
  return uniq;
}

function overlayFields(source) {
  const stats = (source && source.overlayStats) || {};
  return {
    modals: stats.modals || 0,
    popups: stats.popups || 0,
    sidebars: stats.sidebars || 0,
    opened: stats.opened || [],
  };
}

function isBrowserClosedError(err) {
  return /Target page, context or browser has been closed|browser has been closed/i.test(
    String(err?.message || err || ""),
  );
}

/** Close popup/extra pages only — never the active page. */
async function keepSingleTab(context, mainPage) {
  if (!mainPage || mainPage.isClosed()) return;
  for (const p of context.pages()) {
    if (p !== mainPage && !p.isClosed()) await p.close().catch(() => {});
  }
}

async function recoverPage(context, previousPage) {
  if (previousPage && !previousPage.isClosed()) return previousPage;
  const next = await context.newPage();
  await openSignIn(next);
  await signIn(next);
  await keepSingleTab(context, next);
  return next;
}

test("UX Audit batch — login once and scan pages", async ({ page, context }) => {
  const pages = loadPages();
  const rows = [];
  const allIssues = [];
  let activePage = page;

  context.on("page", async (extra) => {
    if (activePage && activePage.__uxAllowExtraPages) return;
    if (extra !== activePage && !extra.isClosed()) {
      await extra.close().catch(() => {});
    }
  });

  await soft("BATCH-01", "Open the admin sign-in page", async () => {
    await openSignIn(activePage);
    await keepSingleTab(context, activePage);
  });

  await soft("BATCH-02", "Sign in as admin once", async () => {
    await signIn(activePage);
    await keepSingleTab(context, activePage);
  });

  for (let i = 0; i < pages.length; i += 1) {
    const entry = {
      ...pages[i],
      stepPrefix: pages[i].stepPrefix || `P${String(i + 1).padStart(3, "0")}`,
    };
    const openId = `${entry.stepPrefix}-OPEN`;
    const auditId = `${entry.stepPrefix}-AUDIT`;
    console.log(`[ux-audit] ${i + 1}/${pages.length} ${entry.hub} — ${entry.name}`);

    try {
      activePage = await recoverPage(context, activePage);
      await soft(openId, `Open ${entry.hub} — ${entry.name}`, async () => {
        await openAdminPage(activePage, entry);
        await keepSingleTab(context, activePage);
      });
    } catch (err) {
      if (isBrowserClosedError(err)) {
        try {
          activePage = await recoverPage(context, null);
          await soft(openId, `Retry open ${entry.hub} — ${entry.name}`, async () => {
            await openAdminPage(activePage, entry);
            await keepSingleTab(context, activePage);
          });
        } catch (retryErr) {
          err = retryErr;
          const shot = await captureIssueScreenshot(activePage, `${openId}-fail`, null).catch(
            () => "",
          );
          await reportFlowIssue({
            id: `${openId}-fail`,
            step: openId,
            title: `Failed to open ${entry.hub} — ${entry.name}`,
            severity: "blocker",
            marker: "[UX]",
            pagePath: entry.path || "",
            screenshotFile: shot || undefined,
            evidence: [
              String(err.message || err).slice(0, 800),
              entry.path ? `Page: ${entry.path}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          });
          rows.push({
            hub: entry.hub,
            name: entry.name,
            path: entry.path,
            status: "error",
            findings: 0,
            error: String(err.message || err).slice(0, 300),
            screenshotFile: shot || "",
          });
          continue;
        }
      } else {
        const shot = await captureIssueScreenshot(activePage, `${openId}-fail`, null).catch(
          () => "",
        );
        await reportFlowIssue({
          id: `${openId}-fail`,
          step: openId,
          title: `Failed to open ${entry.hub} — ${entry.name}`,
          severity: "blocker",
          marker: "[UX]",
          pagePath: entry.path || "",
          screenshotFile: shot || undefined,
          evidence: [
            String(err.message || err).slice(0, 800),
            entry.path ? `Page: ${entry.path}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
        rows.push({
          hub: entry.hub,
          name: entry.name,
          path: entry.path,
          status: "error",
          findings: 0,
          error: String(err.message || err).slice(0, 300),
          screenshotFile: shot || "",
        });
        continue;
      }
    }

    let audited = null;
    try {
      await soft(auditId, `Audit ${entry.hub} — ${entry.name}`, async () => {
        await runUserActionSteps(activePage, entry, soft);
        audited = await runFullUxAudit(activePage, entry, reportFlowIssue, captureIssueScreenshot);
      });
      rows.push({
        hub: entry.hub,
        name: entry.name,
        path: entry.path,
        status: "audited",
        findings: 0,
        ...overlayFields(audited),
      });
    } catch (err) {
      if (isBrowserClosedError(err)) {
        try {
          activePage = await recoverPage(context, null);
          await soft(auditId, `Retry audit ${entry.hub} — ${entry.name}`, async () => {
            await openAdminPage(activePage, entry);
            await runUserActionSteps(activePage, entry, soft);
            audited = await runFullUxAudit(activePage, entry, reportFlowIssue, captureIssueScreenshot);
          });
          rows.push({
            hub: entry.hub,
            name: entry.name,
            path: entry.path,
            status: "audited",
            findings: 0,
            ...overlayFields(audited),
          });
          continue;
        } catch (retryErr) {
          err = retryErr;
        }
      }
      const reported = Array.isArray(err.uxFindings) ? err.uxFindings : [];
      for (const issue of reported) allIssues.push(issue);
      const match = /found (\d+) issue/.exec(String(err.message || ""));
      rows.push({
        hub: entry.hub,
        name: entry.name,
        path: entry.path,
        status: isBrowserClosedError(err) ? "error" : "audited",
        findings: reported.length || (match ? Number(match[1]) : isBrowserClosedError(err) ? 0 : 1),
        error: String(err.message || err).slice(0, 300),
        ...overlayFields(err),
      });
    }

    await keepSingleTab(context, activePage);
  }

  const outDir = path.join(process.cwd(), "test-results", "ux-audit-batch");
  const summary = writeBatchSummary(rows, outDir, allIssues);

  const openErrors = rows.filter((row) => row.status === "error").length;
  const findings = rows.reduce((sum, row) => sum + (row.findings || 0), 0);
  if (openErrors || findings) {
    throw new Error(
      `Batch UX audit finished with ${findings} finding(s) across ${rows.length} page(s); ${openErrors} page open error(s). Overlays opened: ${summary.modals} modal, ${summary.popups} popup, ${summary.sidebars} sidebar. See test-results/ux-audit-batch/SUMMARY.md and PATTERN_ROLLUP.md`,
    );
  }
});
