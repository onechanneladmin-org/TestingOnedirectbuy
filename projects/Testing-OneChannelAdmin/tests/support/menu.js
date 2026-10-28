// Menu leaves the logged-in user can see, read from the 1CA menu source (navbar.menu.json).
//
// Visibility mirrors src/utils/Utils.js CommonNavbarMenu + src/utils/menuModules.js:
//   - permissions are augmented from org modules (Gold → read:gold, Restaurant → read:restaurant);
//   - "superadmin" sees every leaf;
//   - otherwise a leaf needs its permissions (every, or some when permissionType === "or")
//     and, when it has requiresModules, at least one of those org modules.
// If the app's rule changes, update this file (menu.test.js pins the behaviour).
const fs = require("fs");
const path = require("path");

// Snapshot of packages/admin-shell-config/src/navbar.menu.json from onechanneladmin-latest
// (commit de8e8e55). Refresh it when the 1CA menu changes; E2E_MENU_FILE points at a live copy.
const MENU_FILE = process.env.E2E_MENU_FILE || path.resolve(__dirname, "navbar.menu.json");

const ORG_MODULE_READ_PERMISSIONS = { Gold: "read:gold", Restaurant: "read:restaurant" };

function loadMenu(file = MENU_FILE) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function augmentPermissionsFromModules(permissions = [], modules = []) {
  const set = new Set(Array.isArray(permissions) ? permissions : []);
  for (const mod of Array.isArray(modules) ? modules : []) {
    if (ORG_MODULE_READ_PERMISSIONS[mod]) set.add(ORG_MODULE_READ_PERMISSIONS[mod]);
  }
  return [...set];
}

function leafVisible(leaf, permissions, modules) {
  if (permissions.includes("superadmin")) return true;
  const required = Array.isArray(leaf.requiresModules) ? leaf.requiresModules : [];
  if (required.length && !required.some((m) => modules.includes(m))) return false;
  const perms = Array.isArray(leaf.permissions)
    ? leaf.permissions
    : String(leaf.permissions ?? "").split(",").filter(Boolean);
  const fn = leaf.permissionType === "or" ? "some" : "every";
  return perms[fn]((p) => permissions.includes(p));
}

/**
 * @returns {{visible: object[], hidden: object[], external: object[]}} leaves with suite id attached;
 *   `visible` is deduped by path and limited to `suites` when given.
 */
function partitionLeaves(menu, { permissions = [], modules = [], suites = [] } = {}) {
  const perms = augmentPermissionsFromModules(permissions, modules);
  const mods = Array.isArray(modules) ? modules : [];
  const out = { visible: [], hidden: [], external: [] };
  const seen = new Set();
  for (const suite of menu.suites || []) {
    if (suites.length && !suites.includes(suite.id)) continue;
    for (const leaf of suite.leaves || []) {
      const item = { suite: suite.id, id: leaf.id, label: leaf.label, path: leaf.path, badge: leaf.badge };
      if (/^https?:\/\//i.test(leaf.path || "")) {
        out.external.push(item);
        continue;
      }
      if (!leafVisible(leaf, perms, mods)) {
        out.hidden.push(item);
        continue;
      }
      if (seen.has(leaf.path)) continue;
      seen.add(leaf.path);
      out.visible.push(item);
    }
  }
  return out;
}

/** Parse the JSON arrays the app keeps in localStorage ("permissions", "modules"). */
function parseStoredList(raw) {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

module.exports = { MENU_FILE, loadMenu, leafVisible, partitionLeaves, parseStoredList, augmentPermissionsFromModules };
