const { elementsOf, intersectionArea, isNeutral, issue, luminance, sameRow } = require("./support");

function colorKey(color) {
  if (!color) return "";
  return `${Math.round(color.r / 16)}-${Math.round(color.g / 16)}-${Math.round(color.b / 16)}`;
}

function isGradient(value) {
  return /gradient\(/i.test(String(value || ""));
}

const docRules = [
  {
    id: "color.gradient-button",
    category: "color",
    kind: "heuristic",
    severity: "minor",
    description: "A button uses a gradient instead of a solid fill.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => el.controlKind === "button" && isGradient(el.styles && el.styles.backgroundImage))
        .slice(0, 6)
        .map((el) =>
          issue(el, {
            message: "Button fill is a gradient",
            expected: "a solid background, matching primary actions on other pages",
            actual: String(el.styles.backgroundImage).slice(0, 120),
          }),
        );
    },
  },
  {
    id: "color.inconsistent-field-fill",
    category: "color",
    kind: "heuristic",
    severity: "minor",
    description: "Sibling fields mix filled and unfilled backgrounds.",
    detect(snapshot) {
      const groups = new Map();
      for (const el of elementsOf(snapshot)) {
        if (el.controlKind !== "input" && el.controlKind !== "dropdown") continue;
        if (!el.parentSelector || !el.background) continue;
        if (!groups.has(el.parentSelector)) groups.set(el.parentSelector, []);
        groups.get(el.parentSelector).push(el);
      }
      const findings = [];
      for (const fields of groups.values()) {
        if (fields.length < 2) continue;
        const filled = fields.filter((el) => !el.sameBackgroundAsParent && el.background.a > 0.8);
        const plain = fields.filter((el) => el.sameBackgroundAsParent || el.background.a < 0.2);
        if (!filled.length || !plain.length) continue;
        findings.push(
          issue(filled[0], {
            message: "Fields in the same group use different background fills",
            expected: "one fill treatment for sibling inputs",
            actual: `${filled.length} filled and ${plain.length} unfilled`,
          }),
        );
        if (findings.length >= 4) break;
      }
      return findings;
    },
  },
  {
    id: "color.card-palette-split",
    category: "color",
    kind: "heuristic",
    severity: "minor",
    description: "Cards in one row use unrelated background colors.",
    detect(snapshot) {
      const cards = elementsOf(snapshot).filter(
        (el) => (el.tag === "article" || el.role === "region") && el.background && el.background.a > 0.85 && el.bbox,
      );
      const used = new Set();
      const findings = [];
      for (const card of cards) {
        if (used.has(card.selector)) continue;
        const row = cards.filter((other) => other.selector === card.selector || sameRow(card, other));
        row.forEach((item) => used.add(item.selector));
        const keys = new Set(row.map((item) => colorKey(item.background)));
        if (row.length < 2 || keys.size < 2) continue;
        findings.push(
          issue(card, {
            message: "Cards in the same row use different background colors",
            expected: "one card background within a row",
            actual: `${keys.size} backgrounds across ${row.length} cards`,
          }),
        );
        if (findings.length >= 3) break;
      }
      return findings;
    },
  },
  {
    id: "theme.icon-on-wrong-theme",
    category: "theme",
    kind: "deterministic",
    severity: "major",
    description: "An icon is near-black on a dark surface or near-white on a light surface.",
    detect(snapshot, ctx = {}) {
      const theme = ctx.options?.theme;
      if (theme !== "dark" && theme !== "light") return [];
      const findings = [];
      for (const icon of snapshot.icons || []) {
        if (!icon.foreground || !icon.background) continue;
        const ink = luminance(icon.foreground);
        const surface = luminance(icon.background);
        const wrong =
          (theme === "dark" && ink < 0.15 && surface < 0.35) ||
          (theme === "light" && ink > 0.85 && surface > 0.7);
        if (!wrong) continue;
        findings.push(
          issue(null, {
            element: icon.name ? `icon "${icon.name}"` : "icon",
            selector: icon.selector,
            hints: { bbox: icon.bbox, styles: { color: icon.foreground }, auditIgnore: [], disabled: false, allowScroll: false },
            message: "Icon color does not match the active theme",
            expected: theme === "dark" ? "a light icon on a dark surface" : "a dark icon on a light surface",
            actual: `icon luminance ${ink.toFixed(2)} on surface ${surface.toFixed(2)}`,
          }),
        );
        if (findings.length >= 6) break;
      }
      return findings;
    },
  },
  {
    id: "controls.missing-placeholder",
    category: "controls",
    kind: "heuristic",
    severity: "minor",
    description: "A text field has neither a placeholder nor a visible label.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => el.controlKind === "input")
        .filter((el) => el.inputType !== "hidden" && el.inputType !== "checkbox" && el.inputType !== "radio")
        .filter((el) => !String(el.placeholder || "").trim() && !el.labelled)
        .slice(0, 8)
        .map((el) =>
          issue(el, {
            message: "Text field has no placeholder and no visible label",
            expected: "a label or a placeholder that names the field",
            actual: "placeholder and label missing",
          }),
        );
    },
  },
  {
    id: "overlays.off-center-modal",
    category: "overlays",
    kind: "heuristic",
    severity: "minor",
    description: "A dialog is stuck to the top or bottom, or a full-height drawer is not on the right.",
    detect(snapshot) {
      const viewport = snapshot.viewport || { width: 1280, height: 720 };
      const findings = [];
      for (const overlay of snapshot.overlays || []) {
        const box = overlay.bbox;
        if (!box || overlay.offscreen) continue;
        const fullHeight = box.height > viewport.height * 0.8;
        if (fullHeight && box.width < viewport.width * 0.55 && box.x < viewport.width * 0.4) {
          findings.push(
            issue(null, {
              element: overlay.role || "drawer",
              selector: overlay.selector,
              hints: { bbox: box, styles: null, auditIgnore: [], disabled: false, allowScroll: false },
              message: "Full-height drawer opens from the left",
              expected: "a right-side drawer or a centered dialog",
              actual: `x ${Math.round(box.x)} width ${Math.round(box.width)}`,
            }),
          );
          continue;
        }
        if (overlay.role !== "dialog" && overlay.role !== "alertdialog") continue;
        if (fullHeight) continue;
        const stuckTop = box.y < 24;
        const stuckBottom = box.y + box.height > viewport.height - 24 && box.y > viewport.height * 0.45;
        if (!stuckTop && !stuckBottom) continue;
        findings.push(
          issue(null, {
            element: overlay.role,
            selector: overlay.selector,
            hints: { bbox: box, styles: null, auditIgnore: [], disabled: false, allowScroll: false },
            message: stuckTop ? "Dialog is stuck to the top of the viewport" : "Dialog is stuck to the bottom of the viewport",
            expected: "a dialog centered in the viewport",
            actual: `y ${Math.round(box.y)} height ${Math.round(box.height)}`,
          }),
        );
      }
      return findings.slice(0, 4);
    },
  },
  {
    id: "overlays.missing-dismiss",
    category: "overlays",
    kind: "heuristic",
    severity: "minor",
    description: "A dialog or drawer has no close control.",
    detect(snapshot) {
      return (snapshot.overlays || [])
        .filter((overlay) => overlay.hasClose === false)
        .slice(0, 4)
        .map((overlay) =>
          issue(null, {
            element: overlay.role || "overlay",
            selector: overlay.selector,
            hints: { bbox: overlay.bbox, styles: null, auditIgnore: [], disabled: false, allowScroll: false },
            message: "Dialog or drawer has no dismiss control",
            expected: "a close button or data-audit-close",
            actual: "no dismiss control",
          }),
        );
    },
  },
  {
    id: "scroll.dual-scrollbar",
    category: "scroll",
    kind: "heuristic",
    severity: "minor",
    description: "The page shows two vertical scrollbars.",
    detect(snapshot) {
      const doc = snapshot.document || {};
      const inner = doc.verticalScrollerCount || 0;
      const pageScrolls = (doc.scrollHeight || 0) > (doc.innerHeight || 0) + 40;
      if (inner < 2 && !(pageScrolls && inner >= 1)) return [];
      return [
        issue(null, {
          element: "document",
          selector: "html",
          message: "More than one vertical scrollbar is active",
          expected: "a single vertical scroll container, unless marked data-audit-allow-scroll",
          actual: `${inner} inner scroller(s), page scroll ${pageScrolls ? "yes" : "no"}`,
        }),
      ];
    },
  },
  {
    id: "layout.sticky-covers-content",
    category: "layout",
    kind: "heuristic",
    severity: "minor",
    description: "A sticky or fixed bar overlaps the first content row.",
    detect(snapshot) {
      const bars = elementsOf(snapshot).filter((el) => {
        const position = el.styles && el.styles.position;
        return (position === "sticky" || position === "fixed") && el.bbox && el.bbox.height > 0 && el.bbox.height < 160;
      });
      const findings = [];
      for (const bar of bars) {
        const covered = elementsOf(snapshot).find((el) => {
          if (el.selector === bar.selector || !el.text || !el.bbox) return false;
          if ((el.ancestors || []).includes(bar.selector)) return false;
          const area = intersectionArea(bar.bbox, el.bbox);
          return area > Math.min(bar.bbox.width * bar.bbox.height, el.bbox.width * el.bbox.height) * 0.35;
        });
        if (!covered) continue;
        findings.push(
          issue(covered, {
            message: "Sticky or fixed bar covers content",
            expected: "content starts below the sticky bar",
            actual: `${covered.selector} intersects ${bar.selector}`,
          }),
        );
        if (findings.length >= 3) break;
      }
      return findings;
    },
  },
  {
    id: "layout.uneven-cards",
    category: "layout",
    kind: "heuristic",
    severity: "minor",
    description: "Cards in one row differ in height by more than 8px.",
    detect(snapshot) {
      const cards = elementsOf(snapshot).filter(
        (el) => (el.tag === "article" || el.role === "region") && el.bbox && el.bbox.height > 24,
      );
      const used = new Set();
      const findings = [];
      for (const card of cards) {
        if (used.has(card.selector)) continue;
        const row = cards.filter((other) => sameRow(card, other));
        row.forEach((item) => used.add(item.selector));
        if (row.length < 2) continue;
        const heights = row.map((item) => item.bbox.height);
        const spread = Math.max(...heights) - Math.min(...heights);
        if (spread <= 8) continue;
        findings.push(
          issue(card, {
            message: "Cards in the same row have uneven heights",
            expected: "card heights within 8px",
            actual: `spread ${Math.round(spread)}px`,
          }),
        );
        if (findings.length >= 3) break;
      }
      return findings;
    },
  },
  {
    id: "tabs.inconsistent-style",
    category: "tabs",
    kind: "heuristic",
    severity: "minor",
    description: "One page mixes underline tabs and filled tabs.",
    detect(snapshot) {
      const tabs = elementsOf(snapshot).filter((el) => el.controlKind === "tab" && el.styles);
      if (tabs.length < 2) return [];
      const underline = tabs.some((el) => parseFloat(el.styles.borderBottomWidth) >= 2);
      const filled = tabs.some((el) => el.background && !isNeutral(el.background) && el.background.a > 0.85);
      if (!underline || !filled) return [];
      return [
        issue(tabs[0], {
          message: "Tab treatments are mixed on one page",
          expected: "one tab style, underline or filled",
          actual: "both an underline and a filled tab",
        }),
      ];
    },
  },
  {
    id: "tabs.active-unclear",
    category: "tabs",
    kind: "heuristic",
    severity: "minor",
    description: "The selected tab has no underline or background difference from its siblings.",
    detect(snapshot) {
      const tabs = elementsOf(snapshot).filter((el) => el.controlKind === "tab");
      const selected = tabs.filter((el) => el.selected);
      const findings = [];
      for (const tab of selected) {
        const siblings = tabs.filter((el) => el.parentSelector === tab.parentSelector && el.selector !== tab.selector);
        if (!siblings.length) continue;
        const underline = tab.styles && parseFloat(tab.styles.borderBottomWidth) >= 2;
        const fillDiffers = siblings.some((el) => colorKey(el.background) !== colorKey(tab.background));
        if (underline || fillDiffers) continue;
        findings.push(
          issue(tab, {
            message: "Selected tab is not visually distinct",
            expected: "an underline or a different background on the active tab",
            actual: "same fill and no underline as sibling tabs",
          }),
        );
      }
      return findings.slice(0, 3);
    },
  },
  {
    id: "empty.blank-region",
    category: "empty",
    kind: "heuristic",
    severity: "minor",
    description: "A titled region or table has no rows and no empty-state text.",
    detect(snapshot) {
      return (snapshot.tables || [])
        .filter((table) => table.rowCount === 0 && !table.hasEmptyMarker)
        .filter((table) => !/no data|nothing|empty/i.test(table.text || ""))
        .slice(0, 4)
        .map((table) =>
          issue(null, {
            element: "region",
            selector: table.selector,
            message: "Region has no rows and no empty-state message",
            expected: 'visible text such as "no data" when a table or list is empty',
            actual: "blank region",
          }),
        );
    },
  },
];

function compareThemes(lightSnapshot, darkSnapshot) {
  const darkBySelector = new Map();
  for (const el of elementsOf(darkSnapshot)) {
    if (el.selector) darkBySelector.set(el.selector, el);
  }
  const findings = [];
  const seen = new Set();
  for (const light of elementsOf(lightSnapshot)) {
    const dark = darkBySelector.get(light.selector);
    if (!dark || !light.styles || !dark.styles || seen.has(light.selector)) continue;
    const lightSize = parseFloat(light.styles.fontSize);
    const darkSize = parseFloat(dark.styles.fontSize);
    if (Number.isFinite(lightSize) && Number.isFinite(darkSize) && Math.abs(lightSize - darkSize) > 2) {
      seen.add(light.selector);
      findings.push(
        issue(light, {
          ruleId: "theme.cross-mode-drift",
          category: "theme",
          kind: "heuristic",
          severity: "minor",
          message: "Font size changes between light and dark mode",
          expected: "the same font size in both themes",
          actual: `light ${lightSize}px, dark ${darkSize}px`,
        }),
      );
    }
    if (findings.length >= 8) break;
  }
  const lightWidth = (lightSnapshot.viewport && lightSnapshot.viewport.width) || 0;
  const darkWidth = (darkSnapshot.viewport && darkSnapshot.viewport.width) || 0;
  const lightGutter = (lightSnapshot.document && lightSnapshot.document.innerWidth) || lightWidth;
  const darkGutter = (darkSnapshot.document && darkSnapshot.document.innerWidth) || darkWidth;
  if (lightGutter && darkGutter && Math.abs(lightGutter - darkGutter) > 8) {
    findings.push(
      issue(null, {
        ruleId: "theme.cross-mode-drift",
        category: "theme",
        kind: "heuristic",
        severity: "minor",
        element: "document",
        selector: "html",
        message: "Scrollbar gutter changes header alignment between themes",
        expected: "the same content width in light and dark mode",
        actual: `light ${lightGutter}px, dark ${darkGutter}px`,
      }),
    );
  }
  return findings;
}

const crossMode = {
  id: "theme.cross-mode-drift",
  category: "theme",
  kind: "heuristic",
  severity: "minor",
  description: "Font size or scrollbar gutter differs between light and dark snapshots.",
  detect(snapshot, ctx = {}) {
    const peer = ctx.options && ctx.options.peerSnapshot;
    const theme = ctx.options && ctx.options.theme;
    if (!peer) return [];
    if (theme === "dark") return compareThemes(peer, snapshot);
    return compareThemes(snapshot, peer);
  },
};

module.exports = [...docRules, crossMode];
module.exports.compareThemes = compareThemes;
