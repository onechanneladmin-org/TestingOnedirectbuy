const { issue } = require("./support");

module.exports = [
  {
    id: "empty.missing-empty-state",
    category: "empty",
    kind: "deterministic",
    severity: "major",
    description: "A table or list has no rows and no empty-state message.",
    detect(snapshot) {
      return (snapshot.tables || [])
        .filter((table) => table.rowCount === 0 && !table.hasEmptyMarker)
        .map((table) =>
          issue(null, {
            element: "table",
            selector: table.selector,
            message: "Empty collection has no empty state",
            expected: "a status message or [data-audit-empty] when there are no rows",
            actual: "0 rows",
          }),
        );
    },
  },
  {
    id: "empty.blank-main",
    category: "empty",
    kind: "deterministic",
    severity: "major",
    description: "The main region has no content and no empty state.",
    detect(snapshot) {
      const main = snapshot.main;
      if (!main) return [];
      if (main.textLength >= 12 || main.hasEmptyMarker || main.hasHeading) return [];
      return [
        issue(null, {
          element: "main",
          selector: main.selector || "main",
          message: "Main region is blank",
          expected: "content, a heading, or an empty state",
          actual: `${main.textLength} characters`,
        }),
      ];
    },
  },
];
