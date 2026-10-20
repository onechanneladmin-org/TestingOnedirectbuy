const { elementsOf, issue, px } = require("./support");

function peerControls(snapshot) {
  return elementsOf(snapshot).filter((el) => {
    if (!el.interactive || !el.inViewport || el.disabled || !el.bbox) return false;
    if (el.bbox.height < 28 || el.bbox.height > 56 || el.bbox.width < 64) return false;
    const label = String(el.text || "").trim();
    if (!/[a-z]{2,}/i.test(label)) return false;
    if (/^(more|options|menu|actions)$/i.test(label)) return false;
    return true;
  });
}

function groupByRow(items, yTol = 10) {
  const rows = [];
  const sorted = [...items].sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
  for (const item of sorted) {
    const row = rows.find((bucket) => Math.abs(bucket.y - item.bbox.y) <= yTol);
    if (row) row.items.push(item);
    else rows.push({ y: item.bbox.y, items: [item] });
  }
  return rows.filter((row) => row.items.length >= 2);
}

module.exports = [
  {
    id: "design.common-ux",
    category: "design",
    kind: "deterministic",
    severity: "major",
    description:
      "Flags uneven control height, misalignment, uneven gaps, padding drift, and unreadable type.",
    detect(snapshot) {
      const findings = [];
      const peers = peerControls(snapshot);
      const rows = groupByRow(peers);

      for (const row of rows.slice(0, 12)) {
        const heights = row.items.map((el) => el.bbox.height);
        const minH = Math.min(...heights);
        const maxH = Math.max(...heights);
        if (maxH - minH > 8) {
          findings.push(
            issue(row.items[0], {
              message: "Controls on the same row have uneven heights",
              expected: "peer control heights within 8px",
              actual: `${Math.round(minH)}px to ${Math.round(maxH)}px`,
            }),
          );
        }

        const centers = row.items.map((el) => el.bbox.y + el.bbox.height / 2);
        const minC = Math.min(...centers);
        const maxC = Math.max(...centers);
        if (maxC - minC > 8) {
          findings.push(
            issue(row.items[0], {
              message: "Controls on the same row are vertically misaligned",
              expected: "vertical centers within 6px",
              actual: `spread ${Math.round(maxC - minC)}px`,
            }),
          );
        }

        if (row.items.length >= 3) {
          const ordered = [...row.items].sort((a, b) => a.bbox.x - b.bbox.x);
          const gaps = [];
          for (let i = 1; i < ordered.length; i += 1) {
            const gap = ordered[i].bbox.x - (ordered[i - 1].bbox.x + ordered[i - 1].bbox.width);
            if (gap >= 0 && gap <= 48) gaps.push(gap);
          }
          if (gaps.length < 2) continue;
          const minG = Math.min(...gaps);
          const maxG = Math.max(...gaps);
          if (maxG - minG > 20 && minG >= 0) {
            findings.push(
              issue(ordered[0], {
                message: "Horizontal spacing between peer controls is uneven",
                expected: "gap spread within 20px",
                actual: `${Math.round(minG)}px to ${Math.round(maxG)}px`,
              }),
            );
          }
        }
      }

      const stacked = peers.filter((el) => el.bbox.width >= 120);
      const leftBuckets = [];
      for (const el of stacked) {
        const bucket = leftBuckets.find((item) => Math.abs(item.x - el.bbox.x) <= 6);
        if (bucket) bucket.items.push(el);
        else leftBuckets.push({ x: el.bbox.x, items: [el] });
      }
      for (const bucket of leftBuckets) {
        if (bucket.items.length < 3) continue;
        const xs = bucket.items.map((el) => el.bbox.x);
        if (Math.max(...xs) - Math.min(...xs) > 6) {
          findings.push(
            issue(bucket.items[0], {
              message: "Stacked controls do not share a left edge",
              expected: "left edges within 6px",
              actual: `spread ${Math.round(Math.max(...xs) - Math.min(...xs))}px`,
            }),
          );
        }
      }

      const buttons = snapshot.primaryButtons || [];
      if (buttons.length >= 2) {
        const pads = buttons.map((btn) => btn.paddingX || 0);
        if (Math.max(...pads) - Math.min(...pads) > 10) {
          findings.push(
            issue(null, {
              element: "primary buttons",
              selector: buttons[0].selector,
              message: "Primary button horizontal padding is inconsistent",
              expected: "padding-x spread within 10px",
              actual: `${Math.round(Math.min(...pads))}px to ${Math.round(Math.max(...pads))}px`,
            }),
          );
        }
      }

      const bodySizes = [];
      for (const el of elementsOf(snapshot)) {
        if (!el.text || el.text.length < 4 || !el.styles || !el.inViewport) continue;
        if (el.tag === "h1" || el.tag === "h2" || el.tag === "h3") continue;
        const size = px(el.styles.fontSize);
        if (size >= 10 && size <= 22) bodySizes.push(size);
      }
      const smallBody = bodySizes.filter((size) => size < 12);
      if (smallBody.length >= 3) {
        findings.push(
          issue(null, {
            element: "body text",
            selector: "body",
            message: "Body text falls below the readable 12–16px band",
            expected: "body text 12–16px",
            actual: `${smallBody.length} samples under 12px`,
          }),
        );
      }

      const gaps = snapshot.sectionGaps || [];
      if (gaps.length >= 2) {
        const values = gaps.map((item) => item.gap);
        if (Math.max(...values) - Math.min(...values) > 24) {
          findings.push(
            issue(null, {
              element: "sections",
              selector: gaps[0].from,
              message: "Vertical section spacing is uneven across the page",
              expected: "section gap spread within 24px",
              actual: `${Math.min(...values)}px to ${Math.max(...values)}px`,
            }),
          );
        }
      }

      return findings.slice(0, 24);
    },
  },
];
