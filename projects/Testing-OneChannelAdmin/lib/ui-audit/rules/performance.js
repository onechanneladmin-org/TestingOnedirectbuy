const { issue } = require("./support");

module.exports = [
  {
    id: "perf.slow-load",
    category: "performance",
    kind: "deterministic",
    severity: "major",
    description: "Navigation load time exceeds the configured budget.",
    detect(snapshot, ctx = {}) {
      const max = ctx.options?.performance?.maxLoadMs ?? 8000;
      const loadMs = snapshot.performance ? snapshot.performance.loadMs : 0;
      if (!loadMs || loadMs <= max) return [];
      return [
        issue(null, {
          element: "navigation",
          selector: "html",
          message: "Page load exceeded the budget",
          expected: `<= ${max}ms`,
          actual: `${loadMs}ms`,
        }),
      ];
    },
  },
  {
    id: "perf.dom-too-large",
    category: "performance",
    kind: "heuristic",
    severity: "minor",
    description: "The DOM has more nodes than the budget.",
    detect(snapshot, ctx = {}) {
      const max = ctx.options?.performance?.maxNodes ?? 8000;
      const count = snapshot.performance ? snapshot.performance.nodeCount : 0;
      if (count <= max) return [];
      return [
        issue(null, {
          element: "document",
          selector: "html",
          message: "DOM is larger than the budget",
          expected: `<= ${max} nodes`,
          actual: `${count} nodes`,
          confidence: 0.5,
        }),
      ];
    },
  },
  {
    id: "perf.image-missing-dimensions",
    category: "performance",
    kind: "deterministic",
    severity: "minor",
    description: "An image is missing width and height attributes, which causes layout shift.",
    detect(snapshot) {
      const count = snapshot.performance ? snapshot.performance.imagesMissingSize : 0;
      if (!count) return [];
      return [
        issue(null, {
          element: "img",
          selector: "img",
          message: "Images are missing width and height",
          expected: "width and height attributes",
          actual: `${count} image(s)`,
        }),
      ];
    },
  },
];
