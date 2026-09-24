const { issue, luminance } = require("./support");

module.exports = [
  {
    id: "theme.mismatch",
    category: "theme",
    kind: "deterministic",
    severity: "major",
    description: "The page background luminance does not match the requested theme.",
    detect(snapshot, ctx = {}) {
      const theme = ctx.options?.theme;
      if (!theme || !snapshot.themeSignals) return [];
      const limits = ctx.options?.exceptions?.theme || {};
      const darkMax = limits.darkMaxLuminance ?? 0.45;
      const lightMin = limits.lightMinLuminance ?? 0.62;
      const value = luminance(snapshot.themeSignals.bodyBackground);
      if (theme === "dark" && value > darkMax) {
        return [
          issue(null, {
            element: "body",
            selector: "body",
            hints: { styles: { backgroundColor: snapshot.themeSignals.bodyBackground }, bbox: null, auditIgnore: [] },
            message: "Body background is too light for the dark theme",
            expected: `luminance <= ${darkMax}`,
            actual: value.toFixed(2),
          }),
        ];
      }
      if (theme === "light" && value < lightMin) {
        return [
          issue(null, {
            element: "body",
            selector: "body",
            message: "Body background is too dark for the light theme",
            expected: `luminance >= ${lightMin}`,
            actual: value.toFixed(2),
          }),
        ];
      }
      return [];
    },
  },
  {
    id: "theme.attribute-conflict",
    category: "theme",
    kind: "deterministic",
    severity: "major",
    description: "data-theme disagrees with the theme passed to the audit.",
    detect(snapshot, ctx = {}) {
      const requested = ctx.options?.theme;
      const actual = snapshot.themeSignals && snapshot.themeSignals.dataTheme;
      if (!requested || !actual || actual === requested) return [];
      return [
        issue(null, {
          element: "document",
          selector: "html",
          message: "data-theme does not match the requested theme",
          expected: requested,
          actual,
        }),
      ];
    },
  },
];
