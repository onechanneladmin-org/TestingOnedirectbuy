const { elementsOf, issue } = require("./support");

module.exports = [
  {
    id: "interaction.obscured-target",
    category: "interaction",
    kind: "deterministic",
    severity: "major",
    description: "The center of a control is covered by another element.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => el.interactive && el.obscuredBy && !el.disabled)
        .slice(0, 12)
        .map((el) =>
          issue(el, {
            message: "Control is covered by another element",
            expected: "elementFromPoint at the center hits the control",
            actual: `covered by ${el.obscuredBy}`,
          }),
        );
    },
  },
  {
    id: "interaction.console-error",
    category: "interaction",
    kind: "deterministic",
    severity: "major",
    phase: "page",
    order: 30,
    description: "The page logged a console error during the audit, including optional probes.",
    async detect(_snapshot, ctx = {}) {
      const probes = ctx.options?.interaction?.probes || [];
      if (ctx.page) {
        for (const probe of probes) {
          try {
            await ctx.page.locator(probe.selector).click({ timeout: 3000 });
            await ctx.page.waitForTimeout(30);
          } catch (error) {
            return [
              issue(null, {
                element: probe.selector,
                selector: probe.selector,
                message: "Interaction probe failed",
                expected: "click succeeds",
                actual: error.message,
                action: { type: "click", selector: probe.selector },
              }),
            ];
          }
        }
      }
      const errors = (ctx.runtime && ctx.runtime.consoleErrors) || [];
      if (!errors.length) return [];
      return [
        issue(null, {
          element: "console",
          selector: "html",
          message: "Console error during audit",
          expected: "no console errors",
          actual: errors.slice(0, 3).join(" | "),
          action: probes.length
            ? { type: "click", selector: probes.map((probe) => probe.selector).join(",") }
            : { type: "audit" },
        }),
      ];
    },
  },
  {
    id: "interaction.page-error",
    category: "interaction",
    kind: "deterministic",
    severity: "critical",
    phase: "page",
    order: 31,
    description: "The page threw an uncaught exception.",
    async detect(_snapshot, ctx = {}) {
      const errors = (ctx.runtime && ctx.runtime.pageErrors) || [];
      if (!errors.length) return [];
      return [
        issue(null, {
          element: "pageerror",
          selector: "html",
          message: "Uncaught page exception",
          expected: "no page errors",
          actual: errors.slice(0, 3).join(" | "),
          action: { type: "audit" },
        }),
      ];
    },
  },
];
