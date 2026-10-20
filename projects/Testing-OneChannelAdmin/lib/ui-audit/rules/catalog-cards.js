const { issue } = require("./support");
const { expectedFor, getReference } = require("../references");

function topMetricCards(cards) {
  const list = (cards || []).filter((card) => card && card.bbox && card.topRow !== false);
  if (!list.length) return [];
  const minY = Math.min(...list.map((card) => card.bbox.y));
  return list.filter((card) => card.bbox.y <= minY + 36);
}

function luminance(color) {
  if (!color) return 1;
  const channel = (value) => {
    const n = value / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

module.exports = [
  {
    id: "catalog.metric-card",
    category: "catalog",
    kind: "deterministic",
    severity: "major",
    description:
      "Only the top row of metric cards (dashboard KPI strip). Those cards follow the Fulfillment dash-metric pattern: ~108px tall, left accent, light text, value larger than label, equal row height. Icons are allowed. Cards lower on the page are not compared to this pattern.",
    detect(snapshot) {
      const cards = topMetricCards(snapshot.metricCards || []);
      if (!cards.length) return [];
      const ref = getReference("metric-card");
      const tokens = (ref && ref.tokens) || {
        height: 108,
        heightTol: 8,
        rowHeightSpreadMax: 8,
        valueFontMin: 20,
        labelFontMax: 16,
      };
      const findings = [];
      const heights = cards.map((card) => card.bbox.height);
      const minH = Math.min(...heights);
      const maxH = Math.max(...heights);

      for (const card of cards) {
        const problems = [];
        const h = card.bbox.height;
        if (Math.abs(h - tokens.height) > tokens.heightTol + 12) {
          problems.push(`height ${Math.round(h)}px (want ~${tokens.height}±${tokens.heightTol})`);
        }
        if (luminance(card.color) < 0.45) {
          problems.push("text is not light enough on dark surface");
        }
        if (card.hasLeftAccent === false && card.pattern === "dash-metric") {
          problems.push("missing left accent bar");
        }
        if (card.hasIcon && card.iconOnLeft === false) {
          problems.push("icon is not on the left of the text");
        }
        const valueFont = card.valueFontSize || 0;
        const labelFont = card.labelFontSize || 0;
        if (valueFont && labelFont && valueFont <= labelFont) {
          problems.push(`value font ${Math.round(valueFont)}px not larger than label ${Math.round(labelFont)}px`);
        }
        if (problems.length) {
          findings.push(
            issue(null, {
              element: `metric card "${card.lines?.[0] || card.text}"`,
              selector: card.selector,
              message: `Metric card does not match dash-metric reference: ${problems.join(", ")}`,
              expected: expectedFor("catalog.metric-card"),
              actual: problems.join("; "),
              referenceId: ref?.componentId,
            }),
          );
        }
      }

      if (cards.length >= 2 && maxH - minH > (tokens.rowHeightSpreadMax || 8)) {
        findings.push(
          issue(null, {
            element: "metric card row",
            selector: cards[0].selector,
            message: "Metric cards in the row are not equal height",
            expected: expectedFor("catalog.metric-card"),
            actual: `${Math.round(minH)}px to ${Math.round(maxH)}px`,
            referenceId: ref?.rowComponentId || ref?.componentId,
          }),
        );
      }

      return findings.slice(0, 16);
    },
  },
];
