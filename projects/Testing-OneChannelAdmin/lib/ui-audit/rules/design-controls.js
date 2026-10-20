const { issue, px } = require("./support");
const { expectedFor, getReference } = require("../references");

function isTextAction(button) {
  if (!button || button.iconOnly) return false;
  const name = String(button.name || "").trim();
  if (!/[a-z]{2,}/i.test(name)) return false;
  if (/^(more|options|menu|actions|overflow|\.{2,}|…|⋮)$/i.test(name)) return false;
  if (/^(today|yesterday|last 7 days|last 30 days|this week|this month|this year|custom|all time)$/i.test(name)) {
    return false;
  }
  const box = button.bbox;
  if (box && box.height > 0 && box.width / box.height < 1.45) return false;
  return true;
}

function topRightButton(buttons) {
  const list = (buttons || []).filter((button) => button && button.bbox && isTextAction(button));
  if (!list.length) return null;
  const minY = Math.min(...list.map((button) => button.bbox.y));
  const row = list.filter((button) => button.bbox.y <= minY + 16);
  row.sort((a, b) => b.bbox.x + b.bbox.width - (a.bbox.x + a.bbox.width));
  return row[0];
}

function colorDrift(actual, tokens) {
  if (!actual) return null;
  const target = { r: tokens.colorR, g: tokens.colorG, b: tokens.colorB };
  if (![target.r, target.g, target.b].every((channel) => Number.isFinite(channel))) return null;
  return Math.max(
    Math.abs(actual.r - target.r),
    Math.abs(actual.g - target.g),
    Math.abs(actual.b - target.b),
  );
}

module.exports = [
  {
    id: "design.primary-button",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description:
      "Only the top-rightmost header button is the primary action. It must use the Export purple rgb(131, 120, 255) and be ~40px tall.",
    detect(snapshot) {
      const btn = topRightButton(snapshot.primaryButtons || []);
      if (!btn) return [];
      const ref = getReference("primary-button");
      const tokens = ref?.tokens || {
        height: 40,
        heightTol: 4,
        radiusMin: 4,
        radiusMax: 14,
        colorR: 131,
        colorG: 120,
        colorB: 255,
        colorTol: 28,
      };
      const problems = [];
      const h = btn.bbox.height;
      if (Math.abs(h - tokens.height) > tokens.heightTol) {
        problems.push(`height ${Math.round(h)}px`);
      }
      const radius = px(btn.borderRadius);
      if (radius < tokens.radiusMin || radius > tokens.radiusMax) {
        problems.push(`radius ${radius}px`);
      }
      const drift = colorDrift(btn.background, tokens);
      if (drift == null) {
        problems.push("fill color could not be read");
      } else if (drift > (tokens.colorTol ?? 28)) {
        const bg = btn.background;
        problems.push(`fill rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`);
      }
      if (!problems.length) return [];
      return [
        issue(null, {
          element: `button "${btn.name || ""}"`,
          selector: btn.selector,
          message: "Top-right primary button does not match the Export button",
          expected: expectedFor("design.primary-button"),
          actual: problems.join("; "),
          referenceId: ref?.componentId,
        }),
      ];
    },
  },
  {
    id: "design.dropdown",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Form dropdowns should be ~40px tall with readable type (ref Currency).",
    detect(snapshot) {
      const ref = getReference("form-dropdown");
      const tokens = ref?.tokens || {
        height: 40,
        heightTol: 8,
        fontMin: 12,
        fontMax: 16,
        paddingXMin: 12,
      };
      const findings = [];
      for (const drop of snapshot.dropdowns || []) {
        const problems = [];
        const h = drop.bbox.height;
        if (Math.abs(h - tokens.height) > tokens.heightTol) {
          problems.push(`height ${Math.round(h)}px`);
        }
        const font = px(drop.fontSize);
        if (font && (font < tokens.fontMin || font > tokens.fontMax)) {
          problems.push(`font ${font}px`);
        }
        if ((drop.paddingX || 0) < tokens.paddingXMin) {
          problems.push(`padding-x ${Math.round(drop.paddingX || 0)}px`);
        }
        if (problems.length) {
          findings.push(
            issue(null, {
              element: `dropdown "${drop.name || ""}"`,
              selector: drop.selector,
              message: "Dropdown does not match control standards",
              expected: expectedFor("design.dropdown"),
              actual: problems.join("; "),
              referenceId: ref?.componentId,
            }),
          );
        }
      }
      return findings.slice(0, 12);
    },
  },
  {
    id: "design.tab-underline",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description:
      "Active underline-style tabs should show a clear bottom underline (Settings pattern). Pill tabs are handled by design.pill-tabs.",
    detect(snapshot) {
      const ref = getReference("underline-tabs");
      const tabs = (snapshot.tabs || []).filter(
        (tab) => tab.selected && tab.variant !== "pill",
      );
      const findings = [];
      for (const tab of tabs) {
        const underlined =
          (tab.borderBottomWidth || 0) >= 2 || /underline/i.test(tab.textDecoration || "");
        if (!underlined) {
          findings.push(
            issue(null, {
              element: `tab "${tab.name || ""}"`,
              selector: tab.selector,
              message: "Active underline tab is missing a clear underline",
              expected: expectedFor("design.tab-underline"),
              actual: `border-bottom ${tab.borderBottomWidth || 0}px; variant=${tab.variant || "plain"}`,
              referenceId: ref?.componentId,
            }),
          );
        }
      }
      return findings.slice(0, 8);
    },
  },
];
