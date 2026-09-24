/**
 * WCAG relative luminance and contrast. Colors are { r, g, b, a } in 0–255 / 0–1.
 */

function channel(value) {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  if (!rgb) return 1;
  return (
    0.2126 * channel(rgb.r || 0) +
    0.7152 * channel(rgb.g || 0) +
    0.0722 * channel(rgb.b || 0)
  );
}

function blend(fg, bg) {
  const base = bg || { r: 255, g: 255, b: 255, a: 1 };
  const a = fg && fg.a != null ? fg.a : 1;
  const source = fg || { r: 0, g: 0, b: 0, a: 0 };
  return {
    r: source.r * a + base.r * (1 - a),
    g: source.g * a + base.g * (1 - a),
    b: source.b * a + base.b * (1 - a),
    a: 1,
  };
}

function contrastRatio(fg, bg) {
  if (!fg || !bg) return null;
  const top = blend(fg, bg);
  const lighter = Math.max(luminance(top), luminance(bg));
  const darker = Math.min(luminance(top), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function isLargeText(fontSizePx, fontWeight) {
  const weight = Number(fontWeight) || 400;
  if (fontSizePx >= 24) return true;
  return fontSizePx >= 18.66 && weight >= 700;
}

function parseCssColor(value) {
  if (!value || value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const match = String(value).match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i,
  );
  if (!match) return null;
  let alpha = 1;
  if (match[4] != null) {
    alpha = String(match[4]).endsWith("%")
      ? parseFloat(match[4]) / 100
      : parseFloat(match[4]);
  }
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: alpha,
  };
}

function isNeutral(rgb) {
  if (!rgb || rgb.a === 0) return true;
  return Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b) < 18;
}

module.exports = {
  blend,
  contrastRatio,
  isLargeText,
  isNeutral,
  luminance,
  parseCssColor,
};
