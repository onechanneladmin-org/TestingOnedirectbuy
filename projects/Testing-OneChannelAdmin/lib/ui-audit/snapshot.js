/**
 * One browser pass that records geometry, computed style, and accessible names.
 * Rules run in Node against this snapshot so they can be unit tested.
 */

function collectInPage(limits) {
  const tol = limits.overflowTolerance || 2;
  const maxElements = limits.maxElements || 500;

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function selectorFor(el) {
    if (!el || el.nodeType !== 1) return "";
    const audit = el.getAttribute("data-audit-id");
    if (audit) return `[data-audit-id="${cssEscape(audit)}"]`;
    const role = el.getAttribute("role");
    const aria = el.getAttribute("aria-label");
    if (role && aria) return `[role="${cssEscape(role)}"][aria-label="${cssEscape(aria)}"]`;
    if (el.id && /^[A-Za-z][\w-]{0,80}$/.test(el.id)) return `#${cssEscape(el.id)}`;
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute("name");
    if (name && (tag === "input" || tag === "select" || tag === "textarea")) {
      return `${tag}[name="${cssEscape(name)}"]`;
    }
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && node !== document.body && depth < 4) {
      let nth = 1;
      let sib = node;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName === node.tagName) nth += 1;
      }
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${nth})`);
      node = node.parentElement;
      depth += 1;
    }
    return parts.join(" > ") || tag;
  }

  function parseColor(value) {
    if (!value || value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const match = String(value).match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/i,
    );
    if (!match) return null;
    let alpha = 1;
    if (match[4] != null) {
      alpha = String(match[4]).endsWith("%") ? parseFloat(match[4]) / 100 : parseFloat(match[4]);
    }
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: alpha };
  }

  function opaqueBackground(el) {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) layers.push(bg);
      if (bg && bg.a >= 0.98) break;
      node = node.parentElement;
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i -= 1) {
      const src = layers[i];
      const a = src.a;
      acc = {
        r: src.r * a + acc.r * (1 - a),
        g: src.g * a + acc.g * (1 - a),
        b: src.b * a + acc.b * (1 - a),
        a: 1,
      };
    }
    return acc;
  }

  function isAllowedScroll(el) {
    if (el.hasAttribute("data-audit-allow-scroll")) return true;
    let node = el.parentElement;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      if (node.hasAttribute("data-audit-allow-scroll")) return true;
      const style = getComputedStyle(node);
      const overflowX = style.overflowX;
      if (
        (overflowX === "auto" || overflowX === "scroll") &&
        node.scrollWidth > node.clientWidth + tol
      ) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.width <= window.innerWidth + tol) return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  function textOf(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180);
  }

  function textLength(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().length;
  }

  function emptyMarker(el) {
    if (!el) return false;
    if (el.hasAttribute("data-audit-empty") || el.getAttribute("role") === "status") return true;
    return /no (data|results|records|items|orders)|nothing to show|no matches/i.test(textOf(el));
  }

  function visible(el, style, rect) {
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    if (el.hasAttribute("hidden")) return false;
    if (rect.width < 1 && rect.height < 1) return false;
    return true;
  }

  function implicitRole(el) {
    const explicit = el.getAttribute("role");
    if (explicit) return explicit;
    const tag = el.tagName.toLowerCase();
    if (tag === "a" && el.hasAttribute("href")) return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "img") return "img";
    if (tag === "table") return "table";
    if (tag === "nav") return "navigation";
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "input") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "button" || type === "submit" || type === "reset") return "button";
      return "textbox";
    }
    return null;
  }

  function controlKind(el, role) {
    const tag = el.tagName.toLowerCase();
    if (role === "tab") return "tab";
    if (role === "option" || el.hasAttribute("data-audit-chip")) return "chip";
    if (tag === "button" || role === "button") return "button";
    if (tag === "a" || role === "link") return "link";
    if (tag === "select" || role === "combobox" || role === "listbox") return "dropdown";
    if (tag === "textarea" || tag === "input" || role === "textbox" || role === "searchbox") {
      return "input";
    }
    return null;
  }

  function isInteractive(el, role) {
    if (controlKind(el, role)) return true;
    return el.hasAttribute("tabindex") && el.getAttribute("tabindex") !== "-1";
  }

  function accessibleName(el) {
    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const parts = labelledby
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((node) => textOf(node));
      if (parts.length) return parts.join(" ").slice(0, 180);
    }
    const aria = el.getAttribute("aria-label");
    if (aria && aria.trim()) return aria.trim().slice(0, 180);
    if (el.labels && el.labels.length) return textOf(el.labels[0]);
    const wrapped = el.closest("label");
    if (wrapped && wrapped !== el) return textOf(wrapped);
    const alt = el.getAttribute("alt");
    if (alt && alt.trim()) return alt.trim();
    if (el.tagName === "BUTTON" || el.tagName === "A" || el.getAttribute("role") === "button") {
      return textOf(el);
    }
    return "";
  }

  function labelled(el) {
    if ((el.getAttribute("aria-label") || "").trim()) return true;
    if ((el.getAttribute("aria-labelledby") || "").trim()) return true;
    if (el.labels && el.labels.length) return true;
    if (el.closest("label")) return true;
    if (el.id && document.querySelector(`label[for="${cssEscape(el.id)}"]`)) return true;
    return false;
  }

  function inViewport(rect) {
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    );
  }

  function ancestorsOf(el) {
    const list = [];
    let node = el.parentElement;
    let depth = 0;
    while (node && node !== document.documentElement && depth < 8) {
      list.push(selectorFor(node));
      node = node.parentElement;
      depth += 1;
    }
    return list;
  }

  function pack(el) {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect)) return null;
    const role = implicitRole(el);
    const tag = el.tagName.toLowerCase();
    const parent = el.parentElement;
    const parentRect = parent
      ? parent.getBoundingClientRect()
      : { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    const interactive = isInteractive(el, role);
    let obscuredBy = null;
    if (interactive && inViewport(rect) && rect.width >= 8 && rect.height >= 8 && style.pointerEvents !== "none") {
      const cx = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
      const cy = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== el && !el.contains(top) && !top.contains(el)) {
        const forId = top.getAttribute && top.getAttribute("for");
        const labelForSelf = top.tagName === "LABEL" && forId && forId === el.id;
        if (!labelForSelf) obscuredBy = selectorFor(top);
      }
    }
    const headingMatch = /^H([1-6])$/.exec(el.tagName);
    const borderWidths = [
      style.borderTopWidth,
      style.borderRightWidth,
      style.borderBottomWidth,
      style.borderLeftWidth,
    ].map((value) => parseFloat(value) || 0);
    const outlineWidth = parseFloat(style.outlineWidth) || 0;
    const borderless =
      borderWidths.every((value) => value < 0.5) &&
      (style.outlineStyle === "none" || outlineWidth < 0.5) &&
      (!style.boxShadow || style.boxShadow === "none");
    const background = opaqueBackground(el);
    const parentBackground = parent ? opaqueBackground(parent) : background;
    let placeholderColor = null;
    if (tag === "input" || tag === "textarea") {
      placeholderColor = parseColor(getComputedStyle(el, "::placeholder").color);
    }
    return {
      selector: selectorFor(el),
      tag,
      role,
      name: accessibleName(el),
      text: textOf(el),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      client: {
        width: el.clientWidth,
        height: el.clientHeight,
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
      },
      parentBBox: {
        x: parentRect.x,
        y: parentRect.y,
        width: parentRect.width,
        height: parentRect.height,
      },
      parentSelector: parent ? selectorFor(parent) : "body",
      parentRole: parent ? implicitRole(parent) : null,
      styles: {
        color: style.color,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
        display: style.display,
        position: style.position,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        textOverflow: style.textOverflow,
        opacity: style.opacity,
        zIndex: style.zIndex,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftWidth: style.borderLeftWidth,
        outlineStyle: style.outlineStyle,
        boxShadow: style.boxShadow,
        pointerEvents: style.pointerEvents,
        webkitTextFillColor: style.getPropertyValue("-webkit-text-fill-color"),
        whiteSpace: style.whiteSpace,
      },
      foreground: parseColor(style.color),
      background,
      placeholderColor,
      placeholder: el.getAttribute("placeholder"),
      disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
      interactive,
      obscuredBy,
      auditIgnore: (el.getAttribute("data-audit-ignore") || "").split(/[\s,]+/).filter(Boolean),
      allowScroll: isAllowedScroll(el),
      href: el.getAttribute("href"),
      altPresent: tag === "img" ? el.hasAttribute("alt") : null,
      hasDimensions: tag === "img" ? el.hasAttribute("width") && el.hasAttribute("height") : null,
      headingLevel: headingMatch ? Number(headingMatch[1]) : null,
      inViewport: inViewport(rect),
      ancestors: ancestorsOf(el),
      controlKind: controlKind(el, role),
      inputType: (el.getAttribute("type") || "").toLowerCase() || null,
      labelled: labelled(el),
      selected: el.getAttribute("aria-selected") === "true",
      borderless,
      sameBackgroundAsParent: !!(
        parentBackground &&
        Math.abs(parentBackground.r - background.r) < 4 &&
        Math.abs(parentBackground.g - background.g) < 4 &&
        Math.abs(parentBackground.b - background.b) < 4
      ),
      tabindex: el.getAttribute("tabindex"),
    };
  }

  const seen = new Set();
  const elements = [];
  function add(el) {
    if (!el || seen.has(el) || elements.length >= maxElements) return;
    seen.add(el);
    const packed = pack(el);
    if (packed) elements.push(packed);
  }

  document
    .querySelectorAll(
      "a,button,input,select,textarea,img,table,article,section,h1,h2,h3,h4,h5,h6,label,p,li,td,th,dialog,[role],[data-audit-id],[data-audit-chip],[data-audit-list],[data-audit-ignore],[data-audit-allow-scroll]",
    )
    .forEach(add);

  let scanned = 0;
  for (const el of document.body.querySelectorAll("div,section,span,article")) {
    if (scanned > 2000 || elements.length >= maxElements) break;
    scanned += 1;
    if (seen.has(el)) continue;
    const rect = el.getBoundingClientRect();
    if (
      el.scrollWidth > el.clientWidth + tol ||
      el.scrollHeight > el.clientHeight + tol ||
      rect.width > window.innerWidth + tol ||
      rect.right > window.innerWidth + tol
    ) {
      add(el);
    }
  }

  let horizontalOverflow = false;
  if (document.documentElement.scrollWidth > window.innerWidth + tol) {
    let leaked = false;
    let count = 0;
    for (const el of document.body.querySelectorAll("*")) {
      if (count > 2500) {
        leaked = true;
        break;
      }
      count += 1;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.right > window.innerWidth + tol || rect.left < -tol) {
        if (!isAllowedScroll(el)) {
          leaked = true;
          break;
        }
      }
    }
    horizontalOverflow = leaked;
  }

  const rootStyle = getComputedStyle(document.documentElement);
  const bodyStyle = getComputedStyle(document.body);
  const locked = rootStyle.overflowY === "hidden" || bodyStyle.overflowY === "hidden";
  const taller = document.documentElement.scrollHeight > window.innerHeight + tol;
  let internalScroll = false;
  if (locked && taller) {
    for (const el of document.querySelectorAll("main, [role=main], [data-audit-allow-scroll]")) {
      const style = getComputedStyle(el);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + tol
      ) {
        internalScroll = true;
      }
    }
  }

  let verticalScrollerCount = 0;
  for (const el of document.querySelectorAll("main, [role=main], section, article, div, aside")) {
    if (verticalScrollerCount > 6) break;
    if (el === document.body || el === document.documentElement) continue;
    const style = getComputedStyle(el);
    if (
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + tol &&
      el.clientHeight > 80
    ) {
      verticalScrollerCount += 1;
    }
  }

  let nestedVerticalScroll = false;
  if (document.documentElement.scrollHeight > window.innerHeight + 40) {
    for (const el of document.querySelectorAll("main, [role=main]")) {
      const style = getComputedStyle(el);
      if (
        (style.overflowY === "auto" || style.overflowY === "scroll") &&
        el.scrollHeight > el.clientHeight + tol &&
        el.clientHeight > 120
      ) {
        nestedVerticalScroll = true;
      }
    }
  }

  const duplicateIds = [];
  const idCounts = new Map();
  document.querySelectorAll("[id]").forEach((el) => {
    if (!el.id) return;
    idCounts.set(el.id, (idCounts.get(el.id) || 0) + 1);
  });
  idCounts.forEach((count, id) => {
    if (count > 1) duplicateIds.push({ id, count });
  });

  const tables = [];
  document.querySelectorAll("table, [role=table], [data-audit-list]").forEach((table) => {
    const style = getComputedStyle(table);
    const rect = table.getBoundingClientRect();
    if (!visible(table, style, rect)) return;
    let rowCount = 0;
    if (table.matches("table")) {
      if (table.querySelector("tbody")) rowCount = table.querySelectorAll("tbody tr").length;
      else {
        rowCount = [...table.querySelectorAll("tr")].filter((row) => !row.closest("thead")).length;
      }
    } else if (table.hasAttribute("data-audit-list")) {
      rowCount = table.querySelectorAll("[data-audit-row], li, [role=listitem], [role=row]").length;
    } else {
      rowCount = table.querySelectorAll("[role=row]").length;
    }
    const region = table.parentElement || table;
    tables.push({
      selector: selectorFor(table),
      rowCount,
      hasEmptyMarker:
        emptyMarker(table) ||
        !!table.querySelector("[data-audit-empty], [role=status]") ||
        emptyMarker(region),
      text: textOf(region),
    });
  });

  const overlays = [];
  document
    .querySelectorAll("[role=dialog], [role=alertdialog], dialog, [aria-modal=true], [data-audit-drawer]")
    .forEach((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
        return;
      }
      const labelledby = el.getAttribute("aria-labelledby");
      let name = (el.getAttribute("aria-label") || "").trim();
      if (!name && labelledby) {
        name = labelledby
          .split(/\s+/)
          .map((id) => document.getElementById(id))
          .filter(Boolean)
          .map((node) => textOf(node))
          .join(" ");
      }
      const heading = el.querySelector("h1,h2,h3,h4,[role=heading]");
      if (!name && heading) name = textOf(heading);
      overlays.push({
        selector: selectorFor(el),
        role: el.getAttribute("role") || (el.tagName === "DIALOG" ? "dialog" : null),
        name,
        ariaModal: el.getAttribute("aria-modal") === "true" || el.tagName === "DIALOG",
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        offscreen:
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.right < 0 ||
          rect.left > window.innerWidth,
        hasClose: !!el.querySelector(
          "[data-audit-close], button[aria-label*='close' i], button[aria-label*='dismiss' i]",
        ),
      });
    });

  const icons = [];
  document.querySelectorAll("svg, [role=img]").forEach((el) => {
    if (icons.length >= 40) return;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect) || rect.width < 8 || rect.height < 8 || rect.width > 64) return;
    const parent = el.parentElement;
    icons.push({
      selector: selectorFor(el),
      name: (el.getAttribute("aria-label") || "").trim(),
      foreground: parseColor(style.color),
      background: parent ? opaqueBackground(parent) : opaqueBackground(document.body),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    });
  });

  const headings = [];
  document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]").forEach((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect)) return;
    const level = Number(el.getAttribute("aria-level") || (/^H([1-6])$/.exec(el.tagName) || [])[1]);
    headings.push({ level, text: textOf(el), selector: selectorFor(el) });
  });

  const main = document.querySelector("main, [role=main]");
  const mainInfo = main
    ? {
        selector: selectorFor(main),
        textLength: textLength(main),
        hasEmptyMarker: emptyMarker(main) || !!main.querySelector("[data-audit-empty], [role=status]"),
        hasHeading: !!main.querySelector("h1,h2,h3,[role=heading]"),
      }
    : null;

  const navEntry = performance.getEntriesByType("navigation")[0];
  let imagesMissingSize = 0;
  document.querySelectorAll("img").forEach((img) => {
    if (!img.hasAttribute("width") || !img.hasAttribute("height")) imagesMissingSize += 1;
  });

  return {
    htmlLang: document.documentElement.lang || "",
    document: {
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      horizontalOverflow,
      verticalUnreachable: locked && taller && !internalScroll,
      nestedVerticalScroll,
      verticalScrollerCount,
    },
    elements,
    tables,
    overlays,
    headings,
    icons,
    main: mainInfo,
    duplicateIds,
    themeSignals: {
      dataTheme:
        document.documentElement.getAttribute("data-theme") ||
        document.body.getAttribute("data-theme") ||
        "",
      colorScheme: getComputedStyle(document.documentElement).colorScheme || "",
      bodyBackground: opaqueBackground(document.body),
      bodyColor: parseColor(bodyStyle.color),
      prefersDark: window.matchMedia("(prefers-color-scheme: dark)").matches,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    },
    performance: {
      nodeCount: document.getElementsByTagName("*").length,
      imagesMissingSize,
      loadMs: navEntry ? Math.round(navEntry.loadEventEnd || navEntry.duration || 0) : 0,
    },
  };
}

async function collectSnapshot(page, options = {}) {
  const raw = await page.evaluate(collectInPage, {
    maxElements: options.maxElements || 500,
    overflowTolerance: options.overflowTolerancePx ?? 2,
  });
  const viewport = page.viewportSize() || options.viewport || { width: 1280, height: 720 };
  raw.url = page.url();
  raw.title = await page.title();
  raw.viewport = { width: viewport.width, height: viewport.height };
  raw.theme = options.theme || (raw.themeSignals.prefersDark ? "dark" : "light");
  return raw;
}

module.exports = { collectInPage, collectSnapshot };
