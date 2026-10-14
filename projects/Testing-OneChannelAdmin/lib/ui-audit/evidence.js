const fs = require("fs");
const path = require("path");
const { PATHS } = require("../constants");

function slug(value) {
  return (
    String(value || "page")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "page"
  );
}

function createReportDir(options, snapshot) {
  if (options.reportDir) {
    fs.mkdirSync(options.reportDir, { recursive: true });
    return options.reportDir;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(PATHS.testResults, "ui-audit", `${stamp}-${slug(options.pageName || snapshot.title)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function clipToViewport(box, viewport) {
  if (!box || !viewport) return null;
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  const right = Math.min(viewport.width, box.x + box.width);
  const bottom = Math.min(viewport.height, box.y + box.height);
  const width = right - x;
  const height = bottom - y;
  if (width < 2 || height < 2) return null;
  return {
    x: Math.floor(x),
    y: Math.floor(y),
    width: Math.ceil(width),
    height: Math.ceil(height),
  };
}

async function attachEvidence(page, findings, snapshot, options) {
  const dir = createReportDir(options, snapshot);
  let screenshot = null;
  try {
    screenshot = path.join(dir, "page.png");
    await page.screenshot({ path: screenshot, animations: "disabled" });
  } catch {
    screenshot = null;
  }

  const published = [];
  let clips = 0;
  for (const finding of findings) {
    const hints = finding.hints || {};
    let clip = null;
    const important =
      (finding.kind === "deterministic" || finding.kind === "visual") &&
      (finding.severity === "critical" || finding.severity === "major");
    const clipBox = clipToViewport(hints.bbox, snapshot.viewport);
    if (important && clipBox && clips < 8 && page) {
      clip = path.join(dir, `finding-${published.length + 1}.png`);
      try {
        await page.screenshot({ path: clip, animations: "disabled", clip: clipBox });
        clips += 1;
      } catch {
        clip = null;
      }
    }
    published.push({
      ruleId: finding.ruleId,
      category: finding.category,
      severity: finding.severity,
      confidence: finding.confidence,
      kind: finding.kind,
      page: finding.page,
      element: finding.element,
      selector: finding.selector,
      message: finding.message,
      expected: finding.expected,
      actual: finding.actual,
      evidence: {
        screenshot,
        clip,
        boundingBox: hints.bbox || null,
        computedStyles: hints.styles || null,
        url: snapshot.url,
        viewport: snapshot.viewport,
        theme: snapshot.theme,
        action: finding.action || options.action || { type: "audit", page: options.pageName || "" },
      },
    });
  }
  return { findings: published, dir, screenshot };
}

module.exports = { attachEvidence, createReportDir };
