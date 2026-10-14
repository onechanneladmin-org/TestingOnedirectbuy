const { elementsOf, issue } = require("./support");

function matches(url, expected) {
  if (expected instanceof RegExp) return expected.test(String(url));
  return String(url).includes(String(expected));
}

function badHref(href) {
  if (href == null) return false;
  const value = String(href).trim().toLowerCase();
  return value === "" || value === "#" || value.startsWith("javascript:");
}

module.exports = [
  {
    id: "nav.placeholder-destination",
    category: "navigation",
    kind: "deterministic",
    severity: "major",
    description: "A link points at #, an empty href, or javascript:.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => el.controlKind === "link" && badHref(el.href))
        .slice(0, 12)
        .map((el) =>
          issue(el, {
            message: "Link has a placeholder destination",
            expected: "a real URL or hash route",
            actual: el.href == null ? "missing href" : String(el.href),
          }),
        );
    },
  },
  {
    id: "nav.unexpected-url",
    category: "navigation",
    kind: "deterministic",
    severity: "major",
    description: "The current URL does not match the caller's expected location.",
    detect(snapshot, ctx = {}) {
      const expected = ctx.options?.navigation?.expectUrl;
      if (!expected || matches(snapshot.url, expected)) return [];
      return [
        issue(null, {
          element: "document",
          selector: "html",
          message: "Page URL does not match the expected destination",
          expected: String(expected),
          actual: snapshot.url || "",
        }),
      ];
    },
  },
  {
    id: "nav.unexpected-destination",
    category: "navigation",
    kind: "deterministic",
    severity: "major",
    phase: "page",
    order: 10,
    description: "Activating a control lands on a different URL than expected.",
    async detect(snapshot, ctx = {}) {
      const probes = ctx.options?.navigation?.probes || [];
      if (!ctx.page || !probes.length) return [];
      const findings = [];
      for (const probe of probes) {
        const before = ctx.page.url();
        const selector = probe.selector;
        const action = { type: "click", selector: selector || "", name: probe.name || "" };
        try {
          const locator = selector
            ? ctx.page.locator(selector)
            : ctx.page.getByRole(probe.role || "link", { name: probe.name });
          await locator.click({ timeout: 3000 });
          await ctx.page.waitForTimeout(50);
        } catch (error) {
          findings.push(
            issue(null, {
              element: probe.name || selector || "link",
              selector: selector || "",
              message: "Navigation probe could not activate the control",
              expected: probe.expectUrl ? String(probe.expectUrl) : "click succeeds",
              actual: error.message,
              action,
            }),
          );
          continue;
        }
        const after = ctx.page.url();
        if (probe.expectUrl && !matches(after, probe.expectUrl)) {
          findings.push(
            issue(null, {
              element: probe.name || selector || "link",
              selector: selector || "",
              message: "Control navigated to an unexpected URL",
              expected: String(probe.expectUrl),
              actual: after,
              action,
            }),
          );
        }
        if (after !== before) {
          await ctx.page.goBack({ timeout: 2000 }).catch(async () => {
            await ctx.page.goto(before, { timeout: 2000 }).catch(() => {});
          });
        }
      }
      return findings;
    },
  },
];
