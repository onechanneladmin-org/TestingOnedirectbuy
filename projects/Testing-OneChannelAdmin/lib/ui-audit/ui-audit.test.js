const test = require("node:test");
const assert = require("node:assert/strict");
const { contrastRatio, luminance } = require("./contrast");
const { diffRatio } = require("./png-diff");
const { isExcepted, mergeExceptions } = require("./exceptions");
const { exitCodeFor } = require("./exit-code");
const { listRules, registerRule, resetRegistryForTests } = require("./registry");

function el(overrides = {}) {
  return {
    selector: '[data-audit-id="x"]',
    tag: "p",
    role: null,
    name: "",
    text: "Hello",
    bbox: { x: 10, y: 10, width: 120, height: 40 },
    client: { width: 120, height: 40, scrollWidth: 120, scrollHeight: 40 },
    parentBBox: { x: 0, y: 0, width: 400, height: 300 },
    parentSelector: "main",
    parentRole: null,
    styles: {
      fontSize: "16px",
      fontWeight: "400",
      overflowX: "visible",
      textOverflow: "clip",
      pointerEvents: "auto",
      position: "static",
      backgroundImage: "none",
      webkitTextFillColor: "rgb(0, 0, 0)",
      fontFamily: "Arial",
    },
    foreground: { r: 0, g: 0, b: 0, a: 1 },
    background: { r: 255, g: 255, b: 255, a: 1 },
    disabled: false,
    interactive: false,
    inViewport: true,
    allowScroll: false,
    auditIgnore: [],
    ancestors: [],
    labelled: true,
    controlKind: null,
    inputType: null,
    placeholder: null,
    placeholderColor: null,
    borderless: false,
    sameBackgroundAsParent: false,
    obscuredBy: null,
    href: null,
    altPresent: null,
    tabindex: null,
    ...overrides,
  };
}

function snap(overrides = {}) {
  return {
    url: "https://admin.example/orders",
    title: "Orders",
    theme: "light",
    viewport: { width: 1280, height: 720 },
    htmlLang: "en",
    document: {
      horizontalOverflow: false,
      verticalUnreachable: false,
      nestedVerticalScroll: false,
      scrollWidth: 1280,
      innerWidth: 1280,
      scrollHeight: 900,
      innerHeight: 720,
    },
    elements: [],
    tables: [],
    overlays: [],
    headings: [{ level: 1, text: "Orders", selector: "h1" }],
    main: { selector: "main", textLength: 40, hasEmptyMarker: false, hasHeading: true },
    duplicateIds: [],
    themeSignals: {
      dataTheme: "",
      bodyBackground: { r: 255, g: 255, b: 255, a: 1 },
    },
    performance: { nodeCount: 80, imagesMissingSize: 0, loadMs: 120 },
    ...overrides,
  };
}

function ctx(extra = {}) {
  return {
    page: null,
    runtime: { consoleErrors: [], pageErrors: [] },
    options: {
      theme: "light",
      exceptions: mergeExceptions(),
      navigation: {},
      interaction: {},
      visual: {},
      performance: {},
      ...extra,
    },
  };
}

const rules = [
  ...require("./rules/audit-doc"),
  ...require("./rules/a11y"),
  ...require("./rules/color"),
  ...require("./rules/controls"),
  ...require("./rules/empty-state"),
  ...require("./rules/forms"),
  ...require("./rules/interaction"),
  ...require("./rules/layout"),
  ...require("./rules/navigation"),
  ...require("./rules/overlays"),
  ...require("./rules/performance"),
  ...require("./rules/responsive"),
  ...require("./rules/review"),
  ...require("./rules/scroll"),
  ...require("./rules/theme"),
  ...require("./rules/typography"),
  ...require("./rules/visual"),
];

function rule(id) {
  const found = rules.find((entry) => entry.id === id);
  if (!found) throw new Error(`Missing rule ${id}`);
  return found;
}

test("contrast of black on white is about 21:1", () => {
  const ratio = contrastRatio({ r: 0, g: 0, b: 0, a: 1 }, { r: 255, g: 255, b: 255, a: 1 });
  assert.ok(ratio > 20);
  assert.ok(luminance({ r: 255, g: 255, b: 255 }) > 0.9);
});

test("identical pixels have no visual diff", () => {
  const pixel = { width: 1, height: 1, data: Buffer.from([10, 20, 30, 255]) };
  assert.equal(diffRatio(pixel, pixel), 0);
  const other = { width: 1, height: 1, data: Buffer.from([200, 20, 30, 255]) };
  assert.equal(diffRatio(pixel, other), 1);
  assert.equal(diffRatio(pixel, { width: 2, height: 1, data: Buffer.alloc(8) }), 1);
});

test("registry loads built-in rules and accepts an extra rule", () => {
  resetRegistryForTests();
  try {
    const ids = listRules().map((entry) => entry.id);
    for (const id of [
      "layout.element-overlap",
      "scroll.horizontal-overflow",
      "a11y.contrast",
      "forms.missing-label",
      "theme.mismatch",
      "visual.reference-diff",
      "review.icon-only-control",
    ]) {
      assert.ok(ids.includes(id), id);
    }
    registerRule({
      id: "custom.sample",
      category: "layout",
      kind: "deterministic",
      severity: "major",
      detect() {
        return [];
      },
    });
    assert.ok(listRules().some((entry) => entry.id === "custom.sample"));
    assert.throws(() =>
      registerRule({ id: "custom.bad", category: "layout", kind: "subjective", detect() {} }),
    );
  } finally {
    resetRegistryForTests();
  }
});

test("exceptions suppress ignored rules, disabled controls, and entries", () => {
  const exceptions = mergeExceptions({
    entries: [{ ruleId: "a11y.contrast", page: "Orders" }],
  });
  const context = { theme: "light", viewport: { width: 1280, height: 720 }, page: "Orders" };
  assert.equal(
    isExcepted(
      { ruleId: "a11y.contrast", category: "accessibility", selector: "p", page: "Orders", hints: {} },
      exceptions,
      context,
    ),
    true,
  );
  assert.equal(
    isExcepted(
      {
        ruleId: "controls.undersized-target",
        category: "controls",
        selector: "button",
        page: "Orders",
        hints: { disabled: true, auditIgnore: [] },
      },
      exceptions,
      context,
    ),
    true,
  );
  assert.equal(
    isExcepted(
      {
        ruleId: "layout.element-overlap",
        category: "layout",
        selector: '[data-audit-id="x"]',
        page: "Orders",
        hints: { auditIgnore: ["layout.element-overlap"] },
      },
      exceptions,
      context,
    ),
    true,
  );
});

test("default exit code ignores heuristic and review findings", () => {
  assert.equal(
    exitCodeFor([
      { kind: "heuristic", severity: "major" },
      { kind: "review", severity: "critical" },
      { kind: "deterministic", severity: "minor" },
    ]),
    0,
  );
  assert.equal(exitCodeFor([{ kind: "deterministic", severity: "major" }]), 1);
  assert.equal(exitCodeFor([{ kind: "visual", severity: "critical" }]), 1);
});

test("detectors flag generalized audit patterns", () => {
  const overlap = rule("layout.element-overlap");
  const overlapped = overlap.detect(
    snap({
      elements: [
        el({
          selector: '[data-audit-id="a"]',
          interactive: true,
          controlKind: "button",
          bbox: { x: 0, y: 0, width: 100, height: 40 },
        }),
        el({
          selector: '[data-audit-id="b"]',
          interactive: true,
          controlKind: "button",
          bbox: { x: 40, y: 10, width: 100, height: 40 },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(overlapped.length, 1);

  const nested = overlap.detect(
    snap({
      elements: [
        el({ selector: "button", interactive: true, bbox: { x: 0, y: 0, width: 100, height: 40 } }),
        el({
          selector: "button svg",
          interactive: true,
          ancestors: ["button"],
          bbox: { x: 10, y: 10, width: 20, height: 20 },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(nested.length, 0);

  const clipped = rule("layout.clipped-content").detect(
    snap({
      elements: [
        el({
          text: "This label is cut off",
          styles: { ...el().styles, overflowX: "hidden", textOverflow: "clip" },
          client: { width: 40, height: 20, scrollWidth: 180, scrollHeight: 20 },
        }),
      ],
    }),
    ctx(),
  );
  assert.match(clipped[0].message, /clipped/i);

  const scroll = rule("scroll.horizontal-overflow").detect(
    snap({
      document: { ...snap().document, horizontalOverflow: true, scrollWidth: 1800, innerWidth: 1280 },
    }),
    ctx(),
  );
  assert.equal(scroll[0].selector, "html");

  const label = rule("forms.missing-label").detect(
    snap({
      elements: [
        el({
          tag: "input",
          controlKind: "input",
          labelled: false,
          placeholder: "Email",
          text: "",
        }),
      ],
    }),
    ctx(),
  );
  assert.match(label[0].message, /placeholder/i);

  const placeholder = rule("forms.placeholder-contrast").detect(
    snap({
      elements: [
        el({
          placeholder: "Email",
          placeholderColor: { r: 200, g: 200, b: 200, a: 1 },
          background: { r: 255, g: 255, b: 255, a: 1 },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(placeholder.length, 1);

  const dialog = rule("overlays.dialog-missing-name").detect(
    snap({
      overlays: [
        {
          selector: '[role="dialog"]',
          role: "dialog",
          name: "",
          ariaModal: false,
          bbox: { x: 0, y: 0, width: 200, height: 100 },
        },
      ],
    }),
    ctx(),
  );
  assert.match(dialog[0].message, /name/i);

  const empty = rule("empty.missing-empty-state").detect(
    snap({ tables: [{ selector: "table", rowCount: 0, hasEmptyMarker: false }] }),
    ctx(),
  );
  assert.equal(empty.length, 1);
  const marked = rule("empty.missing-empty-state").detect(
    snap({ tables: [{ selector: "table", rowCount: 0, hasEmptyMarker: true }] }),
    ctx(),
  );
  assert.equal(marked.length, 0);

  const theme = rule("theme.mismatch").detect(snap(), ctx({ theme: "dark" }));
  assert.match(theme[0].message, /dark/);

  const headings = rule("a11y.heading-skip").detect(
    snap({
      headings: [
        { level: 1, text: "A", selector: "h1" },
        { level: 4, text: "B", selector: "h4" },
      ],
    }),
    ctx(),
  );
  assert.match(headings[0].actual, /h4/);

  const tiny = rule("controls.undersized-target").detect(
    snap({
      elements: [el({ interactive: true, bbox: { x: 0, y: 0, width: 10, height: 10 } })],
    }),
    ctx(),
  );
  assert.equal(tiny.length, 1);

  const invisible = rule("color.invisible-text").detect(
    snap({
      elements: [
        el({
          text: "Hidden",
          foreground: { r: 0, g: 0, b: 0, a: 0 },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(invisible.length, 1);

  const ids = rule("a11y.duplicate-id").detect(snap({ duplicateIds: [{ id: "dup", count: 2 }] }), ctx());
  assert.match(ids[0].actual, /dup/);

  const href = rule("nav.placeholder-destination").detect(
    snap({ elements: [el({ controlKind: "link", href: "#", text: "Home", name: "Home" })] }),
    ctx(),
  );
  assert.equal(href.length, 1);

  const alt = rule("a11y.image-missing-alt").detect(
    snap({ elements: [el({ tag: "img", altPresent: false, text: "", role: "img" })] }),
    ctx(),
  );
  assert.equal(alt.length, 1);

  const slow = rule("perf.slow-load").detect(
    snap({ performance: { nodeCount: 10, imagesMissingSize: 0, loadMs: 20000 } }),
    ctx(),
  );
  assert.equal(slow.length, 1);

  const review = rule("review.icon-only-control").detect(
    snap({
      elements: [el({ controlKind: "button", text: "", name: "Filter", interactive: true })],
    }),
    ctx(),
  );
  assert.match(review[0].message, /REVIEW_REQUIRED/);

  const gradient = rule("color.gradient-button").detect(
    snap({
      elements: [
        el({
          controlKind: "button",
          styles: { ...el().styles, backgroundImage: "linear-gradient(rgb(0,0,0), rgb(255,255,255))" },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(gradient.length, 1);

  const fills = rule("color.inconsistent-field-fill").detect(
    snap({
      elements: [
        el({
          selector: "input:nth-of-type(1)",
          controlKind: "input",
          parentSelector: "form",
          sameBackgroundAsParent: false,
          background: { r: 20, g: 40, b: 80, a: 1 },
        }),
        el({
          selector: "input:nth-of-type(2)",
          controlKind: "input",
          parentSelector: "form",
          sameBackgroundAsParent: true,
          background: { r: 255, g: 255, b: 255, a: 1 },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(fills.length, 1);

  const icon = rule("theme.icon-on-wrong-theme").detect(
    snap({
      icons: [
        {
          selector: "svg",
          name: "calendar",
          foreground: { r: 10, g: 10, b: 10, a: 1 },
          background: { r: 20, g: 24, b: 32, a: 1 },
          bbox: { x: 0, y: 0, width: 16, height: 16 },
        },
      ],
    }),
    ctx({ theme: "dark" }),
  );
  assert.equal(icon.length, 1);

  const missingPlaceholder = rule("controls.missing-placeholder").detect(
    snap({
      elements: [
        el({ controlKind: "input", inputType: "text", placeholder: "", labelled: false, text: "" }),
      ],
    }),
    ctx(),
  );
  assert.equal(missingPlaceholder.length, 1);

  const stuck = rule("overlays.off-center-modal").detect(
    snap({
      overlays: [
        {
          selector: '[role="dialog"]',
          role: "dialog",
          bbox: { x: 400, y: 0, width: 480, height: 320 },
          offscreen: false,
          hasClose: true,
        },
      ],
    }),
    ctx(),
  );
  assert.match(stuck[0].message, /top/);

  const dual = rule("scroll.dual-scrollbar").detect(
    snap({
      document: { ...snap().document, scrollHeight: 2000, innerHeight: 720, verticalScrollerCount: 1 },
    }),
    ctx(),
  );
  assert.equal(dual.length, 1);

  const sticky = rule("layout.sticky-covers-content").detect(
    snap({
      elements: [
        el({
          selector: "header",
          text: "Nav",
          styles: { ...el().styles, position: "sticky" },
          bbox: { x: 0, y: 0, width: 400, height: 48 },
        }),
        el({
          selector: "h1",
          text: "Orders",
          bbox: { x: 16, y: 20, width: 200, height: 32 },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(sticky.length, 1);

  const uneven = rule("layout.uneven-cards").detect(
    snap({
      elements: [
        el({ tag: "article", bbox: { x: 0, y: 0, width: 200, height: 80 } }),
        el({
          selector: "article:nth-of-type(2)",
          tag: "article",
          bbox: { x: 220, y: 0, width: 200, height: 140 },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(uneven.length, 1);

  const mixedTabs = rule("tabs.inconsistent-style").detect(
    snap({
      elements: [
        el({
          controlKind: "tab",
          background: { r: 20, g: 80, b: 180, a: 1 },
          styles: { ...el().styles, borderBottomWidth: "0px" },
        }),
        el({
          selector: '[role="tab"]:nth-of-type(2)',
          controlKind: "tab",
          background: { r: 255, g: 255, b: 255, a: 1 },
          styles: { ...el().styles, borderBottomWidth: "3px" },
        }),
      ],
    }),
    ctx(),
  );
  assert.equal(mixedTabs.length, 1);

  const blank = rule("empty.blank-region").detect(
    snap({ tables: [{ selector: "table", rowCount: 0, hasEmptyMarker: false, text: "" }] }),
    ctx(),
  );
  assert.equal(blank.length, 1);

  const drift = rule("theme.cross-mode-drift").detect(
    snap({
      elements: [el({ selector: "h1", styles: { ...el().styles, fontSize: "16px" } })],
    }),
    ctx({
      theme: "light",
      peerSnapshot: snap({
        elements: [el({ selector: "h1", styles: { ...el().styles, fontSize: "22px" } })],
      }),
    }),
  );
  assert.match(drift[0].message, /Font size/);
});
