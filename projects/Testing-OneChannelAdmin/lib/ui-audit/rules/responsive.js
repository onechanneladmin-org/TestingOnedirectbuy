const { elementsOf, issue } = require("./support");

module.exports = [
  {
    id: "responsive.wider-than-viewport",
    category: "responsive",
    kind: "deterministic",
    severity: "major",
    description: "An element is wider than the viewport and is not in an allowed scroller.",
    detect(snapshot, ctx = {}) {
      const tol = ctx.options?.overflowTolerancePx ?? 2;
      const width = snapshot.viewport ? snapshot.viewport.width : 0;
      if (!width) return [];
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.bbox || el.allowScroll) continue;
        if (el.tag === "html" || el.tag === "body") continue;
        if (el.bbox.width <= width + tol) continue;
        findings.push(
          issue(el, {
            message: "Element is wider than the viewport",
            expected: `width <= ${width}px or inside an allowed scroll container`,
            actual: `${Math.round(el.bbox.width)}px`,
          }),
        );
        if (findings.length >= 8) break;
      }
      return findings;
    },
  },
  {
    id: "responsive.touch-target",
    category: "responsive",
    kind: "heuristic",
    severity: "minor",
    description: "On a narrow viewport, a target is between the 24px floor and the 44px touch size.",
    detect(snapshot, ctx = {}) {
      const viewport = snapshot.viewport || { width: 1280 };
      const narrow = ctx.options?.exceptions?.narrowViewportPx ?? 768;
      if (viewport.width >= narrow) return [];
      const floor = ctx.options?.exceptions?.minTargetPx ?? 24;
      const target = ctx.options?.exceptions?.narrowTouchTargetPx ?? 44;
      return elementsOf(snapshot)
        .filter((el) => el.interactive && !el.disabled && el.inViewport && el.bbox)
        .filter((el) => el.bbox.width >= floor && el.bbox.height >= floor)
        .filter((el) => el.bbox.width < target || el.bbox.height < target)
        .slice(0, 8)
        .map((el) =>
          issue(el, {
            message: "Touch target is below 44px on a narrow viewport",
            expected: `at least ${target}×${target}px below ${narrow}px wide`,
            actual: `${Math.round(el.bbox.width)}×${Math.round(el.bbox.height)}px`,
            confidence: 0.5,
          }),
        );
    },
  },
];
