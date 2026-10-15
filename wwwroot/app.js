(() => {
  "use strict";

  const API_URL = "/Analyzer/Evaluate";
  const OPERATION = { Set: 0, Add: 1, Sub: 2, Divide: 3, Mul: 4 };
  const OPERATION_LABEL = {
    0: "Set (=)",
    1: "Add (+)",
    2: "Subtract (−)",
    3: "Multiply (×)",
    4: "Divide (÷)"
  };
  const state = {
    states: [],
    nodes: [],
    nextStateId: 1,
    nextNodeId: 1,
    targetNodeId: null,
    requestPayload: null,
    responsePayload: null,
    lastVisited: [],
    lastTargetReached: null,
    animationTimer: null
  };

  const $ = (id) => document.getElementById(id);
  const stateForm = $("stateForm");
  const stateNameInput = $("stateNameInput");
  const stateValueInput = $("stateValueInput");
  const statesList = $("statesList");
  const nodesList = $("nodesList");
  const targetSelect = $("targetSelect");
  const analyzeBtn = $("analyzeBtn");
  const validationBox = $("validationBox");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function isInt(value) {
    if (value === "" || value === null || value === undefined) return false;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= -2147483648 && number <= 2147483647;
  }

  function getState(id) { return state.states.find((item) => item.id === Number(id)); }
  function getNode(id) { return state.nodes.find((item) => item.id === Number(id)); }
  function uniqueName(name, collection, exceptId = null) {
    const normalized = name.trim().toLocaleLowerCase();
    return !collection.some((item) => item.id !== exceptId && item.name.trim().toLocaleLowerCase() === normalized);
  }

  function addState(name, initialValue) {
    state.states.push({ id: state.nextStateId++, name: name.trim(), initialValue: Number(initialValue) });
    renderStates();
    renderNodes();
    updateSummary();
    clearResult();
  }

  function addNode(name) {
    state.nodes.push({ id: state.nextNodeId++, name: name.trim(), requirements: [], setters: [] });
    if (state.targetNodeId === null) state.targetNodeId = state.nodes[state.nodes.length - 1].id;
    renderNodes();
    renderTargetSelect();
    updateSummary();
    clearResult();
  }

  function renderStates() {
    statesList.innerHTML = "";
    statesList.classList.toggle("empty-state", state.states.length === 0);
    if (!state.states.length) {
      statesList.innerHTML = '<div class="empty-icon">∑</div><strong>No states yet</strong><span>Add a state to start defining the scenario.</span>';
      $("stateCountLabel").textContent = "0 defined";
      return;
    }
    $("stateCountLabel").textContent = `${state.states.length} defined`;
    state.states.forEach((item) => {
      const row = $("stateRowTemplate").content.firstElementChild.cloneNode(true);
      row.querySelector(".state-id").textContent = `S${item.id}`;
      row.querySelector(".state-name").textContent = item.name;
      const input = row.querySelector(".state-value");
      input.value = item.initialValue;
      input.setAttribute("aria-label", `Initial value for ${item.name}`);
      input.addEventListener("change", () => {
        if (!isInt(input.value)) {
          showValidation([`Initial value for "${item.name}" must be a 32-bit integer.`]);
          input.value = item.initialValue;
          return;
        }
        item.initialValue = Number(input.value);
        clearResult();
      });
      row.querySelector(".state-delete").addEventListener("click", () => {
        const used = state.nodes.some((node) =>
          node.requirements.some((rule) => rule.stateId === item.id) ||
          node.setters.some((rule) => rule.stateId === item.id));
        if (used && !confirm(`"${item.name}" is used by node rules. Delete it and remove those rules too?`)) return;
        state.nodes.forEach((node) => {
          node.requirements = node.requirements.filter((rule) => rule.stateId !== item.id);
          node.setters = node.setters.filter((rule) => rule.stateId !== item.id);
        });
        state.states = state.states.filter((candidate) => candidate.id !== item.id);
        renderStates(); renderNodes(); updateSummary(); clearResult();
      });
      statesList.appendChild(row);
    });
  }

  function stateOptions(selectedId) {
    if (!state.states.length) return '<option value="">Add a state first</option>';
    return state.states.map((item) =>
      `<option value="${item.id}" ${item.id === selectedId ? "selected" : ""}>${escapeHtml(item.name)} (S${item.id})</option>`
    ).join("");
  }

function renderNodes() {
  nodesList.innerHTML = "";
  nodesList.classList.toggle("empty-state", state.nodes.length === 0);
  if (!state.nodes.length) {
    nodesList.innerHTML = '<div class="empty-icon">◇</div><strong>No nodes yet</strong><span>Create your first node to configure its rules.</span>';
    return;
  }
  state.nodes.forEach((node) => {
    const card = $("nodeCardTemplate").content.firstElementChild.cloneNode(true);
    
    // Hide the ID badge and footer ID display
    const idBadge = card.querySelector(".node-id-badge");
    if (idBadge) idBadge.style.display = "none";

    const footerId = card.querySelector(".node-footer-id");
    if (footerId) footerId.style.display = "none";

    card.querySelector(".node-title").textContent = node.name;
    card.querySelector(".node-summary").textContent = `${node.requirements.length} requirement${node.requirements.length === 1 ? "" : "s"} · ${node.setters.length} state change${node.setters.length === 1 ? "" : "s"}`;
    card.querySelector(".node-footer-count").textContent = `${node.requirements.length + node.setters.length} RULES`;
    
    card.querySelector(".node-rename").addEventListener("click", async () => {
      const name = await showNodeModal("Rename Node", "Enter a new name for this node:", node.name);
      if (!name) return;
      const trimmed = name.trim();
      if (!trimmed) return showValidation(["Node name cannot be empty."]);
      if (!uniqueName(trimmed, state.nodes, node.id)) return showValidation([`A node named "${trimmed}" already exists.`]);
      node.name = trimmed;
      renderNodes(); renderTargetSelect(); updateSummary(); clearResult();
    });
    
    card.querySelector(".node-delete").addEventListener("click", () => {
      if (!confirm(`Delete node "${node.name}"?`)) return;
      state.nodes = state.nodes.filter((candidate) => candidate.id !== node.id);
      if (state.targetNodeId === node.id) state.targetNodeId = state.nodes.length ? state.nodes[0].id : null;
      renderNodes(); renderTargetSelect(); updateSummary(); clearResult();
    });
    
    card.querySelector(".add-requirement").addEventListener("click", () => {
      if (!state.states.length) return showValidation(["Create at least one state before adding a requirement."]);
      node.requirements.push({ stateId: state.states[0].id, value: 0 });
      renderNodes(); updateSummary(); clearResult();
    });
    
    card.querySelector(".add-setter").addEventListener("click", () => {
      if (!state.states.length) return showValidation(["Create at least one state before adding a state change."]);
      node.setters.push({ stateId: state.states[0].id, operation: OPERATION.Set, value: 0 });
      renderNodes(); updateSummary(); clearResult();
    });
    
    renderRuleRows(card.querySelector(".requirements-list"), node, "requirements");
    renderRuleRows(card.querySelector(".setters-list"), node, "setters");
    nodesList.appendChild(card);
  });
}

  function renderRuleRows(container, node, type) {
    const rules = node[type];
    container.innerHTML = "";
    if (!rules.length) {
      container.innerHTML = `<div class="no-rules">${type === "requirements" ? "No requirements · node is open" : "No state changes"}</div>`;
      return;
    }
    rules.forEach((rule, index) => {
      const row = document.createElement("div");
      row.className = `rule-row ${type === "setters" ? "setter-row" : ""}`;
      const stateSelect = document.createElement("select");
      stateSelect.setAttribute("aria-label", `${type} state for ${node.name}`);
      stateSelect.innerHTML = stateOptions(rule.stateId);
      stateSelect.addEventListener("change", () => {
        rule.stateId = Number(stateSelect.value);
        clearResult();
      });
      row.appendChild(stateSelect);

      if (type === "setters") {
        const opSelect = document.createElement("select");
        opSelect.setAttribute("aria-label", `Operation for ${node.name}`);
        opSelect.innerHTML = Object.entries(OPERATION_LABEL).map(([value, label]) =>
          `<option value="${value}" ${Number(value) === rule.operation ? "selected" : ""}>${label}</option>`
        ).join("");
        opSelect.addEventListener("change", () => { rule.operation = Number(opSelect.value); clearResult(); });
        row.appendChild(opSelect);
      }

      const valueInput = document.createElement("input");
      valueInput.type = "number";
      valueInput.step = "1";
      valueInput.value = rule.value;
      valueInput.setAttribute("aria-label", `${type === "requirements" ? "Required value" : "Operation operand"} for ${node.name}`);
      valueInput.title = type === "requirements" ? "Exact required integer value" : "Integer operand";
      valueInput.addEventListener("change", () => {
        if (!isInt(valueInput.value)) {
          showValidation([`Rule values for "${node.name}" must be 32-bit integers.`]);
          valueInput.value = rule.value;
          return;
        }
        rule.value = Number(valueInput.value);
        clearResult();
      });
      row.appendChild(valueInput);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-rule";
      remove.textContent = "×";
      remove.title = "Remove rule";
      remove.setAttribute("aria-label", "Remove rule");
      remove.addEventListener("click", () => {
        rules.splice(index, 1);
        renderNodes(); updateSummary(); clearResult();
      });
      row.appendChild(remove);
      container.appendChild(row);
    });
  }

  function renderTargetSelect() {
    targetSelect.innerHTML = "";
    targetSelect.disabled = state.nodes.length === 0;
    if (!state.nodes.length) {
      targetSelect.innerHTML = '<option value="">Create a node first</option>';
      return;
    }
    state.nodes.forEach((node) => {
      const option = document.createElement("option");
      option.value = String(node.id);
      option.textContent = `${node.name} (ID ${node.id})`;
      option.selected = node.id === state.targetNodeId;
      targetSelect.appendChild(option);
    });
  }

  function updateSummary() {
    $("stateCountStat").textContent = state.states.length;
    $("nodeCountStat").textContent = state.nodes.length;
    $("ruleCountStat").textContent = state.nodes.reduce((sum, node) => sum + node.requirements.length + node.setters.length, 0);
  }

  function showValidation(errors) {
    validationBox.hidden = false;
    validationBox.innerHTML = `<strong>Please fix the following:</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>`;
    validationBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function hideValidation() { validationBox.hidden = true; validationBox.innerHTML = ""; }

  function validateScenario() {
    const errors = [];
    if (!state.states.length) errors.push("Add at least one state.");
    if (!state.nodes.length) errors.push("Add at least one node.");
    if (state.targetNodeId === null || !getNode(state.targetNodeId)) errors.push("Choose a valid target node.");
    if (state.nodes.length && state.nodes.every((node) => node.requirements.length === 0 && node.setters.length === 0)) {
      errors.push("Add at least one requirement or state change. Your current backend rejects an empty State_helpers array.");
    }
    state.states.forEach((item) => {
      if (!item.name.trim()) errors.push("State names cannot be empty.");
      if (!isInt(item.initialValue)) errors.push(`Initial value for "${item.name}" must be a 32-bit integer.`);
      if (!uniqueName(item.name, state.states, item.id)) errors.push(`State name "${item.name}" is duplicated.`);
    });
    state.nodes.forEach((node) => {
      if (!node.name.trim()) errors.push("Node names cannot be empty.");
      if (!uniqueName(node.name, state.nodes, node.id)) errors.push(`Node name "${node.name}" is duplicated.`);
      node.requirements.forEach((rule) => {
        if (!getState(rule.stateId)) errors.push(`Node "${node.name}" has a requirement referencing a missing state.`);
        if (!isInt(rule.value)) errors.push(`A required value on "${node.name}" is not a valid 32-bit integer.`);
      });
      node.setters.forEach((rule) => {
        if (!getState(rule.stateId)) errors.push(`Node "${node.name}" has a state change referencing a missing state.`);
        if (!isInt(rule.value)) errors.push(`A state-change operand on "${node.name}" is not a valid 32-bit integer.`);
        if (rule.operation === OPERATION.Divide && Number(rule.value) === 0) errors.push(`Node "${node.name}" divides by zero. Choose a non-zero divisor.`);
      });
    });
    return [...new Set(errors)];
  }

  function buildPayload() {
    const nodesDict = {};
    const stateDict = {};
    const helpers = [];
    state.states.forEach((item) => { stateDict[String(item.id)] = Number(item.initialValue); });

    state.nodes.forEach((node) => {
      let needOffset = -1;
      let needLen = 0;
      let setterOffset = -1;
      let setterLen = 0;

      if (node.requirements.length) {
        needOffset = helpers.length;
        needLen = node.requirements.length;
        node.requirements.forEach((rule) => {
          helpers.push({ Id: Number(rule.stateId), Val: Number(rule.value), Op_type: OPERATION.Set });
        });
      }
      if (node.setters.length) {
        setterOffset = helpers.length;
        setterLen = node.setters.length;
        node.setters.forEach((rule) => {
          helpers.push({ Id: Number(rule.stateId), Val: Number(rule.value), Op_type: Number(rule.operation) });
        });
      }
      nodesDict[String(node.id)] = {
        Need_offset: needOffset,
        Need_Len: needLen,
        Setter_offset: setterOffset,
        Setter_Len: setterLen,
        Visited: false
      };
    });

    return {
      Nodes: nodesDict,
      States: stateDict,
      State_helpers: helpers,
      Target_node_id: Number(state.targetNodeId)
    };
  }

  async function analyze() {
    hideValidation();
    const errors = validateScenario();
    if (errors.length) { showValidation(errors); return; }
    const payload = buildPayload();
    state.requestPayload = payload;
    $("requestJson").textContent = JSON.stringify(payload, null, 2);
    $("responseJson").textContent = "{ }";
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<span>◌</span> Analyzing…';
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
      state.responsePayload = data;
      $("responseJson").textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
      if (!response.ok) {
        const message = data && typeof data === "object" ? (data.detail || data.title || data.message) : data;
        throw new Error(message || `Server returned HTTP ${response.status}.`);
      }
      const visited = Array.isArray(data) ? data : (data && (data.Nodes_open || data.nodes_open || data.visitedNodeIds || data.VisitedNodeIds));
      if (!Array.isArray(visited)) {
        throw new Error("The API response was not a JSON array of node IDs. Expected Results.Ok(List<int>) or an Analyzer_Result DTO containing Nodes_open.");
      }
      const numericVisited = visited.map(Number);
      if (numericVisited.some((id) => !Number.isInteger(id) || !getNode(id))) {
        throw new Error("The API returned a node ID that is not present in the submitted scenario.");
      }
      state.lastVisited = numericVisited;
      state.lastTargetReached = numericVisited.includes(Number(state.targetNodeId));
      renderResult(numericVisited, state.lastTargetReached);
      await playSequence(numericVisited, state.lastTargetReached);
    } catch (error) {
      setResultError(error.message || "Could not contact the API.");
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.innerHTML = '<span>▶</span> Analyze scenario';
    }
  }

  function renderResult(visited, targetReached) {
    $("resultBadge").className = `result-badge ${targetReached ? "success" : "failure"}`;
    $("resultBadge").textContent = targetReached ? "Target achievable" : "Target not achievable";
    $("resultTitle").textContent = targetReached ? "Target is achievable" : "Target is not achievable";
    $("resultDescription").textContent = targetReached
      ? "The target node appears in the backend’s visited-node sequence."
      : "The analysis finished without visiting the target node.";
    $("resultIcon");
    document.querySelector(".result-icon").textContent = targetReached ? "✓" : "!";
    document.querySelector(".result-icon").style.color = targetReached ? "var(--green)" : "var(--red)";
    $("visitedCount").textContent = String(new Set(visited).size);
    const target = getNode(state.targetNodeId);
    $("targetNameResult").textContent = target ? `${target.name} (#${target.id})` : "—";
    $("sequenceLabel").textContent = visited.length ? `${visited.length} node visit${visited.length === 1 ? "" : "s"} returned` : "No nodes were visited";
    const list = $("sequenceList");
    list.innerHTML = "";
    if (!visited.length) {
      list.innerHTML = '<li class="sequence-empty">The backend returned an empty sequence.</li>';
    } else {
      visited.forEach((id, index) => {
        const node = getNode(id);
        const li = document.createElement("li");
        li.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(node ? node.name : `Node ${id}`)} <span>(ID ${id})</span>`;
        list.appendChild(li);
      });
    }
    renderScene([]);
    $("replayBtn").disabled = visited.length === 0 && state.nodes.length === 0;
  }

  function renderScene(visitedSoFar, currentId = null, final = false, targetReached = null) {
    const scene = $("scene");
    scene.classList.remove("empty-scene");
    scene.innerHTML = "";
    state.nodes.forEach((node) => {
      const el = document.createElement("div");
      el.className = "scene-node";
      if (visitedSoFar.includes(node.id)) el.classList.add("visited");
      if (node.id === state.targetNodeId) el.classList.add("target");
      if (node.id === currentId) el.classList.add("current");
      if (final && node.id === state.targetNodeId && !targetReached) el.classList.add("unreachable");
      const status = node.id === state.targetNodeId && final && !targetReached
        ? "TARGET · NOT REACHED"
        : visitedSoFar.includes(node.id) ? "VISITED" : node.id === state.targetNodeId ? "TARGET" : "NOT VISITED";
      el.innerHTML = `<span class="scene-node-id">NODE ${node.id}</span><strong>${escapeHtml(node.name)}</strong><span class="scene-node-status">${status}</span>`;
      scene.appendChild(el);
    });
    if (!state.nodes.length) scene.classList.add("empty-scene");
  }

  function stopAnimation() {
    if (state.animationTimer) {
      clearTimeout(state.animationTimer);
      state.animationTimer = null;
    }
  }
  function wait(ms) { return new Promise((resolve) => { state.animationTimer = setTimeout(resolve, ms); }); }

  async function playSequence(visited, targetReached) {
    stopAnimation();
    renderScene([]);
    const replayBtn = $("replayBtn");
    replayBtn.disabled = false;
    const seen = [];
    for (const id of visited) {
      seen.push(id);
      renderScene(seen, id, false, null);
      await wait(420);
    }
    renderScene(seen, null, true, targetReached);
    $("sequenceLabel").textContent = targetReached
      ? `Complete · target ${state.targetNodeId} reached`
      : `Complete · target ${state.targetNodeId} not visited`;
  }

  function setResultError(message) {
    stopAnimation();
    $("resultBadge").className = "result-badge error";
    $("resultBadge").textContent = "Request failed";
    $("resultTitle").textContent = "Could not complete analysis";
    $("resultDescription").textContent = message;
    document.querySelector(".result-icon").textContent = "!";
    document.querySelector(".result-icon").style.color = "var(--amber)";
    $("scene").classList.remove("empty-scene");
    $("scene").innerHTML = `<div class="scene-empty-content"><span class="scene-symbol">⚠</span><strong>Analysis request failed</strong><span>${escapeHtml(message)}</span></div>`;
    $("sequenceLabel").textContent = "No valid result returned";
    $("replayBtn").disabled = true;
  }

  function clearResult() {
    stopAnimation();
    state.lastVisited = [];
    state.lastTargetReached = null;
    $("resultBadge").className = "result-badge neutral";
    $("resultBadge").textContent = "Not run yet";
    $("resultTitle").textContent = "Waiting for analysis";
    $("resultDescription").textContent = "Your scenario changed. Run analysis again to refresh the result.";
    document.querySelector(".result-icon").textContent = "✓";
    document.querySelector(".result-icon").style.color = "var(--blue)";
    $("visitedCount").textContent = "—";
    $("targetNameResult").textContent = "—";
    $("sequenceLabel").textContent = "No current execution sequence";
    $("sequenceList").innerHTML = '<li class="sequence-empty">Run the analyzer to see the sequence.</li>';
    $("scene").classList.remove("empty-scene");
    $("scene").innerHTML = "";
    state.nodes.forEach((node) => {
      const el = document.createElement("div");
      el.className = "scene-node";
      if (node.id === state.targetNodeId) el.classList.add("target");
      el.innerHTML = `<span class="scene-node-id">NODE ${node.id}</span><strong>${escapeHtml(node.name)}</strong><span class="scene-node-status">${node.id === state.targetNodeId ? "TARGET" : "NOT VISITED"}</span>`;
      $("scene").appendChild(el);
    });
    if (!state.nodes.length) {
      $("scene").classList.add("empty-scene");
      $("scene").innerHTML = '<div class="scene-empty-content"><span class="scene-symbol">◎</span><strong>Your scenario will appear here</strong><span>Configure nodes above, then run the analyzer.</span></div>';
    }
    $("replayBtn").disabled = true;
  }

  stateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    hideValidation();
    const name = stateNameInput.value.trim();
    const value = stateValueInput.value;
    if (!name) return showValidation(["State name cannot be empty."]);
    if (!uniqueName(name, state.states)) return showValidation([`A state named "${name}" already exists.`]);
    if (!isInt(value)) return showValidation(["Initial state value must be a 32-bit integer."]);
    addState(name, Number(value));
    stateNameInput.value = "";
    stateValueInput.value = "0";
    stateNameInput.focus();
  });

  $("addNodeBtn").addEventListener("click", async () => {
  const name = await showNodeModal("Create New Node", "Enter a name for the new node:");
  if (!name) return;
  if (!uniqueName(name, state.nodes)) return showValidation([`A node named "${name}" already exists.`]);
  
  const newId = state.nodes.length ? Math.max(...state.nodes.map(n => n.id)) + 1 : 1;
  state.nodes.push({ id: newId, name: name, requirements: [], setters: [] });
  renderNodes();
  renderTargetSelect();
  updateSummary();
  clearResult();
});

  targetSelect.addEventListener("change", () => {
    state.targetNodeId = Number(targetSelect.value);
    updateSummary();
    clearResult();
  });
  analyzeBtn.addEventListener("click", analyze);
  $("replayBtn").addEventListener("click", () => {
    if (state.lastTargetReached !== null) playSequence(state.lastVisited, state.lastTargetReached);
  });
  $("copyJsonBtn").addEventListener("click", async () => {
    if (!state.requestPayload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(state.requestPayload, null, 2));
      $("copyJsonBtn").textContent = "Copied!";
      setTimeout(() => $("copyJsonBtn").textContent = "Copy JSON", 1200);
    } catch {
      showValidation(["Clipboard access was blocked by the browser. You can select and copy the request JSON manually."]);
    }
  });

  $("loadExampleBtn").addEventListener("click", () => {
    if ((state.states.length || state.nodes.length) && !confirm("Replace the current scenario with the example?")) return;
    stopAnimation();
    state.states = [];
    state.nodes = [];
    state.nextStateId = 1;
    state.nextNodeId = 1;
    state.targetNodeId = null;
    addState("HasKey", 0);
    addState("DoorOpen", 0);
    addNode("Entrance");
    addNode("Find key");
    addNode("Unlock exit");
    state.nodes[0].setters.push({ stateId: 1, operation: OPERATION.Set, value: 0 });
    state.nodes[1].requirements.push({ stateId: 1, value: 0 });
    state.nodes[1].setters.push({ stateId: 1, operation: OPERATION.Set, value: 1 });
    state.nodes[2].requirements.push({ stateId: 1, value: 1 });
    state.nodes[2].setters.push({ stateId: 2, operation: OPERATION.Set, value: 1 });
    state.targetNodeId = 3;
    renderStates(); renderNodes(); renderTargetSelect(); updateSummary(); clearResult(); hideValidation();
  });

  function showNodeModal(title, description, initialValue = "")
  {
  return new Promise((resolve) => {
    const modal = $("nodeModal");
    const modalTitle = $("modalTitle");
    const modalDesc = $("modalDesc");
    const input = $("modalInput");
    const confirmBtn = $("modalConfirm");
    const cancelBtn = $("modalCancel");

    modalTitle.textContent = title;
    modalDesc.textContent = description;
    input.value = initialValue;
    modal.style.display = "grid";
    input.focus();
    input.select();

    function cleanup() {
      modal.style.display = "none";
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      input.removeEventListener("keydown", onKeydown);
    }

    function onConfirm() {
      const val = input.value.trim();
      cleanup();
      resolve(val);
    }

    function onCancel() {
      cleanup();
      resolve(null);
    }

    function onKeydown(e) {
      if (e.key === "Enter") onConfirm();
      if (e.key === "Escape") onCancel();
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    input.addEventListener("keydown", onKeydown);
  });
}

  renderStates();
  renderNodes();
  renderTargetSelect();
  updateSummary();
  clearResult();
})();
