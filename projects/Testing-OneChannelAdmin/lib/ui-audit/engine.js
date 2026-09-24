const { collectSnapshot } = require("./snapshot");
const { loadBuiltInRules } = require("./registry");
const { mergeExceptions, isExcepted } = require("./exceptions");
const { defaultPolicy, exitCodeFor } = require("./exit-code");
const { attachEvidence } = require("./evidence");
const { summarize, writeReport } = require("./report");

const CONFIDENCE = { deterministic: 0.95, heuristic: 0.55, visual: 0.85, review: 0.35 };

function normalizeDraft(draft, rule, options, snapshot) {
  const kind = draft.kind || rule.kind;
  return {
    ruleId: draft.ruleId || rule.id,
    category: draft.category || rule.category,
    severity: draft.severity || rule.severity || "minor",
    confidence:
      draft.confidence == null
        ? rule.confidence == null
          ? CONFIDENCE[kind] ?? 0.5
          : rule.confidence
        : draft.confidence,
    kind,
    page: options.pageName || snapshot.title || snapshot.url || "",
    element: draft.element || "",
    selector: draft.selector || "",
    message: draft.message || rule.description || rule.id,
    expected: draft.expected == null ? "" : String(draft.expected),
    actual: draft.actual == null ? "" : String(draft.actual),
    action: draft.action || null,
    hints: draft.hints || {},
  };
}

/**
 * Run the UI audit rule engine against the current page.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   pageName?: string,
 *   theme?: 'light' | 'dark' | string,
 *   viewport?: { width: number, height: number },
 *   exceptions?: object,
 *   navigation?: { expectUrl?: string | RegExp, probes?: object[] },
 *   interaction?: { probes?: { selector: string }[] },
 *   visual?: object,
 *   performance?: { maxLoadMs?: number, maxNodes?: number },
 *   additionalRules?: object[],
 *   rules?: object[],
 *   disableRules?: string[],
 *   exitPolicy?: { failOnKinds?: string[], failOnSeverities?: string[] },
 *   action?: object,
 * }} [options]
 */
async function uiAudit(page, options = {}) {
  const exceptions = mergeExceptions(options.exceptions || {});
  const opts = {
    pageName: options.pageName || "",
    theme: options.theme || "",
    viewport: options.viewport || null,
    exceptions,
    navigation: options.navigation || {},
    interaction: options.interaction || {},
    visual: options.visual || {},
    performance: options.performance || {},
    action: options.action || null,
    additionalRules: options.additionalRules || [],
    disableRules: options.disableRules || [],
    includeKinds: options.includeKinds || null,
    writeReport: options.writeReport !== false,
    reportDir: options.reportDir || null,
    maxElements: options.maxElements,
    overflowTolerancePx: options.overflowTolerancePx ?? exceptions.overflowTolerancePx,
  };

  if (opts.viewport && opts.viewport.width && opts.viewport.height) {
    await page.setViewportSize({
      width: opts.viewport.width,
      height: opts.viewport.height,
    });
  }

  const runtime = { consoleErrors: [], pageErrors: [] };
  const onConsole = (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|Download the React DevTools/i.test(text)) return;
    runtime.consoleErrors.push(text);
  };
  const onPageError = (error) => {
    runtime.pageErrors.push(String(error && error.message ? error.message : error));
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  try {
    const snapshot = await collectSnapshot(page, opts);
    if (opts.theme) snapshot.theme = opts.theme;

    let rules = options.rules ? options.rules.slice() : loadBuiltInRules();
    rules = rules.concat(opts.additionalRules);
    const disabled = new Set(opts.disableRules);
    rules = rules.filter((rule) => rule && typeof rule.detect === "function" && !disabled.has(rule.id));
    if (opts.includeKinds) {
      const kinds = new Set(opts.includeKinds);
      rules = rules.filter((rule) => kinds.has(rule.kind));
    }

    const ctx = { page, options: opts, runtime, snapshot };
    const drafts = [];
    const ordered = [
      ...rules.filter((rule) => rule.phase !== "page"),
      ...rules.filter((rule) => rule.phase === "page").sort((a, b) => (a.order || 0) - (b.order || 0)),
    ];

    for (const rule of ordered) {
      try {
        const found = await rule.detect(snapshot, ctx);
        for (const draft of found || []) drafts.push(normalizeDraft(draft, rule, opts, snapshot));
      } catch (error) {
        drafts.push(
          normalizeDraft(
            {
              ruleId: "engine.rule-error",
              message: `Rule ${rule.id} failed: ${error.message}`,
              expected: "rule completes",
              actual: error.message,
              element: rule.id,
              severity: "major",
              confidence: 1,
            },
            { ...rule, id: "engine.rule-error", kind: "deterministic", category: "engine" },
            opts,
            snapshot,
          ),
        );
      }
    }

    const kept = drafts.filter(
      (finding) =>
        !isExcepted(finding, exceptions, {
          theme: snapshot.theme,
          viewport: snapshot.viewport,
          page: finding.page,
        }),
    );

    const policy = { ...defaultPolicy(), ...(options.exitPolicy || {}) };
    const evidenced = await attachEvidence(page, kept, snapshot, opts);
    const exitCode = exitCodeFor(evidenced.findings, policy);
    const report = {
      page: opts.pageName || snapshot.title || "",
      url: snapshot.url,
      theme: snapshot.theme,
      viewport: snapshot.viewport,
      generatedAt: new Date().toISOString(),
      exitCode,
      policy,
      summary: summarize(evidenced.findings),
      rulesExecuted: rules.map((rule) => rule.id),
      findings: evidenced.findings,
    };
    const reportPaths = opts.writeReport ? writeReport(report, evidenced.dir) : null;
    return {
      findings: evidenced.findings,
      report,
      exitCode,
      reportPaths,
      snapshot,
    };
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

module.exports = { uiAudit };
