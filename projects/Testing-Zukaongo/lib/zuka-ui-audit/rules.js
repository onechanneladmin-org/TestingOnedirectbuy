/**
 * Theme + UX rules. Each rule: { id, category, severity, title, check(snapshot, ctx) → findings[] }.
 * Severity: critical (always fails) | major (fails with ZUKA_UI_AUDIT_STRICT=1) | minor | info.
 */
const { PALETTE, FILLED_CONTROL_BG, ICON_FONTS, SURFACES, BUDGETS, hexToRgb } = require("./theme");

const rgbOf = (css) => {
  const m = String(css).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(",").map((x) => parseFloat(x));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const dist = (a, b) => Math.sqrt((a.r - b[0]) ** 2 + (a.g - b[1]) ** 2 + (a.b - b[2]) ** 2);
const nearest = (c, hexes) => {
  let best = { hex: "", d: Infinity };
  for (const h of hexes) {
    const d = dist(c, hexToRgb(h));
    if (d < best.d) best = { hex: h, d };
  }
  return best;
};
const toHex = (c) => `#${[c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
const isSaturated = (c) => Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) > 40;
const group = (items, key) => {
  const map = new Map();
  for (const it of items) {
    const k = key(it);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(it);
  }
  return map;
};

const RULES = [
  {
    id: "theme.font-family",
    category: "theme",
    severity: "major",
    title: "Text uses the surface's brand typeface",
    check(s, ctx) {
      const allowed = SURFACES[ctx.surface].fonts;
      const out = [];
      for (const [family, count] of Object.entries(s.fonts)) {
        if (ICON_FONTS.test(family)) continue;
        if (allowed.some((re) => re.test(family))) continue;
        out.push({
          element: family,
          actual: `${count} text run(s) in "${family}"`,
          expected: `${SURFACES[ctx.surface].label} fonts: ${allowed.map(String).join(", ")}`,
          message: `Off-theme font "${family}"`,
        });
      }
      return out;
    },
  },
  {
    id: "theme.heading-font",
    category: "theme",
    severity: "minor",
    title: "Marketing headings use the display face (Bricolage Grotesque)",
    check(s, ctx) {
      const re = SURFACES[ctx.surface].headingFont;
      if (!re) return [];
      return s.headings
        .filter((h) => h.level <= 2 && h.text && !re.test(h.family) && !ICON_FONTS.test(h.family))
        .slice(0, 5)
        .map((h) => ({ element: h.text, actual: h.family, expected: "Bricolage Grotesque", message: "Heading not in display font" }));
    },
  },
  {
    id: "theme.control-color",
    category: "theme",
    severity: "major",
    title: "Filled buttons/tabs use brand colours",
    check(s) {
      const off = s.controls.filter((c) => {
        const bg = rgbOf(c.bg);
        if (!bg || bg.a < 0.9 || !isSaturated(bg)) return false;
        return nearest(bg, FILLED_CONTROL_BG).d > BUDGETS.colorTolerance * 2;
      });
      return [...group(off, (c) => toHex(rgbOf(c.bg))).entries()].map(([hex, list]) => ({
        element: list[0].name || list[0].selector,
        selector: list[0].selector,
        actual: `${hex} on ${list.length} control(s)`,
        expected: `brand action ${PALETTE.action} / ${PALETTE.actionHover} / ${PALETTE.sun}, ink ${PALETTE.ink} or neutral`,
        message: `Off-palette control colour ${hex}`,
      }));
    },
  },
  {
    id: "theme.primary-cta",
    category: "theme",
    severity: "minor",
    title: "Orange CTAs use exactly the action token",
    check(s) {
      const orange = s.controls.filter((c) => {
        const bg = rgbOf(c.bg);
        if (!bg || bg.a < 0.9) return false;
        return bg.r > 150 && bg.g < 140 && bg.b < 60; // orange-ish
      });
      const tokens = [PALETTE.action, PALETTE.actionHover, PALETTE.sun];
      return [...group(orange.filter((c) => nearest(rgbOf(c.bg), tokens).d > 6), (c) => toHex(rgbOf(c.bg))).entries()]
        .map(([hex, list]) => ({
          element: list[0].name,
          selector: list[0].selector,
          actual: hex,
          expected: `${PALETTE.action} (hover ${PALETTE.actionHover})`,
          message: `CTA orange ${hex} drifts from the action token`,
        }));
    },
  },
  {
    id: "theme.radius",
    category: "theme",
    severity: "info",
    title: "Control corner radii come from the radius scale",
    check(s, ctx) {
      const scale = SURFACES[ctx.surface].radii;
      const off = s.controls.filter((c) => c.radius && !scale.includes(c.radius) && !/%$/.test(c.radius));
      return [...group(off, (c) => c.radius).entries()].map(([r, list]) => ({
        element: list[0].name || list[0].selector,
        actual: `${r} on ${list.length} control(s)`,
        expected: scale.join(" / "),
        message: `Radius ${r} is outside the scale`,
      }));
    },
  },
  {
    id: "a11y.contrast",
    category: "accessibility",
    severity: "major",
    title: "Text contrast meets WCAG AA",
    check(s) {
      const bad = s.texts.filter((t) => !t.disabled && t.ratio < (t.large ? BUDGETS.contrastLarge : BUDGETS.contrastNormal));
      return [...group(bad, (t) => `${t.color}|${t.bg}`).entries()].slice(0, 15).map(([, list]) => ({
        element: list[0].text,
        selector: list[0].selector,
        actual: `${list[0].ratio}:1 (${list[0].color} on ${list[0].bg}, ${list[0].size}px) × ${list.length}`,
        expected: `≥ ${list[0].large ? BUDGETS.contrastLarge : BUDGETS.contrastNormal}:1`,
        message: `Low contrast text "${list[0].text}"`,
      }));
    },
  },
  {
    id: "a11y.control-name",
    category: "accessibility",
    severity: "major",
    title: "Buttons, links and inputs have an accessible name",
    check(s) {
      const unnamed = s.controls.filter((c) => !c.name && !c.nested && !["INPUT", "TEXTAREA", "SELECT"].includes(c.tag));
      return unnamed.slice(0, 15).map((c) => ({
        element: c.selector,
        selector: c.selector,
        actual: `${c.role || c.tag} with no text / aria-label (${c.width}×${c.height})`,
        expected: "aria-label or visible text",
        message: "Unlabelled control (icon-only button?)",
      }));
    },
  },
  {
    id: "a11y.touch-target",
    category: "accessibility",
    severity: "minor",
    title: "Touch targets are large enough",
    check(s, ctx) {
      const min = ctx.mobile ? BUDGETS.minTouchMobile : BUDGETS.minTouchDesktop;
      const small = s.controls.filter((c) => !c.nested && !["INPUT", "TEXTAREA", "SELECT"].includes(c.tag) && !c.disabled &&
        (c.width < min || c.height < min) && c.role !== "link");
      return small.slice(0, 15).map((c) => ({
        element: c.name || c.selector,
        selector: c.selector,
        actual: `${c.width}×${c.height}px`,
        expected: `≥ ${min}×${min}px`,
        message: `Small ${ctx.mobile ? "mobile " : ""}target "${c.name || c.role}"`,
      }));
    },
  },
  {
    id: "a11y.img-alt",
    category: "accessibility",
    severity: "minor",
    title: "Images have alt text",
    check(s) {
      return s.images.filter((i) => i.alt === null && !i.decorative).slice(0, 10).map((i) => ({
        element: i.src, selector: i.selector, actual: "no alt attribute", expected: 'alt="…" or alt="" if decorative', message: "Image without alt",
      }));
    },
  },
  {
    id: "a11y.document",
    category: "accessibility",
    severity: "minor",
    title: "Page has a title and a lang attribute",
    check(s) {
      const out = [];
      if (!s.lang) out.push({ element: "<html>", actual: "no lang", expected: 'lang="en"', message: "Missing html lang" });
      if (!s.title || /^(Zuka|Login|Home|Signup|ForgotPassword)$/i.test(s.title.trim())) {
        out.push({ element: "<title>", actual: s.title || "(empty)", expected: "Descriptive page title, e.g. 'Cart | ZUKAongo'", message: "Generic page title" });
      }
      return out;
    },
  },
  {
    id: "a11y.heading-structure",
    category: "accessibility",
    severity: "minor",
    title: "One h1 per screen; sub-sections use h2/h3",
    check(s) {
      const h1 = s.headings.filter((h) => h.level === 1);
      if (h1.length === 0) return [{ element: "page", actual: "no level-1 heading", expected: "exactly one h1", message: "Missing h1" }];
      if (h1.length > 2) {
        return [{
          element: h1.slice(0, 4).map((h) => h.text).join(" | "),
          actual: `${h1.length} level-1 headings`,
          expected: "one h1, section titles as h2/h3",
          message: "Every heading is level 1 (flat outline for screen readers)",
        }];
      }
      return [];
    },
  },
  {
    id: "layout.horizontal-overflow",
    category: "layout",
    severity: "major",
    title: "No horizontal scrolling",
    check(s) {
      if (s.scrollWidth > s.viewport.width + 2) {
        return [{
          element: "document",
          actual: `content ${s.scrollWidth}px wide in a ${s.viewport.width}px viewport`,
          expected: "no horizontal overflow",
          message: "Page scrolls sideways",
        }];
      }
      return [];
    },
  },
  {
    id: "ux.broken-image",
    category: "ux",
    severity: "major",
    title: "Images load",
    check(s) {
      return s.images.filter((i) => i.broken).slice(0, 10).map((i) => ({
        element: i.src, selector: i.selector, actual: "naturalWidth 0", expected: "image loads", message: "Broken image",
      }));
    },
  },
  {
    id: "ux.runtime-errors",
    category: "ux",
    severity: "critical",
    title: "No uncaught JavaScript errors",
    check(s, ctx) {
      return (ctx.pageErrors || []).slice(0, 5).map((e) => ({ element: "window", actual: e, expected: "no uncaught errors", message: "Uncaught page error" }));
    },
  },
  {
    id: "ux.console-errors",
    category: "ux",
    severity: "minor",
    title: "No console errors",
    check(s, ctx) {
      return [...new Set(ctx.consoleErrors || [])].slice(0, 8).map((e) => ({ element: "console", actual: e, expected: "clean console", message: "Console error" }));
    },
  },
  {
    id: "ux.http-errors",
    category: "ux",
    severity: "major",
    title: "API calls succeed",
    check(s, ctx) {
      return (ctx.httpErrors || []).slice(0, 10).map((e) => ({
        element: e.url,
        actual: `${e.status} ${e.method}`,
        expected: "2xx/3xx",
        message: `HTTP ${e.status} from ${new URL(e.url).pathname}`,
        severity: e.status >= 500 ? "critical" : "major",
      }));
    },
  },
  {
    id: "perf.settle-time",
    category: "performance",
    severity: "major",
    title: "Screen is usable quickly",
    check(s, ctx) {
      if (!ctx.settleMs || ctx.settleMs <= BUDGETS.settleMs) return [];
      return [{
        element: "page",
        actual: `${Math.round(ctx.settleMs)} ms to settle`,
        expected: `≤ ${BUDGETS.settleMs} ms`,
        message: "Slow screen",
        severity: ctx.settleMs > BUDGETS.settleMsCritical ? "critical" : "major",
      }];
    },
  },
];

function runRules(snapshot, ctx) {
  const findings = [];
  for (const rule of RULES) {
    let list = [];
    try {
      list = rule.check(snapshot, ctx) || [];
    } catch (err) {
      list = [{ element: rule.id, actual: String(err.message), expected: "rule runs", message: "Rule crashed", severity: "info" }];
    }
    for (const f of list) {
      findings.push({ ruleId: rule.id, category: rule.category, title: rule.title, severity: f.severity || rule.severity, ...f });
    }
  }
  return findings;
}

module.exports = { RULES, runRules };
