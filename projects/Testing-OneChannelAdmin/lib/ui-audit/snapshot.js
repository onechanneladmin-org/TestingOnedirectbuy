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

  function visibleLabel(el) {
    return textOf(el).replace(/\s+/g, " ").trim();
  }

  function isIconOrMenuButton(el, rect) {
    const label = visibleLabel(el);
    const cls = String(el.className || "");
    if (/pi-ellipsis|p-button-icon-only|icon-only|kebab|more-vert|overflow-menu/i.test(cls)) return true;
    if (el.querySelector(".pi-ellipsis-v, .pi-ellipsis-h, .pi-bars")) return true;
    const popup = el.getAttribute("aria-haspopup") || "";
    if (/^(menu|true)$/i.test(popup) && !/[a-z]{2,}/i.test(label)) return true;
    if (!/[a-z]{2,}/i.test(label)) return true;
    if (/^(more|options|menu|actions|overflow)$/i.test(label)) return true;
    if (rect && rect.height > 0 && rect.width / rect.height < 1.45) return true;
    return false;
  }

  function isDateRangeLabel(label) {
    return /^(today|yesterday|last 7 days|last 30 days|this week|this month|this year|custom|all time)$/i.test(
      String(label || "").trim(),
    );
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
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        borderRadius: style.borderRadius,
        gap: style.gap,
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
    let headerHeight = 0;
    let sampleRowHeight = 0;
    if (table.matches("table")) {
      const headRow = table.querySelector("thead tr") || table.querySelector("tr");
      if (headRow) headerHeight = headRow.getBoundingClientRect().height;
      const bodyRows = table.querySelector("tbody")
        ? [...table.querySelectorAll("tbody tr")]
        : [...table.querySelectorAll("tr")].filter((row) => !row.closest("thead"));
      rowCount = bodyRows.length;
      if (bodyRows[0]) sampleRowHeight = bodyRows[0].getBoundingClientRect().height;
    } else if (table.hasAttribute("data-audit-list")) {
      rowCount = table.querySelectorAll("[data-audit-row], li, [role=listitem], [role=row]").length;
    } else {
      const rows = [...table.querySelectorAll("[role=row]")];
      rowCount = rows.length;
      if (rows[0]) headerHeight = rows[0].getBoundingClientRect().height;
      if (rows[1]) sampleRowHeight = rows[1].getBoundingClientRect().height;
    }
    const region = table.parentElement || table;
    const regionText = textOf(region);
    const emptyText = /no data found|no available options|no records|nothing to show/i.test(
      regionText,
    );
    const parentRect = region.getBoundingClientRect();
    const parentStyle = getComputedStyle(region);
    const headerCells = [...table.querySelectorAll("th, [role=columnheader]")].slice(0, 8);
    const headerAligns = headerCells.map((cell) => getComputedStyle(cell).textAlign || "");
    const titleEl = region.querySelector("h1,h2,h3,h4,[class*=title]") || table.querySelector("caption");
    const headerEl = (() => {
      let node = table;
      for (let depth = 0; depth < 6 && node; depth += 1) {
        const parent = node.parentElement;
        if (!parent) break;
        const header = [...parent.children].find(
          (child) => child.classList && child.classList.contains("table-header"),
        );
        if (header) return header;
        node = parent;
      }
      return null;
    })();
    const headerRect = headerEl ? headerEl.getBoundingClientRect() : null;
    const scopeLeft = headerRect ? headerRect.left : rect.left;
    const scopeRight = headerRect ? headerRect.right : Math.min(rect.right, window.innerWidth);
    const toolbarButtons = [...document.querySelectorAll("button, [role=button]")]
      .filter((button) => {
        if (button.closest("aside, nav, .staff-chat-sidebar, tbody, thead, [role=row], .p-paginator")) return false;
        const box = button.getBoundingClientRect();
        if (box.width < 64 || box.height < 28 || box.height > 56) return false;
        if (isIconOrMenuButton(button, box)) return false;
        if (button.getAttribute("role") === "tab" || button.closest("[role=tablist], [role=tab]")) return false;
        if (box.bottom > rect.top + 8 || box.top < rect.top - 72) return false;
        if (box.right < scopeLeft + 8 || box.left > scopeRight + 8) return false;
        return true;
      })
      .slice(0, 8)
      .map((button) => {
        const box = button.getBoundingClientRect();
        return {
          name: accessibleName(button) || textOf(button),
          selector: selectorFor(button),
          x: Math.round(box.x),
          y: Math.round(box.y),
          right: Math.round(box.right),
          bottom: Math.round(box.bottom),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      });
    const pageTabs = [...document.querySelectorAll("[role=tab]")].filter((tab) => {
      if (tab.closest(".staff-chat-sidebar, aside")) return false;
      const box = tab.getBoundingClientRect();
      if (box.width < 24 || box.height < 16) return false;
      if (box.bottom > rect.top + 4 || box.top < rect.top - 160) return false;
      return box.right > scopeLeft && box.left < scopeRight;
    });
    const tabBar = pageTabs.length
      ? {
          top: Math.round(Math.min(...pageTabs.map((tab) => tab.getBoundingClientRect().top))),
          bottom: Math.round(Math.max(...pageTabs.map((tab) => tab.getBoundingClientRect().bottom))),
        }
      : null;
    const expectsFill =
      /100%|fill|flex/i.test(`${parentStyle.height} ${parentStyle.flexGrow} ${region.className || ""}`) ||
      (parseFloat(parentStyle.flexGrow) || 0) >= 1;
    tables.push({
      selector: selectorFor(table),
      rowCount,
      headerHeight: Math.round(headerHeight),
      sampleRowHeight: Math.round(sampleRowHeight),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      insetLeft: Math.round(rect.x - parentRect.x),
      insetRight: Math.round(parentRect.right - rect.right),
      topGap: Math.round(rect.y - parentRect.y),
      spaceBelow: Math.round(parentRect.bottom - rect.bottom),
      fillRatio: parentRect.height > 80 ? Math.round((rect.height / parentRect.height) * 100) / 100 : null,
      expectsFill,
      headerAligns,
      title: titleEl ? textOf(titleEl) : "",
      titleSelector: titleEl ? selectorFor(titleEl) : "",
      titleColor: titleEl ? parseColor(getComputedStyle(titleEl).color) : null,
      toolbarButtons,
      toolbarRight: Math.round(scopeRight),
      tabBar,
      paginationSelector: (() => {
        const pager = region.querySelector(
          ".p-paginator, [class*=pagination], [aria-label*=pagination i]",
        );
        return pager ? selectorFor(pager) : "";
      })(),
      hasEmptyMarker:
        emptyMarker(table) ||
        !!table.querySelector("[data-audit-empty], [role=status]") ||
        emptyMarker(region) ||
        emptyText,
      text: regionText,
    });
  });

  const overlays = [];
  document
    .querySelectorAll(
      "[role=dialog], [role=alertdialog], dialog, [aria-modal=true], [data-audit-drawer], .p-dialog, .p-sidebar, .p-drawer, .p-overlaypanel",
    )
    .forEach((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!visible(el, style, rect) || rect.width < 80 || rect.height < 80) return;
      const onScreen =
        rect.right > 8 &&
        rect.bottom > 8 &&
        rect.left < window.innerWidth - 8 &&
        rect.top < window.innerHeight - 8;
      if (!onScreen) return;
      if (el.getAttribute("aria-label") === "Home navigation") return;
      const cls = String(el.className || "");
      if (
        /\bp-dialog-mask\b|\bp-sidebar-mask\b|\bp-component-overlay\b/.test(cls) &&
        !/dialog/i.test(el.getAttribute("role") || "")
      ) {
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
      let kind = "modal";
      let role = el.getAttribute("role") || (el.tagName === "DIALOG" ? "dialog" : null);
      if (/\bp-sidebar\b|\bp-drawer\b|\bDrawer\b/.test(cls) || el.hasAttribute("data-audit-drawer")) {
        kind = "sidebar";
        role = role && role !== "complementary" ? role : "drawer";
      } else if (/\bp-overlaypanel\b|\bpopover\b/i.test(cls)) {
        kind = "popup";
        role = role || "dialog";
      } else {
        role = role || "dialog";
      }
      overlays.push({
        selector: selectorFor(el),
        role,
        kind,
        name,
        ariaModal: el.getAttribute("aria-modal") === "true" || el.tagName === "DIALOG" || kind === "modal",
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        borderRadius: style.borderRadius,
        offscreen: false,
        hasClose: !!el.querySelector(
          "[data-audit-close], button[aria-label*='close' i], button[aria-label*='dismiss' i], .p-dialog-header-close, .p-sidebar-close, .p-dialog-header-icons button, .p-sidebar-header button",
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

  function saturation(color) {
    if (!color || color.a < 0.2) return 0;
    const max = Math.max(color.r, color.g, color.b) / 255;
    const min = Math.min(color.r, color.g, color.b) / 255;
    if (max === 0) return 0;
    return (max - min) / max;
  }

  function paintedFill(el) {
    const style = getComputedStyle(el);
    const own = parseColor(style.backgroundColor);
    if (own && own.a > 0.5 && saturation(own) > 0.18) return own;
    const image = style.backgroundImage || "";
    const match = image.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i);
    if (match) {
      const parsed = parseColor(match[0]);
      if (parsed && saturation(parsed) > 0.18) return parsed;
    }
    const child = [...el.children].find((node) => node.nodeType === 1);
    if (child) {
      const childStyle = getComputedStyle(child);
      const childBg = parseColor(childStyle.backgroundColor);
      if (childBg && childBg.a > 0.5 && saturation(childBg) > 0.18) return childBg;
    }
    return own && own.a > 0.5 ? own : opaqueBackground(el);
  }

  function pushMetricCard(el, style, rect, pattern) {
    if (metricCards.length >= 40) return;
    const lines = (el.innerText || "")
      .split(/\n/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 4);
    if (lines.length < 1) return;
    const valueEl =
      el.querySelector("[class*=value], [class*=Value], h1, h2, h3, strong, b") || el;
    const labelEl =
      el.querySelector("[class*=label], [class*=Label], [class*=title], p, span") || el;
    const valueFont = parseFloat(getComputedStyle(valueEl).fontSize) || parseFloat(style.fontSize) || 0;
    const labelFont = parseFloat(getComputedStyle(labelEl).fontSize) || valueFont;
    const accent = el.querySelector(
      "[class*=accent], [class*=Accent], [class*=bar], [style*=border-left]",
    );
    const cs = getComputedStyle(el);
    const hasLeftAccent =
      !!accent ||
      (parseFloat(cs.borderLeftWidth) || 0) >= 2 ||
      /border-l|accent|dash-metric/i.test(String(el.className || ""));
    const icon = el.querySelector("svg,img,i,[class*=icon]");
    let iconOnLeft = null;
    let textOnRight = null;
    if (icon) {
      const iconRect = icon.getBoundingClientRect();
      const textHost = valueEl !== el ? valueEl : labelEl;
      const textRect = textHost.getBoundingClientRect();
      iconOnLeft = iconRect.x + iconRect.width / 2 < rect.x + rect.width * 0.45;
      textOnRight = textRect.x + 4 >= iconRect.x;
    }
    metricCards.push({
      selector: selectorFor(el),
      text: lines.join(" | ").slice(0, 120),
      lines,
      pattern: pattern || "generic",
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      background: opaqueBackground(el),
      color: parseColor(style.color),
      fontSize: style.fontSize,
      valueFontSize: valueFont,
      labelFontSize: labelFont,
      textAlign: style.textAlign,
      hasIcon: !!icon,
      iconOnLeft,
      textOnRight,
      hasLeftAccent,
      borderColor: parseColor(style.borderTopColor),
      borderWidth: parseFloat(style.borderTopWidth) || 0,
    });
  }

  const metricCards = [];
  document
    .querySelectorAll("#dashboard-new, .dash-metric, [class~='metric-card'], [class*='stat-card'], [class*='MetricCard']")
    .forEach((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!visible(el, style, rect)) return;
      if (rect.width < 90 || rect.width > 520 || rect.height < 56 || rect.height > 240) return;
      if (el.closest(".dash-metric-value, .dash-metric-label, .dash-metric-icon, .dash-metric-copy")) return;
      const pattern = el.id === "dashboard-new" || el.closest("#dashboard-top-container") ? "top-card" : "dash-metric";
      pushMetricCard(el, style, rect, pattern);
    });

  if (metricCards.length) {
    const minY = Math.min(...metricCards.map((card) => card.bbox.y));
    const topRow = metricCards.filter((card) => card.bbox.y <= minY + 36);
    metricCards.length = 0;
    for (const card of topRow) {
      card.topRow = true;
      metricCards.push(card);
    }
  }

  const primaryButtons = [];
  const headerActions = [];
  document.querySelectorAll("button,a,[role=button]").forEach((el) => {
    if (headerActions.length >= 40) return;
    if (el.closest("aside, nav, [class*=sidebar], [class*=SideBar], [class*=side-bar]")) return;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect) || rect.height < 32 || rect.height > 56 || rect.width < 64) return;
    if (rect.y > 180) return;
    if (isIconOrMenuButton(el, rect)) return;
    const name = visibleLabel(el) || accessibleName(el);
    if (isDateRangeLabel(name)) return;
    const bg = paintedFill(el);
    const radii = [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((value) => parseFloat(value) || 0);
    const radiusSource = Math.max(...radii);
    headerActions.push({
      selector: selectorFor(el),
      name,
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      background: bg,
      color: parseColor(style.color),
      fontSize: style.fontSize,
      borderRadius: `${radiusSource}px`,
      paddingX: (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0),
      paddingY: (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0),
      iconOnly: false,
    });
  });
  if (headerActions.length) {
    const minY = Math.min(...headerActions.map((button) => button.bbox.y));
    const row = headerActions.filter((button) => button.bbox.y <= minY + 16);
    row.sort((a, b) => b.bbox.x + b.bbox.width - (a.bbox.x + a.bbox.width));
    primaryButtons.push({ ...row[0], topRight: true });
  }

  const dropdowns = [];
  document
    .querySelectorAll("select,[role=combobox],button[aria-haspopup=listbox],.MuiSelect-select")
    .forEach((el) => {
      if (dropdowns.length >= 40) return;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!visible(el, style, rect)) return;
      if (el.closest(".p-paginator") || el.classList.contains("p-dropdown-trigger")) return;
      if (rect.width < 80 || rect.height < 28 || rect.height > 56) return;
      dropdowns.push({
        selector: selectorFor(el),
        name: accessibleName(el) || textOf(el),
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        fontSize: style.fontSize,
        paddingX: (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0),
        hasChevron: !!el.querySelector("svg,[class*=chevron],[class*=arrow]"),
      });
    });

  const tabs = [];
  document.querySelectorAll("[role=tab], .MuiTab-root").forEach((el) => {
    if (tabs.length >= 40) return;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect)) return;
    if (rect.width < 24 || rect.height < 20) return;
    const bg = opaqueBackground(el);
    const filled =
      saturation(bg) > 0.08 && bg.a > 0.4 &&
      (bg.r + bg.g + bg.b) / 3 > 20;
    const underlined =
      (parseFloat(style.borderBottomWidth) || 0) >= 2 ||
      /underline/i.test(style.textDecorationLine || style.textDecoration || "");
    tabs.push({
      selector: selectorFor(el),
      name: accessibleName(el) || textOf(el),
      selected: el.getAttribute("aria-selected") === "true" || el.classList.contains("Mui-selected"),
      variant: underlined ? "underline" : filled ? "pill" : "plain",
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      borderBottomWidth: parseFloat(style.borderBottomWidth) || 0,
      textDecoration: style.textDecorationLine || style.textDecoration,
      background: bg,
      color: parseColor(style.color),
      fontSize: parseFloat(style.fontSize) || 0,
      fontWeight: style.fontWeight,
    });
  });

  // Soft pill tab groups (CRM-style) without role=tab
  document
    .querySelectorAll("[class*=tab], [class*=Tab]")
    .forEach((group) => {
      if (tabs.length >= 40) return;
      const style = getComputedStyle(group);
      const rect = group.getBoundingClientRect();
      if (!visible(group, style, rect)) return;
      if (rect.height < 32 || rect.height > 64 || rect.width < 160) return;
      const kids = [...group.children].filter((kid) => {
        const ks = getComputedStyle(kid);
        const kr = kid.getBoundingClientRect();
        return visible(kid, ks, kr) && kr.width > 40;
      });
      if (kids.length < 2) return;
      kids.slice(0, 8).forEach((kid) => {
        if (tabs.length >= 40) return;
        if (tabs.some((t) => t.selector === selectorFor(kid))) return;
        const ks = getComputedStyle(kid);
        const kr = kid.getBoundingClientRect();
        const bg = opaqueBackground(kid);
        const filled = saturation(bg) > 0.05 && (bg.r + bg.g + bg.b) / 3 > 25;
        tabs.push({
          selector: selectorFor(kid),
          name: textOf(kid),
          selected: filled || /active|selected|current/i.test(String(kid.className || "")),
          variant: "pill",
          bbox: { x: kr.x, y: kr.y, width: kr.width, height: kr.height },
          borderBottomWidth: parseFloat(ks.borderBottomWidth) || 0,
          textDecoration: ks.textDecorationLine || ks.textDecoration,
          background: bg,
          color: parseColor(ks.color),
          fontSize: parseFloat(ks.fontSize) || 0,
          fontWeight: ks.fontWeight,
        });
      });
    });

  const contentCards = [];
  document
    .querySelectorAll(
      ".top-card-div, [class*=top-card], [class*=MuiCard-root], [class*=content-card], [class*=widget-card]",
    )
    .forEach((el) => {
      if (contentCards.length >= 30) return;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!visible(el, style, rect)) return;
      if (rect.width < 200 || rect.height < 100) return;
      const titleEl = el.querySelector("h1,h2,h3,h4,[class*=title], [class*=Title]");
      const titleStyle = titleEl ? getComputedStyle(titleEl) : null;
      contentCards.push({
        selector: selectorFor(el),
        title: titleEl ? textOf(titleEl) : textOf(el).slice(0, 60),
        hasTitle: !!titleEl,
        titleSelector: titleEl ? selectorFor(titleEl) : "",
        titleColor: titleStyle ? parseColor(titleStyle.color) : null,
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        borderRadius: style.borderRadius,
        paddingX: (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0),
        paddingY: (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0),
        background: opaqueBackground(el),
        borderColor: parseColor(style.borderTopColor),
        borderWidth: parseFloat(style.borderTopWidth) || 0,
      });
    });

  const charts = [];
  document
    .querySelectorAll(
      ".recharts-responsive-container, .recharts-wrapper, [class*=chart-container], canvas",
    )
    .forEach((el) => {
      if (charts.length >= 20) return;
      const host =
        el.closest(".recharts-responsive-container, .recharts-wrapper, [class*=chart]") || el;
      if (charts.some((c) => c.selector === selectorFor(host))) return;
      const style = getComputedStyle(host);
      const rect = host.getBoundingClientRect();
      if (!visible(host, style, rect)) return;
      if (rect.width < 120 || rect.height < 80) return;
      // Skip tiny SVG icons misdetected as charts
      if (rect.width < 200 && rect.height < 120 && !host.querySelector(".recharts-surface")) return;
      const titleEl =
        host.querySelector("h1,h2,h3,h4,[class*=title],[class*=Title]") ||
        (host.parentElement &&
          host.parentElement.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > [class*=title]"));
      const titleStyle = titleEl ? getComputedStyle(titleEl) : null;
      const labelNodes = [...host.querySelectorAll(".recharts-text, text, .recharts-label")].filter((node) => {
        const box = node.getBoundingClientRect();
        return box.width > 2 && box.height > 2;
      });
      let labelOverlap = 0;
      const labelBoxes = labelNodes.slice(0, 24).map((node) => node.getBoundingClientRect());
      for (let i = 0; i < labelBoxes.length; i += 1) {
        for (let j = i + 1; j < labelBoxes.length; j += 1) {
          const a = labelBoxes[i];
          const b = labelBoxes[j];
          const overlapW = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapH = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapW > 3 && overlapH > 3) labelOverlap += 1;
        }
      }
      const numericLabels = labelNodes
        .map((node) => ({
          text: textOf(node),
          box: node.getBoundingClientRect(),
          color: parseColor(getComputedStyle(node).fill || getComputedStyle(node).color),
        }))
        .filter((item) => /\d/.test(item.text) && item.box.width > 8);
      const legendNodes = [...host.querySelectorAll(".recharts-legend-item-text, .recharts-legend-item")].slice(0, 8);
      charts.push({
        selector: selectorFor(host),
        name: titleEl ? textOf(titleEl) : textOf(host).slice(0, 60) || "chart",
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        background: opaqueBackground(host),
        hasLegend: !!host.querySelector(".recharts-legend-wrapper, [class*=legend]"),
        hasAxis: !!host.querySelector(".recharts-cartesian-axis, .recharts-xAxis, .recharts-yAxis"),
        isRecharts: !!host.querySelector(".recharts-surface") || /recharts/i.test(String(host.className || "")),
        title: titleEl ? textOf(titleEl) : "",
        titleSelector: titleEl ? selectorFor(titleEl) : "",
        titleColor: titleStyle ? parseColor(titleStyle.color) : null,
        labelOverlap,
        numericLabels: numericLabels.slice(0, 6).map((item) => ({
          text: item.text.slice(0, 40),
          centerOffset: Math.round(item.box.x + item.box.width / 2 - (rect.x + rect.width / 2)),
          color: item.color,
        })),
        legendSamples: legendNodes.map((node) => ({
          text: textOf(node).slice(0, 40),
          selector: selectorFor(node),
          foreground: parseColor(getComputedStyle(node).fill || getComputedStyle(node).color),
          background: opaqueBackground(node.parentElement || host),
        })),
      });
    });

  const searchInputs = [];
  document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio])").forEach((el) => {
    if (searchInputs.length >= 20) return;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect)) return;
    const ph = (el.getAttribute("placeholder") || "").toLowerCase();
    const cls = String(el.className || "").toLowerCase();
    const nameAttr = (el.getAttribute("name") || "").toLowerCase();
    if (!/search|filter|sku|order|upc|serial/.test(`${ph} ${cls} ${nameAttr}`)) return;
    searchInputs.push({
      selector: selectorFor(el),
      name: ph || accessibleName(el) || textOf(el),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      borderRadius: style.borderRadius,
      fontSize: style.fontSize,
    });
  });

  const datePills = [];
  document
    .querySelectorAll(
      ".home-date-pills, [class*=date-pills], [class*=date-pill], [class*=DatePill], .dashboard-select.home-date-pills",
    )
    .forEach((el) => {
      if (datePills.length >= 10) return;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!visible(el, style, rect)) return;
      if (rect.height < 28 || rect.height > 56 || rect.width < 160) return;
      const kids = [...el.querySelectorAll("button, [role=button], a")].filter((kid) => {
        const kr = kid.getBoundingClientRect();
        return kr.width > 40 && kr.height > 20 && Math.abs(kr.y - rect.y) < 20;
      });
      const sats = kids.map((kid) => saturation(opaqueBackground(kid)));
      const orderedSats = [...sats].sort((a, b) => a - b);
      const medianSat = orderedSats.length ? orderedSats[Math.floor(orderedSats.length / 2)] : 0;
      const activeCount = kids.filter((kid, index) => {
        if (/p-highlight|\bactive\b|\bselected\b/i.test(String(kid.className || ""))) return true;
        return sats[index] >= medianSat + 0.18;
      }).length;
      datePills.push({
        selector: selectorFor(el),
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        segmentCount: kids.length || el.children.length,
        activeCount,
      });
    });

  const sidebarNav = [];
  const sidebarHost =
    document.querySelector(
      "aside, [class*=sidebar], [class*=SideBar], [class*=side-bar]",
    ) || null;
  if (sidebarHost) {
    const hostStyle = getComputedStyle(sidebarHost);
    const hostRect = sidebarHost.getBoundingClientRect();
    if (visible(sidebarHost, hostStyle, hostRect)) {
      sidebarNav.push({
        kind: "sidebar",
        selector: selectorFor(sidebarHost),
        bbox: { x: hostRect.x, y: hostRect.y, width: hostRect.width, height: hostRect.height },
        hasSections: /HOME|APPS|SETTINGS|DASHBOARD/i.test(sidebarHost.innerText || ""),
      });
      [...sidebarHost.querySelectorAll("button, a, [role=button]")].forEach((el) => {
        if (sidebarNav.length >= 40) return;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (!visible(el, style, rect)) return;
        if (rect.height < 28 || rect.height > 64 || rect.width < 80) return;
        sidebarNav.push({
          kind: "nav-item",
          selector: selectorFor(el),
          name: accessibleName(el) || textOf(el),
          bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          hasIcon: !!el.querySelector("svg,img,i,[class*=icon]"),
          hasChevron: !!el.querySelector("[class*=chevron], [class*=arrow], svg"),
        });
      });
    }
  }

  const sectionSurfaces = [];
  document.querySelectorAll("[data-audit-section], main section, main > div > div").forEach((el) => {
    if (sectionSurfaces.length >= 30) return;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect) || rect.height < 80 || rect.width < 240) return;
    sectionSurfaces.push({
      selector: selectorFor(el),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      background: opaqueBackground(el),
    });
  });

  const sectionGaps = [];
  for (let i = 1; i < sectionSurfaces.length; i += 1) {
    const prev = sectionSurfaces[i - 1];
    const next = sectionSurfaces[i];
    const gap = next.bbox.y - (prev.bbox.y + prev.bbox.height);
    if (gap >= 0 && gap < 200) {
      sectionGaps.push({
        from: prev.selector,
        to: next.selector,
        gap: Math.round(gap),
      });
    }
  }

  const badges = [];
  document
    .querySelectorAll(
      "[class*=badge], [class*=status-chip], .MuiChip-root, .p-tag, .p-badge",
    )
    .forEach((el) => {
      if (badges.length >= 24) return;
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (!visible(el, style, rect)) return;
      if (rect.y < 80) return;
      if (el.closest("header, [class*=topbar], [class*=top-bar], [class*=navbar], aside")) return;
      if (rect.height < 14 || rect.height > 40 || rect.width < 20 || rect.width > 220) return;
      badges.push({
        selector: selectorFor(el),
        name: textOf(el).slice(0, 40),
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        fontSize: parseFloat(style.fontSize) || 0,
        fontWeight: style.fontWeight,
        borderRadius: style.borderRadius,
        background: opaqueBackground(el),
        color: parseColor(style.color),
        borderColor: parseColor(style.borderTopColor),
      });
    });

  const secondaryButtons = [];
  document.querySelectorAll("button, [role=button]").forEach((el) => {
    if (secondaryButtons.length >= 20) return;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect) || rect.height < 28 || rect.height > 56) return;
    if (isIconOrMenuButton(el, rect)) return;
    if (el.closest("aside, nav, .p-paginator, .staff-chat-sidebar, tbody, thead, [role=row]")) return;
    const bg = opaqueBackground(el);
    const border = parseFloat(style.borderTopWidth) || 0;
    const sat = saturation(bg);
    if (sat >= 0.28 && border < 1) return;
    secondaryButtons.push({
      selector: selectorFor(el),
      name: accessibleName(el) || textOf(el),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      background: bg,
      color: parseColor(style.color),
      borderWidth: border,
    });
  });

  const dateInputs = [];
  document
    .querySelectorAll(
      "input[type=date], .p-calendar, [class*=datepicker], [class*=date-picker], [class*=DatePicker], [class*=calendar]",
    )
    .forEach((el) => {
      if (dateInputs.length >= 12) return;
      const host = el.closest(".p-calendar, [class*=datepicker], [class*=DatePicker], [class*=calendar]") || el;
      if (dateInputs.some((item) => item.selector === selectorFor(host))) return;
      const style = getComputedStyle(host);
      const rect = host.getBoundingClientRect();
      if (!visible(host, style, rect) || rect.width < 40 || rect.height < 24) return;
      const input = host.matches("input") ? host : host.querySelector("input");
      const icon = host.querySelector("svg, i, button, [class*=icon], [class*=calendar]");
      dateInputs.push({
        selector: selectorFor(host),
        name: (input && (input.getAttribute("placeholder") || input.getAttribute("aria-label"))) || textOf(host).slice(0, 40),
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        hasIcon: !!icon && icon !== input,
        borderRadius: style.borderRadius,
      });
    });

  const sliders = [];
  document.querySelectorAll("input[type=range], [role=slider]").forEach((el) => {
    if (sliders.length >= 8) return;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (!visible(el, style, rect)) return;
    sliders.push({
      selector: selectorFor(el),
      name: accessibleName(el) || textOf(el).slice(0, 40),
      bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
    });
  });

  const scrollbars = [];
  document.querySelectorAll("main, [role=main], section, aside, div, [class*=scroll]").forEach((el) => {
    if (scrollbars.length >= 8) return;
    if (el === document.body || el === document.documentElement) return;
    const style = getComputedStyle(el);
    const canScroll =
      (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowX === "auto" || style.overflowX === "scroll") &&
      (el.scrollHeight > el.clientHeight + tol || el.scrollWidth > el.clientWidth + tol);
    if (!canScroll || el.clientHeight < 48) return;
    scrollbars.push({
      selector: selectorFor(el),
      scrollbarWidth: Math.max(0, el.offsetWidth - el.clientWidth),
      scrollbarColor: style.scrollbarColor || "",
      overflowY: style.overflowY,
    });
  });

  const contrastSamples = [];
  function pushSample(sample) {
    if (contrastSamples.length >= 24) return;
    if (!sample || !sample.selector) return;
    contrastSamples.push(sample);
  }
  for (const badge of badges) {
    pushSample({
      component: "badge",
      element: `badge "${badge.name || ""}"`,
      selector: badge.selector,
      foreground: badge.color,
      background: badge.background,
      fontSize: badge.fontSize,
      fontWeight: badge.fontWeight,
    });
  }
  for (const chart of charts) {
    for (const legend of chart.legendSamples || []) {
      pushSample({
        component: "chart-legend",
        element: `graph "${chart.name || "chart"}" legend "${legend.text || ""}"`,
        selector: legend.selector || chart.selector,
        foreground: legend.foreground,
        background: legend.background,
      });
    }
    for (const label of chart.numericLabels || []) {
      pushSample({
        component: "chart-value",
        element: `graph "${chart.name || "chart"}" value "${label.text || ""}"`,
        selector: chart.selector,
        foreground: label.color,
        background: chart.background || null,
      });
    }
  }

  const themeAttr = `${document.documentElement.getAttribute("data-theme") || ""} ${
    document.body.getAttribute("data-theme") || ""
  } ${document.documentElement.className || ""}`.toLowerCase();
  const bodyBg = opaqueBackground(document.body);
  const bodyLum = 0.2126 * bodyBg.r + 0.7152 * bodyBg.g + 0.0722 * bodyBg.b;
  let renderedTheme = "light";
  if (/\bdark\b/.test(themeAttr) && !/\blight\b/.test(themeAttr)) renderedTheme = "dark";
  else if (/\blight\b/.test(themeAttr) && !/\bdark\b/.test(themeAttr)) renderedTheme = "light";
  else renderedTheme = bodyLum < 140 ? "dark" : "light";

  const validationCoverage = {
    renderedTheme,
    present: {
      cards: contentCards.length + metricCards.length,
      tables: tables.length,
      charts: charts.length,
      tabs: tabs.length,
      badges: badges.length,
      calendars: dateInputs.length,
      overlays: overlays.length,
      sliders: sliders.length,
      scrollbars: scrollbars.length,
      primaryButtons: primaryButtons.length,
      secondaryButtons: secondaryButtons.length,
    },
  };

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
    metricCards,
    primaryButtons,
    dropdowns,
    tabs,
    contentCards,
    charts,
    searchInputs,
    datePills,
    sidebarNav,
    sectionSurfaces,
    sectionGaps,
    badges,
    secondaryButtons,
    dateInputs,
    sliders,
    scrollbars,
    contrastSamples,
    renderedTheme,
    validationCoverage,
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
  raw.renderedTheme = raw.renderedTheme || (raw.themeSignals.prefersDark ? "dark" : "light");
  raw.theme = options.theme || raw.renderedTheme;
  return raw;
}

module.exports = { collectInPage, collectSnapshot };
