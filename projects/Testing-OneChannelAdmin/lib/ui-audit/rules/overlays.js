const { issue } = require("./support");

module.exports = [
  {
    id: "overlays.dialog-missing-name",
    category: "overlays",
    kind: "deterministic",
    severity: "major",
    description: "A dialog or drawer has no accessible name.",
    detect(snapshot) {
      return (snapshot.overlays || [])
        .filter((overlay) => !String(overlay.name || "").trim())
        .map((overlay) =>
          issue(null, {
            element: overlay.role || "dialog",
            selector: overlay.selector,
            hints: { bbox: overlay.bbox, styles: null, auditIgnore: [], disabled: false, allowScroll: false },
            message: "Overlay has no accessible name",
            expected: "aria-label, aria-labelledby, or a heading",
            actual: "unnamed overlay",
          }),
        );
    },
  },
  {
    id: "overlays.dialog-not-modal",
    category: "overlays",
    kind: "deterministic",
    severity: "major",
    description: "A dialog is missing aria-modal.",
    detect(snapshot) {
      return (snapshot.overlays || [])
        .filter((overlay) => overlay.role === "dialog" || overlay.role === "alertdialog")
        .filter((overlay) => !overlay.ariaModal)
        .map((overlay) =>
          issue(null, {
            element: overlay.role,
            selector: overlay.selector,
            hints: { bbox: overlay.bbox, styles: null, auditIgnore: [], disabled: false, allowScroll: false },
            message: "Dialog is not marked modal",
            expected: 'aria-modal="true"',
            actual: "aria-modal missing",
          }),
        );
    },
  },
  {
    id: "overlays.dialog-offscreen",
    category: "overlays",
    kind: "deterministic",
    severity: "major",
    description: "An open overlay is fully outside the viewport.",
    detect(snapshot) {
      return (snapshot.overlays || [])
        .filter((overlay) => overlay.offscreen)
        .map((overlay) =>
          issue(null, {
            element: overlay.role || "overlay",
            selector: overlay.selector,
            hints: { bbox: overlay.bbox, styles: null, auditIgnore: [], disabled: false, allowScroll: false },
            message: "Overlay is outside the viewport",
            expected: "dialog or drawer intersects the viewport",
            actual: "offscreen",
          }),
        );
    },
  },
  {
    id: "overlays.stacked",
    category: "overlays",
    kind: "heuristic",
    severity: "minor",
    description: "More than one dialog or drawer is open.",
    detect(snapshot) {
      const overlays = snapshot.overlays || [];
      if (overlays.length < 2) return [];
      return [
        issue(null, {
          element: "overlays",
          selector: overlays[0].selector,
          message: "Multiple overlays are open at once",
          expected: "one dialog or drawer",
          actual: `${overlays.length} overlays`,
          confidence: 0.5,
        }),
      ];
    },
  },
  {
    id: "overlays.missing-close",
    category: "overlays",
    kind: "heuristic",
    severity: "minor",
    description: "An overlay has no labelled close control.",
    detect(snapshot) {
      return (snapshot.overlays || [])
        .filter((overlay) => !overlay.hasClose)
        .slice(0, 4)
        .map((overlay) =>
          issue(null, {
            element: overlay.role || "overlay",
            selector: overlay.selector,
            hints: { bbox: overlay.bbox, styles: null, auditIgnore: [], disabled: false, allowScroll: false },
            message: "Overlay has no close control with an accessible name",
            expected: "a close button named Close or Dismiss, or data-audit-close",
            actual: "no close control found",
            confidence: 0.4,
          }),
        );
    },
  },
];
