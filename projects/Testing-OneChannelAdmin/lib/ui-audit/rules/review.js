const { elementsOf, issue, parseCssColor } = require("./support");

const GENERIC = /^(click here|submit|ok|okay|here|button)$/i;

module.exports = [
  {
    id: "review.icon-only-control",
    category: "review",
    kind: "review",
    severity: "minor",
    description: "A control has an accessible name but no visible text, so icon meaning needs a person.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => el.controlKind === "button" && !String(el.text || "").trim() && String(el.name || "").trim())
        .slice(0, 8)
        .map((el) =>
          issue(el, {
            message: "REVIEW_REQUIRED: icon-only control. Confirm the icon is understandable without the accessible name.",
            expected: "icon meaning is obvious, or visible text accompanies it",
            actual: `accessible name "${el.name}" with no visible text`,
            confidence: 0.35,
          }),
        );
    },
  },
  {
    id: "review.generic-control-label",
    category: "review",
    kind: "review",
    severity: "minor",
    description: "A control label is generic and needs a product decision.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => el.interactive && GENERIC.test(String(el.name || el.text || "").trim()))
        .slice(0, 8)
        .map((el) =>
          issue(el, {
            message: "REVIEW_REQUIRED: generic control label. Confirm it says what will happen.",
            expected: "a specific action name",
            actual: String(el.name || el.text || "").trim(),
            confidence: 0.35,
          }),
        );
    },
  },
  {
    id: "review.gradient-text",
    category: "review",
    kind: "review",
    severity: "minor",
    description: "Gradient text needs a visual check for legibility.",
    detect(snapshot) {
      return elementsOf(snapshot)
        .filter((el) => {
          if (!el.text || !el.styles) return false;
          if (!String(el.styles.backgroundImage || "").includes("gradient")) return false;
          const fill = parseCssColor(el.styles.webkitTextFillColor);
          return !!fill && fill.a <= 0.2;
        })
        .slice(0, 4)
        .map((el) =>
          issue(el, {
            message: "REVIEW_REQUIRED: gradient text. Confirm it stays readable in both themes.",
            expected: "readable gradient text",
            actual: el.styles.backgroundImage,
            confidence: 0.3,
          }),
        );
    },
  },
];
