const { elementsOf, issue } = require("./support");

const SKIPPED_INPUTS = new Set(["hidden", "submit", "button", "reset", "image", "checkbox", "radio", "range", "color", "file"]);

module.exports = [
  {
    id: "controls.undersized-target",
    category: "controls",
    kind: "deterministic",
    severity: "major",
    description: "An interactive target is smaller than 24px on either edge.",
    detect(snapshot, ctx = {}) {
      const min = ctx.options?.exceptions?.minTargetPx ?? 24;
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.interactive || el.disabled || !el.bbox || !el.inViewport) continue;
        if (el.bbox.width >= min && el.bbox.height >= min) continue;
        findings.push(
          issue(el, {
            message: "Interactive target is smaller than the minimum",
            expected: `at least ${min}×${min}px`,
            actual: `${Math.round(el.bbox.width)}×${Math.round(el.bbox.height)}px`,
          }),
        );
        if (findings.length >= 12) break;
      }
      return findings;
    },
  },
  {
    id: "controls.missing-name",
    category: "controls",
    kind: "deterministic",
    severity: "major",
    description: "A button or link has no accessible name.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => (el.controlKind === "button" || el.controlKind === "link") && !String(el.name || "").trim())
        .slice(0, 12)
        .map((el) =>
          issue(el, {
            message: "Control has no accessible name",
            expected: "visible text, aria-label, or aria-labelledby",
            actual: "empty name",
          }),
        );
    },
  },
  {
    id: "controls.missing-affordance",
    category: "controls",
    kind: "deterministic",
    severity: "major",
    description: "A text field has no border, outline, or background distinct from its parent.",
    detect(snapshot) {
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (el.controlKind !== "input" && el.controlKind !== "dropdown") continue;
        if (SKIPPED_INPUTS.has(el.inputType)) continue;
        if (!el.borderless || !el.sameBackgroundAsParent) continue;
        findings.push(
          issue(el, {
            message: "Field has no visible boundary",
            expected: "border, outline, or a background different from the parent",
            actual: "no border and the same background as the parent",
          }),
        );
      }
      return findings.slice(0, 10);
    },
  },
  {
    id: "controls.inconsistent-height",
    category: "controls",
    kind: "heuristic",
    severity: "minor",
    description: "Buttons in the same group have different heights.",
    detect(snapshot) {
      const groups = new Map();
      for (const el of elementsOf(snapshot)) {
        if (el.controlKind !== "button" || !el.bbox || el.disabled) continue;
        const grouped =
          el.parentRole === "toolbar" ||
          el.parentRole === "navigation" ||
          String(el.parentSelector).includes("data-audit-id");
        if (!grouped) continue;
        if (!groups.has(el.parentSelector)) groups.set(el.parentSelector, []);
        groups.get(el.parentSelector).push(el);
      }
      const findings = [];
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        const heights = group.map((el) => el.bbox.height);
        const spread = Math.max(...heights) - Math.min(...heights);
        if (spread <= 8) continue;
        findings.push(
          issue(group[0], {
            message: "Buttons in the same group have inconsistent heights",
            expected: "heights within 8px",
            actual: `${Math.round(Math.min(...heights))}–${Math.round(Math.max(...heights))}px`,
            confidence: 0.55,
          }),
        );
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "controls.tab-without-tablist",
    category: "controls",
    kind: "deterministic",
    severity: "major",
    description: "Tabs are present without a tablist.",
    detect(snapshot) {
      const tabs = elementsOf(snapshot).filter((el) => el.role === "tab");
      const lists = elementsOf(snapshot).filter((el) => el.role === "tablist");
      if (!tabs.length || lists.length) return [];
      return [
        issue(tabs[0], {
          message: "Tab is not inside a tablist",
          expected: "role=tab elements owned by role=tablist",
          actual: `${tabs.length} tab(s) and no tablist`,
        }),
      ];
    },
  },
  {
    id: "controls.combobox-unnamed",
    category: "controls",
    kind: "deterministic",
    severity: "major",
    description: "A combobox or listbox has no accessible name.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => (el.role === "combobox" || el.role === "listbox") && !el.labelled && el.tag !== "select")
        .slice(0, 8)
        .map((el) =>
          issue(el, {
            message: "Dropdown has no accessible name",
            expected: "aria-label or aria-labelledby on the combobox",
            actual: "unnamed combobox",
          }),
        );
    },
  },
];
