const { contrastRatio, isLargeText, issue, px } = require("./support");

/**
 * Spec rules that the existing design/a11y modules do not already cover.
 * Generic text contrast stays in a11y.contrast. Placeholder contrast stays in
 * forms.placeholder-contrast. Card size, underline tabs, and pill tabs stay
 * in the design-* modules.
 */

function noteGap(snapshot, item) {
  if (!snapshot) return;
  if (!snapshot.validationCoverage) snapshot.validationCoverage = { present: {}, unmeasured: [] };
  if (!snapshot.validationCoverage.unmeasured) snapshot.validationCoverage.unmeasured = [];
  if (snapshot.validationCoverage.unmeasured.length >= 24) return;
  snapshot.validationCoverage.unmeasured.push(item);
}

function themeOf(snapshot) {
  return snapshot.renderedTheme || snapshot.theme || "";
}

function isWhite(color) {
  return !!color && (color.a == null || color.a > 0.65) && color.r >= 220 && color.g >= 220 && color.b >= 220;
}

function isBlack(color) {
  return !!color && (color.a == null || color.a > 0.65) && color.r <= 40 && color.g <= 40 && color.b <= 40;
}

function colorKey(color) {
  if (!color) return "";
  return [color.r, color.g, color.b].map((channel) => Math.round(channel / 16) * 16).join(",");
}

function spread(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (nums.length < 2) return 0;
  return Math.max(...nums) - Math.min(...nums);
}

function sameBand(a, b, tol = 14) {
  return Math.abs(a.bbox.y - b.bbox.y) <= tol;
}

function finding(component, selector, message, expected, actual, extra = {}) {
  return issue(null, {
    element: component,
    selector: selector || "",
    message,
    expected,
    actual,
    hints: { component, ...(extra.hints || {}) },
    ...extra,
  });
}

module.exports = [
  {
    id: "design.validation.title-color",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Card, graph, and table titles are white in dark mode and black in light mode.",
    detect(snapshot) {
      const theme = themeOf(snapshot);
      if (theme !== "dark" && theme !== "light") {
        noteGap(snapshot, { component: "title", reason: "rendered theme was not dark or light" });
        return [];
      }
      const targets = [];
      for (const card of snapshot.contentCards || []) {
        if (!card.hasTitle && !card.title) continue;
        targets.push({
          component: "card",
          element: `card title "${card.title || ""}"`,
          selector: card.titleSelector || card.selector,
          color: card.titleColor,
        });
      }
      for (const card of snapshot.metricCards || []) {
        targets.push({
          component: "metric-card",
          element: `metric card "${card.lines?.[0] || card.text || ""}"`,
          selector: card.selector,
          color: card.color,
        });
      }
      for (const chart of snapshot.charts || []) {
        if (!chart.title && !chart.name) continue;
        targets.push({
          component: "graph",
          element: `graph title "${chart.title || chart.name || ""}"`,
          selector: chart.titleSelector || chart.selector,
          color: chart.titleColor,
        });
      }
      for (const table of snapshot.tables || []) {
        if (!table.title) continue;
        targets.push({
          component: "table",
          element: `table title "${table.title}"`,
          selector: table.titleSelector || table.selector,
          color: table.titleColor,
        });
      }
      const findings = [];
      for (const target of targets) {
        if (!target.color) {
          noteGap(snapshot, {
            component: target.component,
            element: target.element,
            reason: "title color could not be read",
          });
          continue;
        }
        const ok = theme === "dark" ? isWhite(target.color) : isBlack(target.color);
        if (ok) continue;
        findings.push(
          finding(
            target.element,
            target.selector,
            `${target.component} title does not match the ${theme} theme`,
            theme === "dark" ? "title color near white (#dcdcdc or lighter)" : "title color near black (#282828 or darker)",
            `rgb(${Math.round(target.color.r)}, ${Math.round(target.color.g)}, ${Math.round(target.color.b)})`,
          ),
        );
      }
      return findings.slice(0, 12);
    },
  },
  {
    id: "design.validation.component-contrast",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description:
      "Contrast for badges, status chips, and graph legends or values. Generic text stays on a11y.contrast.",
    detect(snapshot, ctx = {}) {
      const limits = ctx.options?.exceptions?.contrast || {};
      const normal = limits.normal ?? 4.5;
      const large = limits.large ?? 3;
      const findings = [];
      for (const sample of snapshot.contrastSamples || []) {
        if (!sample.foreground || !sample.background) {
          noteGap(snapshot, {
            component: sample.component || "component",
            element: sample.element || sample.selector,
            reason: "contrast colors were not available",
          });
          continue;
        }
        const ratio = contrastRatio(sample.foreground, sample.background);
        if (ratio == null) {
          noteGap(snapshot, {
            component: sample.component || "component",
            element: sample.element || "",
            reason: "contrast ratio could not be calculated",
          });
          continue;
        }
        const min = isLargeText(sample.fontSize || 14, sample.fontWeight) ? large : normal;
        if (ratio >= min || ratio < 1.3) continue;
        findings.push(
          finding(
            sample.element || sample.component,
            sample.selector,
            `${sample.component || "component"} contrast is below WCAG AA`,
            `>= ${min}:1`,
            `${ratio.toFixed(2)}:1`,
          ),
        );
      }
      return findings.slice(0, 12);
    },
  },
  {
    id: "design.validation.button-roles",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Primary buttons stay visually distinct from secondary buttons and share one primary color.",
    detect(snapshot) {
      const primary = snapshot.primaryButtons || [];
      const secondary = snapshot.secondaryButtons || [];
      const findings = [];
      const primaryFill = primary[0] && primary[0].background;
      const primaryDrift = primaryFill
        ? Math.max(
            Math.abs(primaryFill.r - 131),
            Math.abs(primaryFill.g - 120),
            Math.abs(primaryFill.b - 255),
          )
        : 99;
      if (
        primary.length &&
        secondary.length &&
        primaryFill &&
        secondary[0].background &&
        primaryDrift <= 28
      ) {
        const distance =
          Math.abs(primary[0].background.r - secondary[0].background.r) +
          Math.abs(primary[0].background.g - secondary[0].background.g) +
          Math.abs(primary[0].background.b - secondary[0].background.b);
        if (distance < 36) {
          findings.push(
            finding(
              `primary button "${primary[0].name || ""}"`,
              primary[0].selector,
              "Primary button is not visually distinguishable from a secondary button",
              "primary fill clearly different from secondary fill",
              `color distance ${Math.round(distance)}`,
            ),
          );
        }
      }
      const hues = new Set();
      for (const button of primary) {
        if (!button.background) continue;
        if (/delete|remove|danger|destroy/i.test(button.name || "")) continue;
        hues.add(colorKey(button.background));
      }
      if (hues.size >= 3) {
        findings.push(
          finding(
            "primary buttons",
            primary[0].selector,
            "Primary colors are not consistent",
            "one primary accent across action buttons",
            `${hues.size} primary fills`,
          ),
        );
      }
      return findings.slice(0, 6);
    },
  },
  {
    id: "design.validation.card-geometry",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Content cards in a row share height, background, and border treatment.",
    detect(snapshot) {
      const cards = (snapshot.contentCards || []).filter((card) => card.bbox);
      const findings = [];
      const used = new Set();
      for (const card of cards) {
        if (used.has(card.selector)) continue;
        const row = cards.filter((other) => sameBand(card, other, 16));
        row.forEach((item) => used.add(item.selector));
        if (row.length < 2) continue;
        const heights = row.map((item) => item.bbox.height);
        if (spread(heights) > 8) {
          findings.push(
            finding(
              `card "${card.title || ""}"`,
              card.selector,
              "Cards in the same row are not the same height",
              "card heights within 8px",
              `${Math.round(Math.min(...heights))}px to ${Math.round(Math.max(...heights))}px`,
            ),
          );
        }
        const fills = new Set(row.map((item) => colorKey(item.background)).filter(Boolean));
        if (fills.size > 1) {
          findings.push(
            finding(
              `card "${card.title || ""}"`,
              card.selector,
              "Cards in the same row use different background colors",
              "one card background",
              `${fills.size} backgrounds`,
            ),
          );
        }
        const bordered = row.filter((item) => (item.borderWidth || 0) >= 1);
        if (bordered.length && bordered.length !== row.length) {
          findings.push(
            finding(
              `card "${card.title || ""}"`,
              card.selector,
              "Cards in the same row do not share a border treatment",
              "matching borders on peer cards",
              `${bordered.length} of ${row.length} cards have a border`,
            ),
          );
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "design.validation.badges",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Status badges share height, type size, and corner radius.",
    detect(snapshot) {
      const badges = snapshot.badges || [];
      if (badges.length < 2) return [];
      const findings = [];
      if (spread(badges.map((badge) => badge.bbox.height)) > 6) {
        findings.push(
          finding(
            `badge "${badges[0].name || ""}"`,
            badges[0].selector,
            "Status badges do not share a height",
            "badge heights within 6px",
            badges.map((badge) => `${Math.round(badge.bbox.height)}px`).join(", "),
          ),
        );
      }
      if (spread(badges.map((badge) => badge.fontSize)) > 2) {
        findings.push(
          finding(
            `badge "${badges[0].name || ""}"`,
            badges[0].selector,
            "Status badges do not share a font size",
            "one badge font size",
            badges.map((badge) => `${badge.fontSize}px`).join(", "),
          ),
        );
      }
      const radii = badges.map((badge) => px(String(badge.borderRadius || "").split(" ")[0]));
      if (spread(radii) > 4) {
        findings.push(
          finding(
            `badge "${badges[0].name || ""}"`,
            badges[0].selector,
            "Status badges do not share a border radius",
            "one badge radius",
            radii.map((radius) => `${radius}px`).join(", "),
          ),
        );
      }
      return findings.slice(0, 4);
    },
  },
  {
    id: "design.validation.overlay-radius",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Modals and popups use a consistent corner radius.",
    detect(snapshot) {
      const overlays = (snapshot.overlays || []).filter((overlay) => overlay.bbox && !overlay.offscreen);
      if (!overlays.length) return [];
      const radii = overlays.map((overlay) => px(String(overlay.borderRadius || "").split(" ")[0]));
      const findings = [];
      for (let i = 0; i < overlays.length; i += 1) {
        if (radii[i] < 4 || radii[i] > 20) {
          findings.push(
            finding(
              `modal "${overlays[i].name || ""}"`,
              overlays[i].selector,
              "Modal border radius is outside the shared radius range",
              "radius 4–20px",
              `${radii[i]}px`,
            ),
          );
        }
      }
      if (overlays.length >= 2 && spread(radii) > 4) {
        findings.push(
          finding(
            "modals",
            overlays[0].selector,
            "Open modals do not share a border radius",
            "one modal radius",
            radii.map((radius) => `${radius}px`).join(", "),
          ),
        );
      }
      return findings.slice(0, 4);
    },
  },
  {
    id: "design.validation.table-layout",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Tables share horizontal inset and top spacing, fill their region, and keep actions at the top right.",
    detect(snapshot) {
      const tables = (snapshot.tables || []).filter((table) => !table.hasEmptyMarker);
      const findings = [];
      if (tables.length >= 2) {
        if (spread(tables.map((table) => table.insetLeft)) > 16) {
          findings.push(
            finding(
              "data table",
              tables[0].selector,
              "Tables do not share the same left inset",
              "left spacing within 16px across tables",
              tables.map((table) => `${table.insetLeft}px`).join(", "),
            ),
          );
        }
        if (spread(tables.map((table) => table.insetRight)) > 16) {
          findings.push(
            finding(
              "data table",
              tables[0].selector,
              "Tables do not share the same right inset",
              "right spacing within 16px across tables",
              tables.map((table) => `${table.insetRight}px`).join(", "),
            ),
          );
        }
        if (spread(tables.map((table) => table.topGap)) > 16) {
          findings.push(
            finding(
              "data table",
              tables[0].selector,
              "Tables do not share the same top spacing",
              "top gap within 16px across tables",
              tables.map((table) => `${table.topGap}px`).join(", "),
            ),
          );
        }
      }
      for (const table of tables) {
        if ((table.rowCount || 0) < 1) continue;
        if (table.spaceBelow > 140 && table.fillRatio != null && table.fillRatio < 0.6) {
          findings.push(
            finding(
              table.title ? `table "${table.title}"` : "data table",
              table.selector,
              "DataTable leaves a large empty region below the rows",
              "table uses the available height, or empty space stays under 140px",
              `${table.spaceBelow}px empty below, fill ${table.fillRatio}`,
            ),
          );
        }
        if (table.expectsFill && table.fillRatio != null && table.fillRatio < 0.75) {
          findings.push(
            finding(
              table.title ? `table "${table.title}"` : "data table",
              table.selector,
              "DataTable does not use the available height",
              "full-height table fills at least 75% of its region",
              `fill ${table.fillRatio}`,
            ),
          );
        }
        const aligns = (table.headerAligns || []).filter(Boolean);
        const uniqueAlign = new Set(aligns.map((value) => (value === "start" ? "left" : value)));
        if (uniqueAlign.size > 1) {
          findings.push(
            finding(
              "table headers",
              table.selector,
              "Table headers do not share one alignment",
              "one header alignment",
              [...uniqueAlign].join(", "),
            ),
          );
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "design.validation.table-actions",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description:
      "Buttons above a DataTable sit on the top toolbar row, aligned to the table's right edge, and not below the tabs.",
    detect(snapshot) {
      const findings = [];
      for (const table of snapshot.tables || []) {
        const buttons = table.toolbarButtons || [];
        if (!buttons.length) continue;
        const label = table.title ? `table "${table.title}"` : "data table";
        const minY = Math.min(...buttons.map((button) => button.y));
        const rightmost = buttons.reduce((best, button) => (button.right > best.right ? button : best));
        if (table.toolbarRight != null && table.toolbarRight - rightmost.right > 36) {
          findings.push(
            finding(
              `button "${rightmost.name || "action"}"`,
              rightmost.selector || table.selector,
              "Action buttons above the DataTable are not aligned to the top right",
              "the rightmost table action lines up with the table's right edge",
              `"${rightmost.name || "action"}" ends ${table.toolbarRight - rightmost.right}px short of the table edge`,
            ),
          );
        }
        for (const button of buttons) {
          const belowTabs = table.tabBar && button.y >= table.tabBar.bottom + 24;
          if (!belowTabs && button.y > minY + 12) {
            findings.push(
              finding(
                `button "${button.name || "action"}"`,
                button.selector || table.selector,
                "A table action is not on the top button row",
                "table actions share the top toolbar row",
                `"${button.name || "action"}" is ${button.y - minY}px below the top action on ${label}`,
              ),
            );
          }
          if (belowTabs) {
            findings.push(
              finding(
                `button "${button.name || "action"}"`,
                button.selector || table.selector,
                "A table action is below the tabs",
                "table actions sit on the tab row, at the top right",
                `"${button.name || "action"}" starts at ${button.y}px, below tabs that end at ${table.tabBar.bottom}px`,
              ),
            );
          }
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "design.validation.tab-metrics",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description: "Tabs in one group share type size and even spacing. Underline and pill checks stay on the existing tab rules.",
    detect(snapshot) {
      const tabs = (snapshot.tabs || []).filter((tab) => tab.bbox);
      if (tabs.length < 2) return [];
      const findings = [];
      const fonts = tabs.map((tab) => tab.fontSize).filter((size) => size > 0);
      if (fonts.length >= 2 && spread(fonts) > 2) {
        findings.push(
          finding(
            `tab "${tabs[0].name || ""}"`,
            tabs[0].selector,
            "Tabs do not share a font size",
            "one tab font size",
            fonts.map((size) => `${size}px`).join(", "),
          ),
        );
      }
      const ordered = [...tabs].sort((a, b) => a.bbox.x - b.bbox.x);
      const row = ordered.filter((tab) => sameBand(ordered[0], tab, 10));
      if (row.length >= 3) {
        const gaps = [];
        for (let i = 1; i < row.length; i += 1) {
          gaps.push(row[i].bbox.x - (row[i - 1].bbox.x + row[i - 1].bbox.width));
        }
        if (spread(gaps) > 10 && Math.min(...gaps) >= 0) {
          findings.push(
            finding(
              "tabs",
              row[0].selector,
              "Tab spacing is uneven",
              "gaps within 10px",
              `${Math.round(Math.min(...gaps))}px to ${Math.round(Math.max(...gaps))}px`,
            ),
          );
        }
      }
      return findings.slice(0, 4);
    },
  },
  {
    id: "design.validation.chart-detail",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Graph values stay centered when there is a single figure, and labels do not overlap.",
    detect(snapshot) {
      const findings = [];
      for (const chart of snapshot.charts || []) {
        const name = chart.name || chart.title || "chart";
        if ((chart.labelOverlap || 0) > 0) {
          findings.push(
            finding(
              `graph "${name}"`,
              chart.selector,
              "Graph labels or numbers overlap",
              "labels and values do not overlap",
              `${chart.labelOverlap} overlapping pair(s) on "${name}"`,
            ),
          );
        }
        const numbers = chart.numericLabels || [];
        if (numbers.length === 1 && chart.bbox && chart.bbox.width > 0) {
          const offset = Math.abs(numbers[0].centerOffset || 0);
          if (offset > chart.bbox.width * 0.18) {
            findings.push(
              finding(
                `graph "${name}" value "${numbers[0].text || ""}"`,
                chart.selector,
                "Graph value is not centered",
                "single graph value centered in the chart",
                `offset ${offset}px on "${name}"`,
              ),
            );
          }
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "design.validation.calendar",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Date inputs show a calendar icon.",
    detect(snapshot) {
      const inputs = snapshot.dateInputs || [];
      if (!inputs.length) return [];
      return inputs
        .filter((input) => input.hasIcon === false)
        .slice(0, 6)
        .map((input) =>
          finding(
            `date input "${input.name || ""}"`,
            input.selector,
            "Date input does not show a calendar icon",
            "a calendar icon on the date field",
            "icon not found",
          ),
        );
    },
  },
  {
    id: "design.validation.section-spacing",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description: "Vertical gaps between stacked page sections stay consistent.",
    detect(snapshot) {
      const gaps = (snapshot.sectionGaps || []).map((item) => item.gap).filter((gap) => gap >= 0);
      if (gaps.length < 3) return [];
      if (spread(gaps) <= 16) return [];
      return [
        finding(
          "page sections",
          (snapshot.sectionGaps[0] && snapshot.sectionGaps[0].from) || "main",
          "Section spacing is inconsistent",
          "vertical gaps within 16px",
          `${Math.min(...gaps)}px to ${Math.max(...gaps)}px`,
        ),
      ];
    },
  },
  {
    id: "design.validation.scrollbar",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description: "Explicit scrollbar colors stay readable in the rendered theme.",
    detect(snapshot) {
      const theme = themeOf(snapshot);
      const findings = [];
      for (const bar of snapshot.scrollbars || []) {
        const raw = String(bar.scrollbarColor || "").trim();
        if (!raw || raw === "auto") continue;
        const parts = raw.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g) || [];
        if (!parts.length) continue;
        const thumb = parts[0].toLowerCase();
        const thumbWhite = /255,\s*255,\s*255|#fff(?:fff)?\b/.test(thumb);
        const thumbBlack = /0,\s*0,\s*0|#000(?:000)?\b/.test(thumb);
        if (theme === "dark" && thumbWhite) {
          findings.push(
            finding(
              "scrollbar",
              bar.selector,
              "Dark mode scrollbar thumb is white",
              "a muted thumb that stays visible on the dark surface",
              bar.scrollbarColor,
            ),
          );
        }
        if (theme === "light" && thumbBlack) {
          findings.push(
            finding(
              "scrollbar",
              bar.selector,
              "Light mode scrollbar thumb is black",
              "a muted thumb that matches the light theme",
              bar.scrollbarColor,
            ),
          );
        }
      }
      return findings.slice(0, 4);
    },
  },
  {
    id: "design.validation.slider",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description: "Visible sliders are large enough to use.",
    detect(snapshot) {
      const sliders = (snapshot.sliders || []).filter((slider) => !slider.disabled);
      if (!sliders.length) return [];
      return sliders
        .filter((slider) => slider.bbox && (slider.bbox.width < 80 || slider.bbox.height < 8))
        .slice(0, 4)
        .map((slider) =>
          finding(
            `slider "${slider.name || ""}"`,
            slider.selector,
            "Slider is too small to use",
            "width >= 80px and height >= 8px",
            `${Math.round(slider.bbox.width)}x${Math.round(slider.bbox.height)}`,
          ),
        );
    },
  },
];
