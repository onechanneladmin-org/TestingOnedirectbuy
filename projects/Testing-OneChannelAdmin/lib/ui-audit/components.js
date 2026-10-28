/**
 * Component audit: finds every interactive component kind on the page (PrimeReact + native), checks
 * each statically (name/label, required marker, size, keyboard focus) and probes the first few of each
 * kind with SAFE interactions (open/close, type-then-restore, toggle-then-restore, sort, paginate).
 *
 * Never submits, never selects an option, never toggles controls inside table rows. Writes are also
 * aborted by the audit's network guard (tests/support/guard.js) when the page tries to save anyway.
 *
 * Returns { findings, coverage }:
 *   findings — ruleId "components.<kind>.<check>", same shape as the engine's findings
 *   coverage — { [kind]: { found, probed, failed } } for the page (written to components.json)
 */
const fs = require("fs");
const path = require("path");

/** kind → CSS selector (scoped to the page content; the app's left nav is excluded). */
const KINDS = {
  "text-input":
    "input.p-inputtext:not(.p-dropdown-label):not([role=combobox]):not(.p-autocomplete-input):not([type=password]):not(.p-inputnumber-input):not(.p-column-filter), input[type=text]:not(.p-inputtext), input[type=email], input[type=tel], input[type=url], input:not([type]):not(.p-inputtext)",
  "number-input": ".p-inputnumber",
  textarea: "textarea",
  password: ".p-password, input[type=password]",
  dropdown: ".p-dropdown",
  multiselect: ".p-multiselect",
  autocomplete: ".p-autocomplete",
  calendar: ".p-calendar, input[type=date], input[type=datetime-local]",
  checkbox: ".p-checkbox, input[type=checkbox]:not(.p-checkbox input):not([role=switch])",
  radio: ".p-radiobutton, input[type=radio]:not(.p-radiobutton input)",
  switch: ".p-inputswitch, [role=switch]",
  chips: ".p-chips",
  "file-upload": ".p-fileupload, input[type=file]",
  editor: ".p-editor-container, [contenteditable=true]",
  slider: ".p-slider, input[type=range]",
  "select-button": ".p-selectbutton, .p-togglebutton",
  accordion: ".p-accordion-header",
  "sortable-header": ".p-sortable-column",
  "column-filter": ".p-column-filter-menu-button",
  paginator: ".p-paginator",
  "split-button": ".p-splitbutton",
  "menu-button": "button[aria-haspopup=true]:not(.p-column-filter-menu-button), button[aria-haspopup=menu]",
  "icon-button": "button.p-button-icon-only, button:not(:has(*:not(i):not(svg):not(span.p-button-icon)))",
  tree: ".p-tree, .p-treetable",
  breadcrumb: ".p-breadcrumb, nav[aria-label*=breadcrumb i]",
};

/** Kinds whose controls get an accessible-name / label check. */
const NEEDS_NAME = new Set([
  "text-input", "number-input", "textarea", "password", "dropdown", "multiselect", "autocomplete",
  "calendar", "checkbox", "radio", "switch", "chips", "file-upload", "editor", "slider", "icon-button",
  "menu-button", "column-filter",
]);

const PER_KIND_PROBES = Number(process.env.UX_COMPONENT_PROBES || 2);
const PANEL = ".p-dropdown-panel, .p-multiselect-panel, .p-autocomplete-panel, .p-datepicker:not(.p-datepicker-inline), .p-column-filter-overlay, .p-menu-overlay, .p-tieredmenu-overlay, .p-contextmenu, .p-overlaypanel, [role=listbox], [role=menu], [role=dialog].p-datepicker";

function finding(kind, check, severity, el, message, expected, actual) {
  return {
    ruleId: `components.${kind}.${check}`,
    kind: "deterministic",
    severity,
    category: "components",
    element: el ? `${kind} "${el.name || el.label || el.sel}"` : kind,
    selector: el ? `[data-ux-cmp="${el.id}"]` : "",
    message,
    expected,
    actual,
  };
}

/** Tag + describe every visible component in the page content (runs in the browser). */
/** Kinds whose root wraps many parts — a disabled part does not disable the whole. */
const CONTAINER_KINDS = new Set(["paginator", "accordion", "breadcrumb", "tree", "select-button"]);

/**
 * App chrome present on every page: left nav (with its "Search menu" box), top bar (org switcher,
 * bell …) and the AI chat drawer. Excluded from page inventories and audited once by
 * global-chrome.spec.js (rootSelector: CHROME_SELECTOR).
 */
const CHROME_SELECTOR = '.oneca-app-top, aside[aria-label="Home navigation"], nav[aria-label="Home navigation"]';

async function inventory(page, rootSelector = "") {
  return page.evaluate(({ kinds, rootSelector, containers, chromeSelector }) => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0.05;
    };
    // Whole document minus the app chrome (the first <main> in this app is the chat drawer, not the
    // page content), or the visible matches of rootSelector (an open dialog / sidebar, or the chrome).
    const chrome = [...document.querySelectorAll(chromeSelector)];
    const roots = rootSelector ? [...document.querySelectorAll(rootSelector)].filter(visible) : [document.body];
    if (!roots.length) return [];
    const excluded = (el) => rootSelector !== chromeSelector && chrome.some((c) => c.contains(el) && !roots.some((r) => c.contains(r)));
    document.querySelectorAll("[data-ux-cmp]").forEach((el) => el.removeAttribute("data-ux-cmp"));
    const text = (el) => (el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) : "");
    const control = (el) => el.matches("input, textarea, select, button, [role=switch], [contenteditable=true]") ? el : el.querySelector("input:not([type=hidden]), textarea, [role=combobox], [role=switch], [role=slider], [role=checkbox], [role=radio], button, [tabindex]") || el;
    const nameOf = (el) => {
      const c = control(el);
      const aria = c.getAttribute("aria-label") || el.getAttribute("aria-label");
      if (aria && aria.trim()) return { name: aria.trim(), via: "aria-label" };
      const lb = c.getAttribute("aria-labelledby") || el.getAttribute("aria-labelledby");
      if (lb) {
        const t = lb.split(/\s+/).map((id) => text(document.getElementById(id))).join(" ").trim();
        if (t) return { name: t, via: "aria-labelledby" };
      }
      if (c.id) {
        const l = document.querySelector(`label[for="${CSS.escape(c.id)}"]`);
        if (l && text(l)) return { name: text(l), via: "label" };
      }
      const wrap = c.closest("label");
      if (wrap && text(wrap)) return { name: text(wrap), via: "label-wrap" };
      if (c.getAttribute("title")) return { name: c.getAttribute("title"), via: "title" };
      if (c.tagName === "BUTTON" && text(c)) return { name: text(c), via: "text" };
      const ph = c.getAttribute("placeholder");
      if (ph) return { name: ph, via: "placeholder" };
      return { name: "", via: "" };
    };
    // A label shown next to the field but not linked (common in this app: <label>Name</label><input>).
    const nearbyLabel = (el) => {
      const field = el.closest(".field, .p-field, .p-col, .p-col-12, [class*=col-], .p-fluid > div, div") || el.parentElement;
      const l = field && field.querySelector("label");
      return l && !l.contains(el) ? text(l) : "";
    };
    const out = [];
    const seen = new Set();
    for (const [kind, sel] of Object.entries(kinds)) {
      let n = 0;
      for (const el of roots.flatMap((r) => [...r.querySelectorAll(sel)])) {
        if (!visible(el) || excluded(el) || seen.has(el)) continue;
        if (kind === "icon-button" && (text(el) || !el.querySelector("i, svg, .p-button-icon"))) continue;
        if (kind === "checkbox" && el.closest(".p-multiselect-panel")) continue;
        seen.add(el);
        const id = `${kind}-${n++}`;
        el.setAttribute("data-ux-cmp", id);
        const r = el.getBoundingClientRect();
        const c = control(el);
        const nm = nameOf(el);
        const required = c.required || c.getAttribute("aria-required") === "true";
        const lblText = nm.via === "label" || nm.via === "label-wrap" ? nm.name : nearbyLabel(el);
        out.push({
          id,
          kind,
          name: nm.name,
          via: nm.via,
          nearbyLabel: nearbyLabel(el),
          required: !!required,
          requiredMarked: /\*|required/i.test(lblText || ""),
          w: Math.round(r.width),
          h: Math.round(r.height),
          // PrimeReact puts p-disabled on the inner box (.p-checkbox-box) as often as on the root.
          // Containers (paginator, accordion …) always hold some disabled part: judge only their root.
          disabled: containers.includes(kind)
            ? !!(el.classList.contains("p-disabled") || el.getAttribute("aria-disabled") === "true")
            : !!(c.disabled || el.classList.contains("p-disabled") || c.getAttribute("aria-disabled") === "true"
            || el.querySelector(".p-disabled, [aria-disabled=true], :disabled")),
          // Data rows only (never toggled); header cells (<thead>) are probed.
          inRow: !!el.closest("tbody") || (!!el.closest("[role=row]") && !el.closest("thead, [role=columnheader]")),
          inDialog: !!el.closest(".p-dialog, .p-sidebar, [role=dialog]"),
          sel: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${String(el.className || "").split(/\s+/).slice(0, 2).join(".")}`,
          accept: c.getAttribute && c.getAttribute("accept"),
          tooltip: el.getAttribute("data-pr-tooltip") || el.getAttribute("title") || "",
          prTooltip: !!el.getAttribute("data-pr-tooltip"),
        });
      }
    }
    return out;
  }, { kinds: KINDS, rootSelector, containers: [...CONTAINER_KINDS], chromeSelector: CHROME_SELECTOR });
}

/**
 * One finding per rule per page: 51 unnamed row checkboxes are ONE issue with a count, not 51.
 * The first offender keeps its selector (for the element screenshot); up to 3 examples are listed.
 */
function groupFindings(list) {
  const by = new Map();
  for (const f of list) {
    if (!by.has(f.ruleId)) by.set(f.ruleId, []);
    by.get(f.ruleId).push(f);
  }
  const out = [];
  for (const group of by.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const first = group[0];
    out.push({
      ...first,
      element: `${group.length} × ${first.element.split(" ")[0]}`,
      message: `${first.message} — ${group.length} controls on this page`,
      actual: `${group.length} controls, e.g. ${group.slice(0, 3).map((g) => g.element).join("; ")}`,
      count: group.length,
    });
  }
  return out;
}

function staticChecks(items) {
  return groupFindings(staticChecksEach(items));
}

function staticChecksEach(items) {
  const out = [];
  for (const el of items) {
    if (NEEDS_NAME.has(el.kind)) {
      if (!el.name) {
        out.push(finding(el.kind, "accessible-name", "major", el,
          `${el.kind} has no accessible name (no label, aria-label, title or placeholder)`,
          "Every control has a programmatic name (label for=, aria-label or aria-labelledby)", `no name; visible label nearby: "${el.nearbyLabel || "none"}"`));
      } else if (el.via === "placeholder" && !["icon-button", "menu-button"].includes(el.kind)) {
        out.push(finding(el.kind, "placeholder-as-label", "minor", el,
          `${el.kind} is named only by its placeholder "${el.name}"`,
          "A visible label linked to the field (placeholder disappears on typing)", `placeholder only${el.nearbyLabel ? `; unlinked label "${el.nearbyLabel}"` : ""}`));
      }
    }
    if (el.required && !el.requiredMarked && ["text-input", "number-input", "textarea", "dropdown", "multiselect", "calendar", "autocomplete"].includes(el.kind)) {
      out.push(finding(el.kind, "required-marker", "minor", el, "Required field has no visible required marker",
        "Required fields show * or 'required' in the label", "required but unmarked"));
    }
    const min = ["checkbox", "radio"].includes(el.kind) ? 16 : 24;
    if (!el.disabled && !["paginator", "breadcrumb", "tree", "accordion", "sortable-header"].includes(el.kind) && (el.w < min || el.h < min)) {
      out.push(finding(el.kind, "target-size", "minor", el, `${el.kind} is ${el.w}×${el.h}px`,
        `Target at least ${min}×${min}px (WCAG 2.5.8)`, `${el.w}×${el.h}px`));
    }
    if (el.kind === "file-upload" && !el.accept) {
      out.push(finding(el.kind, "accept-types", "minor", el, "File input does not limit accepted file types",
        "accept= lists the allowed types (e.g. .csv, image/*)", "no accept attribute"));
    }
    if (el.kind === "icon-button" && !el.tooltip && el.via !== "aria-label") {
      out.push(finding(el.kind, "tooltip", "minor", el, "Icon-only button has no tooltip or title",
        "Icon-only buttons explain themselves on hover (tooltip/title)", "no tooltip"));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------- probes

const loc = (page, el) => page.locator(`[data-ux-cmp="${el.id}"]`).first();
const anyPanel = (page) => page.locator(PANEL).filter({ visible: true });

async function focusVisible(page, el) {
  const l = loc(page, el);
  const target = l.locator("input:not([type=hidden]), textarea, [role=combobox], [tabindex]:not([tabindex='-1'])").first();
  const t = (await target.count()) ? target : l;
  return t
    .evaluate((node) => {
      node.focus({ focusVisible: true });
      const s = getComputedStyle(node);
      const p = node.closest(".p-dropdown, .p-multiselect, .p-inputnumber, .p-calendar, .p-autocomplete, .p-checkbox, .p-inputswitch") || node;
      const ps = getComputedStyle(p);
      const ring = (x) => (x.outlineStyle !== "none" && parseFloat(x.outlineWidth) > 0) || (x.boxShadow && x.boxShadow !== "none");
      return document.activeElement === node ? ring(s) || ring(ps) || p.classList.contains("p-focus") || p.classList.contains("p-inputwrapper-focus") : null;
    })
    .catch(() => null);
}

async function panelInViewport(page) {
  return anyPanel(page).first().evaluate((p) => {
    const r = p.getBoundingClientRect();
    return r.top >= -1 && r.left >= -1 && r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
  }).catch(() => true);
}

async function escCloses(page) {
  await page.keyboard.press("Escape");
  return anyPanel(page).first().waitFor({ state: "hidden", timeout: 2500 }).then(() => true, () => false);
}

/** One probe per kind; returns findings. Each probe leaves the page as it found it. */
const PROBES = {
  async "text-input"(page, el) {
    if (el.inRow) return [];
    const l = loc(page, el);
    const input = (await l.evaluate((n) => n.tagName)) === "INPUT" ? l : l.locator("input").first();
    if (await input.isDisabled().catch(() => true)) return [];
    if (!(await input.isEditable().catch(() => false))) return [];
    const before = await input.inputValue();
    const out = [];
    await input.click({ timeout: 3000 });
    await input.press("End");
    await input.pressSequentially("qa", { delay: 15 });
    const typed = await input.inputValue();
    if (!typed.endsWith("qa")) out.push(finding(el.kind, "accepts-typing", "major", el, "Typing into the field had no effect", "Typed text appears in the field", `value "${typed}"`));
    const ring = await focusVisible(page, el);
    if (ring === false) out.push(finding(el.kind, "focus-visible", "major", el, "No visible focus indicator", "Focused field shows an outline / ring", "none"));
    await input.fill(before);
    if (/search/i.test(el.name)) await input.press("Escape").catch(() => {});
    return out;
  },
  async textarea(page, el) {
    return PROBES["text-input"](page, { ...el });
  },
  async "number-input"(page, el) {
    if (el.inRow || el.disabled) return [];
    const input = loc(page, el).locator("input").first();
    if (!(await input.isEditable().catch(() => false))) return [];
    const before = await input.inputValue();
    const out = [];
    await input.click({ timeout: 3000 });
    await input.press("ControlOrMeta+a");
    await input.pressSequentially("ab12", { delay: 15 });
    const v = await input.inputValue();
    if (/[a-z]/i.test(v)) out.push(finding(el.kind, "rejects-letters", "major", el, "Number field accepted letters", "Only digits / separators are accepted", `value "${v}"`));
    if (!/12/.test(v)) out.push(finding(el.kind, "accepts-digits", "major", el, "Number field did not take digits", "Typed digits appear", `value "${v}"`));
    await input.press("ControlOrMeta+a");
    if (before) await input.pressSequentially(before.replace(/[^\d.,-]/g, ""), { delay: 10 });
    else await input.press("Delete");
    await input.blur();
    return out;
  },
  async password(page, el) {
    const out = [];
    const input = loc(page, el).locator("input").first().or(loc(page, el)).first();
    if ((await input.getAttribute("type").catch(() => "")) !== "password") {
      out.push(finding(el.kind, "masked", "major", el, "Password field is not masked", "type=password", "plain text"));
    }
    return out;
  },
  async dropdown(page, el) {
    if (el.inRow || el.disabled) return [];
    const l = loc(page, el);
    const out = [];
    await l.click({ timeout: 3000 });
    const opened = await anyPanel(page).first().waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
    if (!opened) return [finding(el.kind, "opens", "major", el, `${el.kind} did not open its panel on click`, "Click opens the options panel", "no panel")];
    const panel = anyPanel(page).first();
    const options = await panel.locator("[role=option], li.p-dropdown-item, li.p-multiselect-item, li.p-autocomplete-item").count();
    const empty = await panel.locator(".p-dropdown-empty-message, .p-multiselect-empty-message").count();
    if (!options && !empty) out.push(finding(el.kind, "options-or-empty", "major", el, "Opened panel shows no options and no empty message", "Options, or 'No results found'", "blank panel"));
    if (options > 10 && !(await panel.locator(".p-dropdown-filter, .p-multiselect-filter-container input, input[type=text]").count())) {
      out.push(finding(el.kind, "filter-long-list", "minor", el, `${options} options with no search box`, "Lists over 10 options are filterable", `${options} options, no filter`));
    }
    if (!(await panelInViewport(page))) out.push(finding(el.kind, "panel-in-viewport", "major", el, "Options panel opens partly off-screen", "Panel fully inside the viewport", "clipped"));
    if (!(await escCloses(page))) {
      out.push(finding(el.kind, "esc-closes", "major", el, "Esc does not close the options panel", "Esc closes the panel", "still open"));
      await l.click({ timeout: 2000 }).catch(() => {});
    }
    return out;
  },
  async multiselect(page, el) {
    return PROBES.dropdown(page, el);
  },
  async "column-filter"(page, el) {
    // Filter menu overlay: a field (input / dropdown / calendar) plus Apply & Clear — not an options list.
    const out = [];
    await loc(page, el).click({ timeout: 3000 });
    const overlay = page.locator(".p-column-filter-overlay").filter({ visible: true }).first();
    if (!(await overlay.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false))) {
      return [finding(el.kind, "opens", "major", el, "Column filter button did not open its filter menu", "Click opens the filter menu", "nothing")];
    }
    if (!(await overlay.locator("input, .p-dropdown, .p-multiselect, .p-calendar").count())) {
      out.push(finding(el.kind, "has-field", "major", el, "Filter menu has no field to filter by", "An input / dropdown / date field", "none"));
    }
    if (!(await overlay.getByRole("button", { name: /apply/i }).count())) {
      out.push(finding(el.kind, "apply-button", "minor", el, "Filter menu has no Apply button", "Apply and Clear buttons", "no Apply"));
    }
    if (!(await panelInViewport(page))) out.push(finding(el.kind, "panel-in-viewport", "major", el, "Filter menu opens partly off-screen", "Fully visible", "clipped"));
    await page.keyboard.press("Escape");
    if (!(await overlay.waitFor({ state: "hidden", timeout: 2000 }).then(() => true, () => false))) {
      out.push(finding(el.kind, "esc-closes", "major", el, "Esc does not close the filter menu", "Esc closes it", "still open"));
      // Toggle it shut with its own button (clicking elsewhere does not close it either).
      await loc(page, el).click({ timeout: 2000, force: true }).catch(() => {});
      if (await overlay.isVisible().catch(() => false)) {
        await overlay.getByRole("button", { name: /clear|close/i }).first().click({ timeout: 2000 }).catch(() => {});
      }
      await overlay.waitFor({ state: "hidden", timeout: 2000 }).catch(() => {});
    }
    return out;
  },
  async "menu-button"(page, el) {
    return PROBES.dropdown(page, el);
  },
  async "split-button"(page, el) {
    const l = loc(page, el).locator(".p-splitbutton-menubutton").first();
    if (!(await l.count())) return [];
    await l.click({ timeout: 3000 });
    const opened = await anyPanel(page).first().waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
    if (!opened) return [finding(el.kind, "opens", "major", el, "Split button menu did not open", "Menu opens", "no menu")];
    return (await escCloses(page)) ? [] : [finding(el.kind, "esc-closes", "major", el, "Esc does not close the menu", "Esc closes it", "still open")];
  },
  async autocomplete(page, el) {
    if (el.inRow || el.disabled) return [];
    const input = loc(page, el).locator("input").first();
    if (!(await input.isEditable().catch(() => false))) return [];
    const before = await input.inputValue();
    const out = [];
    await input.click({ timeout: 3000 });
    await input.pressSequentially("a", { delay: 30 });
    const opened = await anyPanel(page).first().waitFor({ state: "visible", timeout: 5000 }).then(() => true, () => false);
    if (!opened) {
      const btn = loc(page, el).locator(".p-autocomplete-dropdown");
      if (await btn.count()) {
        await btn.click().catch(() => {});
        const viaBtn = await anyPanel(page).first().waitFor({ state: "visible", timeout: 4000 }).then(() => true, () => false);
        if (!viaBtn) out.push(finding(el.kind, "suggests", "major", el, "Typing / the dropdown button shows no suggestions", "Suggestions or a 'no results' message", "nothing"));
      } else {
        out.push(finding(el.kind, "suggests", "minor", el, "Typing a letter shows no suggestions or no-results message", "Suggestions or 'No results'", "nothing"));
      }
    }
    if (opened && !(await escCloses(page))) out.push(finding(el.kind, "esc-closes", "major", el, "Esc does not close suggestions", "Esc closes them", "still open"));
    await input.fill(before).catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
    return out;
  },
  async calendar(page, el) {
    if (el.inRow || el.disabled) return [];
    const l = loc(page, el);
    const input = l.locator("input").first().or(l).first();
    const before = await input.inputValue().catch(() => "");
    const out = [];
    // A native <input type=date> opens the browser's own picker, which is not in the DOM: check it is
    // keyboard-operable instead (ArrowUp steps the focused segment), then restore the value.
    if (await input.evaluate((n) => /^(date|datetime-local|month|week|time)$/.test(n.type)).catch(() => false)) {
      await input.focus();
      await page.keyboard.press("ArrowUp");
      const after = await input.inputValue().catch(() => before);
      await input.fill(before).catch(() => {});
      return after === before && before
        ? [finding(el.kind, "keyboard-operable", "major", el, "Arrow keys do not change the native date field", "ArrowUp steps the focused date part", "unchanged")]
        : [];
    }
    await input.click({ timeout: 3000 });
    const picker = page.locator(".p-datepicker").filter({ visible: true }).first();
    const opened = await picker.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
    if (!opened) {
      const btn = l.locator(".p-datepicker-trigger");
      if (await btn.count()) await btn.click().catch(() => {});
    }
    if (!(await picker.isVisible().catch(() => false))) return [finding(el.kind, "opens", "major", el, "Date picker did not open", "Click opens the calendar", "no calendar")];
    const unnamed = await picker.locator("button").evaluateAll((bs) => bs.filter((b) => !(b.getAttribute("aria-label") || b.innerText || "").trim()).length);
    if (unnamed) out.push(finding(el.kind, "nav-buttons-named", "minor", el, `${unnamed} calendar buttons have no name`, "Prev/next month buttons have aria-labels", `${unnamed} unnamed`));
    const inView = await picker.evaluate((p) => { const r = p.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.top >= -1; });
    if (!inView) out.push(finding(el.kind, "panel-in-viewport", "major", el, "Date picker opens partly off-screen", "Fully visible", "clipped"));
    await page.keyboard.press("Escape");
    const closed = await picker.waitFor({ state: "hidden", timeout: 2500 }).then(() => true, () => false);
    if (!closed) {
      out.push(finding(el.kind, "esc-closes", "major", el, "Esc does not close the date picker", "Esc closes it", "still open"));
      await page.mouse.click(5, 5);
    }
    if ((await input.inputValue().catch(() => before)) !== before) {
      out.push(finding(el.kind, "unchanged-on-dismiss", "major", el, "Opening and dismissing the picker changed the date", "Value unchanged when dismissed", "changed"));
      await input.fill(before).catch(() => {});
    }
    return out;
  },
  async checkbox(page, el) {
    if (el.inRow || el.disabled) return [];
    // On list pages a checkbox / switch is a filter or a live setting ("Shared with me", "Active"):
    // toggling it changes the data under test or saves. Toggle only inside dialogs / forms.
    if (!el.inDialog) {
      const ring = await focusVisible(page, el);
      return ring === false ? [finding(el.kind, "focus-visible", "minor", el, "No visible focus indicator", "Focus ring when tabbed to", "none")] : [];
    }
    const l = loc(page, el);
    // PrimeReact shows state on the box (p-highlight / p-checkbox-checked / p-inputswitch-checked) and
    // not always on the hidden input: any signal counts.
    const state = () => l.evaluate((n) => {
      const i = n.matches("input") ? n : n.querySelector("input, [role=checkbox], [role=switch]");
      const box = n.querySelector(".p-checkbox-box, .p-inputswitch-slider, .p-radiobutton-box") || n;
      const on = !!(i && i.checked) || (i && i.getAttribute("aria-checked") === "true") || n.getAttribute("aria-checked") === "true"
        || box.classList.contains("p-highlight") || n.classList.contains("p-checkbox-checked") || n.classList.contains("p-inputswitch-checked")
        || !!n.querySelector(".p-checkbox-icon, .pi-check");
      return String(on);
    });
    const before = await state();
    await l.click({ timeout: 3000 });
    let after = await state();
    for (let i = 0; after === before && i < 5; i += 1) {
      await page.waitForTimeout(300);
      after = await state().catch(() => before);
    }
    const out = [];
    if (after === before) out.push(finding(el.kind, "toggles", "major", el, "Click did not change the state", "Click toggles checked/unchecked", `stays ${before}`));
    else await l.click({ timeout: 3000 }).catch(() => {});
    const ring = await focusVisible(page, el);
    if (ring === false) out.push(finding(el.kind, "focus-visible", "minor", el, "No visible focus indicator", "Focus ring when tabbed to", "none"));
    return out;
  },
  async switch(page, el) {
    return PROBES.checkbox(page, el);
  },
  async radio(page, el) {
    if (el.inRow || el.disabled) return [];
    const ring = await focusVisible(page, el);
    return ring === false ? [finding(el.kind, "focus-visible", "minor", el, "No visible focus indicator", "Focus ring when tabbed to", "none")] : [];
  },
  async chips(page, el) {
    if (el.inRow || el.disabled) return [];
    const input = loc(page, el).locator("input").first();
    const count = () => loc(page, el).locator(".p-chips-token").count();
    const before = await count();
    await input.click({ timeout: 3000 });
    await input.pressSequentially("qa-chip", { delay: 10 });
    await input.press("Enter");
    const added = (await count()) === before + 1;
    if (added) await input.press("Backspace");
    return added ? [] : [finding(el.kind, "adds-on-enter", "major", el, "Enter did not add a chip", "Typed value + Enter adds a chip", "no chip")];
  },
  async slider(page, el) {
    if (el.disabled) return [];
    const handle = loc(page, el).locator("[role=slider], .p-slider-handle").first().or(loc(page, el)).first();
    const val = () => handle.evaluate((n) => n.getAttribute("aria-valuenow") || n.value || "");
    const before = await val();
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    const after = await val();
    await page.keyboard.press("ArrowLeft");
    return after !== before ? [] : [finding(el.kind, "keyboard", "major", el, "Arrow keys do not move the slider", "ArrowRight/Left change the value", `stays ${before}`)];
  },
  async accordion(page, el) {
    const header = loc(page, el).locator("a, [role=button], button").first().or(loc(page, el)).first();
    const exp = () => header.getAttribute("aria-expanded");
    const before = await exp();
    await header.click({ timeout: 3000 });
    const after = await exp();
    if (after !== before) await header.click().catch(() => {});
    return after !== before ? [] : [finding(el.kind, "expands", "major", el, "Accordion header click did not change aria-expanded", "Click toggles the panel and aria-expanded", `stays ${before}`)];
  },
  async "sortable-header"(page, el) {
    const th = loc(page, el);
    const sortOf = () => th.getAttribute("aria-sort");
    const before = await sortOf();
    await th.click({ timeout: 3000 });
    await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
    const after = await sortOf();
    const out = [];
    if (after === before) out.push(finding(el.kind, "aria-sort", "major", el, "Clicking a sortable header does not update aria-sort", "aria-sort becomes ascending/descending", `stays ${before}`));
    // PrimeReact cycles none → asc → desc (→ none with removableSort): click until back to start (max 2).
    for (let i = 0; i < 2 && (await sortOf()) !== before; i += 1) await th.click().catch(() => {});
    return out;
  },
  async paginator(page, el) {
    const pg = loc(page, el);
    const next = pg.locator(".p-paginator-next");
    if (!(await next.count()) || (await next.isDisabled().catch(() => true)) || /p-disabled/.test((await next.getAttribute("class")) || "")) return [];
    const out = [];
    const current = () => pg.locator(".p-paginator-page.p-highlight, [aria-current=true], [aria-current=page]").first().innerText().catch(() => "");
    const firstRow = () => page.locator(".p-datatable tbody tr").first().innerText().catch(() => "");
    const [p0, r0] = [await current(), await firstRow()];
    await next.click({ timeout: 3000 });
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    const [p1, r1] = [await current(), await firstRow()];
    if (p1 === p0) out.push(finding(el.kind, "page-indicator", "major", el, "Next page did not change the current page indicator", "Current page number moves", `stays ${p0}`));
    if (r1 === r0) out.push(finding(el.kind, "rows-change", "major", el, "Next page shows the same first row", "Next page shows other rows", "same rows"));
    const unnamed = await pg.locator("button").evaluateAll((bs) => bs.filter((b) => !(b.getAttribute("aria-label") || b.innerText || "").trim()).length);
    if (unnamed) out.push(finding(el.kind, "buttons-named", "major", el, `${unnamed} paginator buttons have no name`, "First/prev/next/last have aria-labels", `${unnamed} unnamed`));
    await pg.locator(".p-paginator-prev").click().catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
    return out;
  },
  async "icon-button"(page, el) {
    // A native title shows a browser tooltip that is not in the DOM: only data-pr-tooltip must render one.
    if (!el.prTooltip || el.inRow) return [];
    await loc(page, el).hover({ timeout: 3000 });
    const shown = await page.locator(".p-tooltip, [role=tooltip]").filter({ visible: true }).first()
      .waitFor({ state: "visible", timeout: 1500 }).then(() => true, () => false);
    await page.mouse.move(2, 2);
    return shown ? [] : [finding(el.kind, "tooltip-shows", "minor", el, "Hovering the icon button shows no tooltip", `Tooltip "${el.tooltip}" appears on hover`, "nothing")];
  },
};

/**
 * Form probe (dialogs / sidebars only, read-only mode only): with required fields left empty, the
 * submit button must show field errors and must NOT send a save request. The network guard aborts
 * any save anyway, so nothing is ever written.
 */
async function probeEmptySubmit(page, rootSelector, items) {
  const root = page.locator(rootSelector).first();
  const required = items.filter((i) => i.required && !i.disabled);
  if (!required.length) return [];
  const submit = root.getByRole("button", { name: /^\W*(submit|save|create|add|update|apply|send)\b/i }).filter({ visible: true }).last();
  if (!(await submit.count())) return [];
  const emptyRequired = [];
  for (const el of required) {
    const v = await page.locator(`[data-ux-cmp="${el.id}"]`).first()
      .evaluate((n) => { const i = n.matches("input,textarea") ? n : n.querySelector("input,textarea"); return i ? i.value : (n.innerText || ""); })
      .catch(() => "x");
    if (!String(v).trim() || /^select/i.test(String(v).trim())) emptyRequired.push(el);
  }
  if (!emptyRequired.length) return [];
  const writes = [];
  const onReq = (r) => { if (!["GET", "HEAD", "OPTIONS"].includes(r.method()) && /onechanneladmin|onedirectbuy|localhost:3004/.test(r.url()) && !/\/(all[A-Z]\w*|get[A-Za-z]\w*|list\w*|search\w*|headers|filters?)\/?($|\?)|showcount=/.test(r.url())) writes.push(r.url().split("?")[0]); };
  page.on("request", onReq);
  await submit.click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  page.off("request", onReq);
  const shown = await page.evaluate((sel) => {
    const r = document.querySelector(sel) || document;
    const errs = r.querySelectorAll(".p-invalid, .p-error, small.p-error, [aria-invalid=true], :invalid");
    const toast = [...document.querySelectorAll(".p-toast-message")].some((t) => /error|required|invalid|missing/i.test(t.innerText || "") || t.classList.contains("p-toast-message-error"));
    return errs.length > 0 || toast;
  }, rootSelector).catch(() => false);
  const out = [];
  const el = emptyRequired[0];
  if (writes.length) {
    out.push(finding("form", "blocks-empty-required", "critical", el, `Form sent a save request with ${emptyRequired.length} required field(s) empty`,
      "Client blocks submit until required fields are filled", `request(s): ${[...new Set(writes)].slice(0, 2).join(", ")} (aborted by the audit guard)`));
  } else if (!shown) {
    out.push(finding("form", "shows-required-errors", "major", el, "Submitting with required fields empty shows no field error",
      "Each empty required field is flagged (red border / message)", `${emptyRequired.length} empty required field(s), no error shown`));
  }
  return out;
}

/** Probes that re-render the data grid. */
const GRID_KINDS = new Set(["sortable-header", "column-filter", "paginator"]);

/** Kinds that only get static checks (no safe interaction exists or it is covered elsewhere). */
const STATIC_ONLY = new Set(["file-upload", "editor", "select-button", "tree", "breadcrumb"]);

async function auditComponents(page, { reportDir, perKind = PER_KIND_PROBES, reload, rootSelector = "", surfaceName = "", formProbe = false } = {}) {
  const items = await inventory(page, rootSelector).catch(() => []);
  const findings = staticChecks(items);
  const coverage = {};
  for (const kind of Object.keys(KINDS)) coverage[kind] = { found: 0, probed: 0, failed: 0 };
  for (const el of items) coverage[el.kind].found += 1;

  // Probes must fail fast: a re-rendered grid detaches elements, and the default 15 s waits add up.
  page.setDefaultTimeout(4000);
  const byKind = {};
  for (const el of items) (byKind[el.kind] = byKind[el.kind] || []).push(el);
  // Grid probes (sort, filter, paginate) re-render the table and drop the data-ux-cmp tags: run them
  // last, and re-tag the page before each of them.
  const kinds = Object.keys(byKind).sort((a, b) => GRID_KINDS.has(a) - GRID_KINDS.has(b));
  for (const kind of kinds) {
    const probe = PROBES[kind];
    if (!probe || STATIC_ONLY.has(kind)) continue;
    for (let i = 0; i < perKind; i += 1) {
      let list = byKind[kind];
      if (GRID_KINDS.has(kind)) {
        // Earlier probes (e.g. a filter checkbox) may have reloaded the grid: let it settle first.
        await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => {});
        await page.locator(".p-datatable-loading-overlay, .p-datatable-loading-icon").first().waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
        list = (await inventory(page, rootSelector).catch(() => [])).filter((x) => x.kind === kind);
      }
      const el = list.filter((x) => !x.disabled && !x.inRow)[i];
      if (!el) break;
      // A probe may have closed the dialog (Esc): stop probing a surface that is gone.
      if (rootSelector && !(await page.locator(rootSelector).first().isVisible().catch(() => false))) break;
      try {
        const f = await probe(page, el);
        coverage[kind].probed += 1;
        if (f.length) coverage[kind].failed += 1;
        findings.push(...f);
      } catch (err) {
        // The probe could not drive the control (detached, covered …): report it, keep going.
        coverage[kind].probed += 1;
        coverage[kind].failed += 1;
        findings.push(finding(kind, "operable", "major", el, `Could not operate the ${kind}: ${String(err.message || err).split("\n")[0].slice(0, 160)}`,
          "The control can be clicked / typed into",
          (String(err.message || err).match(/<[^>]+> (intercepts pointer events|from <[^>]+> subtree intercepts pointer events)|element is (not visible|outside of the viewport|not enabled)/) || ["probe failed"])[0].slice(0, 200)));
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  }
  page.setDefaultTimeout(15000);
  if (formProbe && rootSelector && (await page.locator(rootSelector).first().isVisible().catch(() => false))) {
    findings.push(...(await probeEmptySubmit(page, rootSelector, items).catch(() => [])));
  }
  if (surfaceName) {
    for (const f of findings) {
      f.element = `${f.element} [${surfaceName}]`;
      f.message = `${f.message} (in ${surfaceName})`;
    }
  }
  // Leave the page exactly as the rest of the audit expects it.
  if (typeof reload === "function") await reload();
  if (reportDir) {
    try {
      fs.mkdirSync(reportDir, { recursive: true });
      fs.writeFileSync(path.join(reportDir, "components.json"), JSON.stringify({ coverage, items, findings }, null, 2));
    } catch {
      // reporting must never break the audit
    }
  }
  return { findings, coverage, items };
}

module.exports = { KINDS, CHROME_SELECTOR, auditComponents, staticChecks, groupFindings, inventory };
