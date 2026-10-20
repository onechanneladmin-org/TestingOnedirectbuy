const { issue } = require("./support");

module.exports = [
  {
    id: "scroll.horizontal-overflow",
    category: "scroll",
    kind: "deterministic",
    severity: "major",
    description: "The page scrolls horizontally outside an allowed scroll container.",
    detect(snapshot) {
      const doc = snapshot.document || {};
      if (!doc.horizontalOverflow) return [];
      return [
        issue(null, {
          element: "document",
          selector: "html",
          message: "Page has horizontal scrolling that is not inside an allowed scroller",
          expected: "document scrollWidth within the viewport, or overflow inside [data-audit-allow-scroll]",
          actual: `scrollWidth ${doc.scrollWidth}px > viewport ${doc.innerWidth}px`,
        }),
      ];
    },
  },
  {
    id: "scroll.content-unreachable",
    category: "scroll",
    kind: "deterministic",
    severity: "major",
    description: "The page is taller than the viewport but scrolling is locked and nothing else scrolls.",
    detect(snapshot) {
      const doc = snapshot.document || {};
      if (!doc.verticalUnreachable) return [];
      return [
        issue(null, {
          element: "document",
          selector: "html",
          message: "Content is taller than the viewport and cannot be scrolled",
          expected: "overflow-y auto/scroll on the page or a main region",
          actual: `scrollHeight ${doc.scrollHeight}px in ${doc.innerHeight}px with overflow hidden`,
        }),
      ];
    },
  },
  {
    id: "scroll.nested-vertical",
    category: "scroll",
    kind: "heuristic",
    severity: "minor",
    description: "The page and a main region both scroll vertically.",
    detect(snapshot) {
      if (!snapshot.document || !snapshot.document.nestedVerticalScroll) return [];
      return [
        issue(null, {
          element: "main",
          selector: "main",
          message: "Nested vertical scrollbars on the page and main region",
          expected: "one vertical scroll container",
          actual: "document and main both scroll",
          confidence: 0.45,
        }),
      ];
    },
  },
];
