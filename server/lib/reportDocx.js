const fs = require("fs");
const { Document, Packer, Paragraph, HeadingLevel, ImageRun } = require("docx");
const { resolveScreenshotFile } = require("./issueScreenshots");

function issueList(report, occurrence) {
  const fromReport = report?.issues?.issues || report?.issues;
  if (Array.isArray(fromReport) && fromReport.length) return fromReport;
  if (Array.isArray(occurrence?.liveIssues) && occurrence.liveIssues.length) {
    return occurrence.liveIssues;
  }
  return [];
}

function bodyText(issue) {
  const evidence = String(issue.evidence || issue.message || "").trim();
  if (evidence) return evidence;
  return [
    issue.pagePath ? `Page: ${issue.pagePath}` : "",
    issue.expected ? `Expected: ${issue.expected}` : "",
    issue.actual ? `Actual: ${issue.actual}` : "",
    issue.selector ? `Selector: ${issue.selector}` : "",
    issue.referenceId ? `Reference: ${issue.referenceId}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function buildReportDocx({ occurrence, report }) {
  const occurrenceId = occurrence.occurrenceId;
  const issues = issueList(report, occurrence);
  const summary = report?.summary || {};
  const children = [];

  children.push(
    new Paragraph({
      text: "OneChannelAdmin UX Audit Report",
      heading: HeadingLevel.TITLE,
    }),
  );
  children.push(
    new Paragraph({
      text: [
        `Occurrence: ${occurrenceId}`,
        `Flow: ${occurrence.flowName || occurrence.flowId || "—"}`,
        `Status: ${occurrence.status || "—"} · Exit: ${summary.exitCode ?? occurrence.exitCode ?? "—"}`,
        `Issues: ${issues.length}`,
        `Generated: ${new Date().toISOString()}`,
      ].join("\n"),
      spacing: { after: 200 },
    }),
  );

  if (!issues.length) {
    children.push(
      new Paragraph({
        text: "No UX issues recorded for this run.",
        spacing: { before: 200 },
      }),
    );
  }

  for (let i = 0; i < issues.length; i += 1) {
    const issue = issues[i];
    const title = `${issue.marker || "[UX]"} ${issue.id || issue.step || i + 1} — ${issue.title || "Issue"}`;
    children.push(
      new Paragraph({
        text: title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      }),
    );
    const meta = [
      `Severity: ${issue.severity || "major"}`,
      issue.ruleId ? `Rule: ${issue.ruleId}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    children.push(new Paragraph({ text: meta, spacing: { after: 80 } }));
    children.push(
      new Paragraph({
        text: bodyText(issue),
        spacing: { after: 120 },
      }),
    );

    const shotKey = issue.screenshotFile || issue.screenshot || "";
    if (shotKey) {
      const shotPath = resolveScreenshotFile(occurrenceId, shotKey);
      if (shotPath && fs.existsSync(shotPath)) {
        try {
          const data = fs.readFileSync(shotPath);
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  type: "png",
                  data,
                  transformation: { width: 520, height: 320 },
                }),
              ],
            }),
          );
        } catch {
          children.push(new Paragraph({ text: "[Screenshot could not be embedded]" }));
        }
      }
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = { buildReportDocx, issueList };
