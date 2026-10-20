const { issue, px } = require("./support");
const { expectedFor, getReference } = require("../references");

module.exports = [
  {
    id: "design.content-card",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Content cards need a title, moderate radius, and usable padding (ref Catalog brand card).",
    detect(snapshot) {
      const ref = getReference("content-card");
      const tokens = ref?.tokens || {
        radiusMin: 6,
        radiusMax: 16,
        paddingMin: 12,
        minWidth: 240,
        minHeight: 120,
      };
      const findings = [];
      for (const card of snapshot.contentCards || []) {
        const problems = [];
        if (!card.hasTitle) problems.push("missing title");
        const radius = px(card.borderRadius);
        if (radius && (radius < tokens.radiusMin || radius > tokens.radiusMax)) {
          problems.push(`radius ${radius}px`);
        }
        const padSide = (card.paddingX || 0) / 2;
        if (padSide > 0 && padSide < tokens.paddingMin) {
          problems.push(`padding-x ~${Math.round(padSide)}px`);
        }
        if (card.bbox.width < tokens.minWidth || card.bbox.height < tokens.minHeight) {
          problems.push(`size ${Math.round(card.bbox.width)}x${Math.round(card.bbox.height)}`);
        }
        if (problems.length) {
          findings.push(
            issue(null, {
              element: `content card "${card.title || ""}"`,
              selector: card.selector,
              message: `Content card does not match reference: ${problems.join(", ")}`,
              expected: expectedFor("design.content-card"),
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
    id: "design.table",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Data tables with rows should keep header/body row heights in range (ref Shipping Lookuplist).",
    detect(snapshot) {
      const ref = getReference("table");
      const tokens = ref?.tokens || {
        headerHeightMin: 32,
        headerHeightMax: 64,
        rowHeightMin: 28,
        rowHeightMax: 72,
      };
      const findings = [];
      for (const table of snapshot.tables || []) {
        if (table.hasEmptyMarker || (table.rowCount || 0) < 1) continue;
        const problems = [];
        if (table.headerHeight) {
          if (
            table.headerHeight < tokens.headerHeightMin ||
            table.headerHeight > tokens.headerHeightMax
          ) {
            problems.push(`header ${table.headerHeight}px`);
          }
        }
        if (table.sampleRowHeight) {
          if (
            table.sampleRowHeight < tokens.rowHeightMin ||
            table.sampleRowHeight > tokens.rowHeightMax
          ) {
            problems.push(`row ${table.sampleRowHeight}px`);
          }
        }
        if (problems.length) {
          findings.push(
            issue(null, {
              element: "data table",
              selector: table.selector,
              message: `Table geometry outside reference range: ${problems.join(", ")}`,
              expected: expectedFor("design.table"),
              actual: problems.join("; "),
              referenceId: ref?.componentId,
            }),
          );
        }
      }
      return findings.slice(0, 10);
    },
  },
  {
    id: "design.chart",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Charts should be large enough and include axes/legend when multi-series (ref Driver Hub).",
    detect(snapshot) {
      const ref = getReference("chart");
      const tokens = ref?.tokens || { minWidth: 280, minHeight: 180 };
      const findings = [];
      for (const chart of snapshot.charts || []) {
        const problems = [];
        if (chart.bbox.width < tokens.minWidth || chart.bbox.height < tokens.minHeight) {
          problems.push(
            `size ${Math.round(chart.bbox.width)}x${Math.round(chart.bbox.height)}`,
          );
        }
        if (chart.isRecharts && !chart.hasAxis) {
          problems.push("missing axes");
        }
        if (problems.length) {
          findings.push(
            issue(null, {
              element: "chart",
              selector: chart.selector,
              message: `Chart does not match reference layout: ${problems.join(", ")}`,
              expected: expectedFor("design.chart"),
              actual: problems.join("; "),
              referenceId: ref?.componentId,
            }),
          );
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "design.search-input",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description: "Search fields should be ~40±4px tall (ref Fulfillment search).",
    detect(snapshot) {
      const ref = getReference("search-input");
      const tokens = ref?.tokens || { height: 40, heightTol: 4 };
      const findings = [];
      for (const input of snapshot.searchInputs || []) {
        const h = input.bbox.height;
        if (Math.abs(h - tokens.height) > tokens.heightTol) {
          findings.push(
            issue(null, {
              element: `search "${input.name || ""}"`,
              selector: input.selector,
              message: "Search input height outside reference",
              expected: expectedFor("design.search-input"),
              actual: `height ${Math.round(h)}px`,
              referenceId: ref?.componentId,
            }),
          );
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "design.date-pills",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description: "Date pill groups should be ~40px tall with a single active segment (ref Home).",
    detect(snapshot) {
      const ref = getReference("date-pills");
      const tokens = ref?.tokens || { height: 40, heightTol: 4 };
      const findings = [];
      for (const group of snapshot.datePills || []) {
        const problems = [];
        const h = group.bbox.height;
        if (Math.abs(h - tokens.height) > tokens.heightTol) {
          problems.push(`height ${Math.round(h)}px`);
        }
        if (group.segmentCount >= 2 && group.activeCount > 1) {
          problems.push(`active segments ${group.activeCount}`);
        }
        if (problems.length) {
          findings.push(
            issue(null, {
              element: "date pill group",
              selector: group.selector,
              message: `Date pills do not match reference: ${problems.join(", ")}`,
              expected: expectedFor("design.date-pills"),
              actual: problems.join("; "),
              referenceId: ref?.componentId,
            }),
          );
        }
      }
      return findings.slice(0, 6);
    },
  },
  {
    id: "design.pill-tabs",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description: "Pill tabs need a filled active state and muted inactive (ref CRM Companies/Contacts).",
    detect(snapshot) {
      const ref = getReference("pill-tabs");
      const tokens = ref?.tokens || { height: 45, heightTol: 8 };
      const pills = (snapshot.tabs || []).filter(
        (tab) => tab.variant === "pill" && tab.bbox && tab.bbox.height >= 24 && tab.bbox.width >= 40,
      );
      if (pills.length < 2) return [];
      const findings = [];
      const selected = pills.filter((tab) => tab.selected);
      if (!selected.length) {
        findings.push(
          issue(null, {
            element: "pill tabs",
            selector: pills[0].selector,
            message: "Pill tab group has no clear active/selected tab",
            expected: expectedFor("design.pill-tabs"),
            actual: "no selected pill",
            referenceId: ref?.componentId,
          }),
        );
      }
      for (const tab of pills) {
        const h = tab.bbox.height;
        if (Math.abs(h - tokens.height) > tokens.heightTol) {
          findings.push(
            issue(null, {
              element: `pill tab "${tab.name || ""}"`,
              selector: tab.selector,
              message: "Pill tab height outside reference",
              expected: expectedFor("design.pill-tabs"),
              actual: `height ${Math.round(h)}px`,
              referenceId: ref?.componentId,
            }),
          );
        }
      }
      return findings.slice(0, 8);
    },
  },
  {
    id: "design.sidebar-nav",
    category: "design",
    kind: "deterministic",
    severity: "minor",
    description: "Sidebar width and nav item heights should match Home chrome (ref 008 / 023).",
    detect(snapshot) {
      const sideRef = getReference("sidebar");
      const navRef = getReference("nav-item");
      const sideTokens = sideRef?.tokens || { width: 256, widthTol: 24 };
      const navTokens = navRef?.tokens || { height: 43, heightTol: 6 };
      const findings = [];
      for (const item of snapshot.sidebarNav || []) {
        if (item.kind === "sidebar") {
          const w = item.bbox.width;
          if (Math.abs(w - sideTokens.width) > sideTokens.widthTol) {
            findings.push(
              issue(null, {
                element: "sidebar",
                selector: item.selector,
                message: "Sidebar width outside reference",
                expected: expectedFor("sidebar"),
                actual: `width ${Math.round(w)}px`,
                referenceId: sideRef?.componentId,
              }),
            );
          }
          continue;
        }
        if (item.kind === "nav-item") {
          const h = item.bbox.height;
          if (Math.abs(h - navTokens.height) > navTokens.heightTol) {
            findings.push(
              issue(null, {
                element: `nav "${item.name || ""}"`,
                selector: item.selector,
                message: "Sidebar nav item height outside reference",
                expected: expectedFor("nav-item"),
                actual: `height ${Math.round(h)}px`,
                referenceId: navRef?.componentId,
              }),
            );
          }
        }
      }
      return findings.slice(0, 12);
    },
  },
];
