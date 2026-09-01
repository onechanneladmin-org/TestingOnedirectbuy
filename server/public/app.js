const state = {
  flows: [],
  filter: "all",
  search: "",
  selectedFlowId: null,
  occurrenceId: null,
  pollTimer: null,
  token: localStorage.getItem("odb_api_token") || "",
};

const $ = (id) => document.getElementById(id);

function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function headers(json = true) {
  const h = {};
  if (json) h["Content-Type"] = "application/json";
  if (state.token) h.Authorization = `Bearer ${state.token}`;
  return h;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { ...headers(Boolean(opts.body)), ...(opts.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const msg = data?.error || data?.raw || res.statusText;
    throw new Error(msg);
  }
  return data;
}

function filteredFlows() {
  const q = state.search.trim().toLowerCase();
  return state.flows.filter((f) => {
    if (state.filter === "enabled" && !f.enabled) return false;
    if (state.filter === "disabled" && f.enabled) return false;
    if (!q) return true;
    const hay = [
      f.name,
      String(f.flowId),
      f.catalog,
      ...(f.tests || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function isSheetFlow(f) {
  return Boolean(f.catalog) || (f.steps || []).some((s) => s.module || s.useCase);
}

function flowIdSortKey(id) {
  const n = Number.parseFloat(id);
  return Number.isFinite(n) ? n : 0;
}

function sheetGroupOrder(f) {
  const named = String(f.name || "").match(/^(\d+)\./);
  if (named) return Number(named[1]);
  return flowIdSortKey(f.flowId);
}

function flowItemHtml(f) {
  const active = String(f.flowId) === String(state.selectedFlowId) ? "active" : "";
  return `
        <li>
          <button type="button" class="flow-item ${active}" data-id="${escapeAttr(f.flowId)}">
            <span class="name">${escapeHtml(f.name)}</span>
            <span class="meta">
              <span>#${escapeHtml(String(f.flowId))}</span>
              <span>${f.stepsTotal || 0} steps</span>
              <span>${f.enabled ? "enabled" : "off"}</span>
            </span>
          </button>
        </li>`;
}

function renderFlowList() {
  const list = $("flowList");
  const flows = filteredFlows();
  $("flowCount").textContent = `${flows.length} shown · ${state.flows.length} total`;

  if (!flows.length) {
    list.innerHTML = `<li class="flow-empty muted">No flows match that search.</li>`;
    return;
  }

  const sheet = flows
    .filter(isSheetFlow)
    .sort((a, b) => sheetGroupOrder(a) - sheetGroupOrder(b));
  const other = flows
    .filter((f) => !isSheetFlow(f))
    .sort((a, b) => flowIdSortKey(a.flowId) - flowIdSortKey(b.flowId));

  const section = (label, items) => {
    if (!items.length) return "";
    return `<li class="rail-group">${escapeHtml(label)}</li>${items
      .map(flowItemHtml)
      .join("")}`;
  };

  list.innerHTML = `${section("Sheet modules", sheet)}${section("Other flows", other)}`;

  list.querySelectorAll(".flow-item").forEach((btn) => {
    btn.addEventListener("click", () => selectFlow(btn.dataset.id));
  });
}

function hasSheetCatalog(flow) {
  return (flow?.steps || []).some((s) => s.module || s.useCase || s.priority);
}

function sheetStatusLabel(status) {
  if (!status || status === "pending") return "";
  if (status === "passed") return "pass";
  if (status === "failed" || status === "blocked") return "fail";
  if (status === "skipped") return "skip";
  return status;
}

function cleanIssueText(raw) {
  return String(raw || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\x1B\[[0-9;]*m/g, "")
    .replace(/\[(?:\d{1,3};)*\d{1,3}m/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function issuesForRow(stepId, occ) {
  const issues = occ?.liveIssues || [];
  const matched = issues.filter((issue) => {
    const id = String(issue.id || issue.step || "");
    return id === stepId || id.startsWith(`${stepId}-`) || id.startsWith(`${stepId}:`);
  });
  if (matched.length) {
    return cleanIssueText(
      matched
        .map((i) => i.evidence || i.message || i.title || i.marker || "issue")
        .join(" · "),
    ).slice(0, 280);
  }
  const step = (occ?.steps || []).find((s) => s.stepId === stepId);
  if (step?.error) return cleanIssueText(step.error).slice(0, 280);
  const label = sheetStatusLabel(step?.status);
  if (label === "pass") return "no issue";
  return "";
}

function renderUseCaseSheet(flow, occ) {
  const body = $("useCaseSheetBody");
  if (!body) return;
  const steps = flow?.steps || [];
  $("sheetRowCount").textContent = String(steps.length);
  const running = Boolean(occ);
  const testedBy = running ? "automation" : "";

  body.innerHTML = steps
    .map((s) => {
      const live = (occ?.steps || []).find((x) => x.stepId === s.stepId);
      const status = live?.status || "pending";
      const statusLabel = sheetStatusLabel(status);
      const issues = occ ? issuesForRow(s.stepId, occ) : "";
      return `
        <tr data-step="${escapeAttr(s.stepId)}">
          <td class="mono">${escapeHtml(s.stepId)}</td>
          <td>${escapeHtml(s.module || "")}</td>
          <td>${escapeHtml(s.actor || "")}</td>
          <td>${escapeHtml(s.useCase || s.title || "")}</td>
          <td class="desc">${escapeHtml(s.description || "")}</td>
          <td>${escapeHtml(s.priority || "")}</td>
          <td>${escapeHtml(s.automation || "Yes")}</td>
          <td>${escapeHtml(s.currentStatus || "")}</td>
          <td>${escapeHtml(testedBy)}</td>
          <td class="issues"><span class="issues-text" title="${escapeAttr(
            issues,
          )}">${escapeHtml(issues)}</span></td>
          <td class="status-cell"><span class="sheet-status ${escapeAttr(status)}">${escapeHtml(
            statusLabel,
          )}</span></td>
        </tr>`;
    })
    .join("");
}

function showFlowLayout(flow) {
  const sheet = hasSheetCatalog(flow);
  $("listLayout").classList.toggle("hidden", sheet);
  $("sheetLayout").classList.toggle("hidden", !sheet);
}

function selectFlow(flowId) {
  state.selectedFlowId = String(flowId);
  const flow = state.flows.find((f) => String(f.flowId) === state.selectedFlowId);
  renderFlowList();

  if (!flow) {
    $("emptyState").classList.remove("hidden");
    $("flowDetail").classList.add("hidden");
    return;
  }

  $("emptyState").classList.add("hidden");
  $("flowDetail").classList.remove("hidden");
  $("flowEyebrow").textContent = `Flow ${flow.flowId}`;
  $("flowTitle").textContent = flow.name;
  $("flowMeta").textContent = `${flow.tests?.length || 0} spec file(s) · ${
    flow.enabled ? "enabled" : "disabled in config"
  }`;
  $("stepCatalogCount").textContent = String(flow.steps?.length || 0);
  showFlowLayout(flow);

  if (hasSheetCatalog(flow)) {
    renderUseCaseSheet(flow, null);
    $("sheetIdleHint").classList.remove("hidden");
  } else {
    $("stepCatalog").innerHTML = (flow.steps || [])
      .map(
        (s) => `
      <li>
        <div>
          <span class="sid">${escapeHtml(s.stepId)}${
            s.dependsOn ? ` · after ${escapeHtml(s.dependsOn)}` : ""
          }</span>
          ${escapeHtml(s.title)}
        </div>
      </li>`,
      )
      .join("");
  }
}

function setLiveIdle() {
  $("runBadge").className = "status-pill idle";
  $("runBadge").textContent = "idle";
  $("liveEmpty").classList.remove("hidden");
  $("liveBody").classList.add("hidden");
  $("runProgress").classList.add("hidden");
  $("btnLoadReport").disabled = true;
  $("reportBody").innerHTML =
    '<p class="muted">Report appears when the occurrence finishes.</p>';
  const flow = state.flows.find((f) => String(f.flowId) === state.selectedFlowId);
  if (flow && hasSheetCatalog(flow)) {
    $("sheetIdleHint").classList.remove("hidden");
    renderUseCaseSheet(flow, null);
  }
}

function renderOccurrence(occ) {
  $("liveEmpty").classList.add("hidden");
  $("liveBody").classList.remove("hidden");
  $("runProgress").classList.remove("hidden");

  const status = occ.status || "idle";
  $("runBadge").className = `status-pill ${status}`;
  $("runBadge").textContent = status;

  const pct = occ.progress?.percent ?? 0;
  $("progressFill").style.width = `${pct}%`;
  $("progressLabel").textContent = `${occ.stepsCompleted || 0} / ${
    occ.stepsTotal || 0
  } steps`;
  $("progressPct").textContent = `${pct}%`;
  $("occurrenceId").textContent = occ.occurrenceId;

  const terminal = ["passed", "failed", "cancelled"].includes(status);
  $("btnLoadReport").disabled = !terminal;
  $("btnRun").disabled = status === "running" || status === "queued";

  const flow = state.flows.find((f) => String(f.flowId) === String(occ.flowId));
  if (flow && hasSheetCatalog(flow)) {
    $("sheetIdleHint").classList.add("hidden");
    renderUseCaseSheet(flow, occ);
  } else {
    $("liveSteps").innerHTML = (occ.steps || [])
      .map((s) => {
        const err = s.error
          ? `<span class="err">${escapeHtml(String(s.error).slice(0, 220))}</span>`
          : "";
        return `
        <li>
          <span class="dot ${escapeAttr(s.status)}"></span>
          <div>
            <div class="title">${escapeHtml(s.title || s.stepId)}</div>
            <span class="sid mono" style="color:var(--muted)">${escapeHtml(
              s.stepId,
            )}</span>
            ${err}
          </div>
          <span class="st">${escapeHtml(s.status)}</span>
        </li>`;
      })
      .join("");
  }

  // Live issues from DB (source of truth during the run)
  const liveIssues = occ.liveIssues || [];
  if (liveIssues.length && !terminal) {
    $("reportBody").innerHTML =
      `<p><strong>${liveIssues.length}</strong> live issue(s) in DB</p>` +
      liveIssues
        .slice(0, 30)
        .map((issue) => {
          const sev = (issue.severity || "major").toLowerCase();
          return `
            <div class="issue ${escapeAttr(sev)}">
              <p class="ih">${escapeHtml(issue.marker || "")} ${escapeHtml(
                issue.id || issue.step || "",
              )} — ${escapeHtml(issue.title || "")}</p>
              <p class="im">${escapeHtml(issue.evidence || issue.message || "")}</p>
            </div>`;
        })
        .join("");
  }

  if (terminal) {
    stopPolling();
    $("btnRun").disabled = false;
    loadReport(occ.occurrenceId).catch(() => {});
  }
}

async function loadReport(occurrenceId) {
  const id = occurrenceId || state.occurrenceId;
  if (!id) return;
  try {
    const report = await api(`/api/occurrences/${encodeURIComponent(id)}/report`);
    const issues = report.issues?.issues || report.issues || [];
    const list = Array.isArray(issues) ? issues : [];

    let html = `
      <p><strong>${list.length}</strong> issue(s)
      · flow <code>${escapeHtml(String(report.flowId || ""))}</code>
      · exit ${escapeHtml(String(report.summary?.exitCode ?? "—"))}</p>`;

    if (!list.length) {
      html += `<p class="muted" style="margin-top:0.75rem">No soft issues recorded for this run.</p>`;
    } else {
      html += list
        .slice(0, 40)
        .map((issue) => {
          const sev = (issue.severity || "major").toLowerCase();
          return `
            <div class="issue ${escapeAttr(sev)}">
              <p class="ih">${escapeHtml(issue.marker || "")} ${escapeHtml(
                issue.id || issue.step || "",
              )} — ${escapeHtml(issue.title || "")}</p>
              <p class="im">${escapeHtml(issue.evidence || issue.message || "")}</p>
            </div>`;
        })
        .join("");
    }

    if (report.artifactPaths?.runDir) {
      html += `<p class="mono muted" style="margin-top:0.75rem">Artifacts: ${escapeHtml(
        report.artifactPaths.runDir,
      )}</p>`;
    }

    $("reportBody").innerHTML = html;
  } catch (err) {
    $("reportBody").innerHTML = `<p class="muted">${escapeHtml(
      err.message || "Report not ready",
    )}</p>`;
  }
}

function stopPolling() {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

function startPolling(occurrenceId) {
  stopPolling();
  state.occurrenceId = occurrenceId;
  const tick = async () => {
    try {
      const occ = await api(
        `/api/occurrences/${encodeURIComponent(occurrenceId)}`,
      );
      renderOccurrence(occ);
      await loadHistory();
    } catch (err) {
      toast(err.message, true);
      stopPolling();
      $("btnRun").disabled = false;
    }
  };
  tick();
  state.pollTimer = setInterval(tick, 1000);
}

async function runSelectedFlow() {
  if (!state.selectedFlowId) return;
  $("btnRun").disabled = true;
  setLiveIdle();
  try {
    const data = await api(
      `/api/flows/${encodeURIComponent(state.selectedFlowId)}/run`,
      {
        method: "POST",
        body: JSON.stringify({ headed: $("headedMode").checked }),
      },
    );
    toast(`Started occurrence ${data.occurrenceId.slice(0, 8)}…`);
    startPolling(data.occurrenceId);
  } catch (err) {
    toast(err.message, true);
    $("btnRun").disabled = false;
  }
}

async function loadFlows() {
  const data = await api("/api/flows");
  state.flows = data.flows || [];
  renderFlowList();
  if (state.selectedFlowId) selectFlow(state.selectedFlowId);
}

async function loadHistory() {
  const data = await api("/api/occurrences?limit=20");
  const items = data.occurrences || [];
  $("runHistory").innerHTML = items.length
    ? items
        .map(
          (o) => `
      <li>
        <button type="button" class="history-item" data-id="${escapeAttr(
          o.occurrenceId,
        )}" data-flow="${escapeAttr(o.flowId)}">
          <span class="name">${escapeHtml(o.flowName || o.flowId)}</span>
          <span class="meta">
            <span class="status-pill ${escapeAttr(o.status)}" style="padding:0.1rem 0.4rem">${escapeHtml(
              o.status,
            )}</span>
            <span>${o.stepsCompleted || 0}/${o.stepsTotal || 0}</span>
            <span>${formatTime(o.startedAt || o.createdAt)}</span>
          </span>
        </button>
      </li>`,
        )
        .join("")
    : `<li class="muted" style="padding:0.75rem">No runs yet</li>`;

  $("runHistory").querySelectorAll(".history-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      selectFlow(btn.dataset.flow);
      state.occurrenceId = btn.dataset.id;
      try {
        const occ = await api(
          `/api/occurrences/${encodeURIComponent(btn.dataset.id)}`,
        );
        renderOccurrence(occ);
        if (["running", "queued"].includes(occ.status)) {
          startPolling(occ.occurrenceId);
        } else {
          stopPolling();
          $("btnRun").disabled = false;
        }
      } catch (err) {
        toast(err.message, true);
      }
    });
  });
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function bindUi() {
  $("apiToken").value = state.token;
  $("apiToken").addEventListener("change", () => {
    state.token = $("apiToken").value.trim();
    localStorage.setItem("odb_api_token", state.token);
    toast("API token saved");
  });

  $("btnRefresh").addEventListener("click", async () => {
    try {
      await Promise.all([loadFlows(), loadHistory()]);
      toast("Refreshed");
    } catch (err) {
      toast(err.message, true);
    }
  });

  $("btnRun").addEventListener("click", runSelectedFlow);
  $("btnLoadReport").addEventListener("click", () =>
    loadReport().catch((e) => toast(e.message, true)),
  );

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      state.filter = chip.dataset.filter;
      renderFlowList();
    });
  });

  $("flowSearch").addEventListener("input", () => {
    state.search = $("flowSearch").value;
    renderFlowList();
  });
}

async function init() {
  bindUi();
  setLiveIdle();
  try {
    await Promise.all([loadFlows(), loadHistory()]);
  } catch (err) {
    toast(err.message || "Failed to load API", true);
    $("flowCount").textContent = "API unreachable";
  }
}

init();
