const path = require("path");
const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./middleware/auth");
const { CORS_ORIGINS } = require("./config");
const flowsRouter = require("./routes/flows");
const occurrencesRouter = require("./routes/occurrences");
const projectsRouter = require("./routes/projects");
const usecasesRouter = require("./routes/usecases");
const { seedFlows } = require("./services/seedFlows");

const PUBLIC_DIR = path.join(__dirname, "public");

function createApp() {
  const app = express();

  // Cross-origin access only for origins listed in CORS_ORIGINS (comma-separated).
  // The bundled UI is same-origin and needs no entry.
  app.use(
    cors({
      origin: (origin, cb) => cb(null, Boolean(origin) && CORS_ORIGINS.includes(origin)),
    }),
  );
  app.use(express.json({ limit: "10mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "onedirectbuy-flow-control" });
  });

  // UI static assets (no auth)
  app.use("/ui", express.static(PUBLIC_DIR));
  app.get("/", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
  app.get("/coverage", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "coverage.html"));
  });

  // API routes: bearer token required; refused (503) while API_TOKEN is unset
  const api = express.Router();
  api.use(requireAuth);

  api.get("/health", (_req, res) => {
    res.json({ ok: true, service: "onedirectbuy-flow-control" });
  });

  api.post("/seed", async (req, res, next) => {
    try {
      const projectId = req.body?.projectId
        ? String(req.body.projectId).trim()
        : undefined;
      const result = await seedFlows(projectId);
      res.json({
        upserted: result.upserted,
        flows: result.flows.map((f) => ({
          projectId: f.projectId,
          flowId: f.flowId,
          name: f.name,
          steps: (f.steps || []).length,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  api.use("/projects", projectsRouter);
  api.use("/flows", flowsRouter);
  api.use("/occurrences", occurrencesRouter);
  api.use("/usecases", usecasesRouter);

  app.use("/api", api);

  app.use((err, _req, res, _next) => {
    console.error("[api]", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return app;
}

module.exports = { createApp };
