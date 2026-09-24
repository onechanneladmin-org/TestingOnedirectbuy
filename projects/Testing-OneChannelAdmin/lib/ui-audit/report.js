const fs = require("fs");
const path = require("path");
const { PATHS } = require("../constants");

const KIND_ORDER = ["deterministic", "heuristic", "visual", "review"];
const SEVERITY_ORDER = ["critical", "major", "minor"];

function summarize(findings) {
  const summary = {
    total: findings.length,
    deterministic: 0,
    heuristic: 0,
    visual: 0,
    review: 0,
    critical: 0,
    major: 0,
    minor: 0,
  };
  for (const finding of findings) {
    if (summary[finding.kind] != null) summary[finding.kind] += 1;
    if (summary[finding.severity] != null) summary[finding.severity] += 1;
  }
  return summary;
}

function renderMarkdown(report) {
  const lines = [
    `# UI audit — ${report.page || report.url || "page"}`,
    "",
    `**URL:** ${report.url || ""}`,
    `**Theme:** ${report.theme || ""}`,
    `**Viewport:** ${report.viewport.width}×${report.viewport.height}`,
    `**Generated:** ${report.generatedAt}`,
    `**Exit code:** ${report.exitCode}`,
    "",
    "Deterministic and visual findings at critical or major fail the default CI gate. Heuristic findings and REVIEW_REQUIRED items are reported and do not fail that gate.",
    "",
    `**Totals:** ${report.summary.total} · deterministic ${report.summary.deterministic} · heuristic ${report.summary.heuristic} · visual ${report.summary.visual} · review ${report.summary.review}`,
    "",
  ];
  if (!report.findings.length) {
    lines.push("No findings.");
    lines.push("");
    return lines.join("\n");
  }
  for (const kind of KIND_ORDER) {
    const group = report.findings.filter((finding) => finding.kind === kind);
    if (!group.length) continue;
    const title = kind === "review" ? "REVIEW_REQUIRED" : kind;
    lines.push(`## ${title}`);
    lines.push("");
    for (const severity of SEVERITY_ORDER) {
      const rows = group.filter((finding) => finding.severity === severity);
      if (!rows.length) continue;
      lines.push(`### ${severity}`);
      lines.push("");
      for (const finding of rows) {
        lines.push(`- **${finding.ruleId}** (${finding.category}, confidence ${finding.confidence})`);
        lines.push(`  - ${finding.message}`);
        lines.push(`  - Element: ${finding.element || "n/a"}`);
        lines.push(`  - Selector: \`${finding.selector || "n/a"}\``);
        lines.push(`  - Expected: ${finding.expected}`);
        lines.push(`  - Actual: ${finding.actual}`);
        if (finding.evidence && finding.evidence.screenshot) {
          lines.push(`  - Screenshot: ${finding.evidence.screenshot}`);
        }
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function writeReport(report, dir) {
  const jsonPath = path.join(dir, "report.json");
  const markdownPath = path.join(dir, "report.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(markdownPath, renderMarkdown(report));
  const latestDir = path.join(PATHS.testResults, "ui-audit");
  fs.mkdirSync(latestDir, { recursive: true });
  fs.copyFileSync(jsonPath, path.join(latestDir, "latest.json"));
  return { json: jsonPath, markdown: markdownPath, dir };
}

module.exports = { renderMarkdown, summarize, writeReport };
