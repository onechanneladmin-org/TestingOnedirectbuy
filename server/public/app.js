const state = {
  flows: [],
  projects: [],
  projectId: localStorage.getItem("odb_project_id") || "",
  filter: "all",
  search: "",
  selectedFlowId: null,
  selectedUseCaseId: null,
  expandedUseCaseIds: new Set(),
  checkedFlowIds: new Set(),
  queueWatch: null,
  occurrenceId: null,
  lastOccurrence: null,
  history: [],
  pollTimer: null,
  token: localStorage.getItem("odb_api_token") || "",
};

const SHEET_COLSPAN = 14;

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
  const url = new URL(path, window.location.origin);
  if (state.projectId && !url.searchParams.has("projectId")) {
    if (path.startsWith("/api/flows") || path.startsWith("/api/occurrences")) {
      url.searchParams.set("projectId", state.projectId);
    }
  }
  const res = await fetch(`${url.pathname}${url.search}`, {
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
      ...(f.steps || []).flatMap((s) => [s.stepId, s.useCase, s.title, s.module]),
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

function listedFlowsInOrder() {
  const flows = filteredFlows();
  const sheet = flows
    .filter(isSheetFlow)
    .sort((a, b) => sheetGroupOrder(a) - sheetGroupOrder(b));
  const other = flows
    .filter((f) => !isSheetFlow(f))
    .sort((a, b) => flowIdSortKey(a.flowId) - flowIdSortKey(b.flowId));
  return [...sheet, ...other];
}

function selectedFlowIdsInOrder() {
  return listedFlowsInOrder()
    .map((f) => String(f.flowId))
    .filter((id) => state.checkedFlowIds.has(id));
}

function syncSelectAllBox() {
  const box = $("flowSelectAll");
  if (!box) return;
  const ids = listedFlowsInOrder().map((f) => String(f.flowId));
  const selected = ids.filter((id) => state.checkedFlowIds.has(id));
  box.checked = ids.length > 0 && selected.length === ids.length;
  box.indeterminate = selected.length > 0 && selected.length < ids.length;
}

function updateQueueRunButtons() {
  const n = selectedFlowIdsInOrder().length;
  const railBtn = $("btnRunSelected");
  if (railBtn) {
    railBtn.disabled = n === 0 || Boolean(state.queueWatch);
    railBtn.textContent = n ? `Run selected (${n})` : "Run selected";
  }
  const btnLabel = $("btnRunLabel");
  if (btnLabel && n > 1) {
    btnLabel.textContent = `Run ${n} flows`;
  } else if (btnLabel && n === 1 && !state.selectedUseCaseId) {
    btnLabel.textContent = "Run selected";
  } else if (btnLabel) {
    setRunLabels(Boolean(state.selectedUseCaseId));
  }
}

function childCount(s) {
  return Array.isArray(s?.children) ? s.children.length : 0;
}

function catalogUseCases(flows) {
  const out = [];
  for (const f of flows) {
    if (!isSheetFlow(f)) continue;
    for (const s of f.steps || []) {
      out.push({
        flowId: f.flowId,
        flowName: f.name,
        flowEnabled: f.enabled,
        stepId: s.stepId,
        title: s.useCase || s.title || s.stepId,
        module: s.module || "",
        childrenCount: childCount(s),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      });
    }
  }
  return out;
}

function filteredUseCases() {
  const q = state.search.trim().toLowerCase();
  return catalogUseCases(state.flows).filter((uc) => {
    if (state.filter === "enabled" && !uc.flowEnabled) return false;
    if (state.filter === "disabled" && uc.flowEnabled) return false;
    if (!q) return true;
    return [uc.stepId, uc.title, uc.module, uc.flowName]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

function flowItemHtml(f) {
  const active =
    String(f.flowId) === String(state.selectedFlowId) && !state.selectedUseCaseId
      ? "active"
      : "";
  const checked = state.checkedFlowIds.has(String(f.flowId));
  return `
        <li class="flow-row">
          <label class="flow-check" title="Queue this flow">
            <input type="checkbox" class="flow-checkbox" data-id="${escapeAttr(
              f.flowId,
            )}" ${checked ? "checked" : ""} />
          </label>
          <button type="button" class="flow-item ${active}" data-id="${escapeAttr(f.flowId)}">
            <span class="name">${escapeHtml(f.name)}</span>
            <span class="meta">
              <span>#${escapeHtml(String(f.flowId))}</span>
              <span>${f.stepsTotal || 0} steps</span>
              <span>${f.enabled ? "enabled" : "off"}</span>
              ${recordTimeLabel(f) ? `<span class="when">${escapeHtml(recordTimeLabel(f))}</span>` : ""}
            </span>
          </button>
        </li>`;
}

function useCaseItemHtml(uc) {
  const active =
    String(uc.flowId) === String(state.selectedFlowId) &&
    String(uc.stepId) === String(state.selectedUseCaseId)
      ? "active"
      : "";
  return `
        <li>
          <button type="button" class="flow-item uc-item ${active}" data-id="${escapeAttr(
            uc.flowId,
          )}" data-uc="${escapeAttr(uc.stepId)}">
            <span class="name">${escapeHtml(uc.stepId)} · ${escapeHtml(uc.title)}</span>
            <span class="meta">
              <span>${uc.childrenCount} steps</span>
              <span>${escapeHtml(uc.module || uc.flowName)}</span>
              ${recordTimeLabel(uc) ? `<span class="when">${escapeHtml(recordTimeLabel(uc))}</span>` : ""}
            </span>
          </button>
        </li>`;
}

function useCaseRailHtml() {
  const items = filteredUseCases();
  if (!items.length) return "";
  const groups = new Map();
  for (const uc of items) {
    const key = uc.flowName || "Use cases";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(uc);
  }
  const flowByName = new Map(state.flows.map((f) => [f.name, f]));
  const groupNames = [...groups.keys()].sort(
    (a, b) =>
      sheetGroupOrder(flowByName.get(a) || {}) -
      sheetGroupOrder(flowByName.get(b) || {}),
  );
  let html = `<li class="rail-group">Use cases</li>`;
  for (const name of groupNames) {
    html += `<li class="rail-subgroup">${escapeHtml(name)}</li>`;
    html += groups.get(name).map(useCaseItemHtml).join("");
  }
  return html;
}

function renderFlowList() {
  const list = $("flowList");
  const flows = filteredFlows();
  const ucCount = filteredUseCases().length;
  $("flowCount").textContent = `${flows.length} shown · ${state.flows.length} total · ${ucCount} use cases`;
  renderStats();

  if (!flows.length && !ucCount) {
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

  list.innerHTML = `${section("Sheet modules", sheet)}${useCaseRailHtml()}${section(
    "Other flows",
    other,
  )}`;

  list.querySelectorAll(".flow-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectFlow(btn.dataset.id, btn.dataset.uc || null);
    });
  });
  list.querySelectorAll(".flow-checkbox").forEach((box) => {
    box.addEventListener("click", (ev) => ev.stopPropagation());
    box.addEventListener("change", () => {
      const id = String(box.dataset.id);
      if (box.checked) state.checkedFlowIds.add(id);
      else state.checkedFlowIds.delete(id);
      syncSelectAllBox();
      updateQueueRunButtons();
    });
  });
  syncSelectAllBox();
  updateQueueRunButtons();
}

function hasSheetCatalog(flow) {
  return (flow?.steps || []).some((s) => s.module || s.useCase || s.priority);
}

function findUseCase(flow, useCaseId) {
  return (flow?.steps || []).find((s) => s.stepId === useCaseId) || null;
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

function issuesForRow(stepId, occ, live) {
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
  const childErr = (live?.children || [])
    .map((c) => c.error)
    .filter(Boolean)
    .join(" · ");
  if (childErr) return cleanIssueText(childErr).slice(0, 280);
  if (live?.error) return cleanIssueText(live.error).slice(0, 280);
  const label = sheetStatusLabel(live?.status);
  if (label === "pass") return "no issue";
  return "";
}

function nestedStepsHtml(s, live) {
  const children = live?.children?.length ? live.children : s.children || [];
  if (!children.length) {
    return `<p class="muted uc-step-empty">No extracted steps for this use case.</p>`;
  }
  return `<ol class="uc-step-list">${children
    .map((c) => {
      const st = c.status || "pending";
      const label = sheetStatusLabel(st) || st;
      return `<li>
        <span class="sid">${escapeHtml(c.stepId)}</span>
        <span>${escapeHtml(c.title || "")}</span>
        ${recordTimeLabel(c) ? `<span class="when">${escapeHtml(recordTimeLabel(c))}</span>` : ""}
        <span class="sheet-status ${escapeAttr(st)}">${escapeHtml(label)}</span>
      </li>`;
    })
    .join("")}</ol>`;
}

function bindSheetEvents() {
  const body = $("useCaseSheetBody");
  if (!body) return;
  body.querySelectorAll("tr.uc-row").forEach((row) => {
    row.addEventListener("click", (ev) => {
      if (ev.target.closest(".uc-run")) return;
      const id = row.dataset.step;
      if (!id) return;
      if (state.expandedUseCaseIds.has(id)) state.expandedUseCaseIds.delete(id);
      else state.expandedUseCaseIds.add(id);
      const flow = state.flows.find(
        (f) => String(f.flowId) === String(state.selectedFlowId),
      );
      if (!flow) return;
      const occ =
        state.lastOccurrence &&
        String(state.lastOccurrence.flowId) === String(flow.flowId)
          ? state.lastOccurrence
          : null;
      renderUseCaseSheet(flow, occ);
    });
  });
  body.querySelectorAll(".uc-run").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      startRun({ useCaseId: btn.dataset.uc, keepSheet: true });
    });
  });
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
      const issues = occ ? issuesForRow(s.stepId, occ, live) : "";
      const expanded = state.expandedUseCaseIds.has(s.stepId);
      const n = childCount(s);
      return `
        <tr class="uc-row${expanded ? " expanded" : ""}" data-step="${escapeAttr(
          s.stepId,
        )}" aria-expanded="${expanded ? "true" : "false"}">
          <td class="expand-cell"><span class="uc-chevron">▸</span></td>
          <td class="mono">${escapeHtml(s.stepId)}<span class="uc-step-count">${n} step${
            n === 1 ? "" : "s"
          }</span></td>
          <td>${escapeHtml(s.module || "")}</td>
          <td>${escapeHtml(s.actor || "")}</td>
          <td>${escapeHtml(s.useCase || s.title || "")}</td>
          <td class="desc">${escapeHtml(s.description || "")}</td>
          <td>${escapeHtml(s.priority || "")}</td>
          <td>${escapeHtml(s.automation || "Yes")}</td>
          <td>${escapeHtml(s.currentStatus || "")}</td>
          <td class="when">${escapeHtml(recordTimeLabel(s))}</td>
          <td>${escapeHtml(testedBy)}</td>
          <td class="issues"><span class="issues-text" title="${escapeAttr(
            issues,
          )}">${escapeHtml(issues)}</span></td>
          <td class="status-cell"><span class="sheet-status ${escapeAttr(status)}">${escapeHtml(
            statusLabel,
          )}</span></td>
          <td class="run-cell">
            <button type="button" class="btn ghost sm uc-run" data-uc="${escapeAttr(
              s.stepId,
            )}">Run</button>
          </td>
        </tr>
        ${
          expanded
            ? `<tr class="uc-steps"><td colspan="${SHEET_COLSPAN}">${nestedStepsHtml(
                s,
                live,
              )}</td></tr>`
            : ""
        }`;
    })
    .join("");

  bindSheetEvents();
}

function stepCatalogItems(steps) {
  return (steps || [])
    .map(
      (s) => `
      <li>
        <div>
          <span class="sid">${escapeHtml(s.stepId)}${
            s.dependsOn ? ` · after ${escapeHtml(s.dependsOn)}` : ""
          }</span>
          ${escapeHtml(s.title || "")}
          ${recordTimeLabel(s) ? `<span class="when">${escapeHtml(recordTimeLabel(s))}</span>` : ""}
        </div>
      </li>`,
    )
    .join("");
}

function liveStepEntries(occ) {
  const steps = occ?.steps || [];
  if (steps.length === 1 && (steps[0].children || []).length) {
    return steps[0].children;
  }
  return steps;
}

function setRunLabels(isUseCase) {
  const label = isUseCase ? "Run use case" : "Run flow";
  const btnLabel = $("btnRunLabel");
  if (btnLabel) btnLabel.textContent = label;
  const emptyAction = $("liveEmptyAction");
  if (emptyAction) emptyAction.textContent = label;
}

function showFlowLayout(flow) {
  const useCaseView = Boolean(state.selectedUseCaseId);
  const sheet = hasSheetCatalog(flow) && !useCaseView;
  $("listLayout").classList.toggle("hidden", sheet);
  $("sheetLayout").classList.toggle("hidden", !sheet);
  setRunLabels(useCaseView);
}

function renderSelectedCatalog(flow, occ) {
  if (state.selectedUseCaseId) {
    const uc = findUseCase(flow, state.selectedUseCaseId);
    const children =
      (occ?.steps || []).find((s) => s.stepId === state.selectedUseCaseId)?.children ||
      uc?.children ||
      [];
    const list = children.length
      ? children
      : uc
        ? [{ stepId: uc.stepId, title: uc.useCase || uc.title, dependsOn: null }]
        : [];
    $("stepCatalogCount").textContent = String(list.length);
    $("stepCatalog").innerHTML = stepCatalogItems(list);
    return;
  }
  $("stepCatalogCount").textContent = String(flow.steps?.length || 0);
  $("stepCatalog").innerHTML = stepCatalogItems(flow.steps);
}

function selectFlow(flowId, useCaseId = null) {
  state.selectedFlowId = String(flowId);
  state.selectedUseCaseId = useCaseId ? String(useCaseId) : null;
  const flow = state.flows.find((f) => String(f.flowId) === state.selectedFlowId);
  renderFlowList();

  if (!flow) {
    $("emptyState").classList.remove("hidden");
    $("flowDetail").classList.add("hidden");
    return;
  }

  $("emptyState").classList.add("hidden");
  $("flowDetail").classList.remove("hidden");

  const uc = state.selectedUseCaseId
    ? findUseCase(flow, state.selectedUseCaseId)
    : null;
  if (uc) {
    $("flowEyebrow").textContent = `Flow ${flow.flowId} · Use case`;
    $("flowTitle").textContent = `${uc.stepId} — ${uc.useCase || uc.title || uc.stepId}`;
    $("flowMeta").textContent = `${flow.name} · ${childCount(uc)} step(s) · ${
      flow.enabled ? "enabled" : "disabled in config"
    } · ${recordTimeLabel(uc) || recordTimeLabel(flow)}`;
  } else {
    $("flowEyebrow").textContent = `Flow ${flow.flowId}`;
    $("flowTitle").textContent = flow.name;
    $("flowMeta").textContent = `${flow.tests?.length || 0} spec file(s) · ${
      flow.enabled ? "enabled" : "disabled in config"
    } · ${recordTimeLabel(flow)}`;
  }

  showFlowLayout(flow);

  const activeOcc = (state.history || []).find(
    (o) =>
      String(o.flowId) === state.selectedFlowId &&
      ["running", "queued"].includes(o.status),
  );
  const latestOccForFlow =
    activeOcc ||
    (state.history || []).find((o) => String(o.flowId) === state.selectedFlowId);

  if (latestOccForFlow) {
    api(`/api/occurrences/${encodeURIComponent(latestOccForFlow.occurrenceId)}`)
      .then((occ) => {
        renderOccurrence(occ);
        if (["running", "queued"].includes(occ.status)) {
          startPolling(occ.occurrenceId);
        }
      })
      .catch(() => {
        setLiveIdle();
      });
  } else {
    setLiveIdle();
  }
}

function setLiveIdle() {
  $("runBadge").className = "status-pill idle";
  $("runBadge").textContent = "idle";
  $("liveEmpty").classList.remove("hidden");
  $("liveBody").classList.add("hidden");
  $("runProgress").classList.add("hidden");
  $("btnLoadReport").disabled = true;
  $("btnStop")?.classList.add("hidden");
  $("btnRun").disabled = false;
  $("reportBody").innerHTML =
    '<p class="muted">Report appears when the occurrence finishes.</p>';
  state.lastOccurrence = null;
  state.occurrenceId = null;
  const flow = state.flows.find((f) => String(f.flowId) === state.selectedFlowId);
  if (!flow) return;
  if (hasSheetCatalog(flow) && !state.selectedUseCaseId) {
    $("sheetIdleHint").classList.remove("hidden");
    renderUseCaseSheet(flow, null);
  } else {
    renderSelectedCatalog(flow, null);
  }
}

function renderOccurrence(occ) {
  state.lastOccurrence = occ;
  $("liveEmpty").classList.add("hidden");
  $("liveBody").classList.remove("hidden");
  $("runProgress").classList.remove("hidden");

  const status = occ.status || "idle";
  $("runBadge").className = `status-pill ${status}`;
  $("runBadge").textContent = status;

  const passed = occ.passed ?? occ.progress?.passed ?? 0;
  const failed = occ.failed ?? occ.progress?.failed ?? 0;
  const skipped = occ.skipped ?? occ.progress?.skipped ?? 0;
  const pct = occ.progress?.percent ?? 0;
  $("progressFill").style.width = `${pct}%`;
  $("progressLabel").textContent = `${passed} passed · ${failed} failed · ${skipped} skipped`;
  $("progressPct").textContent = `${pct}%`;
  $("occurrenceId").textContent = occ.occurrenceId;

  const terminal = ["passed", "failed", "cancelled"].includes(status);
  $("btnLoadReport").disabled = !terminal;
  $("btnRun").disabled = status === "running" || status === "queued";
  const btnStop = $("btnStop");
  if (btnStop) {
    if (status === "running" || status === "queued") {
      btnStop.classList.remove("hidden");
      btnStop.disabled = false;
      const isUc = Boolean(occ.useCaseId);
      const stopLabel = $("btnStopLabel");
      if (stopLabel) stopLabel.textContent = isUc ? "Stop use case" : "Stop flow";
    } else {
      btnStop.classList.add("hidden");
    }
  }

  const flow = state.flows.find((f) => String(f.flowId) === String(occ.flowId));
  const occUseCase = occ.useCaseId || "";
  if (occUseCase && !state.selectedUseCaseId) {
    // keep sheet if the user launched a row run from the module view
  } else if (occUseCase && state.selectedUseCaseId !== occUseCase) {
    state.selectedUseCaseId = occUseCase;
    if (flow) showFlowLayout(flow);
  }

  if (flow && hasSheetCatalog(flow) && !state.selectedUseCaseId) {
    $("sheetIdleHint").classList.add("hidden");
    renderUseCaseSheet(flow, occ);
  } else {
    if (flow) renderSelectedCatalog(flow, occ);
    $("liveSteps").innerHTML = liveStepEntries(occ)
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
    $("btnStop")?.classList.add("hidden");
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

async function startRun({ useCaseId = "", keepSheet = false } = {}) {
  if (!state.selectedFlowId) return;
  const id = useCaseId || state.selectedUseCaseId || "";
  if (id && !keepSheet && !state.selectedUseCaseId) {
    state.selectedUseCaseId = id;
  }
  setLiveIdle();
  $("btnRun").disabled = true;
  const btnStop = $("btnStop");
  if (btnStop) {
    btnStop.classList.remove("hidden");
    btnStop.disabled = false;
    const stopLabel = $("btnStopLabel");
    if (stopLabel) stopLabel.textContent = id ? "Stop use case" : "Stop flow";
  }
  try {
    const data = await api(
      `/api/flows/${encodeURIComponent(state.selectedFlowId)}/run`,
      {
        method: "POST",
        body: JSON.stringify({
          headed: $("headedMode").checked,
          projectId: state.projectId,
          ...(id ? { useCaseId: id } : {}),
        }),
      },
    );
    toast(`Started occurrence ${data.occurrenceId.slice(0, 8)}…`);
    loadHistory().catch(() => {});
    startPolling(data.occurrenceId);
  } catch (err) {
    toast(err.message, true);
    $("btnRun").disabled = false;
    $("btnStop")?.classList.add("hidden");
  }
}

async function stopRunningOccurrence() {
  const occId = state.occurrenceId || state.lastOccurrence?.occurrenceId;
  const flowId = state.selectedFlowId;
  if (!occId && !flowId) return;

  const btnStop = $("btnStop");
  const stopLabel = $("btnStopLabel");
  const prevLabel = stopLabel ? stopLabel.textContent : "Stop";

  if (btnStop) {
    btnStop.disabled = true;
  }
  if (stopLabel) {
    stopLabel.textContent = "Stopping…";
  }

  try {
    await api("/api/flows/queue", { method: "DELETE" }).catch(() => {});
    stopQueueWatch();

    let res;
    if (occId) {
      res = await api(`/api/occurrences/${encodeURIComponent(occId)}/stop`, {
        method: "POST",
        body: JSON.stringify({ reason: "Stopped from dashboard UI" }),
      });
    } else {
      res = await api(`/api/flows/${encodeURIComponent(flowId)}/stop`, {
        method: "POST",
        body: JSON.stringify({
          projectId: state.projectId,
          reason: "Stopped from dashboard UI",
        }),
      });
    }

    toast("Stopped — remaining queue cleared");
    stopPolling();

    const updatedOcc = res?.occurrence;
    if (updatedOcc) {
      renderOccurrence(updatedOcc);
    } else if (occId) {
      try {
        const fresh = await api(`/api/occurrences/${encodeURIComponent(occId)}`);
        renderOccurrence(fresh);
      } catch {
        // ignore
      }
    }
    await loadHistory();
  } catch (err) {
    toast(`Failed to stop: ${err.message}`, true);
    if (btnStop) {
      btnStop.disabled = false;
    }
    if (stopLabel) {
      stopLabel.textContent = prevLabel;
    }
  }
}

async function runSelectedFlow() {
  const queued = selectedFlowIdsInOrder();
  if (queued.length > 1 || (queued.length === 1 && !state.selectedUseCaseId)) {
    await runFlowQueue(queued);
    return;
  }
  await startRun({
    useCaseId: state.selectedUseCaseId || "",
    keepSheet: !state.selectedUseCaseId,
  });
}

async function runFlowQueue(flowIds) {
  const ids = (flowIds || selectedFlowIdsInOrder()).filter(Boolean);
  if (!ids.length) {
    toast("Select one or more flows to run", true);
    return;
  }
  $("btnRun").disabled = true;
  const railBtn = $("btnRunSelected");
  if (railBtn) railBtn.disabled = true;
  const btnStop = $("btnStop");
  if (btnStop) {
    btnStop.classList.remove("hidden");
    btnStop.disabled = false;
    const stopLabel = $("btnStopLabel");
    if (stopLabel) stopLabel.textContent = "Stop queue";
  }
  try {
    const data = await api("/api/flows/queue", {
      method: "POST",
      body: JSON.stringify({
        flowIds: ids,
        headed: Boolean($("headedMode")?.checked),
        projectId: state.projectId,
      }),
    });
    const firstId =
      data.firstOccurrence?.occurrenceId || data.activeOccurrenceId;
    const firstFlow = data.firstOccurrence?.flowId || ids[0];
    toast(`Queued ${ids.length} flow(s) — running one at a time`);
    if (firstFlow) selectFlow(firstFlow);
    if (firstId) {
      startPolling(firstId);
      watchQueue(ids.length);
    }
    loadHistory().catch(() => {});
  } catch (err) {
    toast(err.message, true);
    $("btnRun").disabled = false;
    updateQueueRunButtons();
    $("btnStop")?.classList.add("hidden");
  }
}

function stopQueueWatch() {
  if (state.queueWatch) {
    clearInterval(state.queueWatch);
    state.queueWatch = null;
  }
}

function watchQueue(total) {
  stopQueueWatch();
  state.queueWatch = setInterval(async () => {
    try {
      const q = await api("/api/flows/queue");
      const remaining = q.remainingCount || 0;
      const active = q.activeOccurrenceId;
      if (active && active !== state.occurrenceId) {
        const occ = await api(`/api/occurrences/${encodeURIComponent(active)}`);
        if (occ.flowId && String(occ.flowId) !== String(state.selectedFlowId)) {
          selectFlow(occ.flowId);
        }
        startPolling(active);
      }
      const stopLabel = $("btnStopLabel");
      if (stopLabel && (active || remaining)) {
        stopLabel.textContent = remaining
          ? `Stop queue (${remaining} left)`
          : "Stop queue";
      }
      if (!active && remaining === 0) {
        stopQueueWatch();
        updateQueueRunButtons();
        toast("Queue finished");
      }
    } catch {
      // keep polling; occurrence poller surfaces errors
    }
  }, 1500);
}

function projectStats() {
  const flows = state.flows || [];
  let steps = 0;
  const specs = new Set();
  let enabled = 0;
  for (const f of flows) {
    if (f.enabled) enabled += 1;
    for (const t of f.tests || []) specs.add(t);
    for (const s of f.steps || []) {
      const n = childCount(s);
      steps += n > 0 ? n : 1;
    }
  }
  const history = state.history || [];
  return {
    flows: flows.length,
    enabled,
    useCases: catalogUseCases(flows).length,
    steps,
    specs: specs.size,
    runs: history.length,
    passed: history.filter((o) => o.status === "passed").length,
    failed: history.filter((o) => o.status === "failed").length,
    running: history.filter((o) =>
      ["running", "queued"].includes(o.status),
    ).length,
  };
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function renderStats() {
  if (!$("statStrip")) return;
  const s = projectStats();
  setText("statFlows", String(s.flows));
  setText("statFlowsHint", `${s.enabled} enabled · ${s.flows - s.enabled} off`);
  setText("statUseCases", String(s.useCases));
  setText("statSteps", String(s.steps));
  setText("statSpecs", String(s.specs));
  setText("statRuns", String(s.runs));
  const hint = $("statRunsHint");
  if (!hint) return;
  hint.classList.remove("pass", "fail");
  if (!s.runs) {
    hint.textContent = "No runs yet";
    return;
  }
  const parts = [];
  if (s.passed) parts.push(`${s.passed} passed`);
  if (s.failed) parts.push(`${s.failed} failed`);
  if (s.running) parts.push(`${s.running} running`);
  hint.textContent = parts.join(" · ") || `Latest ${s.runs}`;
  if (s.failed && !s.passed) hint.classList.add("fail");
  else if (s.passed && !s.failed) hint.classList.add("pass");
}

async function loadFlows() {
  const data = await api("/api/flows");
  state.flows = data.flows || [];
  renderFlowList();
  if (state.selectedFlowId) {
    selectFlow(state.selectedFlowId, state.selectedUseCaseId);
  }
}

async function loadHistory() {
  const qs = state.projectId
    ? `?limit=50&projectId=${encodeURIComponent(state.projectId)}`
    : "?limit=50";
  const data = await api(`/api/occurrences${qs}`);
  const items = data.occurrences || [];
  state.history = items;
  renderStats();
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
            ${historyCountsHtml(o)}
            <span>${formatTime(o.startedAt || o.createdAt)}</span>
          </span>
        </button>
      </li>`,
        )
        .join("")
    : `<li class="muted" style="padding:0.75rem">No runs yet</li>`;

  $("runHistory").querySelectorAll(".history-item").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        const occ = await api(
          `/api/occurrences/${encodeURIComponent(btn.dataset.id)}`,
        );
        selectFlow(btn.dataset.flow, occ.useCaseId || null);
        if (occ.projectId) state.projectId = occ.projectId;
        state.occurrenceId = btn.dataset.id;
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

function historyCountsHtml(o) {
  const passed = Number(o.passed || 0);
  const failed = Number(o.failed || 0);
  const skipped = Number(o.skipped || 0);
  return `<span class="history-counts" title="${passed + failed + skipped}/${
    o.stepsTotal || 0
  } steps">
            <span class="pass">${passed} passed</span>
            <span class="fail">${failed} failed</span>
            <span class="skip">${skipped} skipped</span>
          </span>`;
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function recordTimeLabel(record) {
  const added = record?.createdAt || record?.addedAt;
  const updated = record?.updatedAt;
  if (!added && !updated) return "";
  const addedMs = added ? new Date(added).getTime() : 0;
  const updatedMs = updated ? new Date(updated).getTime() : 0;
  if (updatedMs && addedMs && updatedMs - addedMs > 1000) {
    return `Updated ${formatTime(updated)}`;
  }
  return `Added ${formatTime(added || updated)}`;
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

function currentProject() {
  return (
    state.projects.find((p) => p.id === state.projectId) ||
    state.projects[0] ||
    null
  );
}

function closeProjectMenu() {
  const menu = $("projectMenu");
  const btn = $("projectMenuBtn");
  if (!menu || !btn) return;
  menu.classList.add("hidden");
  btn.setAttribute("aria-expanded", "false");
}

function renderProjectSwitcher() {
  const label = $("projectLabel");
  const menu = $("projectMenu");
  const btn = $("projectMenuBtn");
  if (!label || !menu || !btn) return;

  const current = currentProject();
  label.textContent = current?.name || "Select project";
  document.title = current
    ? `${current.name} — Flow Control`
    : "Flow Control Plane";

  menu.innerHTML = state.projects
    .map((p) => {
      const selected = p.id === state.projectId ? "true" : "false";
      const missing = p.available ? "" : " unavailable";
      const status = p.runnable ? "ready" : "catalog only";
      return `<li>
        <button type="button" class="project-option${p.id === state.projectId ? " selected" : ""}${missing}" role="option" aria-selected="${selected}" data-id="${escapeAttr(p.id)}" ${p.available ? "" : "disabled"}>
          <span class="project-option-name">${escapeHtml(p.name)}</span>
          <span class="project-option-meta">${p.available ? status : "unavailable"}</span>
        </button>
      </li>`;
    })
    .join("");

  menu.querySelectorAll(".project-option").forEach((item) => {
    item.addEventListener("click", () => {
      switchProject(item.dataset.id);
    });
  });
}

async function switchProject(projectId) {
  const next = String(projectId || "").trim();
  if (!next || next === state.projectId) {
    closeProjectMenu();
    return;
  }
  const project = state.projects.find((p) => p.id === next);
  if (project && !project.available) {
    toast(`${project.name} is unavailable`, true);
    closeProjectMenu();
    return;
  }

  stopPolling();
  state.projectId = next;
  localStorage.setItem("odb_project_id", next);
  state.selectedFlowId = null;
  state.selectedUseCaseId = null;
  state.expandedUseCaseIds = new Set();
  state.occurrenceId = null;
  state.lastOccurrence = null;
  state.history = [];
  state.flows = [];
  closeProjectMenu();
  renderProjectSwitcher();
  renderStats();
  $("emptyState")?.classList.remove("hidden");
  $("flowDetail")?.classList.add("hidden");
  setLiveIdle();
  try {
    await Promise.all([loadFlows(), loadHistory()]);
    toast(`Loaded ${currentProject()?.name || next}`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function loadProjects() {
  const data = await api("/api/projects");
  state.projects = data.projects || [];
  const saved = state.projectId;
  const match = state.projects.find((p) => p.id === saved && p.available);
  const fallback =
    state.projects.find((p) => p.id === data.defaultProjectId && p.available) ||
    state.projects.find((p) => p.available) ||
    state.projects[0];
  state.projectId = (match || fallback)?.id || "";
  if (state.projectId) {
    localStorage.setItem("odb_project_id", state.projectId);
  }
  renderProjectSwitcher();
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
  $("btnRunSelected")?.addEventListener("click", () =>
    runFlowQueue(selectedFlowIdsInOrder()),
  );
  $("flowSelectAll")?.addEventListener("change", () => {
    const box = $("flowSelectAll");
    const ids = listedFlowsInOrder().map((f) => String(f.flowId));
    if (box.checked) ids.forEach((id) => state.checkedFlowIds.add(id));
    else ids.forEach((id) => state.checkedFlowIds.delete(id));
    renderFlowList();
  });
  $("btnStop")?.addEventListener("click", stopRunningOccurrence);
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

  const menuBtn = $("projectMenuBtn");
  if (menuBtn) {
    menuBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const menu = $("projectMenu");
      if (!menu) return;
      const open = menu.classList.contains("hidden");
      menu.classList.toggle("hidden", !open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.addEventListener("click", (ev) => {
    const switcher = ev.target.closest(".brand-switcher");
    if (!switcher) closeProjectMenu();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") closeProjectMenu();
  });
}

async function init() {
  bindUi();
  setLiveIdle();
  try {
    await loadProjects();
    await Promise.all([loadFlows(), loadHistory()]);
  } catch (err) {
    toast(err.message || "Failed to load API", true);
    $("flowCount").textContent = "API unreachable";
  }
}

init();
