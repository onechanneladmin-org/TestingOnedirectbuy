/**
 * Runs inside the page (page.evaluate). Returns a plain snapshot the rules read.
 * Kept dependency-free and serialisable.
 */
function collectSnapshot(opts) {
  const MAX = opts.maxElements || 1500;
  const PUA = /[-]/g; // icon-font glyphs

  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const blend = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const effectiveBg = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const s = getComputedStyle(node);
      if (s.backgroundImage && s.backgroundImage !== "none" && !/gradient/.test(s.backgroundImage)) return null; // text over image: skip
      const c = parse(s.backgroundColor);
      if (c && c.a > 0) {
        layers.push(c);
        if (c.a >= 1) break;
      }
      node = node.parentElement;
    }
    let out = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) out = blend(layers[i], out);
    return out;
  };
  const visible = (el, r, s) =>
    r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05 &&
    r.bottom > 0 && r.right > 0 && r.top < innerHeight * 6 && r.left < innerWidth;
  const sel = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; n && n.nodeType === 1 && i < 4; i += 1) {
      let p = n.tagName.toLowerCase();
      if (n.id) p += `#${n.id}`;
      const role = n.getAttribute("role");
      if (role) p += `[role=${role}]`;
      const label = n.getAttribute("aria-label");
      if (label) p += `[aria-label="${label.slice(0, 30)}"]`;
      parts.unshift(p);
      n = n.parentElement;
    }
    return parts.join(" > ");
  };
  const textOf = (el) => (el.innerText || el.textContent || "").replace(PUA, "").replace(/\s+/g, " ").trim();
  const accName = (el) => {
    const label = el.getAttribute("aria-label");
    if (label && label.replace(PUA, "").trim()) return label.trim();
    const lb = el.getAttribute("aria-labelledby");
    if (lb) {
      const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ").trim();
      if (t) return t;
    }
    const t = textOf(el);
    if (t) return t;
    if (el.getAttribute("title")) return el.getAttribute("title");
    const img = el.querySelector("img[alt], svg[aria-label], [role=img][aria-label]");
    if (img) return img.getAttribute("alt") || img.getAttribute("aria-label") || "";
    return "";
  };

  const texts = [];
  const controls = [];
  const images = [];
  const headings = [];
  const fonts = {};

  const all = document.querySelectorAll("body *");
  for (const el of all) {
    if (texts.length + controls.length > MAX) break;
    if (el.closest("[data-audit-ignore='*'], iframe")) continue;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (!visible(el, r, s)) continue;

    const role = el.getAttribute("role") || "";
    const tag = el.tagName;
    const isControl = tag === "BUTTON" || tag === "A" || role === "button" || role === "link" || role === "tab" ||
      role === "checkbox" || role === "radio" || role === "switch" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

    // Own text nodes only, so each run of text is counted once.
    const ownText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").replace(PUA, "").trim();
    if (ownText) {
      const family = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
      fonts[family] = (fonts[family] || 0) + 1;
      const fg = parse(s.color);
      const bg = effectiveBg(el);
      if (fg && bg) {
        const fgB = blend(fg, bg);
        const l1 = lum(fgB);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const size = parseFloat(s.fontSize);
        const weight = parseInt(s.fontWeight, 10) || (/bold|black|heavy|extrabold/i.test(family) ? 700 : /semibold/i.test(family) ? 600 : 400);
        texts.push({
          text: ownText.slice(0, 60),
          selector: sel(el),
          family,
          size,
          weight,
          color: s.color,
          bg: `rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,
          ratio: Math.round(ratio * 100) / 100,
          large: size >= 24 || (size >= 18.66 && weight >= 700),
          disabled: el.closest("[aria-disabled=true], [disabled]") != null,
        });
      }
    }

    if (isControl && !(tag === "INPUT" && el.type === "hidden")) {
      controls.push({
        tag,
        role,
        name: accName(el).slice(0, 80),
        selector: sel(el),
        width: Math.round(r.width),
        height: Math.round(r.height),
        bg: s.backgroundColor,
        color: s.color,
        radius: s.borderTopLeftRadius,
        disabled: el.matches("[disabled], [aria-disabled=true]"),
        nested: !!el.parentElement?.closest("button, a, [role=button], [role=link]"),
      });
    }

    if (tag === "IMG") {
      images.push({
        src: (el.currentSrc || el.src || "").slice(0, 160),
        alt: el.getAttribute("alt"),
        decorative: el.getAttribute("aria-hidden") === "true" || el.getAttribute("role") === "presentation",
        broken: el.complete && el.naturalWidth === 0,
        selector: sel(el),
      });
    }
    if (/^H[1-6]$/.test(tag) || role === "heading") {
      headings.push({
        level: Number(el.getAttribute("aria-level")) || Number(tag.slice(1)) || 0,
        text: textOf(el).slice(0, 60),
        family: s.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      });
    }
  }

  const doc = document.documentElement;
  return {
    url: location.href,
    title: document.title,
    lang: doc.getAttribute("lang") || "",
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: Math.max(doc.scrollWidth, document.body.scrollWidth),
    texts,
    controls,
    images,
    headings,
    fonts,
  };
}

module.exports = { collectSnapshot };
