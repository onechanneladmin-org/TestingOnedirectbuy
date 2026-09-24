const fs = require("fs");
const os = require("os");
const path = require("path");
const { expect, test } = require("@playwright/test");
const { uiAudit } = require("../../lib/ui-audit");

const fixtureDir = path.join(__dirname, "fixtures");
const cleanHtml = fs.readFileSync(path.join(fixtureDir, "clean.html"), "utf8");
const brokenHtml = fs.readFileSync(path.join(fixtureDir, "broken.html"), "utf8");

const viewport = { width: 1280, height: 720 };

test("clean page passes the CI gate", async ({ page }) => {
  await page.setContent(cleanHtml);
  const result = await uiAudit(page, {
    pageName: "Orders",
    theme: "light",
    viewport,
  });
  const gating = result.findings.filter(
    (finding) => finding.kind === "deterministic" || finding.kind === "visual",
  );
  expect(gating, JSON.stringify(gating, null, 2)).toEqual([]);
  expect(result.exitCode).toBe(0);
  expect(result.reportPaths.json).toBeTruthy();
  const saved = JSON.parse(fs.readFileSync(result.reportPaths.json, "utf8"));
  expect(saved.exitCode).toBe(0);
  for (const finding of result.findings) {
    expect(finding).toEqual(
      expect.objectContaining({
        ruleId: expect.any(String),
        category: expect.any(String),
        severity: expect.any(String),
        confidence: expect.any(Number),
        page: "Orders",
        message: expect.any(String),
        expected: expect.any(String),
        actual: expect.any(String),
        evidence: expect.objectContaining({
          url: expect.any(String),
          viewport,
          theme: "light",
        }),
      }),
    );
  }
});

test("broken fixture reports generalized rules and fails the gate", async ({ page }) => {
  await page.setContent(brokenHtml);
  const result = await uiAudit(page, {
    pageName: "Broken",
    theme: "dark",
    viewport,
    navigation: {
      probes: [{ selector: '[data-audit-id="orders-link"]', expectUrl: "#/orders" }],
    },
    interaction: {
      probes: [{ selector: '[data-audit-id="boom"]' }],
    },
  });
  const ids = result.findings.map((finding) => finding.ruleId);
  expect(ids, ids.join("\n")).toEqual(
    expect.arrayContaining([
      "scroll.horizontal-overflow",
      "layout.clipped-content",
      "layout.element-overlap",
      "layout.overflows-container",
      "responsive.wider-than-viewport",
      "a11y.contrast",
      "color.invisible-text",
      "forms.missing-label",
      "forms.placeholder-contrast",
      "controls.undersized-target",
      "controls.missing-name",
      "controls.missing-affordance",
      "controls.tab-without-tablist",
      "a11y.image-missing-alt",
      "a11y.document-language",
      "a11y.duplicate-id",
      "overlays.dialog-missing-name",
      "overlays.dialog-not-modal",
      "empty.missing-empty-state",
      "nav.placeholder-destination",
      "nav.unexpected-destination",
      "theme.mismatch",
      "interaction.obscured-target",
      "interaction.console-error",
      "typography.below-minimum",
      "review.icon-only-control",
    ]),
  );
  expect(result.exitCode).toBe(1);
  const overlap = result.findings.find((finding) => finding.ruleId === "layout.element-overlap");
  expect(overlap.evidence.boundingBox).toBeTruthy();
  expect(overlap.evidence.screenshot).toBeTruthy();
  expect(overlap.evidence.theme).toBe("dark");
  expect(overlap.evidence.viewport).toEqual(viewport);
});

test("exceptions remove intentional findings", async ({ page }) => {
  await page.setContent(brokenHtml);
  const result = await uiAudit(page, {
    pageName: "Broken",
    theme: "dark",
    viewport,
    exceptions: {
      entries: [{ ruleId: "a11y.contrast" }, { ruleId: "scroll.horizontal-overflow" }],
    },
  });
  const ids = result.findings.map((finding) => finding.ruleId);
  expect(ids).not.toContain("a11y.contrast");
  expect(ids).not.toContain("scroll.horizontal-overflow");
  expect(ids).toContain("layout.element-overlap");
});

test("additional rules run without editing the engine", async ({ page }) => {
  await page.setContent(cleanHtml);
  const result = await uiAudit(page, {
    pageName: "Orders",
    theme: "light",
    viewport,
    additionalRules: [
      {
        id: "custom.marker",
        category: "layout",
        kind: "deterministic",
        severity: "major",
        detect(snapshot) {
          const hit = (snapshot.elements || []).find((item) =>
            String(item.text || "").includes("selected seller"),
          );
          if (!hit) return [];
          return [
            {
              message: "Marker is present",
              element: hit.text,
              selector: hit.selector,
              expected: "absent",
              actual: "present",
              confidence: 1,
            },
          ];
        },
      },
    ],
  });
  expect(result.findings.map((finding) => finding.ruleId)).toContain("custom.marker");
  expect(result.exitCode).toBe(1);
});

test("visual reference check fails when the viewport changes", async ({ page }) => {
  const baseline = path.join(os.tmpdir(), `ui-audit-baseline-${Date.now()}.png`);
  const options = {
    pageName: "Visual",
    theme: "light",
    viewport: { width: 800, height: 600 },
    includeKinds: ["visual"],
    writeReport: false,
    visual: { baselinePath: baseline },
  };
  await page.setContent("<body style='margin:0;background:#fff'></body>");
  const created = await uiAudit(page, {
    ...options,
    visual: { ...options.visual, updateBaseline: true },
  });
  expect(created.exitCode).toBe(0);
  expect(fs.existsSync(baseline)).toBe(true);

  const same = await uiAudit(page, options);
  expect(same.findings.map((finding) => finding.ruleId)).not.toContain("visual.reference-diff");
  expect(same.exitCode).toBe(0);

  await page.setContent("<body style='margin:0;background:#c00000'></body>");
  const changed = await uiAudit(page, options);
  expect(changed.findings.map((finding) => finding.ruleId)).toContain("visual.reference-diff");
  expect(changed.exitCode).toBe(1);
});
