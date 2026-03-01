/**
 * JARVIS AI Assistant — Core Application Engine
 * J.A.R.V.I.S. — Just A Rather Very Intelligent System
 * Stark Industries — Proprietary Interface v7.3.1
 */

'use strict';

// ═══════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════
// Remote API with in-memory cache (server-backed)

const JARVIS_RESPONSES = {
  greetings: [
    "Good {time}, {name}. All systems are fully operational.",
    "Welcome back, {name}. I've been monitoring the situation.",
    "Ah, {name}. I've taken the liberty of running diagnostics. Everything is nominal.",
    "Systems online, {name}. Ready for your instructions.",
  ],
  thinking: [
    "Processing your request, {name}.",
    "Analyzing data streams...",
    "Cross-referencing available information...",
    "Running analysis. One moment, {name}.",
    "Accessing relevant data banks...",
  ],
  project_created: [
    "Project '{name}' has been initialized and logged to the operational matrix, {user}.",
    "I've created project '{name}'. It's now tracked in your operational timeline, {user}.",
  ],
  task_created: [
    "Task '{name}' has been added to the project queue.",
    "Logged. Task '{name}' is now in the operational pipeline.",
  ],
  research_saved: [
    "Research on '{topic}' has been indexed and stored in the knowledge matrix, {user}.",
  ],
  memory_saved: [
    "Memory indexed successfully. I'll retain that information for future reference, {user}.",
  ],
  voice_start: [
    "Voice interface active. I'm listening, {name}.",
    "Auditory sensors engaged. Go ahead, {name}.",
    "Voice mode activated. Ready for your command, {name}.",
  ],
  voice_end: [
    "Voice interface standing by.",
    "Switching to standby mode.",
  ],
  unknown: [
    "I'm afraid I don't quite follow, {name}. Could you rephrase that?",
    "I didn't catch that, {name}. Please try again.",
  ],
};

const UI = {
  sidebar:          () => document.getElementById('sidebar'),
  mainContent:      () => document.getElementById('main-content'),
  inputBar:         () => document.getElementById('inputBar'),
  chatInput:        () => document.getElementById('chatInput'),
  sendBtn:          () => document.getElementById('sendBtn'),
  voiceBtn:         () => document.getElementById('voiceBtn'),
  statusDot:        () => document.getElementById('statusDot'),
  statusText:       () => document.getElementById('statusText'),
  greetingEl:       () => document.getElementById('greeting'),
  navLinks:         () => document.querySelectorAll('.nav-link'),
  themeToggleBtn:   () => document.getElementById('themeToggleBtn'),
  modalOverlay:     () => document.getElementById('modalOverlay'),
  modalTitle:       () => document.getElementById('modalTitle'),
  modalBody:        () => document.getElementById('modalBody'),
  modalCancel:      () => document.getElementById('modalCancel'),
  modalConfirm:     () => document.getElementById('modalConfirm'),
  toastContainer:   () => document.getElementById('toastContainer'),
  authOverlay:      () => document.getElementById('authOverlay'),
  authInput:        () => document.getElementById('authInput'),
  authBtn:          () => document.getElementById('authBtn'),
  authError:        () => document.getElementById('authError'),
};

const State = {
  currentView:    'dashboard',
  isLoading:      false,
  voiceActive:    false,
  recognition:    null,
  theme:          'dark',
  userName:       'Boss',
  apiEndpoint:    null,
  data: {
    projects:  [],
    tasks:     [],
    research:  [],
    memories:  [],
    briefings: [],
  },
};

// ═══════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

function formatDate(iso) {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ═══════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════

function showToast(message, type = 'info', duration = 4000) {
  const container = UI.toastContainer();
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ'}</span><span class="toast-message">${escapeHtml(message)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ═══════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════

function showModal(title, bodyHtml, onConfirm = null) {
  const overlay = UI.modalOverlay();
  if (!overlay) return;
  UI.modalTitle().textContent = title;
  UI.modalBody().innerHTML = bodyHtml;
  overlay.classList.add('active');
  const confirmBtn = UI.modalConfirm();
  const cancelBtn  = UI.modalCancel();
  const close = () => overlay.classList.remove('active');
  confirmBtn.onclick = () => { close(); if (onConfirm) onConfirm(); };
  cancelBtn.onclick  = close;
  overlay.onclick    = (e) => { if (e.target === overlay) close(); };
}

// ═══════════════════════════════════════════════════════
//  THEME
// ═══════════════════════════════════════════════════════

function initTheme() {
  const saved = localStorage.getItem('jarvis_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  State.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('jarvis_theme', theme);
  const btn = UI.themeToggleBtn();
  if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
}

function toggleTheme() {
  applyTheme(State.theme === 'dark' ? 'light' : 'dark');
}

// ═══════════════════════════════════════════════════════
//  API
// ═══════════════════════════════════════════════════════

async function loadApiConfig() {
  try {
    const res = await fetch('api-config.json?_=' + Date.now());
    if (!res.ok) throw new Error('not found');
    const cfg = await res.json();
    if (cfg.api_url) {
      State.apiEndpoint = cfg.api_url;
      console.log('[JARVIS] API endpoint loaded from config:', State.apiEndpoint);
      return true;
    }
  } catch (e) {
    console.warn('[JARVIS] Could not load api-config.json:', e.message);
  }
  return false;
}

async function callApi(action, payload = {}) {
  if (!State.apiEndpoint) {
    throw new Error('API endpoint not configured');
  }
  const body = { action, ...payload };
  const res = await fetch(State.apiEndpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${res.status}: ${txt}`);
  }
  return res.json();
}

// ═══════════════════════════════════════════════════════
//  STATUS
// ═══════════════════════════════════════════════════════

function setStatus(state) {
  const dot  = UI.statusDot();
  const text = UI.statusText();
  if (!dot || !text) return;
  const states = {
    online:     { cls: 'online',     label: 'Online'     },
    thinking:   { cls: 'thinking',   label: 'Thinking'   },
    processing: { cls: 'processing', label: 'Processing' },
    offline:    { cls: 'offline',    label: 'Offline'    },
    error:      { cls: 'error',      label: 'Error'      },
  };
  const s = states[state] || states.online;
  dot.className  = `status-dot ${s.cls}`;
  text.textContent = s.label;
}

// ═══════════════════════════════════════════════════════
//  NAVIGATION
// ═══════════════════════════════════════════════════════

function navigate(view) {
  State.currentView = view;
  window.location.hash = view;
  UI.navLinks().forEach(link => {
    link.classList.toggle('active', link.dataset.view === view);
  });
  renderView(view);
}

// ═══════════════════════════════════════════════════════
//  VIEW ROUTER
// ═══════════════════════════════════════════════════════

function renderView(view) {
  const content = UI.mainContent();
  if (!content) return;
  content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading...</p></div>';
  const renderers = {
    dashboard:  renderDashboard,
    projects:   renderProjects,
    tasks:      renderTasks,
    research:   renderResearch,
    memory:     renderMemory,
    briefings:  renderBriefings,
    settings:   renderSettings,
  };
  const fn = renderers[view];
  if (fn) fn();
  else content.innerHTML = `<div class="error-state"><h2>View not found</h2><p>${escapeHtml(view)}</p></div>`;
}

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════

async function renderDashboard() {
  const content = UI.mainContent();
  try {
    const [projectsRes, tasksRes, memoriesRes] = await Promise.all([
      callApi('list_projects'),
      callApi('list_tasks'),
      callApi('list_memories'),
    ]);
    State.data.projects  = projectsRes.projects  || [];
    State.data.tasks     = tasksRes.tasks         || [];
    State.data.memories  = memoriesRes.memories   || [];

    const activeProjects = State.data.projects.filter(p => p.status === 'active').length;
    const pendingTasks   = State.data.tasks.filter(t => t.status === 'pending').length;
    const doneTasks      = State.data.tasks.filter(t => t.status === 'done').length;
    const totalTasks     = State.data.tasks.length;
    const completionPct  = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Mission Control</h1>
        <p class="view-subtitle">Operational Overview — ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card" onclick="navigate('projects')">
          <div class="stat-icon">◈</div>
          <div class="stat-value">${activeProjects}</div>
          <div class="stat-label">Active Projects</div>
        </div>
        <div class="stat-card" onclick="navigate('tasks')">
          <div class="stat-icon">◉</div>
          <div class="stat-value">${pendingTasks}</div>
          <div class="stat-label">Pending Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">◎</div>
          <div class="stat-value">${completionPct}%</div>
          <div class="stat-label">Completion Rate</div>
        </div>
        <div class="stat-card" onclick="navigate('memory')">
          <div class="stat-icon">◇</div>
          <div class="stat-value">${State.data.memories.length}</div>
          <div class="stat-label">Memory Entries</div>
        </div>
      </div>

      <div class="dashboard-grid">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Recent Projects</h2>
            <button class="btn btn-sm" onclick="navigate('projects')">View All</button>
          </div>
          <div class="card-body">
            ${State.data.projects.length === 0
              ? '<p class="empty-state">No projects yet. Start a new project with JARVIS.</p>'
              : State.data.projects.slice(0, 3).map(p => `
                <div class="list-item">
                  <div class="list-item-main">
                    <span class="list-item-title">${escapeHtml(p.name)}</span>
                    <span class="badge badge-${p.status}">${escapeHtml(p.status)}</span>
                  </div>
                  <div class="list-item-sub">${escapeHtml(p.description || 'No description')}</div>
                </div>`).join('')
            }
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h2 class="card-title">Active Tasks</h2>
            <button class="btn btn-sm" onclick="navigate('tasks')">View All</button>
          </div>
          <div class="card-body">
            ${State.data.tasks.filter(t => t.status === 'pending').length === 0
              ? '<p class="empty-state">No pending tasks. Well done.</p>'
              : State.data.tasks.filter(t => t.status === 'pending').slice(0, 4).map(t => `
                <div class="list-item">
                  <div class="list-item-main">
                    <span class="list-item-title">${escapeHtml(t.name)}</span>
                    <span class="badge badge-${t.priority || 'medium'}">${escapeHtml(t.priority || 'medium')}</span>
                  </div>
                  <div class="list-item-sub">${escapeHtml(t.project || 'General')}</div>
                </div>`).join('')
            }
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="error-state">
        <h2>Systems Offline</h2>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn btn-primary" onclick="renderDashboard()">Retry</button>
      </div>`;
    setStatus('error');
  }
}

// ═══════════════════════════════════════════════════════
//  PROJECTS
// ═══════════════════════════════════════════════════════

async function renderProjects() {
  const content = UI.mainContent();
  try {
    const res = await callApi('list_projects');
    State.data.projects = res.projects || [];
    const projects = State.data.projects;

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Projects</h1>
        <button class="btn btn-primary" onclick="showNewProjectModal()">+ New Project</button>
      </div>
      ${
        projects.length === 0
          ? '<div class="empty-state-full"><p>No projects found. Create your first project.</p></div>'
          : `<div class="project-grid">${projects.map(p => renderProjectCard(p)).join('')}</div>`
      }
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderProjectCard(p) {
  const taskCount = (p.tasks || []).length;
  const doneCount = (p.tasks || []).filter(t => t.status === 'done').length;
  const pct       = taskCount ? Math.round((doneCount / taskCount) * 100) : 0;
  return `
    <div class="project-card" data-id="${escapeHtml(p.id)}">
      <div class="project-card-header">
        <span class="project-card-title">${escapeHtml(p.name)}</span>
        <span class="badge badge-${p.status}">${escapeHtml(p.status)}</span>
      </div>
      <p class="project-card-desc">${escapeHtml(p.description || 'No description')}</p>
      <div class="project-card-meta">
        <span>${taskCount} task${taskCount !== 1 ? 's' : ''}</span>
        <span>Created ${formatDate(p.created_at)}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="card-actions">
        <button class="btn btn-sm" onclick="showProjectDetail('${escapeHtml(p.id)}')">View</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProject('${escapeHtml(p.id)}', '${escapeHtml(p.name)}')">Delete</button>
      </div>
    </div>
  `;
}

async function showProjectDetail(id) {
  try {
    const res = await callApi('get_project', { id });
    const p = res.project;
    showModal(
      escapeHtml(p.name),
      `<p><strong>Status:</strong> ${escapeHtml(p.status)}</p>
       <p><strong>Description:</strong> ${escapeHtml(p.description || 'None')}</p>
       <p><strong>Created:</strong> ${formatDate(p.created_at)}</p>
       <h4>Tasks (${(p.tasks || []).length})</h4>
       <ul>${(p.tasks || []).map(t => `<li>${escapeHtml(t.name)} — <em>${escapeHtml(t.status)}</em></li>`).join('') || '<li>No tasks</li>'}</ul>`,
    );
  } catch (err) {
    showToast('Failed to load project: ' + err.message, 'error');
  }
}

function showNewProjectModal() {
  showModal(
    'New Project',
    `<label>Project Name<input id="mProjectName" class="modal-input" placeholder="Enter project name" autofocus /></label>
     <label>Description<textarea id="mProjectDesc" class="modal-input" rows="3" placeholder="Optional description"></textarea></label>
     <label>Status
       <select id="mProjectStatus" class="modal-input">
         <option value="active">Active</option>
         <option value="planning">Planning</option>
         <option value="on_hold">On Hold</option>
       </select>
     </label>`,
    async () => {
      const name   = document.getElementById('mProjectName')?.value?.trim();
      const desc   = document.getElementById('mProjectDesc')?.value?.trim();
      const status = document.getElementById('mProjectStatus')?.value || 'active';
      if (!name) { showToast('Project name is required.', 'warning'); return; }
      await createProjectAction(name, desc, status);
    }
  );
}

async function createProjectAction(name, desc, status = 'active') {
  try {
    setStatus('processing');
    await callApi('create_project', { name, description: desc, status });
    const msg = fillTemplate(pickRandom(JARVIS_RESPONSES.project_created), { name, user: State.userName });
    showToast(msg, 'success');
    speakText(msg);
    setStatus('online');
    renderProjects();
  } catch (err) {
    showToast('Failed to create project: ' + err.message, 'error');
    setStatus('error');
  }
}

async function deleteProject(id, name) {
  showModal(
    'Delete Project',
    `<p>Are you sure you want to delete <strong>${escapeHtml(name)}</strong>? This cannot be undone.</p>`,
    async () => {
      try {
        await callApi('delete_project', { id });
        showToast(`Project "${name}" deleted.`, 'success');
        renderProjects();
      } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
      }
    }
  );
}

// ═══════════════════════════════════════════════════════
//  TASKS
// ═══════════════════════════════════════════════════════

async function renderTasks() {
  const content = UI.mainContent();
  try {
    const [tasksRes, projectsRes] = await Promise.all([
      callApi('list_tasks'),
      callApi('list_projects'),
    ]);
    State.data.tasks    = tasksRes.tasks    || [];
    State.data.projects = projectsRes.projects || [];
    const tasks = State.data.tasks;

    const filterBtns = ['all', 'pending', 'in_progress', 'done'].map(f =>
      `<button class="btn btn-sm filter-btn" data-filter="${f}" onclick="filterTasks('${f}')">${f === 'all' ? 'All' : f.replace('_', ' ')}</button>`
    ).join('');

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Tasks</h1>
        <div class="header-actions">
          <div class="filter-group">${filterBtns}</div>
          <button class="btn btn-primary" onclick="showNewTaskModal()">+ New Task</button>
        </div>
      </div>
      <div id="taskList">
        ${renderTaskList(tasks, 'all')}
      </div>
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderTaskList(tasks, filter) {
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  if (filtered.length === 0) return '<div class="empty-state-full"><p>No tasks found.</p></div>';
  return `<div class="task-list">${filtered.map(t => renderTaskItem(t)).join('')}</div>`;
}

function renderTaskItem(t) {
  return `
    <div class="task-item" data-id="${escapeHtml(t.id)}">
      <div class="task-checkbox ${t.status === 'done' ? 'checked' : ''}" onclick="toggleTaskStatus('${escapeHtml(t.id)}', '${escapeHtml(t.status)}')"></div>
      <div class="task-body">
        <div class="task-title ${t.status === 'done' ? 'done' : ''}">${escapeHtml(t.name)}</div>
        <div class="task-meta">
          <span class="badge badge-${t.priority || 'medium'}">${escapeHtml(t.priority || 'medium')}</span>
          ${t.project ? `<span class="task-project">${escapeHtml(t.project)}</span>` : ''}
          ${t.due_date ? `<span class="task-due">Due ${formatDate(t.due_date)}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="btn btn-sm btn-danger" onclick="deleteTask('${escapeHtml(t.id)}', '${escapeHtml(t.name)}')">✕</button>
      </div>
    </div>
  `;
}

function filterTasks(filter) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  const taskList = document.getElementById('taskList');
  if (taskList) taskList.innerHTML = renderTaskList(State.data.tasks, filter);
}

async function toggleTaskStatus(id, currentStatus) {
  const newStatus = currentStatus === 'done' ? 'pending' : 'done';
  try {
    await callApi('update_task', { id, status: newStatus });
    const task = State.data.tasks.find(t => t.id === id);
    if (task) task.status = newStatus;
    const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
    const taskList = document.getElementById('taskList');
    if (taskList) taskList.innerHTML = renderTaskList(State.data.tasks, activeFilter);
  } catch (err) {
    showToast('Failed to update task: ' + err.message, 'error');
  }
}

function showNewTaskModal() {
  const projectOptions = State.data.projects.map(p =>
    `<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`
  ).join('');
  showModal(
    'New Task',
    `<label>Task Name<input id="mTaskName" class="modal-input" placeholder="Enter task name" autofocus /></label>
     <label>Project
       <select id="mTaskProject" class="modal-input">
         <option value="">— None —</option>
         ${projectOptions}
       </select>
     </label>
     <label>Priority
       <select id="mTaskPriority" class="modal-input">
         <option value="medium">Medium</option>
         <option value="high">High</option>
         <option value="low">Low</option>
       </select>
     </label>
     <label>Due Date<input id="mTaskDue" type="date" class="modal-input" /></label>`,
    async () => {
      const name     = document.getElementById('mTaskName')?.value?.trim();
      const project  = document.getElementById('mTaskProject')?.value;
      const priority = document.getElementById('mTaskPriority')?.value || 'medium';
      const due_date = document.getElementById('mTaskDue')?.value;
      if (!name) { showToast('Task name is required.', 'warning'); return; }
      await createTaskAction(name, project, priority, due_date);
    }
  );
}

async function createTaskAction(name, project, priority, due_date) {
  try {
    setStatus('processing');
    await callApi('create_task', { name, project, priority, due_date });
    const msg = fillTemplate(pickRandom(JARVIS_RESPONSES.task_created), { name });
    showToast(msg, 'success');
    speakText(msg);
    setStatus('online');
    renderTasks();
  } catch (err) {
    showToast('Failed to create task: ' + err.message, 'error');
    setStatus('error');
  }
}

async function deleteTask(id, name) {
  showModal(
    'Delete Task',
    `<p>Delete task <strong>${escapeHtml(name)}</strong>?</p>`,
    async () => {
      try {
        await callApi('delete_task', { id });
        showToast(`Task "${name}" deleted.`, 'success');
        renderTasks();
      } catch (err) {
        showToast('Failed to delete task: ' + err.message, 'error');
      }
    }
  );
}

// ═══════════════════════════════════════════════════════
//  RESEARCH
// ═══════════════════════════════════════════════════════

async function renderResearch() {
  const content = UI.mainContent();
  try {
    const res = await callApi('list_research');
    State.data.research = res.research || [];

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Research</h1>
        <button class="btn btn-primary" onclick="showNewResearchModal()">+ New Research</button>
      </div>
      ${
        State.data.research.length === 0
          ? '<div class="empty-state-full"><p>No research entries yet.</p></div>'
          : `<div class="research-grid">${State.data.research.map(r => renderResearchCard(r)).join('')}</div>`
      }
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderResearchCard(r) {
  const tagHtml = (r.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  return `
    <div class="research-card">
      <div class="research-card-header">
        <span class="research-card-title">${escapeHtml(r.topic)}</span>
        <button class="btn btn-sm btn-danger" onclick="deleteResearch('${escapeHtml(r.id)}', '${escapeHtml(r.topic)}')">✕</button>
      </div>
      <div class="research-card-content">${escapeHtml(r.content).substring(0, 200)}${r.content.length > 200 ? '…' : ''}</div>
      <div class="research-card-footer">
        <div class="tag-list">${tagHtml}</div>
        <span class="research-date">${formatDateTime(r.created_at)}</span>
      </div>
    </div>
  `;
}

function showNewResearchModal() {
  showModal(
    'New Research Entry',
    `<label>Topic<input id="mResTopic" class="modal-input" placeholder="Research topic" autofocus /></label>
     <label>Content<textarea id="mResContent" class="modal-input" rows="5" placeholder="Research notes, findings, links…"></textarea></label>
     <label>Tags (comma-separated)<input id="mResTags" class="modal-input" placeholder="ai, tech, notes" /></label>`,
    async () => {
      const topic   = document.getElementById('mResTopic')?.value?.trim();
      const content = document.getElementById('mResContent')?.value?.trim();
      const tagsRaw = document.getElementById('mResTags')?.value?.trim();
      const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
      if (!topic) { showToast('Topic is required.', 'warning'); return; }
      await saveResearchAction(topic, content, tags);
    }
  );
}

async function saveResearchAction(topic, content, tags) {
  try {
    setStatus('processing');
    await callApi('save_research', { topic, content, tags });
    const msg = fillTemplate(pickRandom(JARVIS_RESPONSES.research_saved), { topic, user: State.userName });
    showToast(msg, 'success');
    speakText(msg);
    setStatus('online');
    renderResearch();
  } catch (err) {
    showToast('Failed to save research: ' + err.message, 'error');
    setStatus('error');
  }
}

async function deleteResearch(id, topic) {
  showModal(
    'Delete Research',
    `<p>Delete research on <strong>${escapeHtml(topic)}</strong>?</p>`,
    async () => {
      try {
        await callApi('delete_research', { id });
        showToast(`Research "${topic}" deleted.`, 'success');
        renderResearch();
      } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
      }
    }
  );
}

// ═══════════════════════════════════════════════════════
//  MEMORY
// ═══════════════════════════════════════════════════════

async function renderMemory() {
  const content = UI.mainContent();
  try {
    const res = await callApi('list_memories');
    State.data.memories = res.memories || [];

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Memory Bank</h1>
        <button class="btn btn-primary" onclick="showNewMemoryModal()">+ Store Memory</button>
      </div>
      ${
        State.data.memories.length === 0
          ? '<div class="empty-state-full"><p>No memories stored yet.</p></div>'
          : `<div class="memory-list">${State.data.memories.map(m => renderMemoryItem(m)).join('')}</div>`
      }
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderMemoryItem(m) {
  return `
    <div class="memory-item">
      <div class="memory-item-header">
        <span class="memory-category">${escapeHtml(m.category || 'general')}</span>
        <span class="memory-date">${formatDateTime(m.created_at)}</span>
        <button class="btn btn-sm btn-danger" onclick="deleteMemory('${escapeHtml(m.id)}', '${escapeHtml(m.content.substring(0, 30))}…')">✕</button>
      </div>
      <div class="memory-content">${escapeHtml(m.content)}</div>
    </div>
  `;
}

function showNewMemoryModal() {
  showModal(
    'Store Memory',
    `<label>Memory<textarea id="mMemContent" class="modal-input" rows="4" placeholder="What should I remember?" autofocus></textarea></label>
     <label>Category
       <select id="mMemCategory" class="modal-input">
         <option value="general">General</option>
         <option value="preference">Preference</option>
         <option value="fact">Fact</option>
         <option value="instruction">Instruction</option>
         <option value="context">Context</option>
       </select>
     </label>`,
    async () => {
      const content  = document.getElementById('mMemContent')?.value?.trim();
      const category = document.getElementById('mMemCategory')?.value || 'general';
      if (!content) { showToast('Memory content is required.', 'warning'); return; }
      await saveMemoryAction(content, category);
    }
  );
}

async function saveMemoryAction(content, category) {
  try {
    setStatus('processing');
    await callApi('save_memory', { content, category });
    const msg = fillTemplate(pickRandom(JARVIS_RESPONSES.memory_saved), { user: State.userName });
    showToast(msg, 'success');
    speakText(msg);
    setStatus('online');
    renderMemory();
  } catch (err) {
    showToast('Failed to save memory: ' + err.message, 'error');
    setStatus('error');
  }
}

async function deleteMemory(id, preview) {
  showModal(
    'Delete Memory',
    `<p>Delete memory: <strong>${escapeHtml(preview)}</strong>?</p>`,
    async () => {
      try {
        await callApi('delete_memory', { id });
        showToast('Memory deleted.', 'success');
        renderMemory();
      } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
      }
    }
  );
}

// ═══════════════════════════════════════════════════════
//  BRIEFINGS
// ═══════════════════════════════════════════════════════

async function renderBriefings() {
  const content = UI.mainContent();
  try {
    const res = await callApi('list_briefings');
    State.data.briefings = res.briefings || [];

    content.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Briefings</h1>
        <button class="btn btn-primary" onclick="showNewBriefingModal()">+ New Briefing</button>
      </div>
      ${
        State.data.briefings.length === 0
          ? '<div class="empty-state-full"><p>No briefings found.</p></div>'
          : `<div class="briefing-list">${State.data.briefings.map(b => renderBriefingItem(b)).join('')}</div>`
      }
    `;
  } catch (err) {
    content.innerHTML = `<div class="error-state"><h2>Error</h2><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderBriefingItem(b) {
  return `
    <div class="briefing-item">
      <div class="briefing-header">
        <span class="briefing-title">${escapeHtml(b.title)}</span>
        <span class="briefing-date">${formatDateTime(b.created_at)}</span>
        <button class="btn btn-sm" onclick="viewBriefing('${escapeHtml(b.id)}')">View</button>
        <button class="btn btn-sm btn-danger" onclick="deleteBriefing('${escapeHtml(b.id)}', '${escapeHtml(b.title)}')">✕</button>
      </div>
      <div class="briefing-summary">${escapeHtml((b.content || '').substring(0, 150))}${(b.content || '').length > 150 ? '…' : ''}</div>
    </div>
  `;
}

async function viewBriefing(id) {
  const briefing = State.data.briefings.find(b => b.id === id);
  if (!briefing) return;
  showModal(
    escapeHtml(briefing.title),
    `<div class="briefing-full-content">${escapeHtml(briefing.content || '').replace(/\n/g, '<br>')}</div>`,
  );
}

function showNewBriefingModal() {
  showModal(
    'New Briefing',
    `<label>Title<input id="mBriefTitle" class="modal-input" placeholder="Briefing title" autofocus /></label>
     <label>Content<textarea id="mBriefContent" class="modal-input" rows="6" placeholder="Briefing content…"></textarea></label>`,
    async () => {
      const title   = document.getElementById('mBriefTitle')?.value?.trim();
      const content = document.getElementById('mBriefContent')?.value?.trim();
      if (!title) { showToast('Title is required.', 'warning'); return; }
      await saveBriefingAction(title, content);
    }
  );
}

async function saveBriefingAction(title, content) {
  try {
    setStatus('processing');
    await callApi('save_briefing', { title, content });
    showToast('Briefing saved.', 'success');
    setStatus('online');
    renderBriefings();
  } catch (err) {
    showToast('Failed to save briefing: ' + err.message, 'error');
    setStatus('error');
  }
}

async function deleteBriefing(id, title) {
  showModal(
    'Delete Briefing',
    `<p>Delete briefing <strong>${escapeHtml(title)}</strong>?</p>`,
    async () => {
      try {
        await callApi('delete_briefing', { id });
        showToast(`Briefing "${title}" deleted.`, 'success');
        renderBriefings();
      } catch (err) {
        showToast('Failed to delete: ' + err.message, 'error');
      }
    }
  );
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════

function renderSettings() {
  const content = UI.mainContent();
  content.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Settings</h1>
    </div>
    <div class="settings-grid">

      <div class="card">
        <div class="card-header"><h2 class="card-title">Identity</h2></div>
        <div class="card-body">
          <label>Display Name
            <input id="sUserName" class="modal-input" value="${escapeHtml(State.userName)}" placeholder="Your name" />
          </label>
          <button class="btn btn-primary" style="margin-top:12px" onclick="saveIdentitySettings()">Save</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">Appearance</h2></div>
        <div class="card-body">
          <div class="setting-row">
            <span>Theme</span>
            <button class="btn btn-sm" onclick="toggleTheme()">${State.theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">API Configuration</h2></div>
        <div class="card-body">
          <div class="setting-row">
            <span>Endpoint</span>
            <span class="setting-value">${State.apiEndpoint ? '<span class="badge badge-active">Connected</span>' : '<span class="badge badge-error">Not Set</span>'}</span>
          </div>
          ${State.apiEndpoint ? `<div class="setting-url">${escapeHtml(State.apiEndpoint)}</div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2 class="card-title">Data Management</h2></div>
        <div class="card-body">
          <button class="btn btn-danger" onclick="confirmClearData()">Clear All Local Data</button>
          <p class="setting-note">This clears your local session. Server data is unaffected.</p>
        </div>
      </div>

    </div>
  `;
}

function saveIdentitySettings() {
  const name = document.getElementById('sUserName')?.value?.trim();
  if (!name) { showToast('Name cannot be empty.', 'warning'); return; }
  State.userName = name;
  localStorage.setItem('jarvis_user', name);
  showToast('Identity updated.', 'success');
  updateGreeting();
}

function confirmClearData() {
  showModal(
    'Clear All Data',
    '<p>This will clear your local session data. Server data is unaffected. Continue?</p>',
    () => {
      localStorage.clear();
      showToast('Local data cleared. Reloading…', 'info');
      setTimeout(() => location.reload(), 1500);
    }
  );
}

// ═══════════════════════════════════════════════════════
//  CHAT / COMMAND PROCESSING
// ═══════════════════════════════════════════════════════

async function processCommand(input) {
  const text = input.trim();
  if (!text) return;

  const chatInput = UI.chatInput();
  if (chatInput) chatInput.value = '';

  setStatus('thinking');
  const thinkingMsg = fillTemplate(pickRandom(JARVIS_RESPONSES.thinking), { name: State.userName });
  speakText(thinkingMsg);

  try {
    const res = await callApi('chat', { message: text, user: State.userName });
    const reply = res.reply || res.response || res.message || JSON.stringify(res);
    setStatus('online');
    displayChatReply(text, reply);
    speakText(reply);
    // Refresh current view
    renderView(State.currentView);
  } catch (err) {
    setStatus('error');
    const errMsg = 'I encountered an error processing that request: ' + err.message;
    displayChatReply(text, errMsg);
    speakText(errMsg);
  }
}

function displayChatReply(userMsg, botReply) {
  const content = UI.mainContent();
  const existing = content.querySelector('.chat-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'chat-overlay';
  overlay.innerHTML = `
    <div class="chat-bubble user-bubble">
      <span class="chat-label">You</span>
      <div class="chat-text">${escapeHtml(userMsg)}</div>
    </div>
    <div class="chat-bubble jarvis-bubble">
      <span class="chat-label">JARVIS</span>
      <div class="chat-text">${escapeHtml(botReply)}</div>
    </div>
    <button class="btn btn-sm" onclick="this.parentElement.remove()" style="margin-top:12px">Dismiss</button>
  `;
  content.prepend(overlay);
}

// ═══════════════════════════════════════════════════════
//  VOICE
// ═══════════════════════════════════════════════════════

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;
  State.recognition = new SpeechRecognition();
  State.recognition.continuous    = false;
  State.recognition.interimResults = false;
  State.recognition.lang           = 'en-US';
  State.recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    const chatInput = UI.chatInput();
    if (chatInput) chatInput.value = transcript;
    processCommand(transcript);
  };
  State.recognition.onend = () => {
    State.voiceActive = false;
    const btn = UI.voiceBtn();
    if (btn) btn.classList.remove('active');
    speakText(pickRandom(JARVIS_RESPONSES.voice_end));
  };
  State.recognition.onerror = (e) => {
    State.voiceActive = false;
    const btn = UI.voiceBtn();
    if (btn) btn.classList.remove('active');
    showToast('Voice recognition error: ' + e.error, 'error');
  };
}

function toggleVoice() {
  if (!State.recognition) {
    showToast('Voice recognition is not supported in this browser.', 'warning');
    return;
  }
  if (State.voiceActive) {
    State.recognition.stop();
    State.voiceActive = false;
    UI.voiceBtn()?.classList.remove('active');
  } else {
    State.recognition.start();
    State.voiceActive = true;
    UI.voiceBtn()?.classList.add('active');
    const msg = fillTemplate(pickRandom(JARVIS_RESPONSES.voice_start), { name: State.userName });
    speakText(msg);
  }
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate   = 0.95;
  utter.pitch  = 0.85;
  utter.volume = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v => v.name.includes('Google UK English Male'))
    || voices.find(v => v.name.includes('Daniel'))
    || voices.find(v => v.lang === 'en-GB' && v.name.includes('Male'))
    || voices.find(v => v.lang === 'en-GB')
    || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utter.voice = preferred;
  window.speechSynthesis.speak(utter);
}

// ═══════════════════════════════════════════════════════
//  GREETING
// ═══════════════════════════════════════════════════════

function updateGreeting() {
  const el = UI.greetingEl();
  if (!el) return;
  el.textContent = `Good ${timeOfDay()}, ${State.userName}.`;
}

// ═══════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════

function initEventListeners() {
  // Nav
  UI.navLinks().forEach(link => {
    link.addEventListener('click', () => navigate(link.dataset.view));
  });

  // Chat input
  const sendBtn   = UI.sendBtn();
  const chatInput = UI.chatInput();
  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => processCommand(chatInput.value));
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processCommand(chatInput.value);
      }
    });
  }

  // Voice
  const voiceBtn = UI.voiceBtn();
  if (voiceBtn) voiceBtn.addEventListener('click', toggleVoice);

  // Theme
  const themeBtn = UI.themeToggleBtn();
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Sidebar toggle (mobile)
  const menuBtn = document.getElementById('menuToggleBtn');
  const sidebar = UI.sidebar();
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
  }
}

// ═══════════════════════════════════════════════════════
//  SOUNDS
// ═══════════════════════════════════════════════════════

function playSuccessSound() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime);
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) { /* AudioContext not available */ }
}

// ═══════════════════════════════════════════════════════
//  PARTICLE BACKGROUND
// ═══════════════════════════════════════════════════════

function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  let particles = [];
  let animId;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 15000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x:    Math.random() * canvas.width,
        y:    Math.random() * canvas.height,
        vx:   (Math.random() - 0.5) * 0.4,
        vy:   (Math.random() - 0.5) * 0.4,
        r:    Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width)  p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${p.alpha})`;
      ctx.fill();
    });
    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 212, 255, ${0.15 * (1 - dist / 80)})`;
          ctx.lineWidth   = 0.5;
          ctx.stroke();
        }
      }
    }
    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    resize();
    createParticles();
    draw();
  });

  resize();
  createParticles();
  draw();
}

// ═══════════════════════════════════════════════════════
//  HUD CLOCK
// ═══════════════════════════════════════════════════════

function initClock() {
  const el = document.getElementById('hudClock');
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  tick();
  setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════
//  SCAN LINE ANIMATION
// ═══════════════════════════════════════════════════════

function initScanLines() {
  const overlay = document.getElementById('scanLineOverlay');
  if (!overlay) return;
  let pos = 0;
  setInterval(() => {
    pos = (pos + 1) % 100;
    overlay.style.backgroundPosition = `0 ${pos}%`;
  }, 50);
}

// ═══════════════════════════════════════════════════════
//  PROGRESS BARS (animated)
// ═══════════════════════════════════════════════════════

function animateProgressBars() {
  document.querySelectorAll('.progress-fill').forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0%';
    requestAnimationFrame(() => {
      bar.style.transition = 'width 0.8s ease';
      bar.style.width = target;
    });
  });
}

// Call after renders
const _originalRenderView = renderView;
function renderView(view) {
  _originalRenderView(view);
  setTimeout(animateProgressBars, 100);
}

// ═══════════════════════════════════════════════════════
//  TYPING INDICATOR
// ═══════════════════════════════════════════════════════

function showTypingIndicator() {
  const bar = UI.inputBar();
  if (!bar) return;
  let existing = bar.querySelector('.typing-indicator');
  if (!existing) {
    existing = document.createElement('div');
    existing.className = 'typing-indicator';
    existing.innerHTML = '<span></span><span></span><span></span>';
    bar.appendChild(existing);
  }
  existing.classList.add('visible');
}

function hideTypingIndicator() {
  const bar = UI.inputBar();
  if (!bar) return;
  bar.querySelector('.typing-indicator')?.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════
//  SIDEBAR STATS TICKER
// ═══════════════════════════════════════════════════════

function initSidebarTicker() {
  const el = document.getElementById('sidebarTicker');
  if (!el) return;
  const items = [
    'All systems nominal.',
    'Neural net: online.',
    'Threat level: zero.',
    'Reactor: 100%.',
    'Uplink: secure.',
    'Encryption: AES-256.',
    'Location: classified.',
  ];
  let i = 0;
  el.textContent = items[0];
  setInterval(() => {
    el.style.opacity = '0';
    setTimeout(() => {
      i = (i + 1) % items.length;
      el.textContent = items[i];
      el.style.opacity = '1';
    }, 400);
  }, 3000);
}

// ═══════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ═══════════════════════════════════════════════════════

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K → focus chat input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      UI.chatInput()?.focus();
    }
    // Escape → close modal
    if (e.key === 'Escape') {
      UI.modalOverlay()?.classList.remove('active');
    }
    // Ctrl/Cmd + D → dashboard
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
      e.preventDefault();
      navigate('dashboard');
    }
  });
}

// ═══════════════════════════════════════════════════════
//  DRAG-AND-DROP SIDEBAR REORDER (stub)
// ═══════════════════════════════════════════════════════

function initDragDrop() {
  const nav = document.querySelector('.nav-list');
  if (!nav) return;
  let dragged = null;
  nav.addEventListener('dragstart', e => {
    dragged = e.target.closest('.nav-item');
    if (dragged) dragged.style.opacity = '0.5';
  });
  nav.addEventListener('dragend', e => {
    if (dragged) dragged.style.opacity = '';
    dragged = null;
  });
  nav.addEventListener('dragover', e => e.preventDefault());
  nav.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.nav-item');
    if (target && dragged && target !== dragged) {
      nav.insertBefore(dragged, target);
    }
  });
}

// ═══════════════════════════════════════════════════════
//  RESPONSIVE SIDEBAR
// ═══════════════════════════════════════════════════════

function initResponsiveSidebar() {
  const sidebar = UI.sidebar();
  const content = UI.mainContent();
  if (!sidebar || !content) return;
  content.addEventListener('click', () => {
    if (window.innerWidth < 768) sidebar.classList.remove('open');
  });
}

// ═══════════════════════════════════════════════════════
//  ONLINE / OFFLINE DETECTION
// ═══════════════════════════════════════════════════════

function initConnectivityMonitor() {
  function update() {
    if (navigator.onLine) {
      setStatus('online');
    } else {
      setStatus('offline');
      showToast('Network connection lost. Some features may be unavailable.', 'warning');
    }
  }
  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
}

// ═══════════════════════════════════════════════════════
//  BOOT SEQUENCE
// ═══════════════════════════════════════════════════════

async function _boot() {
  initTheme();
  initClock();
  initParticles();
  initScanLines();
  initVoice();
  initEventListeners();
  initKeyboardShortcuts();
  initDragDrop();
  initResponsiveSidebar();
  initConnectivityMonitor();
  initSidebarTicker();

  State.userName = localStorage.getItem('jarvis_user') || 'Boss';
  updateGreeting();

  // Load API config from file (auto-connect)
  const configured = await loadApiConfig();

  if (!configured) {
    setStatus('offline');
    showToast('API endpoint not configured. Check api-config.json.', 'warning');
    const content = UI.mainContent();
    if (content) {
      content.innerHTML = `
        <div class="error-state">
          <h2>API Not Configured</h2>
          <p>JARVIS could not load <code>api-config.json</code>. Please ensure the file exists and contains a valid <code>api_url</code>.</p>
          <button class="btn btn-primary" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
    return;
  }

  setStatus('online');

  // Initial view
  const hash = window.location.hash.replace('#', '');
  const validViews = ['dashboard', 'projects', 'tasks', 'research', 'memory', 'briefings', 'settings'];
  const initialView = validViews.includes(hash) ? hash : 'dashboard';

  // Load initial data
  navigate(initialView);

  // Speak greeting after short delay
  setTimeout(() => {
    const greeting = fillTemplate(pickRandom(JARVIS_RESPONSES.greetings), { time: timeOfDay(), name: State.userName });
    speakText(greeting);
    updateGreeting();
    playSuccessSound();
  }, 800);
}

// ═══════════════════════════════════════════════════════
//  AUTH SYSTEM
// ═══════════════════════════════════════════════════════

const AUTH_KEY  = 'jarvis_auth_token';
const PASS_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'; // 'password'

async function _sha256(msg) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function _initAuthSystem() {
  const token = localStorage.getItem(AUTH_KEY);
  if (token === PASS_HASH) {
    // Already authenticated
    _hideAuthOverlay();
    await _boot();
    return;
  }
  // Show auth overlay
  const overlay = UI.authOverlay();
  if (overlay) overlay.style.display = 'flex';
  const btn   = UI.authBtn();
  const input = UI.authInput();
  if (btn && input) {
    const attempt = async () => {
      const hash = await _sha256(input.value);
      if (hash === PASS_HASH) {
        localStorage.setItem(AUTH_KEY, hash);
        _hideAuthOverlay();
        await _boot();
      } else {
        const errEl = UI.authError();
        if (errEl) {
          errEl.textContent = 'Access denied. Invalid credentials.';
          errEl.style.display = 'block';
        }
        input.value = '';
        input.focus();
      }
    };
    btn.addEventListener('click', attempt);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  }
}

function _hideAuthOverlay() {
  const overlay = UI.authOverlay();
  if (overlay) overlay.style.display = 'none';
}

// ═══════════════════════════════════════════════════════
//  MINI CHART (SVG sparkline)
// ═══════════════════════════════════════════════════════

function renderSparkline(containerId, data, color = '#00d4ff') {
  const container = document.getElementById(containerId);
  if (!container || !data.length) return;
  const w = container.offsetWidth || 120;
  const h = 40;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  container.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" />
  </svg>`;
}

// ═══════════════════════════════════════════════════════
//  CONTEXTUAL TIPS
// ═══════════════════════════════════════════════════════

const TIPS = [
  'Try asking JARVIS to create a project.',
  'Use Ctrl+K to quickly focus the chat input.',
  'Voice mode is available — click the mic button.',
  'JARVIS remembers things you tell it.',
  'Use the briefings section for structured reports.',
];

function showContextualTip() {
  const tip = pickRandom(TIPS);
  showToast('Tip: ' + tip, 'info', 6000);
}

// Show a tip after 30 seconds of inactivity
let _inactivityTimer;
function resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(showContextualTip, 30000);
}
document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keydown',   resetInactivityTimer);

// ═══════════════════════════════════════════════════════
//  EXPORT (for testing)
// ═══════════════════════════════════════════════════════

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    pickRandom, fillTemplate, timeOfDay, formatDate, formatDateTime,
    escapeHtml, slugify, setStatus, navigate, speakText, showToast,
  };
}

// ═══════════════════════════════════════════════════════
//  SYSTEM STATUS PANEL
// ═══════════════════════════════════════════════════════

function renderSystemStatus() {
  const el = document.getElementById('systemStatus');
  if (!el) return;
  const items = [
    { label: 'Neural Net',  value: 'Online',   cls: 'online'   },
    { label: 'Data Uplink', value: 'Secure',   cls: 'online'   },
    { label: 'Reactor',     value: '100%',     cls: 'online'   },
    { label: 'Encryption',  value: 'AES-256',  cls: 'online'   },
    { label: 'Threat Level',value: 'Zero',     cls: 'online'   },
  ];
  el.innerHTML = items.map(it => `
    <div class="sys-item">
      <span class="sys-label">${escapeHtml(it.label)}</span>
      <span class="sys-value ${it.cls}">${escapeHtml(it.value)}</span>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════
//  COMMAND PALETTE
// ═══════════════════════════════════════════════════════

function initCommandPalette() {
  const COMMANDS = [
    { label: 'Go to Dashboard',  action: () => navigate('dashboard')  },
    { label: 'Go to Projects',   action: () => navigate('projects')   },
    { label: 'Go to Tasks',      action: () => navigate('tasks')      },
    { label: 'Go to Research',   action: () => navigate('research')   },
    { label: 'Go to Memory',     action: () => navigate('memory')     },
    { label: 'Go to Briefings',  action: () => navigate('briefings')  },
    { label: 'Go to Settings',   action: () => navigate('settings')   },
    { label: 'Toggle Theme',     action: toggleTheme                   },
    { label: 'New Project',      action: showNewProjectModal           },
    { label: 'New Task',         action: showNewTaskModal              },
    { label: 'New Research',     action: showNewResearchModal          },
    { label: 'Store Memory',     action: showNewMemoryModal            },
  ];

  let paletteEl = null;

  function openPalette() {
    if (paletteEl) return;
    paletteEl = document.createElement('div');
    paletteEl.className = 'command-palette';
    paletteEl.innerHTML = `
      <input class="palette-input" placeholder="Type a command…" autofocus />
      <div class="palette-list"></div>
    `;
    document.body.appendChild(paletteEl);
    const input = paletteEl.querySelector('.palette-input');
    const list  = paletteEl.querySelector('.palette-list');

    function renderList(filter) {
      const filtered = COMMANDS.filter(c => c.label.toLowerCase().includes(filter.toLowerCase()));
      list.innerHTML = filtered.map((c, i) =>
        `<div class="palette-item" data-index="${i}">${escapeHtml(c.label)}</div>`
      ).join('');
      list.querySelectorAll('.palette-item').forEach((item, i) => {
        item.addEventListener('click', () => {
          filtered[i].action();
          closePalette();
        });
      });
    }

    renderList('');
    input.addEventListener('input', () => renderList(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePalette();
      if (e.key === 'Enter') {
        const first = list.querySelector('.palette-item');
        first?.click();
      }
    });
    input.focus();

    // Click outside to close
    setTimeout(() => {
      document.addEventListener('click', (e) => {
        if (paletteEl && !paletteEl.contains(e.target)) closePalette();
      }, { once: true });
    }, 100);
  }

  function closePalette() {
    paletteEl?.remove();
    paletteEl = null;
  }

  // Ctrl+P or Ctrl+Shift+P
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      paletteEl ? closePalette() : openPalette();
    }
  });
}

// ═══════════════════════════════════════════════════════
//  NOTIFICATION CENTER
// ═══════════════════════════════════════════════════════

const Notifications = {
  items: [],
  add(msg, type = 'info') {
    this.items.unshift({ msg, type, time: new Date() });
    if (this.items.length > 20) this.items.pop();
    this.updateBadge();
  },
  updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = this.items.length;
      badge.style.display = this.items.length ? 'block' : 'none';
    }
  },
  render() {
    const panel = document.getElementById('notifPanel');
    if (!panel) return;
    panel.innerHTML = this.items.length === 0
      ? '<p class="notif-empty">No notifications.</p>'
      : this.items.map(n => `
          <div class="notif-item notif-${n.type}">
            <span class="notif-msg">${escapeHtml(n.msg)}</span>
            <span class="notif-time">${n.time.toLocaleTimeString()}</span>
          </div>`
        ).join('');
  },
};

// ═══════════════════════════════════════════════════════
//  PERFORMANCE METRICS (stub)
// ═══════════════════════════════════════════════════════

function collectPerformanceMetrics() {
  if (!window.performance) return {};
  const nav = performance.getEntriesByType('navigation')[0] || {};
  return {
    domLoad:     Math.round(nav.domContentLoadedEventEnd - nav.startTime),
    fullLoad:    Math.round(nav.loadEventEnd - nav.startTime),
    ttfb:        Math.round(nav.responseStart - nav.requestStart),
  };
}

// ═══════════════════════════════════════════════════════
//  ERROR BOUNDARY
// ═══════════════════════════════════════════════════════

window.addEventListener('unhandledrejection', (e) => {
  console.error('[JARVIS] Unhandled promise rejection:', e.reason);
  showToast('An unexpected error occurred. See console for details.', 'error');
});

window.addEventListener('error', (e) => {
  console.error('[JARVIS] Global error:', e.message);
});

// ═══════════════════════════════════════════════════════
//  SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════════

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW not available in this environment — silently skip
    });
  });
}

// ═══════════════════════════════════════════════════════
//  LAZY IMAGE LOADING
// ═══════════════════════════════════════════════════════

function initLazyImages() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          observer.unobserve(img);
        }
      }
    });
  });
  document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
}

// ═══════════════════════════════════════════════════════
//  COLOR THEME PICKER
// ═══════════════════════════════════════════════════════

const COLOR_THEMES = {
  cyan:    { '--accent': '#00d4ff', '--accent-glow': 'rgba(0,212,255,0.3)' },
  green:   { '--accent': '#00ff88', '--accent-glow': 'rgba(0,255,136,0.3)' },
  purple:  { '--accent': '#a855f7', '--accent-glow': 'rgba(168,85,247,0.3)' },
  orange:  { '--accent': '#f97316', '--accent-glow': 'rgba(249,115,22,0.3)' },
  red:     { '--accent': '#ef4444', '--accent-glow': 'rgba(239,68,68,0.3)'  },
};

function applyColorTheme(name) {
  const theme = COLOR_THEMES[name];
  if (!theme) return;
  Object.entries(theme).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v);
  });
  localStorage.setItem('jarvis_color_theme', name);
}

function initColorTheme() {
  const saved = localStorage.getItem('jarvis_color_theme') || 'cyan';
  applyColorTheme(saved);
}

// ═══════════════════════════════════════════════════════
//  DATA EXPORT
// ═══════════════════════════════════════════════════════

function exportData() {
  const data = {
    exported_at: new Date().toISOString(),
    projects:    State.data.projects,
    tasks:       State.data.tasks,
    research:    State.data.research,
    memories:    State.data.memories,
    briefings:   State.data.briefings,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `jarvis-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data exported successfully.', 'success');
}

// ═══════════════════════════════════════════════════════
//  FULLSCREEN TOGGLE
// ═══════════════════════════════════════════════════════

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════
//  PRINT VIEW
// ═══════════════════════════════════════════════════════

function printCurrentView() {
  window.print();
}

// ═══════════════════════════════════════════════════════
//  ACCESSIBILITY: SKIP LINK
// ═══════════════════════════════════════════════════════

function initSkipLink() {
  const skip = document.getElementById('skipToMain');
  if (!skip) return;
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    const main = UI.mainContent();
    if (main) { main.setAttribute('tabindex', '-1'); main.focus(); }
  });
}

// ═══════════════════════════════════════════════════════
//  MISC HELPERS
// ═══════════════════════════════════════════════════════

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Copied to clipboard.', 'success');
  }).catch(() => {
    showToast('Failed to copy.', 'error');
  });
}

// ═══════════════════════════════════════════════════════
//  ADVANCED SEARCH
// ═══════════════════════════════════════════════════════

function searchAll(query) {
  const q = query.toLowerCase();
  const results = [];
  State.data.projects.forEach(p => {
    if (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q))
      results.push({ type: 'project', label: p.name, action: () => navigate('projects') });
  });
  State.data.tasks.forEach(t => {
    if (t.name.toLowerCase().includes(q))
      results.push({ type: 'task', label: t.name, action: () => navigate('tasks') });
  });
  State.data.research.forEach(r => {
    if (r.topic.toLowerCase().includes(q) || (r.content || '').toLowerCase().includes(q))
      results.push({ type: 'research', label: r.topic, action: () => navigate('research') });
  });
  State.data.memories.forEach(m => {
    if ((m.content || '').toLowerCase().includes(q))
      results.push({ type: 'memory', label: m.content.substring(0, 50), action: () => navigate('memory') });
  });
  return results;
}

// ═══════════════════════════════════════════════════════
//  LIVE SEARCH BAR
// ═══════════════════════════════════════════════════════

function initLiveSearch() {
  const searchInput = document.getElementById('globalSearch');
  if (!searchInput) return;
  const resultsEl = document.getElementById('searchResults');
  if (!resultsEl) return;
  searchInput.addEventListener('input', debounce(() => {
    const q = searchInput.value.trim();
    if (!q) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; return; }
    const results = searchAll(q);
    if (!results.length) {
      resultsEl.innerHTML = '<div class="search-result-empty">No results found.</div>';
    } else {
      resultsEl.innerHTML = results.slice(0, 8).map((r, i) =>
        `<div class="search-result-item" data-index="${i}">
           <span class="search-result-type">${escapeHtml(r.type)}</span>
           <span class="search-result-label">${escapeHtml(r.label)}</span>
         </div>`
      ).join('');
      resultsEl.querySelectorAll('.search-result-item').forEach((item, i) => {
        item.addEventListener('click', () => {
          results[i].action();
          resultsEl.style.display = 'none';
          searchInput.value = '';
        });
      });
    }
    resultsEl.style.display = 'block';
  }, 200));

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsEl.contains(e.target)) {
      resultsEl.style.display = 'none';
    }
  });
}

// ═══════════════════════════════════════════════════════
//  GANTT / TIMELINE STUB
// ═══════════════════════════════════════════════════════

function renderTimeline(containerId, items) {
  const el = document.getElementById(containerId);
  if (!el || !items.length) return;
  const now   = Date.now();
  const start = Math.min(...items.map(i => new Date(i.start || now).getTime()));
  const end   = Math.max(...items.map(i => new Date(i.end   || now).getTime()));
  const range = end - start || 1;
  el.innerHTML = `<div class="timeline">${items.map(item => {
    const left  = ((new Date(item.start || now).getTime() - start) / range) * 100;
    const width = Math.max(((new Date(item.end || now).getTime() - new Date(item.start || now).getTime()) / range) * 100, 2);
    return `<div class="timeline-item" style="left:${left}%;width:${width}%" title="${escapeHtml(item.label)}">
              <span class="timeline-label">${escapeHtml(item.label)}</span>
            </div>`;
  }).join('')}</div>`;
}

// ═══════════════════════════════════════════════════════
//  CALENDAR MINI (stub)
// ═══════════════════════════════════════════════════════

function renderMiniCalendar(containerId, year, month) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const names = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  let html = `<div class="mini-cal">
    <div class="mini-cal-header">${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}</div>
    <div class="mini-cal-grid">${names.map(n => `<span class="cal-day-name">${n}</span>`).join('')}`;
  for (let i = 0; i < first; i++) html += `<span></span>`;
  for (let d = 1; d <= days; d++) {
    const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;
    html += `<span class="cal-day${isToday ? ' today' : ''}">${d}</span>`;
  }
  html += `</div></div>`;
  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════
//  WEATHER WIDGET (stub — requires API key)
// ═══════════════════════════════════════════════════════

async function fetchWeather(city) {
  // Requires integration with a weather API (e.g., OpenWeatherMap)
  // This is a stub — replace API_KEY and endpoint as needed
  try {
    const API_KEY = localStorage.getItem('weather_api_key');
    if (!API_KEY) return null;
    const res  = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`);
    const data = await res.json();
    return { temp: data.main?.temp, desc: data.weather?.[0]?.description, city: data.name };
  } catch (_) { return null; }
}

// ═══════════════════════════════════════════════════════
//  BATTERY STATUS (Web API)
// ═══════════════════════════════════════════════════════

async function initBatteryMonitor() {
  if (!navigator.getBattery) return;
  const battery = await navigator.getBattery();
  function update() {
    const el = document.getElementById('batteryStatus');
    if (!el) return;
    const pct = Math.round(battery.level * 100);
    el.textContent = `Battery: ${pct}% ${battery.charging ? '⚡' : ''}`;
  }
  battery.addEventListener('levelchange',    update);
  battery.addEventListener('chargingchange', update);
  update();
}

// ═══════════════════════════════════════════════════════
//  GEOLOCATION (stub)
// ═══════════════════════════════════════════════════════

function getLocation(callback) {
  if (!navigator.geolocation) { callback(null, 'Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(
    pos  => callback({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    err  => callback(null, err.message),
  );
}

// ═══════════════════════════════════════════════════════
//  LOCAL NOTIFICATIONS (Web Push stub)
// ═══════════════════════════════════════════════════════

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

function sendLocalNotification(title, body) {
  if (Notification.permission !== 'granted') return;
  new Notification(title, { body, icon: '/favicon.ico' });
}

// ═══════════════════════════════════════════════════════
//  MATRIX RAIN (easter egg)
// ═══════════════════════════════════════════════════════

function triggerMatrixRain() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const cols = Math.floor(canvas.width / 16);
  const drops = Array(cols).fill(1);
  const chars = '01アイウエオカキクケコ';
  let frame = 0;
  const id = setInterval(() => {
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff41';
    ctx.font = '14px monospace';
    drops.forEach((y, i) => {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ctx.fillText(ch, i * 16, y * 16);
      if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
    if (++frame > 200) { clearInterval(id); canvas.remove(); }
  }, 33);
}

// Type 'matrix' in chat to trigger easter egg
const _origProcess = processCommand;
async function processCommand(input) {
  if (input.trim().toLowerCase() === 'matrix') { triggerMatrixRain(); return; }
  return _origProcess(input);
}

// ═══════════════════════════════════════════════════════
//  WEBCAM FEED (stub)
// ═══════════════════════════════════════════════════════

async function initWebcam(videoElId) {
  const video = document.getElementById(videoElId);
  if (!video) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();
  } catch (e) {
    console.warn('[JARVIS] Webcam unavailable:', e.message);
  }
}

// ═══════════════════════════════════════════════════════
//  WEBSOCKET (real-time stub)
// ═══════════════════════════════════════════════════════

let _ws = null;

function initWebSocket(url) {
  if (_ws) _ws.close();
  _ws = new WebSocket(url);
  _ws.onopen    = () => { setStatus('online'); showToast('Real-time connection established.', 'success'); };
  _ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'update') renderView(State.currentView);
      if (msg.type === 'toast')  showToast(msg.text, msg.level || 'info');
    } catch (_) {}
  };
  _ws.onerror = () => showToast('WebSocket error.', 'error');
  _ws.onclose = () => setStatus('offline');
}

// ═══════════════════════════════════════════════════════
//  MARKDOWN RENDERER (minimal)
// ═══════════════════════════════════════════════════════

function renderMarkdown(md) {
  return md
    .replace(/^### (.+)/gm,  '<h3>$1</h3>')
    .replace(/^## (.+)/gm,   '<h2>$1</h2>')
    .replace(/^# (.+)/gm,    '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,   '<em>$1</em>')
    .replace(/`(.+?)`/g,     '<code>$1</code>')
    .replace(/\n/g,          '<br>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
}

// ═══════════════════════════════════════════════════════
//  DIFF VIEWER (stub)
// ═══════════════════════════════════════════════════════

function renderDiff(oldText, newText) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const max = Math.max(oldLines.length, newLines.length);
  let html = '<div class="diff-view">';
  for (let i = 0; i < max; i++) {
    const o = oldLines[i] ?? '';
    const n = newLines[i] ?? '';
    if (o === n) {
      html += `<div class="diff-line diff-same">${escapeHtml(n)}</div>`;
    } else {
      if (o) html += `<div class="diff-line diff-removed">- ${escapeHtml(o)}</div>`;
      if (n) html += `<div class="diff-line diff-added">+ ${escapeHtml(n)}</div>`;
    }
  }
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════
//  HOTKEY MAP DISPLAY
// ═══════════════════════════════════════════════════════

function showHotkeyMap() {
  showModal('Keyboard Shortcuts', `
    <table class="hotkey-table">
      <tr><td>Ctrl + K</td><td>Focus chat input</td></tr>
      <tr><td>Ctrl + D</td><td>Go to Dashboard</td></tr>
      <tr><td>Ctrl + P</td><td>Open Command Palette</td></tr>
      <tr><td>Escape</td><td>Close modal</td></tr>
    </table>
  `);
}

// ═══════════════════════════════════════════════════════
//  STYLE INJECTION (dynamic)
// ═══════════════════════════════════════════════════════

function injectStyle(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

// Compact mode
function enableCompactMode() {
  injectStyle(`:root { --spacing-sm: 4px; --spacing-md: 8px; --spacing-lg: 12px; } .card { padding: 8px; } .list-item { padding: 6px 8px; }`);
  showToast('Compact mode enabled.', 'info');
}

// ═══════════════════════════════════════════════════════
//  WIDGET REGISTRY
// ═══════════════════════════════════════════════════════

const Widgets = {
  registry: {},
  register(name, fn) { this.registry[name] = fn; },
  render(name, el, data) {
    const fn = this.registry[name];
    if (fn) fn(el, data);
    else el.textContent = `Widget "${name}" not found.`;
  },
};

// Example: register a clock widget
Widgets.register('clock', (el) => {
  setInterval(() => {
    el.textContent = new Date().toLocaleTimeString();
  }, 1000);
});

// ═══════════════════════════════════════════════════════
//  PLUGIN SYSTEM (stub)
// ═══════════════════════════════════════════════════════

const PluginManager = {
  plugins: [],
  register(plugin) {
    if (typeof plugin.init === 'function') {
      plugin.init({ State, UI, callApi, showToast, navigate });
      this.plugins.push(plugin);
      console.log('[JARVIS] Plugin loaded:', plugin.name || 'unnamed');
    }
  },
};

// ═══════════════════════════════════════════════════════
//  I18N (stub)
// ═══════════════════════════════════════════════════════

const I18N = {
  locale: 'en',
  strings: {
    en: { hello: 'Hello', error: 'Error', loading: 'Loading' },
    es: { hello: 'Hola',  error: 'Error', loading: 'Cargando' },
  },
  t(key) {
    return this.strings[this.locale]?.[key] || this.strings['en']?.[key] || key;
  },
  setLocale(locale) {
    this.locale = locale;
    localStorage.setItem('jarvis_locale', locale);
  },
};

// ═══════════════════════════════════════════════════════
//  ANALYTICS (stub)
// ═══════════════════════════════════════════════════════

const Analytics = {
  events: [],
  track(event, data = {}) {
    this.events.push({ event, data, ts: Date.now() });
    // In production: send to analytics endpoint
  },
};

// Track navigation
const __origNavigate = navigate;
function navigate(view) {
  Analytics.track('navigate', { view });
  __origNavigate(view);
}

// ═══════════════════════════════════════════════════════
//  UNDO / REDO STACK
// ═══════════════════════════════════════════════════════

const UndoStack = {
  stack: [],
  redoStack: [],
  push(action) {
    this.stack.push(action);
    this.redoStack = [];
  },
  undo() {
    const action = this.stack.pop();
    if (action?.undo) { action.undo(); this.redoStack.push(action); }
  },
  redo() {
    const action = this.redoStack.pop();
    if (action?.redo) { action.redo(); this.stack.push(action); }
  },
};

// ═══════════════════════════════════════════════════════
//  FOCUS TRAP (for modals)
// ═══════════════════════════════════════════════════════

function trapFocus(el) {
  const focusable = el.querySelectorAll('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])');
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  });
}

// ═══════════════════════════════════════════════════════
//  RESPONSIVE IMAGES
// ═══════════════════════════════════════════════════════

function buildSrcSet(basePath, sizes) {
  return sizes.map(s => `${basePath}?w=${s} ${s}w`).join(', ');
}

// ═══════════════════════════════════════════════════════
//  CSS VARIABLES INSPECTOR
// ═══════════════════════════════════════════════════════

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setCssVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

// ═══════════════════════════════════════════════════════
//  RESIZE OBSERVER
// ═══════════════════════════════════════════════════════

function observeResize(el, callback) {
  if (!('ResizeObserver' in window)) return;
  const ro = new ResizeObserver(entries => {
    entries.forEach(e => callback(e.contentRect));
  });
  ro.observe(el);
  return ro;
}

// ═══════════════════════════════════════════════════════
//  SCROLL TO TOP
// ═══════════════════════════════════════════════════════

function initScrollToTop() {
  const btn = document.getElementById('scrollTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', throttle(() => {
    btn.style.display = window.scrollY > 300 ? 'block' : 'none';
  }, 200));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ═══════════════════════════════════════════════════════
//  CONTEXT MENU
// ═══════════════════════════════════════════════════════

function initContextMenu() {
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.display = 'none';
  document.body.appendChild(menu);

  document.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('[data-context]');
    if (!target) return;
    e.preventDefault();
    const items = JSON.parse(target.dataset.context || '[]');
    menu.innerHTML = items.map((item, i) =>
      `<div class="ctx-item" data-index="${i}">${escapeHtml(item.label)}</div>`
    ).join('');
    menu.querySelectorAll('.ctx-item').forEach((el, i) => {
      el.addEventListener('click', () => {
        // Actions handled by caller
        menu.style.display = 'none';
      });
    });
    menu.style.cssText = `display:block;position:fixed;top:${e.clientY}px;left:${e.clientX}px;z-index:10000;`;
  });

  document.addEventListener('click', () => { menu.style.display = 'none'; });
}

// ═══════════════════════════════════════════════════════
//  DRAG-AND-DROP FILE UPLOAD
// ═══════════════════════════════════════════════════════

function initFileDrop(dropZoneId, callback) {
  const zone = document.getElementById(dropZoneId);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    callback(files);
  });
}

// ═══════════════════════════════════════════════════════
//  INDEXED DB (local persistence stub)
// ═══════════════════════════════════════════════════════

const DB = {
  db: null,
  async open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('JarvisDB', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        ['projects','tasks','research','memories','briefings'].forEach(store => {
          if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
        });
      };
      req.onsuccess = e => { this.db = e.target.result; res(this.db); };
      req.onerror   = e => rej(e.target.error);
    });
  },
  async getAll(store) {
    return new Promise((res, rej) => {
      const tx  = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
  },
  async put(store, item) {
    return new Promise((res, rej) => {
      const tx  = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(item);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },
  async delete(store, id) {
    return new Promise((res, rej) => {
      const tx  = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(id);
      req.onsuccess = () => res();
      req.onerror   = () => rej(req.error);
    });
  },
};

// ═══════════════════════════════════════════════════════
//  RATE LIMITER
// ═══════════════════════════════════════════════════════

function createRateLimiter(limit, windowMs) {
  const calls = [];
  return function(fn) {
    const now = Date.now();
    while (calls.length && now - calls[0] > windowMs) calls.shift();
    if (calls.length >= limit) {
      showToast('Too many requests. Please wait.', 'warning');
      return;
    }
    calls.push(now);
    return fn();
  };
}

const rateLimitedCommand = createRateLimiter(10, 60000);

// ═══════════════════════════════════════════════════════
//  TOKEN COUNTER (for chat)
// ═══════════════════════════════════════════════════════

function estimateTokens(text) {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

// ═══════════════════════════════════════════════════════
//  LOADING SKELETON
// ═══════════════════════════════════════════════════════

function skeletonHtml(rows = 3) {
  return Array(rows).fill(0).map(() => `
    <div class="skeleton-row">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════════════════
//  VIRTUAL SCROLL (stub)
// ═══════════════════════════════════════════════════════

function initVirtualScroll(containerId, items, renderItem, itemHeight = 60) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const total = items.length * itemHeight;
  container.style.position = 'relative';
  container.style.height   = `${Math.min(total, 400)}px`;
  container.style.overflowY = 'auto';

  const inner = document.createElement('div');
  inner.style.height = `${total}px`;
  inner.style.position = 'relative';
  container.appendChild(inner);

  function render() {
    const scrollTop = container.scrollTop;
    const start = Math.floor(scrollTop / itemHeight);
    const end   = Math.min(start + Math.ceil(400 / itemHeight) + 1, items.length);
    inner.innerHTML = '';
    for (let i = start; i < end; i++) {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;top:${i * itemHeight}px;left:0;right:0;height:${itemHeight}px;`;
      el.innerHTML = renderItem(items[i], i);
      inner.appendChild(el);
    }
  }

  container.addEventListener('scroll', throttle(render, 50));
  render();
}

// ═══════════════════════════════════════════════════════
//  HUD METRICS BAR
// ═══════════════════════════════════════════════════════

function initHudMetrics() {
  const el = document.getElementById('hudMetrics');
  if (!el) return;
  function update() {
    const memory = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) : '--';
    el.innerHTML = `
      <span>JS Heap: ${memory}MB</span>
      <span>FPS: ~60</span>
      <span>Conn: ${navigator.onLine ? 'Online' : 'Offline'}</span>
    `;
  }
  update();
  setInterval(update, 5000);
}

// ═══════════════════════════════════════════════════════
//  PROGRESS TOAST
// ═══════════════════════════════════════════════════════

function showProgressToast(id, label, pct) {
  let toast = document.getElementById(`progress-toast-${id}`);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = `progress-toast-${id}`;
    toast.className = 'toast toast-progress toast-visible';
    toast.innerHTML = `
      <span class="toast-message">${escapeHtml(label)}</span>
      <div class="progress-bar" style="margin-top:6px">
        <div class="progress-fill" id="progress-fill-${id}" style="width:${pct}%;transition:width 0.3s ease"></div>
      </div>
    `;
    UI.toastContainer()?.appendChild(toast);
  } else {
    document.getElementById(`progress-fill-${id}`).style.width = `${pct}%`;
  }
  if (pct >= 100) {
    setTimeout(() => toast.remove(), 1000);
  }
}

// ═══════════════════════════════════════════════════════
//  INIT EXTRA FEATURES
// ═══════════════════════════════════════════════════════

// Call these after DOM is ready
function initExtras() {
  initColorTheme();
  initCommandPalette();
  initLiveSearch();
  initLazyImages();
  initScrollToTop();
  initContextMenu();
  initSkipLink();
  initHudMetrics();
  renderSystemStatus();
  initBatteryMonitor();
}

// Attach to boot
const _origBoot = _boot;
async function _boot() {
  await _origBoot();
  initExtras();
}

// ═══════════════════════════════════════════════════════
//  FINAL: START
// ═══════════════════════════════════════════════════════

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', _initAuthSystem);
