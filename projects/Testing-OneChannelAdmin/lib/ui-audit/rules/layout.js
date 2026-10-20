const { elementsOf, intersectionArea, issue, related, sameRow } = require("./support");

module.exports = [
  {
    id: "layout.element-overlap",
    category: "layout",
    kind: "deterministic",
    severity: "major",
    description: "Interactive controls overlap enough to steal clicks or hide labels.",
    detect(snapshot, ctx = {}) {
      const ratio = ctx.options?.exceptions?.overlapRatio || 0.4;
      const items = elementsOf(snapshot).filter(
        (el) =>
          el.interactive &&
          el.inViewport &&
          !el.disabled &&
          el.styles &&
          el.styles.pointerEvents !== "none" &&
          el.bbox &&
          el.bbox.width >= 8 &&
          el.bbox.height >= 8,
      );
      const findings = [];
      for (let i = 0; i < items.length; i += 1) {
        for (let j = i + 1; j < items.length; j += 1) {
          if (related(items[i], items[j])) continue;
          const area = intersectionArea(items[i].bbox, items[j].bbox);
          const minArea = Math.min(
            items[i].bbox.width * items[i].bbox.height,
            items[j].bbox.width * items[j].bbox.height,
          );
          if (minArea > 0 && area / minArea >= ratio) {
            findings.push(
              issue(items[i], {
                message: `Overlaps ${items[j].selector || "another control"}`,
                expected: "interactive controls do not cover each other",
                actual: `${Math.round((area / minArea) * 100)}% of the smaller box overlaps`,
              }),
            );
          }
          if (findings.length >= 12) return findings;
        }
      }
      return findings;
    },
  },
  {
    id: "layout.clipped-content",
    category: "layout",
    kind: "deterministic",
    severity: "major",
    description: "Content is cut off by a hidden overflow without an ellipsis or scroll.",
    detect(snapshot, ctx = {}) {
      const tol = ctx.options?.overflowTolerancePx ?? 2;
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.client || !el.text || el.text.length < 12) continue;
        if (el.tag === "html" || el.tag === "body") continue;
        const hidden = el.styles && (el.styles.overflowX === "hidden" || el.styles.overflowX === "clip");
        const ellipsis = el.styles && el.styles.textOverflow === "ellipsis";
        if (!hidden || ellipsis) continue;
        if (el.client.scrollWidth <= el.client.width + tol) continue;
        findings.push(
          issue(el, {
            message: "Content is clipped without a scroll container or ellipsis",
            expected: "overflow visible, scrollable, or ellipsized",
            actual: `scrollWidth ${el.client.scrollWidth}px in ${el.client.width}px`,
          }),
        );
        if (findings.length >= 12) break;
      }
      return findings;
    },
  },
  {
    id: "layout.overflows-container",
    category: "layout",
    kind: "deterministic",
    severity: "major",
    description: "Chips, options, or tabs paint outside their parent.",
    detect(snapshot) {
      const findings = [];
      for (const el of elementsOf(snapshot)) {
        if (el.controlKind !== "chip" && el.role !== "tab") continue;
        if (!el.bbox || !el.parentBBox || el.allowScroll) continue;
        const overflows =
          el.bbox.x < el.parentBBox.x - 1 ||
          el.bbox.x + el.bbox.width > el.parentBBox.x + el.parentBBox.width + 1;
        if (!overflows) continue;
        findings.push(
          issue(el, {
            message: "Control extends outside its parent",
            expected: "chips, options, and tabs stay inside the parent box",
            actual: `width ${Math.round(el.bbox.width)}px in parent ${Math.round(el.parentBBox.width)}px`,
          }),
        );
      }
      return findings.slice(0, 12);
    },
  },
  {
    id: "layout.offscreen-fixed",
    category: "layout",
    kind: "deterministic",
    severity: "major",
    description: "A fixed interactive control sits fully outside the viewport.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter(
          (el) =>
            el.interactive &&
            el.styles &&
            el.styles.position === "fixed" &&
            el.inViewport === false,
        )
        .slice(0, 8)
        .map((el) =>
          issue(el, {
            message: "Fixed control is outside the viewport",
            expected: "fixed controls remain on screen",
            actual: `box at ${Math.round(el.bbox.x)},${Math.round(el.bbox.y)}`,
          }),
        );
    },
  },
  {
    id: "layout.misaligned-controls",
    category: "layout",
    kind: "heuristic",
    severity: "minor",
    description: "Controls that share a row do not share a top edge.",
    detect(snapshot) {
      const groups = new Map();
      for (const el of elementsOf(snapshot)) {
        if (!el.interactive || !el.bbox || !el.parentSelector) continue;
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
        let worst = 0;
        let sample = null;
        for (let i = 0; i < group.length; i += 1) {
          for (let j = i + 1; j < group.length; j += 1) {
            if (!sameRow(group[i], group[j])) continue;
            const delta = Math.abs(group[i].bbox.y - group[j].bbox.y);
            if (delta > worst) {
              worst = delta;
              sample = group[j];
            }
          }
        }
        if (worst <= 8 || !sample) continue;
        findings.push(
          issue(sample, {
            message: "Controls on the same row are vertically misaligned",
            expected: "shared top edge within 8px",
            actual: `${Math.round(worst)}px top difference`,
            confidence: 0.5,
          }),
        );
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "layout.inconsistent-gap",
    category: "layout",
    kind: "heuristic",
    severity: "minor",
    description: "A toolbar or navigation row uses uneven gaps.",
    detect(snapshot) {
      const groups = new Map();
      for (const el of elementsOf(snapshot)) {
        if (el.controlKind !== "button" && el.controlKind !== "link") continue;
        if (!el.bbox) continue;
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
        const row = group.slice().sort((a, b) => a.bbox.x - b.bbox.x);
        if (row.length < 3) continue;
        const gaps = [];
        for (let i = 1; i < row.length; i += 1) {
          if (!sameRow(row[i - 1], row[i])) continue;
          gaps.push(row[i].bbox.x - (row[i - 1].bbox.x + row[i - 1].bbox.width));
        }
        if (gaps.length < 2) continue;
        const spread = Math.max(...gaps) - Math.min(...gaps);
        if (spread <= 16) continue;
        findings.push(
          issue(row[0], {
            message: "Gaps between controls in the same row vary",
            expected: "consistent spacing within 16px",
            actual: `gap spread ${Math.round(spread)}px`,
            confidence: 0.45,
          }),
        );
      }
      return findings.slice(0, 8);
    },
  },
];
