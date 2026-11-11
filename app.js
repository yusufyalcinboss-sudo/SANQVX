(() => {
  "use strict";

  const DB_NAME = "sanqvx-workspace";
  const DB_VERSION = 1;
  const MAX_FILE_SIZE = 2 * 1024 * 1024;
  const MAX_VERSIONS = 30;
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    editor: $("#editor"),
    highlight: $("#highlight-layer"),
    lineNumbers: $("#line-numbers"),
    list: $("#script-list"),
    tabs: $("#tabs"),
    projectSelect: $("#project-select"),
    search: $("#search"),
    fileInput: $("#file-input"),
    backupInput: $("#backup-input"),
    modal: $("#modal"),
    modalContent: $("#modal-content"),
    toast: $("#toast"),
    status: $("#status-message"),
  };
  const state = {
    db: null,
    projects: [],
    scripts: [],
    tabs: [],
    activeId: null,
    category: "All",
    search: "",
    saveTimers: new Map(),
    historyTimers: new Map(),
    toastTimer: null,
    installPrompt: null,
    settings: {accent: "#52a9ff", fontSize: 13, background: "glow", motion: true},
  };

  function id() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("scripts")) {
          const scripts = db.createObjectStore("scripts", {keyPath: "id"});
          scripts.createIndex("projectId", "projectId", {unique: false});
        }
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", {keyPath: "id"});
        if (!db.objectStoreNames.contains("versions")) {
          const versions = db.createObjectStore("versions", {keyPath: "id"});
          versions.createIndex("scriptId", "scriptId", {unique: false});
        }
        if (!db.objectStoreNames.contains("settings")) db.createObjectStore("settings", {keyPath: "id"});
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open local storage."));
    });
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Local storage operation failed."));
    });
  }

  async function getAll(storeName) {
    return requestResult(state.db.transaction(storeName, "readonly").objectStore(storeName).getAll());
  }

  async function put(storeName, value) {
    return requestResult(state.db.transaction(storeName, "readwrite").objectStore(storeName).put(value));
  }

  async function remove(storeName, key) {
    return requestResult(state.db.transaction(storeName, "readwrite").objectStore(storeName).delete(key));
  }

  function activeTab() {
    return state.tabs.find((tab) => tab.id === state.activeId);
  }

  function activeScript() {
    const tab = activeTab();
    return tab ? state.scripts.find((script) => script.id === tab.id) : null;
  }

  function escapeHtml(text) {
    return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function highlight(source) {
    const tokens = /(--\[\[[\s\S]*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:and|break|continue|do|else|elseif|end|export|false|for|function|if|in|local|nil|not|or|repeat|return|then|true|type|until|while|as|assert|const)\b|\b(?:game|workspace|script|require|task|Instance|Vector[234]|CFrame|Color3|UDim2|Enum|math|string|table|typeof|print|warn|pairs|ipairs|pcall|xpcall|tostring|tonumber|select|unpack|self)\b|\b\d+(?:\.\d+)?\b)/g;
    let result = "";
    let cursor = 0;
    for (const match of source.matchAll(tokens)) {
      const value = match[0];
      result += escapeHtml(source.slice(cursor, match.index));
      const cls = value.startsWith("--") ? "comment"
        : /^[`"']/.test(value) ? "str"
        : /^\d/.test(value) ? "num"
        : /^(game|workspace|script|require|task|Instance|Vector[234]|CFrame|Color3|UDim2|Enum|math|string|table|typeof|print|warn|pairs|ipairs|pcall|xpcall|tostring|tonumber|select|unpack|self)$/.test(value) ? "builtin"
        : "kw";
      result += `<span class="${cls}">${escapeHtml(value)}</span>`;
      cursor = match.index + value.length;
    }
    return result + escapeHtml(source.slice(cursor)) + (source.endsWith("\n") ? " " : "");
  }

  function toast(message, error = false) {
    clearTimeout(state.toastTimer);
    ui.toast.textContent = message;
    ui.toast.classList.toggle("error", error);
    ui.toast.classList.add("show");
    state.toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
    ui.status.classList.toggle("error", error);
  }

  function currentProjectId() {
    return ui.projectSelect.value || state.projects[0]?.id || null;
  }

  function currentProjectName() {
    return state.projects.find((project) => project.id === currentProjectId())?.name || "My Project";
  }

  function updateEditor() {
    const tab = activeTab();
    const script = activeScript();
    const source = tab?.source || "";
    ui.editor.value = source;
    ui.highlight.innerHTML = highlight(source);
    updateLineNumbers(source);
    $("#crumb-project").textContent = currentProjectName();
    $("#crumb-script").textContent = script?.name || "Untitled";
    $("#dirty-indicator").hidden = !tab?.dirty;
    $("#empty-state").hidden = Boolean(tab);
    renderCategories();
    renderTabs();
    renderList();
    renderVision();
  }

  function updateLineNumbers(source) {
    const count = Math.max(1, source.split("\n").length);
    ui.lineNumbers.textContent = Array.from({length: count}, (_, index) => index + 1).join("\n");
    ui.lineNumbers.scrollTop = ui.editor.scrollTop;
  }

  function renderTabs() {
    ui.tabs.replaceChildren();
    for (const tab of state.tabs) {
      const script = state.scripts.find((item) => item.id === tab.id);
      if (!script) continue;
      const node = document.createElement("div");
      node.className = `tab${tab.id === state.activeId ? " active" : ""}`;
      node.innerHTML = `<span class="tab-dirty">${tab.dirty ? "●" : ""}</span><span class="tab-label"></span><button class="tab-close" aria-label="Close tab">×</button>`;
      node.querySelector(".tab-label").textContent = script.name;
      node.querySelector(".tab-label").addEventListener("click", () => selectTab(tab.id));
      node.querySelector(".tab-close").addEventListener("click", (event) => {
        event.stopPropagation();
        closeTab(tab.id).catch((error) => toast(`Could not close tab: ${error.message}`, true));
      });
      node.addEventListener("click", () => selectTab(tab.id));
      ui.tabs.append(node);
    }
  }

  function renderCategories() {
    const categories = ["All", "Favorites", "Saved"];
    for (const script of state.scripts) {
      if (script.projectId === currentProjectId() && script.category && script.category !== "Uncategorized" && !categories.includes(script.category)) {
        categories.push(script.category);
      }
    }
    if (!categories.includes(state.category)) state.category = "All";
    const container = $("#categories");
    container.replaceChildren();
    for (const category of categories) {
      const button = document.createElement("button");
      button.className = `category${category === state.category ? " active" : ""}`;
      button.dataset.category = category;
      button.textContent = category === "Favorites" ? "★" : category;
      if (category === "All") {
        const count = document.createElement("span");
        count.id = "script-count";
        count.textContent = state.scripts.filter((script) => script.projectId === currentProjectId()).length;
        button.append(count);
      }
      container.append(button);
    }
  }

  function renderList() {
    const projectId = currentProjectId();
    const query = state.search.toLocaleLowerCase();
    const scripts = state.scripts.filter((script) => {
      const textMatch = !query || `${script.name} ${script.source} ${script.category || ""}`.toLocaleLowerCase().includes(query);
      const projectMatch = script.projectId === projectId;
      const categoryMatch = state.category === "All"
        || (state.category === "Favorites" && script.favorite)
        || (state.category === "Saved" && script.saved)
        || script.category === state.category;
      return projectMatch && categoryMatch && textMatch;
    });
    $("#script-count").textContent = state.scripts.filter((script) => script.projectId === projectId).length;
    ui.list.replaceChildren();
    if (!scripts.length) {
      const empty = document.createElement("div");
      empty.className = "empty-list";
      empty.textContent = state.search ? "No matching scripts. Try another search." : "No scripts yet. Create a script or import a .luau file.";
      ui.list.append(empty);
      return;
    }
    for (const script of scripts) {
      const item = document.createElement("div");
      item.className = `script-item${script.id === state.activeId ? " active" : ""}`;
      const glyph = document.createElement("span");
      glyph.className = "script-glyph";
      glyph.textContent = script.kind === "ModuleScript" ? "M" : script.kind === "LocalScript" ? "L" : "S";
      const copy = document.createElement("span");
      copy.className = "script-copy";
      const name = document.createElement("strong");
      name.textContent = script.name;
      const meta = document.createElement("small");
      meta.textContent = `${script.kind || "Script"}${script.saved ? " · saved" : ""}`;
      copy.append(name, meta);
      const favorite = document.createElement("button");
      favorite.className = `favorite-star${script.favorite ? " on" : ""}`;
      favorite.textContent = script.favorite ? "★" : "☆";
      favorite.title = script.favorite ? "Remove favorite" : "Add favorite";
      favorite.setAttribute("aria-label", favorite.title);
      favorite.addEventListener("click", async (event) => {
        event.stopPropagation();
        script.favorite = !script.favorite;
        await put("scripts", script);
        renderList();
      });
      item.append(glyph, copy, favorite);
      item.addEventListener("click", () => selectTab(script.id));
      item.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        showScriptMenu(script);
      });
      ui.list.append(item);
    }
  }

  function renderVision() {
    const list = state.scripts.filter((script) => script.projectId === currentProjectId());
    const root = document.createElement("div");
    const rootRow = document.createElement("div");
    rootRow.className = "tree-row";
    rootRow.innerHTML = '<span>◈</span>';
    const label = document.createElement("span");
    label.textContent = currentProjectName();
    rootRow.append(label);
    root.append(rootRow);
    for (const script of list.slice(0, 8)) {
      const row = document.createElement("div");
      row.className = "tree-row";
      const branch = document.createElement("span");
      branch.className = "tree-branch";
      branch.textContent = "├─";
      const name = document.createElement("span");
      name.textContent = script.name;
      row.append(branch, name);
      root.append(row);
    }
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "tree-row";
      empty.textContent = "└─ No scripts yet";
      root.append(empty);
    } else if (list.length > 8) {
      const more = document.createElement("div");
      more.className = "tree-row tree-branch";
      more.textContent = `└─ +${list.length - 8} more`;
      root.append(more);
    }
    $("#vision-tree").replaceChildren(root);
  }

  function renderProjects() {
    const selected = ui.projectSelect.value;
    ui.projectSelect.replaceChildren();
    for (const project of state.projects) {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = project.name;
      ui.projectSelect.append(option);
    }
    if (state.projects.some((project) => project.id === selected)) ui.projectSelect.value = selected;
    else if (state.projects[0]) ui.projectSelect.value = state.projects[0].id;
  }

  async function selectTab(scriptId) {
    const script = state.scripts.find((item) => item.id === scriptId);
    if (!script) return;
    let tab = state.tabs.find((item) => item.id === scriptId);
    if (!tab) {
      tab = {id: script.id, source: script.source, dirty: false, undo: [script.source], undoIndex: 0};
      state.tabs.push(tab);
    }
    state.activeId = scriptId;
    updateEditor();
  }

  async function closeTab(scriptId) {
    const index = state.tabs.findIndex((tab) => tab.id === scriptId);
    if (index < 0) return;
    const tab = state.tabs[index];
    if (tab.dirty) {
      const script = state.scripts.find((item) => item.id === scriptId);
      if (script) {
        script.source = tab.source;
        script.updatedAt = Date.now();
        script.saved = true;
        await put("scripts", script);
      }
    }
    clearTimeout(state.saveTimers.get(scriptId));
    clearTimeout(state.historyTimers.get(scriptId));
    state.saveTimers.delete(scriptId);
    state.historyTimers.delete(scriptId);
    state.tabs.splice(index, 1);
    if (state.activeId === scriptId) state.activeId = state.tabs[Math.max(0, index - 1)]?.id || null;
    updateEditor();
  }

  async function createScript(name = "NewScript", kind = "Script", source = "-- Write Luau for Roblox Studio here.\n", projectId = currentProjectId()) {
    if (!projectId) throw new Error("Create a project before adding scripts.");
    const script = {
      id: id(), projectId, name: sanitizeName(name), kind, source, category: "Uncategorized",
      favorite: false, saved: false, createdAt: Date.now(), updatedAt: Date.now(),
    };
    await put("scripts", script);
    state.scripts.push(script);
    await selectTab(script.id);
    toast(`${script.name} created locally.`);
  }

  function sanitizeName(name) {
    const clean = String(name || "NewScript").replace(/[\u0000-\u001f<>:"/\\|?*]/g, "").trim().slice(0, 80);
    return clean || "NewScript";
  }

  async function persistActive(makeVersion = false) {
    const tab = activeTab();
    const script = activeScript();
    if (!tab || !script) {
      toast("Create or open a script first.", true);
      return false;
    }
    script.source = tab.source;
    script.updatedAt = Date.now();
    script.saved = true;
    await put("scripts", script);
    tab.dirty = false;
    if (makeVersion) await saveVersion(script);
    $("#dirty-indicator").hidden = true;
    $("#crumb-script").textContent = script.name;
    renderTabs();
    renderList();
    return true;
  }

  async function saveVersion(script) {
    const versions = await getAll("versions");
    const own = versions.filter((version) => version.scriptId === script.id).sort((a, b) => b.createdAt - a.createdAt);
    if (own[0]?.source === script.source) return;
    await put("versions", {id: id(), scriptId: script.id, source: script.source, createdAt: Date.now()});
    for (const old of own.slice(MAX_VERSIONS - 1)) await remove("versions", old.id);
  }

  function schedulePersist(tabId = state.activeId) {
    const tab = state.tabs.find((item) => item.id === tabId);
    const script = state.scripts.find((item) => item.id === tabId);
    if (!tab || !script) return;
    clearTimeout(state.saveTimers.get(tab.id));
    const timer = setTimeout(async () => {
      try {
        script.source = tab.source;
        script.updatedAt = Date.now();
        script.saved = true;
        await put("scripts", script);
        tab.dirty = false;
        if (state.activeId === tab.id) {
          $("#dirty-indicator").hidden = true;
          $("#crumb-script").textContent = script.name;
          renderTabs();
          renderList();
        }
        toast("Autosaved on this device.");
      } catch (error) {
        toast(`Autosave failed: ${error.message}`, true);
      } finally {
        state.saveTimers.delete(tab.id);
      }
    }, 850);
    state.saveTimers.set(tab.id, timer);
  }

  function queueAutosave() {
    const tab = activeTab();
    if (!tab) return;
    tab.source = ui.editor.value;
    tab.dirty = true;
    $("#dirty-indicator").hidden = false;
    $("#crumb-script").textContent = `${activeScript()?.name || "Untitled"} · unsaved`;
    schedulePersist(tab.id);
    clearTimeout(state.historyTimers.get(tab.id));
    const historyTimer = setTimeout(() => {
      if (tab.undo[tab.undoIndex] === tab.source) return;
      tab.undo = tab.undo.slice(0, tab.undoIndex + 1);
      tab.undo.push(tab.source);
      if (tab.undo.length > 80) tab.undo.shift();
      tab.undoIndex = tab.undo.length - 1;
    }, 350);
    state.historyTimers.set(tab.id, historyTimer);
    updateHighlights();
  }

  function updateHighlights() {
    const source = ui.editor.value;
    ui.highlight.innerHTML = highlight(source);
    updateLineNumbers(source);
    const line = ui.editor.value.slice(0, ui.editor.selectionStart).split("\n");
    $("#cursor-position").textContent = `Ln ${line.length}, Col ${line.at(-1).length + 1}`;
  }

  function moveHistory(direction) {
    const tab = activeTab();
    if (!tab) return;
    const next = tab.undoIndex + direction;
    if (next < 0 || next >= tab.undo.length) return;
    tab.undoIndex = next;
    tab.source = tab.undo[next];
    tab.dirty = true;
    ui.editor.value = tab.source;
    updateHighlights();
    renderTabs();
    $("#dirty-indicator").hidden = false;
    schedulePersist(tab.id);
  }

  function scanSource(source) {
    const findings = [];
    const lines = source.split("\n");
    const rules = [
      {pattern: /\bloadstring\s*\(/, level: "risk", title: "Dynamic code execution call; review before using in Studio."},
      {pattern: /\bHttpService\s*:\s*GetAsync\s*\(/, level: "warning", title: "HTTP access may require Studio security settings and a trusted endpoint."},
      {pattern: /\bHttpService\s*:\s*PostAsync\s*\(/, level: "warning", title: "HTTP POST sends data outside this project; verify the destination and payload."},
      {pattern: /\bgetfenv\s*\(|\bsetfenv\s*\(/, level: "warning", title: "Environment manipulation can make code harder to reason about."},
      {pattern: /\bwhile\s+true\s+do\b/, level: "warning", title: "Unbounded loop found; verify it yields or has a safe exit."},
      {pattern: /\.Source\s*=/, level: "risk", title: "Script source modification; inspect context and permissions."},
      {pattern: /\bWaitForChild\s*\(\s*["'][^"']+["']\s*\)/, level: "info", title: "WaitForChild without timeout may wait indefinitely if the instance is missing."},
      {pattern: /\bTODO\b|\bFIXME\b/i, level: "info", title: "Unfinished TODO/FIXME marker."},
    ];
    for (let index = 0; index < lines.length; index += 1) {
      for (const rule of rules) if (rule.pattern.test(lines[index])) findings.push({line: index + 1, level: rule.level, title: rule.title});
    }
    const opens = (source.match(/\b(function|then|do|repeat)\b/g) || []).length;
    const closes = (source.match(/\bend\b/g) || []).length + (source.match(/\buntil\b/g) || []).length;
    if (opens !== closes) findings.push({line: 1, level: "info", title: "Block keywords appear unbalanced; confirm syntax in Roblox Studio."});
    const score = Math.max(0, 100 - findings.reduce((sum, item) => sum + (item.level === "risk" ? 22 : item.level === "warning" ? 11 : 4), 0));
    return {findings, score};
  }

  function runScan(showModal = false) {
    const script = activeScript();
    if (!script) {
      toast("Open a script before scanning.", true);
      return;
    }
    const {findings, score} = scanSource(ui.editor.value);
    $("#health-value").style.width = `${score}%`;
    $("#health-value").classList.toggle("warn", score < 70);
    $("#health-label").textContent = `${score}/100 · heuristic checks`;
    $("#health-findings").textContent = findings.length ? `${findings.length} note(s) found. Open Scan for details.` : "No heuristic flags found. This is not a full Luau type or security analysis.";
    toast(findings.length ? `${findings.length} review note(s) found. Studio may report additional issues.` : "No heuristic flags found. Verify in Studio.");
    if (showModal) {
      const body = findings.length
        ? findings.map((item) => `<div class="scan-item ${item.level === "risk" ? "error" : item.level === "info" ? "info" : ""}"><strong>Line ${item.line} · ${item.level.toUpperCase()}</strong><br>${escapeHtml(item.title)}</div>`).join("")
        : '<p class="modal-note">No heuristic flags found. This is not a full Luau parser, compatibility guarantee, or security audit. Verify compatibility and output in Roblox Studio.</p>';
      showModalView("Script Scanner", `${body}<p class="modal-note">The scanner only flags patterns for review. Roblox services, permissions, server/client context, APIs and runtime behavior must be checked in Studio.</p>`);
    }
  }

  function showModalView(title, body) {
    ui.modalContent.innerHTML = `<div class="modal-head"><h2>${escapeHtml(title)}</h2><button class="modal-close" aria-label="Close">×</button></div><div class="modal-body">${body}</div>`;
    ui.modalContent.querySelector(".modal-close").addEventListener("click", () => ui.modal.close());
    if (!ui.modal.open) ui.modal.showModal();
  }

  function selectedSource() {
    const start = ui.editor.selectionStart;
    const end = ui.editor.selectionEnd;
    return start !== end ? ui.editor.value.slice(start, end) : ui.editor.value;
  }

  function assistant(action) {
    const source = selectedSource();
    const output = $("#assistant-output");
    if (!source.trim()) {
      output.textContent = action === "build"
        ? "Create a UI template with a name, then insert it into the editor. This offline template builder does not generate arbitrary code."
        : "Select code in the editor first.";
      if (action === "build") showBuilder();
      return;
    }
    if (action === "explain") {
      const lines = source.split("\n").filter((line) => line.trim());
      const funcs = [...source.matchAll(/function\s+([\w.:]+)/g)].map((match) => match[1]);
      const locals = [...source.matchAll(/local\s+([\w]+)/g)].map((match) => match[1]).slice(0, 5);
      output.textContent = `${lines.length} non-empty line(s).${funcs.length ? ` Functions: ${funcs.join(", ")}.` : ""}${locals.length ? ` Locals: ${locals.join(", ")}.` : ""} This is a lightweight local summary, not an AI-generated explanation.`;
    } else {
      const notes = [];
      if (!/\blocal\b/.test(source)) notes.push("Consider local scope where appropriate.");
      if (source.length > 12000) notes.push("Large code selection; consider splitting independent responsibilities into ModuleScripts.");
      if (!/\bpcall\s*\(/.test(source) && /\bGetAsync|PostAsync|RequestAsync\b/.test(source)) notes.push("Handle HTTP failures explicitly and validate responses.");
      if (/\bwhile\s+true\s+do\b/.test(source) && !/\btask\.wait\s*\(/.test(source)) notes.push("Check that long loops yield to avoid blocking work.");
      output.textContent = notes.length ? notes.join(" ") : "No simple maintainability hints found. This is a heuristic review, not a performance profiler.";
    }
  }

  function showBuilder() {
    showModalView("UI Template Builder", `
      <p class="modal-note">Create a conservative Roblox Studio UI starter. Review and test it in Studio before use.</p>
      <label class="field">ScreenGui name<input id="builder-name" maxlength="40" value="MainUI"></label>
      <label class="field">Button label<input id="builder-label" maxlength="60" value="Click me"></label>
      <div class="modal-actions"><button class="secondary-button" data-modal-close>Cancel</button><button class="primary-button" id="insert-template">Insert template</button></div>`);
    $("#insert-template").addEventListener("click", () => {
      const gui = sanitizeName($("#builder-name").value);
      const label = ($("#builder-label").value.replace(/[\r\n]/g, "").slice(0, 60) || "Click me")
        .replaceAll("\\", "\\\\").replaceAll('"', '\\"');
      insertText(`local Players = game:GetService("Players")\nlocal player = Players.LocalPlayer\nlocal playerGui = player:WaitForChild("PlayerGui")\n\nlocal screenGui = Instance.new("ScreenGui")\nscreenGui.Name = "${gui}"\nscreenGui.ResetOnSpawn = false\nscreenGui.Parent = playerGui\n\nlocal button = Instance.new("TextButton")\nbutton.Name = "ActionButton"\nbutton.Size = UDim2.fromOffset(180, 48)\nbutton.Position = UDim2.fromScale(0.5, 0.5)\nbutton.AnchorPoint = Vector2.new(0.5, 0.5)\nbutton.Text = "${label}"\nbutton.Parent = screenGui\n\nbutton.Activated:Connect(function()\n\tprint("Button activated")\nend)\n`);
      ui.modal.close();
      toast("Template inserted. Check client context and test in Studio.");
    });
    $("#modal-content [data-modal-close]").addEventListener("click", () => ui.modal.close());
  }

  function insertText(text) {
    const start = ui.editor.selectionStart;
    const end = ui.editor.selectionEnd;
    const before = ui.editor.value.slice(0, start);
    const after = ui.editor.value.slice(end);
    if (before && !before.endsWith("\n")) text = `\n${text}`;
    if (after && !text.endsWith("\n")) text = `${text}\n`;
    ui.editor.setRangeText(text, start, end, "end");
    ui.editor.focus();
    queueAutosave();
  }

  async function showVersions() {
    const script = activeScript();
    if (!script) return toast("Open a script to view its versions.", true);
    const versions = (await getAll("versions")).filter((version) => version.scriptId === script.id).sort((a, b) => b.createdAt - a.createdAt);
    const items = versions.length ? versions.map((version, index) => `
      <div class="version-row"><div><strong>Snapshot ${versions.length - index}</strong><small>${new Date(version.createdAt).toLocaleString()} · ${version.source.length.toLocaleString()} characters</small></div>
      <button class="secondary-button" data-version-index="${index}">Restore</button></div>`).join("") : '<p class="modal-note">No saved versions yet. Use Save to create a snapshot. Up to 30 are kept per script.</p>';
    showModalView("Time Machine · " + script.name, `${items}<p class="modal-note">Restore replaces the editor contents; save first if you need to preserve current changes.</p>`);
    ui.modalContent.querySelectorAll("[data-version-index]").forEach((button) => button.addEventListener("click", async () => {
      const version = versions[Number(button.dataset.versionIndex)];
      if (!version) return;
      const tab = activeTab();
      tab.source = version.source;
      tab.dirty = true;
      ui.editor.value = tab.source;
      updateHighlights();
      renderTabs();
      ui.modal.close();
      await persistActive(false);
      toast("Version restored. Save to create a new snapshot.");
    }));
  }

  async function showSettings() {
    showModalView("Workspace settings", `
      <label class="field">Accent color<input id="setting-accent" type="color" value="${state.settings.accent}"></label>
      <label class="field">Editor font size <span id="font-value">${state.settings.fontSize}px</span><input id="setting-font" type="range" min="11" max="20" value="${state.settings.fontSize}"></label>
      <label class="field">Workspace background<select id="setting-background"><option value="glow">Neon glow</option><option value="grid">Subtle grid</option><option value="plain">Plain</option></select></label>
      <label class="field">Motion<select id="setting-motion"><option value="on">Enabled</option><option value="off">Reduced</option></select></label>
      <p class="modal-note">Preferences are stored on this device. Shortcuts: Ctrl/⌘+S save, Ctrl/⌘+O import, Ctrl/⌘+Z undo.</p>
      <div class="modal-actions"><button class="primary-button" id="settings-done">Done</button></div>`);
    $("#setting-background").value = state.settings.background;
    $("#setting-motion").value = state.settings.motion ? "on" : "off";
    const apply = () => {
      state.settings.accent = $("#setting-accent").value;
      state.settings.fontSize = Number($("#setting-font").value);
      state.settings.background = $("#setting-background").value;
      state.settings.motion = $("#setting-motion").value === "on";
      document.documentElement.style.setProperty("--accent", state.settings.accent);
      document.documentElement.style.setProperty("--editor-font", `${state.settings.fontSize}px`);
      document.body.dataset.background = state.settings.background;
      document.body.classList.toggle("reduced-motion", !state.settings.motion);
      $("#font-value").textContent = `${state.settings.fontSize}px`;
      put("settings", {id: "preferences", value: state.settings}).catch((error) => toast(`Could not save settings: ${error.message}`, true));
    };
    ["setting-accent", "setting-font", "setting-background", "setting-motion"].forEach((settingId) => {
      document.getElementById(settingId).addEventListener("input", apply);
    });
    $("#settings-done").addEventListener("click", () => ui.modal.close());
  }

  function showScriptMenu(script) {
    showModalView(script.name, `
      <p class="modal-note">Manage this local script.</p>
      <label class="field">Name<input id="rename-script" maxlength="80"></label>
      <label class="field">Category<select id="script-category"><option>Uncategorized</option><option>UI</option><option>Gameplay</option><option>Systems</option><option>Utilities</option><option>Other</option></select></label>
      <div class="modal-actions"><button class="secondary-button" id="delete-script">Delete</button><button class="primary-button" id="rename-save">Save details</button></div>`);
    $("#rename-script").value = script.name;
    $("#script-category").value = script.category || "Uncategorized";
    $("#rename-save").addEventListener("click", async () => {
      script.name = sanitizeName($("#rename-script").value);
      script.category = $("#script-category").value;
      await put("scripts", script);
      ui.modal.close();
      updateEditor();
      toast("Script details updated.");
    });
    $("#delete-script").addEventListener("click", async () => {
      if (!confirm(`Delete ${script.name} and its local version history?`)) return;
      await remove("scripts", script.id);
      for (const version of await getAll("versions")) if (version.scriptId === script.id) await remove("versions", version.id);
      state.scripts = state.scripts.filter((item) => item.id !== script.id);
      await closeTab(script.id);
      ui.modal.close();
      updateEditor();
      toast("Script and its versions deleted.");
    });
  }

  async function createProject() {
    const name = prompt("Name your Roblox Studio project:");
    if (!name?.trim()) return;
    const project = {id: id(), name: name.trim().slice(0, 60), createdAt: Date.now()};
    await put("projects", project);
    state.projects.push(project);
    renderProjects();
    ui.projectSelect.value = project.id;
    state.category = "All";
    updateEditor();
    toast(`Project "${project.name}" created on this device.`);
  }

  async function downloadFile(filename, content, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([content], {type}));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function exportActive() {
    const script = activeScript();
    if (!script) return toast("Open a script before exporting.", true);
    await downloadFile(`${sanitizeName(script.name)}.lua`, ui.editor.value);
    toast("Luau file exported. Import it in Roblox Studio.");
  }

  async function importFiles(files) {
    if (!files?.length) return;
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) throw new Error(`${file.name} exceeds the 2 MB import limit.`);
      const extension = file.name.split(".").pop().toLowerCase();
      if (!["lua", "luau", "txt", "json"].includes(extension)) throw new Error(`Unsupported file type: ${file.name}`);
      const text = await file.text();
      let source = text;
      let name = file.name.replace(/\.(lua|luau|txt|json)$/i, "");
      if (extension === "json") {
        const parsed = JSON.parse(text);
        if (typeof parsed.source !== "string") throw new Error(`${file.name} JSON must contain a source string.`);
        source = parsed.source;
        name = parsed.name || name;
      }
      await createScript(name, "Script", source);
    }
    ui.fileInput.value = "";
  }

  async function exportBackup() {
    for (const tab of state.tabs) {
      const script = state.scripts.find((item) => item.id === tab.id);
      if (script && tab.dirty) {
        script.source = tab.source;
        script.updatedAt = Date.now();
        script.saved = true;
        await put("scripts", script);
        tab.dirty = false;
      }
    }
    const payload = {
      format: "sanqvx-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: state.projects,
      scripts: state.scripts,
      versions: await getAll("versions"),
    };
    await downloadFile(`SANQVX-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast("Backup exported. Store it somewhere safe.");
  }

  async function restoreBackup(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) throw new Error("Backup exceeds the 20 MB restore limit.");
    const backup = JSON.parse(await file.text());
    if (backup.format !== "sanqvx-backup" || backup.version !== 1 || !Array.isArray(backup.projects) || !Array.isArray(backup.scripts)) {
      throw new Error("This is not a supported SANQVX backup.");
    }
    if (!confirm(`Restore ${backup.projects.length} project(s) and ${backup.scripts.length} script(s)? Existing IDs will be replaced.`)) return;
    for (const project of backup.projects) {
      if (!project.id || typeof project.name !== "string") throw new Error("Backup contains an invalid project.");
      await put("projects", project);
    }
    for (const script of backup.scripts) {
      if (!script.id || !script.projectId || typeof script.name !== "string" || typeof script.source !== "string" || script.source.length > MAX_FILE_SIZE) {
        throw new Error("Backup contains an invalid or oversized script.");
      }
      await put("scripts", script);
    }
    for (const version of Array.isArray(backup.versions) ? backup.versions : []) {
      if (version.id && version.scriptId && typeof version.source === "string" && version.source.length <= MAX_FILE_SIZE) await put("versions", version);
    }
    state.projects = await getAll("projects");
    state.scripts = await getAll("scripts");
    state.tabs = [];
    state.activeId = null;
    renderProjects();
    if (state.scripts.length) await selectTab(state.scripts[0].id);
    else updateEditor();
    ui.backupInput.value = "";
    toast("Backup restored to this device.");
  }

  function studioGuide() {
    const script = activeScript();
    if (!script) return toast("Open a script first.", true);
    showModalView("Run in Roblox Studio", `
      <p class="modal-note">Your script is saved in SANQVX. To run it, export the source and open it in Roblox Studio. SANQVX cannot execute Luau; use Studio's own Test &gt; Play controls in an experience you control.</p>
      <ol class="modal-note"><li>Save this script and export a <code>.lua</code> file.</li><li>In Roblox Studio, create or select the correct Script, LocalScript or ModuleScript.</li><li>Paste/import the source in Studio's native editor.</li><li>Check Output and Script Analysis. Confirm APIs, permissions and client/server context.</li><li>Use Studio's Test &gt; Play controls. Stop the test from Studio.</li></ol>
      <p class="modal-note"><strong>Compatibility is project-specific.</strong> A script's class, location, API availability, permissions, and experience setup affect whether it works.</p>
      <div class="modal-actions"><button class="secondary-button" id="guide-export">Export .lua</button><button class="primary-button" data-modal-close>Got it</button></div>`);
    $("#guide-export").addEventListener("click", () => {
      ui.modal.close();
      exportActive().catch((error) => toast(error.message, true));
    });
    $("#modal-content [data-modal-close]").addEventListener("click", () => ui.modal.close());
  }

  async function copyCode() {
    const text = selectedSource();
    if (!text) return toast("There is no code to copy.", true);
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard access requires a supported browser and a secure app address.");
    await navigator.clipboard.writeText(text);
    toast(ui.editor.selectionStart === ui.editor.selectionEnd ? "Script copied." : "Selection copied.");
  }

  async function pasteCode() {
    if (!navigator.clipboard?.readText) throw new Error("Clipboard access requires a supported browser and a secure app address.");
    const text = await navigator.clipboard.readText();
    if (!text) return toast("Clipboard is empty.");
    insertText(text);
    toast("Pasted as text; SANQVX never executes imported code.");
  }

  function handleAction(action) {
    const run = async () => {
      switch (action) {
        case "home": state.category = "All"; state.search = ""; ui.search.value = ""; updateEditor(); break;
        case "new-script": await createScript(); break;
        case "new-project": await createProject(); break;
        case "save": if (await persistActive(true)) toast("Saved locally with a version snapshot."); break;
        case "undo": moveHistory(-1); break;
        case "redo": moveHistory(1); break;
        case "versions": await showVersions(); break;
        case "scan": runScan(true); break;
        case "studio": studioGuide(); break;
        case "run": if (await persistActive(true)) studioGuide(); break;
        case "import": ui.fileInput.click(); break;
        case "backup": await exportBackup(); break;
        case "restore": ui.backupInput.click(); break;
        case "settings": await showSettings(); break;
        case "explain": assistant("explain"); break;
        case "optimize": assistant("optimize"); break;
        case "build": showBuilder(); break;
        case "export": await exportActive(); break;
        case "copy": await copyCode(); break;
        case "paste": await pasteCode(); break;
        case "rename": { const script = activeScript(); if (script) showScriptMenu(script); else toast("Open a script first.", true); break; }
        default: break;
      }
    };
    run().catch((error) => toast(error.message || "Action failed.", true));
  }

  function showMoreMenu() {
    showModalView("More actions", `<div class="assistant-buttons">
      <button data-menu="import">Import Luau</button><button data-menu="export">Export .lua</button>
      <button data-menu="rename">Script details</button><button data-menu="restore">Restore backup</button>
      <button data-menu="copy">Copy code</button><button data-menu="paste">Paste code</button>
      <button data-menu="run">Run as a script</button>
      <button data-menu="build">UI template</button><button data-menu="explain">Explain code</button><button data-menu="optimize">Review code</button>
    </div><p class="modal-note">Imported code is stored as text and is never executed by SANQVX.</p>`);
    ui.modalContent.querySelectorAll("[data-menu]").forEach((button) => button.addEventListener("click", () => {
      const action = button.dataset.menu;
      ui.modal.close();
      handleAction(action);
    }));
  }

  async function init() {
    if (!("indexedDB" in window)) throw new Error("This browser does not support local IndexedDB storage.");
    state.db = await openDatabase();
    state.projects = await getAll("projects");
    state.scripts = await getAll("scripts");
    const preferences = await requestResult(state.db.transaction("settings", "readonly").objectStore("settings").get("preferences"));
    if (preferences?.value) state.settings = {...state.settings, ...preferences.value};
    if (!state.projects.length) {
      const project = {id: id(), name: "My Roblox Project", createdAt: Date.now()};
      await put("projects", project);
      state.projects = [project];
    }
    renderProjects();
    document.documentElement.style.setProperty("--accent", state.settings.accent);
    document.documentElement.style.setProperty("--editor-font", `${state.settings.fontSize}px`);
    document.body.dataset.background = state.settings.background;
    document.body.classList.toggle("reduced-motion", !state.settings.motion);
    if (state.scripts.length) await selectTab(state.scripts[0].id);
    else updateEditor();
    $("#empty-state").hidden = state.scripts.length > 0;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "more") showMoreMenu();
    else handleAction(action);
  });
  ui.editor.addEventListener("input", queueAutosave);
  ui.editor.addEventListener("scroll", () => {
    ui.highlight.scrollTop = ui.editor.scrollTop;
    ui.highlight.scrollLeft = ui.editor.scrollLeft;
    ui.lineNumbers.scrollTop = ui.editor.scrollTop;
  });
  ui.editor.addEventListener("click", updateHighlights);
  ui.editor.addEventListener("keyup", updateHighlights);
  ui.search.addEventListener("input", () => { state.search = ui.search.value; renderList(); });
  ui.projectSelect.addEventListener("change", () => { state.category = "All"; updateEditor(); });
  $("#categories").addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    state.category = button.dataset.category;
    $("#categories").querySelectorAll(".category").forEach((node) => node.classList.toggle("active", node === button));
    renderList();
  });
  ui.fileInput.addEventListener("change", () => importFiles(ui.fileInput.files).catch((error) => toast(error.message, true)));
  ui.backupInput.addEventListener("change", () => restoreBackup(ui.backupInput.files[0]).catch((error) => toast(error.message, true)));
  document.addEventListener("keydown", (event) => {
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "s") { event.preventDefault(); handleAction("save"); }
    if (modifier && event.key.toLowerCase() === "o") { event.preventDefault(); handleAction("import"); }
    if (modifier && event.key.toLowerCase() === "z" && !event.shiftKey) { event.preventDefault(); moveHistory(-1); }
    if ((modifier && event.key.toLowerCase() === "y") || (modifier && event.shiftKey && event.key.toLowerCase() === "z")) { event.preventDefault(); moveHistory(1); }
    if (event.key === "Escape" && ui.modal.open) ui.modal.close();
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    $("#install-button").hidden = false;
  });
  $("#install-button").addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    $("#install-button").hidden = true;
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch((error) => toast(`Offline install setup failed: ${error.message}`, true));
  }

  init().catch((error) => {
    console.error(error);
    toast(`Workspace failed to start: ${error.message}`, true);
  });
})();
