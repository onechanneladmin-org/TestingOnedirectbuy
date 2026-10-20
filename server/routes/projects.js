const express = require("express");
const {
  listProjects,
  defaultProjectId,
  serializeProject,
} = require("../lib/projects");

const router = express.Router();

/** GET /api/projects — available automation projects for the switcher */
router.get("/", (_req, res) => {
  const projects = listProjects().map(serializeProject);
  res.json({
    defaultProjectId: defaultProjectId(),
    count: projects.length,
    projects,
  });
});

module.exports = router;
