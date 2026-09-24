const fs = require("fs");
const path = require("path");
const { decodePng, diffRatio } = require("../png-diff");
const { issue } = require("./support");

function slug(snapshot, options) {
  const name = options.pageName || snapshot.title || "page";
  return (
    String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "page"
  );
}

module.exports = [
  {
    id: "visual.reference-diff",
    category: "visual",
    kind: "visual",
    severity: "major",
    phase: "page",
    order: 0,
    description: "Viewport screenshot differs from the reference image.",
    async detect(snapshot, ctx = {}) {
      const visual = ctx.options?.visual || {};
      if (visual.enabled === false || !ctx.page) return [];
      const file =
        visual.baselinePath ||
        (visual.baselineDir
          ? path.join(
              visual.baselineDir,
              `${slug(snapshot, ctx.options)}-${snapshot.theme}-${snapshot.viewport.width}x${snapshot.viewport.height}.png`,
            )
          : "");
      if (!file) return [];
      const current = await ctx.page.screenshot({ animations: "disabled" });
      if (visual.updateBaseline || !fs.existsSync(file)) {
        if (visual.updateBaseline) {
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, current);
        }
        if (!fs.existsSync(file) && visual.requireBaseline) {
          return [
            issue(null, {
              element: "viewport",
              selector: "body",
              severity: "minor",
              message: "Visual baseline is missing",
              expected: file,
              actual: "no baseline",
            }),
          ];
        }
        return [];
      }
      let ratio = 1;
      try {
        ratio = diffRatio(decodePng(current), decodePng(fs.readFileSync(file)), visual.channelTolerance ?? 24);
      } catch (error) {
        return [
          issue(null, {
            element: "viewport",
            selector: "body",
            severity: "minor",
            kind: "review",
            message: "Visual comparison could not decode a screenshot",
            expected: "comparable PNGs",
            actual: error.message,
            confidence: 0.3,
          }),
        ];
      }
      const max = visual.maxDiffPixelRatio ?? 0.01;
      if (ratio <= max) return [];
      return [
        issue(null, {
          element: "viewport",
          selector: "body",
          message: "Screenshot differs from the reference",
          expected: `pixel difference <= ${max}`,
          actual: ratio.toFixed(4),
          action: { type: "screenshot", baseline: file },
        }),
      ];
    },
  },
];
