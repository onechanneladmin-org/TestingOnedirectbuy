/**
 * Multi-project registry for the flow control plane.
 * Sibling Playwright repos are loaded by id; runs execute in that project's cwd.
 */
const fs = require("fs");
const path = require("path");
const { ROOT } = require("../config");

const PROJECTS_CONFIG = path.join(ROOT, "projects.config.json");

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveRoot(raw) {
  const value = String(raw || ".").trim();
  if (!value) return ROOT;
  if (path.isAbsolute(value)) return path.normalize(value);
  return path.resolve(ROOT, value);
}

function resolveFlowsConfig(entry, projectRoot) {
  const rel = String(entry.flowsConfig || "flows.config.json").trim();
  if (path.isAbsolute(rel)) return rel;
  if (entry.flowsConfigRelativeTo === "hub") {
    return path.join(ROOT, rel);
  }
  return path.join(projectRoot, rel);
}

function loadProjectsConfig() {
  const cfg = loadJson(PROJECTS_CONFIG);
  if (!cfg || !Array.isArray(cfg.projects) || cfg.projects.length === 0) {
    return {
      defaultProjectId: "onedirectbuy",
      projects: [
        {
          id: "onedirectbuy",
          name: "OneDirectBuy",
          root: ROOT,
          flowsConfig: path.join(ROOT, "flows.config.json"),
          available: true,
          runnable: true,
        },
      ],
    };
  }

  const projects = cfg.projects.map((entry) => {
    const id = String(entry.id || "").trim();
    const root = resolveRoot(entry.root);
    const flowsConfig = resolveFlowsConfig(entry, root);
    return {
      id,
      name: String(entry.name || id).trim(),
      root,
      flowsConfig,
      // Configured projects remain selectable in container deployments so
      // persisted flow catalogs can still be viewed without sibling repos.
      available: Boolean(id),
      runnable: Boolean(id && fs.existsSync(root)),
    };
  });

  const defaultProjectId =
    String(cfg.defaultProjectId || projects[0]?.id || "onedirectbuy").trim();

  return { defaultProjectId, projects };
}

function listProjects() {
  return loadProjectsConfig().projects;
}

function defaultProjectId() {
  return loadProjectsConfig().defaultProjectId;
}

function getProject(projectId) {
  const id = String(projectId || "").trim() || defaultProjectId();
  const found = listProjects().find((p) => p.id === id);
  if (!found) {
    const err = new Error(`Unknown project: ${id}`);
    err.status = 404;
    throw err;
  }
  return found;
}

function requireAvailableProject(projectId) {
  const project = getProject(projectId);
  if (!project.runnable) {
    const err = new Error(
      `Project folder not found: ${project.name} (${project.root})`,
    );
    err.status = 400;
    throw err;
  }
  return project;
}

function serializeProject(project) {
  return {
    id: project.id,
    name: project.name,
    available: project.available,
    runnable: project.runnable,
    root: project.root,
  };
}

module.exports = {
  PROJECTS_CONFIG,
  loadProjectsConfig,
  listProjects,
  defaultProjectId,
  getProject,
  requireAvailableProject,
  serializeProject,
};
