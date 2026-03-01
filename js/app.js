/**
 * JARVIS AI Assistant — Core Application Engine
 * J.A.R.V.I.S. — Just A Rather Very Intelligent System
 * Stark Industries — Proprietary Interface v7.3.1
 */

'use strict';

// ══════════════════════════════════════════════════════════
//  CONFIGURATION
// ══════════════════════════════════════════════════════════
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
    "I didn't catch that entirely. Could you be more specific, {name}?",
    "My apologies, {name}. That command isn't in my current parameters. Try 'help' for a list of commands.",
  ],
  help: `Available commands, {name}:
• "new project [name]" — Create a new project
• "show projects" — Navigate to projects
• "new task [name]" — Add task to current project
• "research [topic]" — Open research center
• "show chat" — Open conversation panel
• "remember [fact]" — Save to memory banks
• "show memory" — Open memory banks
• "show dashboard" — Return to command center
• "settings" — Open configuration panel
• "what time is it" — Current time
• "status" — System diagnostics report`,
};

// ══════════════════════════════════════════════════════════
//  APPLICATION STATE
// ══════════════════════════════════════════════════════════
const State = {
  currentView: 'dashboard',
  currentProjectId: null,
  userName: 'Sir',
  voiceSettings: { rate: 0.9, pitch: 1.0, volume: 1.0, voiceURI: '' },
  isListening: false,
  isSpeaking: false,
  recognition: null,
  synthesis: window.speechSynthesis,
  availableVoices: [],
  selectedVoice: null,
  audioCtx: null,
  kpis: { projects: 0, memories: 0, operations: 0, conversations: 0 },
  // Voice upgrade state
  continuousMode: false,
  wakeWordActive: false,
  wakeRecognition: null,
  speechQueue: [],
  analyser: null,
  micSource: null,
  audioVizActive: false,
  // ElevenLabs TTS
  elevenLabs: {
    enabled: true,
    apiKey: 'ae057a5a1eac4465a8d4ad630bda48d0a6aad444db35a024543ef5174846 4e43',
    voiceId: 'P3TTlDkzxma0sdCGP8YZ',
    model: 'eleven_multilingual_v2',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.4,
  },
  elevenLabsAudio: null,  // current Audio element for streaming
};

// Audio element for ElevenLabs TTS — primed on first user interaction to bypass autoplay
let _elAudio = null;
let _audioUnlocked = false;

function _unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  // Create and prime an audio element with a silent sample
  _elAudio = new Audio();
  const ctx = State.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  State.audioCtx = ctx;
  // Play silent audio to unlock the element
  _elAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
  _elAudio.volume = 0;
  _elAudio.play().then(() => { _elAudio.pause(); _elAudio.volume = 1; }).catch(() => {});
}

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── In-memory cache helpers ──────────────────────────────────────────
const _memCache = {};
function lsGet(table) {
  return _memCache[table] || null;
}
function lsSet(table, value) {
  _memCache[table] = value;
}
function lsNextId(rows) {
  return rows.length ? Math.max(...rows.map(r => r.id || 0)) + 1 : 1;
}
function parseParams(params) {
  const p = {};
  if (!params) return p;
  params.split('&').forEach(pair => { const [k, v] = pair.split('='); if (k) p[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
  return p;
}

// Default settings
const DEFAULT_SETTINGS = {
  user_name: 'Sir',
  voice_rate: 0.9,
  voice_pitch: 1.0,
  voice_volume: 1.0,
  glow_intensity: 1.0,
  animation_speed: 1.0,
  theme: 'dark',
  continuous_mode: 'true',
  wake_word: 'true',
  el_enabled: 'true',
  el_apikey: 'ae057a5a1eac4465a8d4ad630bda48d0a6aad444db35a024543ef5174846 4e43',
  el_voiceid: 'P3TTlDkzxma0sdCGP8YZ',
  el_model: 'eleven_multilingual_v2',
};

// ── Remote API Configuration ─────────────────────────────────────────
const API_BASE = '__CGI_BIN__/api.py';

async function api(action, method = 'GET', body = null, params = '') {
  try {
    // ── SETTINGS: memory cache, API as source of truth ──
    if (action === 'settings') {
      if (method === 'GET') {
        // Return cached settings immediately, refresh from API in background
        const cached = lsGet('settings');
        const base = Object.assign({}, DEFAULT_SETTINGS, cached || {});
        // Fire-and-forget: sync from API
        fetch(`${API_BASE}?action=settings`, { method: 'GET' })
          .then(r => r.json())
          .then(remote => {
            if (remote && typeof remote === 'object' && !remote.error) {
              const merged = Object.assign({}, DEFAULT_SETTINGS, remote);
              lsSet('settings', merged);
            }
          }).catch(() => {});
        return base;
      }
      if (method === 'POST' && body) {
        // Save to memory cache immediately for responsiveness
        const current = Object.assign({}, DEFAULT_SETTINGS, lsGet('settings') || {});
        const updated = Object.assign(current, body);
        lsSet('settings', updated);
        // Sync to API in background
        fetch(`${API_BASE}?action=settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).catch(() => {});
        return updated;
      }
    }

    // ── ALL OTHER TABLES: fetch from remote API ─────────────────────
    let url = `${API_BASE}?action=${encodeURIComponent(action)}`;
    if (params) url += '&' + params;

    const opts = { method };
    if (body && (method === 'POST' || method === 'PUT')) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }

    const res = await fetch(url, opts);
    const data = await res.json();

    // Cache GET results in memory for offline fallback
    if (method === 'GET' && Array.isArray(data)) {
      lsSet(action, data);
    }

    return data;
  } catch (err) {
    console.warn(`API ${action} failed, falling back to cache:`, err);
    // ── Offline fallback: use memory cache ──────────────────────────
    if (action === 'settings') {
      return Object.assign({}, DEFAULT_SETTINGS, lsGet('settings') || {});
    }
    const cached = lsGet(action);
    if (Array.isArray(cached)) return cached;
    return method === 'GET' ? [] : null;
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(str, vars = {}) {
  return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] || State.userName || 'Sir');
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatDateTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
           d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

// ══════════════════════════════════════════════════════════
//  AUDIO ENGINE — Web Audio API tones
// ══════════════════════════════════════════════════════════
function initAudio() {
  try {
    State.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.log('Web Audio API not available');
  }
}

function playTone(freq = 880, duration = 80, type = 'sine', vol = 0.08) {
  if (!State.audioCtx) return;
  try {
    const osc = State.audioCtx.createOscillator();
    const gain = State.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(State.audioCtx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, State.audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, State.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, State.audioCtx.currentTime + duration / 1000);
    osc.start();
    osc.stop(State.audioCtx.currentTime + duration / 1000);
  } catch(e) {}
}

function playClickSound() { playTone(1200, 40, 'square', 0.04); }
function playSuccessSound() {
  playTone(660, 80, 'sine', 0.06);
  setTimeout(() => playTone(880, 80, 'sine', 0.05), 100);
  setTimeout(() => playTone(1100, 120, 'sine', 0.04), 200);
}
function playErrorSound() { playTone(220, 200, 'sawtooth', 0.05); }
function playNavSound() { playTone(660, 50, 'sine', 0.04); }
function playVoiceStartSound() {
  playTone(880, 60, 'sine', 0.06);
  setTimeout(() => playTone(1100, 80, 'sine', 0.05), 80);
}

// ══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════
function showToast(msg, duration = 3500) {
  const container = $('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ══════════════════════════════════════════════════════════
//  CLOCK & GREETING
// ══════════════════════════════════════════════════════════
function startClock() {
  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const el = $('live-clock');
    if (el) el.textContent = `${dateStr}  ${timeStr}`;
  }
  update();
  setInterval(update, 1000);
}

function updateGreeting() {
  const greet = $('greeting-text');
  if (greet) {
    const tod = timeOfDay();
    greet.textContent = `Good ${tod}, ${State.userName}. All systems operational.`;
  }
  const arcLabel = $('arc-state-label');
  if (arcLabel && !State.isListening) {
    arcLabel.textContent = 'STANDBY — CLICK TO ACTIVATE VOICE';
  }
}

// ══════════════════════════════════════════════════════════
//  DIAGNOSTICS ANIMATION
// ══════════════════════════════════════════════════════════
function animateDiagnostics() {
  function jitter(base, range) {
    return Math.min(99, Math.max(1, base + (Math.random() - 0.5) * range));
  }
  let cpu = 45, mem = 62, net = 28, ai = 78;
  setInterval(() => {
    cpu = jitter(cpu, 15);
    mem = jitter(mem, 8);
    net = jitter(net, 20);
    ai  = jitter(ai, 12);
    const set = (id, val) => {
      const fill = $(id);
      const valEl = $(id + '-val');
      if (fill) fill.style.width = val.toFixed(0) + '%';
      if (valEl) valEl.textContent = val.toFixed(0) + '%';
    };
    set('diag-cpu', cpu);
    set('diag-mem', mem);
    set('diag-net', net);
    set('diag-ai', ai);
  }, 2500);
}

// ══════════════════════════════════════════════════════════
//  ROUTING — View Navigation
// ══════════════════════════════════════════════════════════
function navigate(viewName) {
  if (!viewName) return;
  playNavSound();

  // Deactivate all views
  $$('.view').forEach(v => v.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  $$('.mobile-nav-btn').forEach(n => n.classList.remove('active'));

  // Activate target view
  const view = $('view-' + viewName);
  if (view) view.classList.add('active');

  // Update nav
  $$(`[data-view="${viewName}"]`).forEach(el => el.classList.add('active'));

  // Update quick-action bottom bar for desktop
  const isMobile = window.innerWidth <= 600;
  $$('.mobile-nav-btn').forEach(b => {
    b.style.display = isMobile ? 'flex' : 'none';
  });
  const qp = $('quick-project-btn');
  const qr = $('quick-research-btn');
  const qm = $('quick-memory-btn');
  if (!isMobile) {
    [qp, qr, qm].forEach(el => { if (el) el.style.display = 'inline-flex'; });
  }

  State.currentView = viewName;
  window.location.hash = viewName;

  // Load view-specific data
  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'projects') loadProjects();
  else if (viewName === 'chat') loadChat();
  else if (viewName === 'operations') loadOperations();
  else if (viewName === 'research') loadResearch();
  else if (viewName === 'schedule') loadSchedule();
  else if (viewName === 'memory') loadMemory();
  else if (viewName === 'settings') loadSettings();
}

// ══════════════════════════════════════════════════════════
//  KPI COUNTER ANIMATION
// ══════════════════════════════════════════════════════════
function animateCount(el, target) {
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const duration = 600;
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ══════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════
async function loadDashboard() {
  const [projects, memories, operations, convos, scheduledTasks] = await Promise.all([
    api('projects'),
    api('memories'),
    api('operations'),
    api('conversations'),
    api('scheduled_tasks'),
  ]);

  const activeProjects = (projects || []).filter(p => p.status.toLowerCase() === 'active').length;
  const totalMemories = (memories || []).length;
  const totalOps = (operations || []).length;
  const totalConvos = (convos || []).length;
  const pendingScheduled = (scheduledTasks || []).filter(t => t.status !== 'completed').length;

  animateCount($('kpi-projects'), activeProjects);
  animateCount($('kpi-memories'), totalMemories);
  animateCount($('kpi-operations'), totalOps);
  animateCount($('kpi-convos'), totalConvos);
  animateCount($('kpi-schedule-count'), pendingScheduled);

  // Recent activity
  const activityEl = $('recent-activity');
  if (activityEl) {
    const recent = [...(convos || [])].slice(0, 5);
    if (recent.length === 0) {
      activityEl.innerHTML = '<div style="color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-xs)">No recent activity</div>';
    } else {
      activityEl.innerHTML = recent.map(c => `
        <div style="display:flex;gap:var(--sp-3);align-items:flex-start;padding:var(--sp-2) 0;border-bottom:1px solid var(--border-dim)">
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-cyan);width:40px;flex-shrink:0">${c.role === 'user' ? 'YOU' : 'J.A.R.'}</span>
          <span style="font-size:var(--text-xs);color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.content)}</span>
        </div>
      `).join('');
    }
  }

  // Ops preview
  const opsEl = $('ops-preview');
  if (opsEl) {
    const activeOps = (operations || []).filter(o => o.status !== 'complete').slice(0, 3);
    if (activeOps.length === 0) {
      opsEl.innerHTML = '<div style="color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-xs)">No active operations</div>';
    } else {
      opsEl.innerHTML = activeOps.map(op => `
        <div class="operation-item ${op.status}">
          <div class="op-status-icon ${op.status}"></div>
          <div class="op-name">${escHtml(op.name)}</div>
          <div class="op-progress-bar"><div class="op-progress-fill" style="width:${op.progress}%"></div></div>
          <div class="op-percent">${op.progress}%</div>
        </div>
      `).join('');
    }
  }
}

// ══════════════════════════════════════════════════════════
//  CHAT
// ══════════════════════════════════════════════════════════
async function loadChat() {
  const convos = await api('conversations', 'GET', null, 'limit=100') || [];
  const container = $('chat-messages');
  if (!container) return;

  const sorted = [...convos].reverse(); // oldest first
  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="chat-message jarvis">
        <div class="chat-avatar">J</div>
        <div>
          <div class="chat-bubble">Good ${timeOfDay()}, ${State.userName}. I'm JARVIS — your personal AI interface. How may I assist you today?</div>
          <div class="chat-time">JARVIS — Just now</div>
        </div>
      </div>`;
  } else {
    container.innerHTML = sorted.map(renderMessage).join('');
  }
  container.scrollTop = container.scrollHeight;
}

function renderMessage(msg) {
  const isJarvis = msg.role === 'jarvis' || msg.role === 'assistant';
  const side = isJarvis ? 'jarvis' : 'user';
  const avatar = isJarvis ? 'J' : (State.userName[0] || 'U');
  const time = formatDateTime(msg.created_at);
  return `
    <div class="chat-message ${side}">
      <div class="chat-avatar">${avatar}</div>
      <div>
        <div class="chat-bubble">${escHtml(msg.content)}</div>
        <div class="chat-time">${isJarvis ? 'JARVIS' : State.userName} — ${time}</div>
      </div>
    </div>`;
}

function appendChatMessage(role, content) {
  const container = $('chat-messages');
  if (!container) return;
  const msg = { role, content, created_at: new Date().toISOString() };
  const div = document.createElement('div');
  div.innerHTML = renderMessage(msg);
  container.appendChild(div.firstElementChild);
  container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = $('chat-messages');
  if (!container) return null;
  const div = document.createElement('div');
  div.className = 'chat-message jarvis';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="chat-avatar">J</div>
    <div class="chat-bubble">
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function removeTypingIndicator() {
  const el = $('typing-indicator');
  if (el) el.remove();
}

async function typwriterEffect(el, text, speed = 18) {
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    await new Promise(r => setTimeout(r, speed));
  }
}

async function sendMessage(inputEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  _unlockAudio();

  // Navigate to chat view if not already there
  if (State.currentView !== 'chat') navigate('chat');

  appendChatMessage('user', text);
  await api('conversations', 'POST', { role: 'user', content: text });

  const typing = showTypingIndicator();
  const response = await processCommand(text);
  removeTypingIndicator();

  appendChatMessage('jarvis', response);
  await api('conversations', 'POST', { role: 'jarvis', content: response });
  speak(response);
}

// ══════════════════════════════════════════════════════════
//  COMMAND PROCESSOR
// ══════════════════════════════════════════════════════════
async function processCommand(input) {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  await new Promise(r => setTimeout(r, 300 + Math.random() * 400));

  // Help
  if (lower === 'help' || lower === '?') {
    return fillTemplate(JARVIS_RESPONSES.help);
  }

  // Time
  if (lower.includes('time') && (lower.includes('what') || lower.includes('current') || lower.includes('now'))) {
    const now = new Date();
    return `Current time: ${now.toLocaleTimeString()} on ${now.toLocaleDateString()}.`;
  }

  // Status
  if (lower === 'status' || lower === 'system status' || lower === 'diagnostics') {
    return `All systems nominal, ${State.userName}. Neural network: online. Memory banks: accessible. Voice interface: ${State.isListening ? 'active' : 'standby'}. ElevenLabs TTS: ${State.elevenLabs.enabled ? 'enabled' : 'disabled'}.`;
  }

  // Navigate dashboard
  if (lower.includes('dashboard') || lower.includes('home') || lower.includes('command center')) {
    setTimeout(() => navigate('dashboard'), 300);
    return `Navigating to command center, ${State.userName}.`;
  }

  // Navigate projects
  if (lower.includes('show project') || lower.includes('open project') || lower.includes('projects')) {
    setTimeout(() => navigate('projects'), 300);
    return `Opening project matrix, ${State.userName}.`;
  }

  // Navigate chat
  if (lower.includes('show chat') || lower.includes('open chat') || lower === 'chat') {
    setTimeout(() => navigate('chat'), 300);
    return `Opening communications panel, ${State.userName}.`;
  }

  // Navigate operations
  if (lower.includes('operations') || lower.includes('show ops')) {
    setTimeout(() => navigate('operations'), 300);
    return `Loading operations monitor, ${State.userName}.`;
  }

  // Navigate research
  if (lower.includes('show research') || lower.includes('open research')) {
    setTimeout(() => navigate('research'), 300);
    return `Opening research center, ${State.userName}.`;
  }

  // Navigate memory
  if (lower.includes('show memory') || lower.includes('memory bank') || lower.includes('open memory')) {
    setTimeout(() => navigate('memory'), 300);
    return `Accessing memory banks, ${State.userName}.`;
  }

  // Navigate settings
  if (lower === 'settings' || lower.includes('open settings') || lower.includes('configuration')) {
    setTimeout(() => navigate('settings'), 300);
    return `Opening configuration panel, ${State.userName}.`;
  }

  // New project
  const newProjMatch = raw.match(/^(?:new|create|add)\s+project\s+(.+)$/i);
  if (newProjMatch) {
    const name = newProjMatch[1].trim();
    const proj = await api('projects', 'POST', { name, status: 'active', description: '' });
    playSuccessSound();
    setTimeout(() => navigate('projects'), 500);
    return fillTemplate(pickRandom(JARVIS_RESPONSES.project_created), { name, user: State.userName });
  }

  // New task
  const newTaskMatch = raw.match(/^(?:new|create|add)\s+task\s+(.+)$/i);
  if (newTaskMatch) {
    const name = newTaskMatch[1].trim();
    const projects = await api('projects');
    const activeProj = projects && projects.find(p => p.status === 'active');
    if (activeProj) {
      await api('tasks', 'POST', { project_id: activeProj.id, name, status: 'todo' });
      playSuccessSound();
      return fillTemplate(pickRandom(JARVIS_RESPONSES.task_created), { name });
    } else {
      return `No active project found, ${State.userName}. Please create a project first.`;
    }
  }

  // Research
  const researchMatch = raw.match(/^research\s+(.+)$/i);
  if (researchMatch) {
    const topic = researchMatch[1].trim();
    await api('research', 'POST', { topic, content: '', tags: '' });
    playSuccessSound();
    setTimeout(() => navigate('research'), 300);
    return fillTemplate(pickRandom(JARVIS_RESPONSES.research_saved), { topic, user: State.userName });
  }

  // Remember
  const rememberMatch = raw.match(/^remember\s+(.+)$/i);
  if (rememberMatch) {
    const fact = rememberMatch[1].trim();
    await api('memories', 'POST', { content: fact, category: 'general', tags: '' });
    playSuccessSound();
    return fillTemplate(pickRandom(JARVIS_RESPONSES.memory_saved), { user: State.userName });
  }

  // Unknown
  return fillTemplate(pickRandom(JARVIS_RESPONSES.unknown));
}

// ══════════════════════════════════════════════════════════
//  PROJECTS
// ══════════════════════════════════════════════════════════
async function loadProjects() {
  const [projects, tasks] = await Promise.all([
    api('projects'),
    api('tasks'),
  ]);

  const container = $('projects-list');
  if (!container) return;

  if (!projects || projects.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--sp-8);color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-sm)">
        NO PROJECTS INITIALIZED<br>
        <span style="font-size:var(--text-xs);opacity:0.6">Use voice command "new project [name]" or click +</span>
      </div>`;
    return;
  }

  container.innerHTML = projects.map(proj => {
    const projTasks = (tasks || []).filter(t => t.project_id === proj.id);
    const done = projTasks.filter(t => t.status === 'done' || t.status === 'complete').length;
    const total = projTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const statusClass = proj.status === 'active' ? 'status-active' :
                        proj.status === 'complete' ? 'status-complete' : 'status-paused';
    return `
      <div class="project-card" onclick="openProject(${proj.id})">
        <div class="project-header">
          <div>
            <div class="project-name">${escHtml(proj.name)}</div>
            <div class="project-meta">${formatDateTime(proj.created_at)}</div>
          </div>
          <span class="project-status ${statusClass}">${proj.status.toUpperCase()}</span>
        </div>
        ${proj.description ? `<div class="project-desc">${escHtml(proj.description)}</div>` : ''}
        <div class="project-progress">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-text">${done}/${total} tasks • ${pct}%</div>
        </div>
      </div>`;
  }).join('');
}

async function openProject(id) {
  State.currentProjectId = id;
  const [projects, tasks] = await Promise.all([
    api('projects'),
    api('tasks'),
  ]);
  const proj = projects && projects.find(p => p.id === id);
  if (!proj) return;

  const modal = $('project-modal');
  const title = $('modal-project-title');
  const taskList = $('modal-task-list');
  if (!modal) return;

  title.textContent = proj.name;
  const projTasks = (tasks || []).filter(t => t.project_id === id);

  if (projTasks.length === 0) {
    taskList.innerHTML = '<div style="color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-xs)">No tasks yet. Add one above.</div>';
  } else {
    taskList.innerHTML = projTasks.map(t => `
      <div class="task-item ${t.status}" id="task-${t.id}">
        <div class="task-checkbox" onclick="toggleTask(${t.id})"></div>
        <div class="task-content">
          <div class="task-name ${t.status === 'done' ? 'done' : ''}">${escHtml(t.name)}</div>
          ${t.due_date ? `<div class="task-due">Due: ${formatDateTime(t.due_date)}</div>` : ''}
        </div>
        <button class="task-delete" onclick="deleteTask(${t.id})">×</button>
      </div>
    `).join('');
  }

  modal.classList.add('active');
  playClickSound();
}

async function addTask() {
  const input = $('new-task-input');
  if (!input || !State.currentProjectId) return;
  const name = input.value.trim();
  if (!name) return;
  input.value = '';
  await api('tasks', 'POST', { project_id: State.currentProjectId, name, status: 'todo' });
  playSuccessSound();
  showToast(`Task "${name}" added`);
  openProject(State.currentProjectId);
}

async function toggleTask(id) {
  const tasks = await api('tasks');
  const task = tasks && tasks.find(t => t.id === id);
  if (!task) return;
  const newStatus = task.status === 'done' ? 'todo' : 'done';
  await api('tasks', 'PUT', { status: newStatus }, `id=${id}`);
  playClickSound();
  openProject(State.currentProjectId);
}

async function deleteTask(id) {
  await api('tasks', 'DELETE', null, `id=${id}`);
  playErrorSound();
  openProject(State.currentProjectId);
}

function closeModal() {
  $$('.modal-overlay').forEach(m => m.classList.remove('active'));
}

async function createProject() {
  const input = $('new-project-input');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  input.value = '';
  await api('projects', 'POST', { name, status: 'active', description: '' });
  playSuccessSound();
  showToast(`Project "${name}" created`);
  loadProjects();
}

async function updateProjectStatus(id, status) {
  await api('projects', 'PUT', { status }, `id=${id}`);
  loadProjects();
  showToast(`Project status updated to ${status}`);
}

// ══════════════════════════════════════════════════════════
//  OPERATIONS
// ══════════════════════════════════════════════════════════
async function loadOperations() {
  const ops = await api('operations') || [];
  const container = $('operations-list');
  if (!container) return;

  if (ops.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--sp-8);color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-sm)">
        NO ACTIVE OPERATIONS<br>
        <span style="font-size:var(--text-xs);opacity:0.6">Operations will appear here when created</span>
      </div>`;
    return;
  }

  container.innerHTML = ops.map(op => `
    <div class="operation-item ${op.status}">
      <div class="op-header">
        <div class="op-name">${escHtml(op.name)}</div>
        <div class="op-status-badge ${op.status}">${op.status.toUpperCase()}</div>
      </div>
      ${op.description ? `<div class="op-desc">${escHtml(op.description)}</div>` : ''}
      <div class="op-progress-bar">
        <div class="op-progress-fill" style="width:${op.progress}%"></div>
      </div>
      <div class="op-footer">
        <span class="op-percent">${op.progress}%</span>
        <span class="op-date">${formatDateTime(op.updated_at || op.created_at)}</span>
      </div>
    </div>
  `).join('');
}

async function createOperation() {
  const nameInput = $('new-op-name');
  const descInput = $('new-op-desc');
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) return;
  const desc = descInput ? descInput.value.trim() : '';
  nameInput.value = '';
  if (descInput) descInput.value = '';
  await api('operations', 'POST', { name, description: desc, status: 'active', progress: 0 });
  playSuccessSound();
  showToast(`Operation "${name}" created`);
  loadOperations();
}

// ══════════════════════════════════════════════════════════
//  RESEARCH
// ══════════════════════════════════════════════════════════
async function loadResearch() {
  const entries = await api('research') || [];
  const container = $('research-list');
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--sp-8);color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-sm)">
        KNOWLEDGE MATRIX EMPTY<br>
        <span style="font-size:var(--text-xs);opacity:0.6">Use voice command "research [topic]" or add below</span>
      </div>`;
    return;
  }

  container.innerHTML = entries.map(e => `
    <div class="research-card">
      <div class="research-header">
        <div class="research-topic">${escHtml(e.topic)}</div>
        <div class="research-date">${formatDateTime(e.created_at)}</div>
      </div>
      ${e.content ? `<div class="research-content">${escHtml(e.content)}</div>` : ''}
      ${e.tags ? `<div class="research-tags">${e.tags.split(',').map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('')}</div>` : ''}
    </div>
  `).join('');
}

async function addResearch() {
  const topicInput = $('new-research-topic');
  const contentInput = $('new-research-content');
  if (!topicInput) return;
  const topic = topicInput.value.trim();
  if (!topic) return;
  const content = contentInput ? contentInput.value.trim() : '';
  topicInput.value = '';
  if (contentInput) contentInput.value = '';
  await api('research', 'POST', { topic, content, tags: '' });
  playSuccessSound();
  showToast(`Research "${topic}" saved`);
  loadResearch();
}

// ══════════════════════════════════════════════════════════
//  SCHEDULE
// ══════════════════════════════════════════════════════════
async function loadSchedule() {
  const tasks = await api('scheduled_tasks') || [];
  const container = $('schedule-list');
  if (!container) return;

  if (tasks.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--sp-8);color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-sm)">
        SCHEDULE CLEAR<br>
        <span style="font-size:var(--text-xs);opacity:0.6">No scheduled tasks</span>
      </div>`;
    return;
  }

  const sorted = [...tasks].sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
  container.innerHTML = sorted.map(t => {
    const isPast = t.due_at && new Date(t.due_at) < new Date();
    const statusClass = t.status === 'completed' ? 'status-complete' : isPast ? 'status-overdue' : 'status-active';
    return `
      <div class="schedule-item ${t.status}">
        <div class="schedule-header">
          <div class="schedule-title">${escHtml(t.title || t.name || '')}</div>
          <span class="project-status ${statusClass}">${t.status ? t.status.toUpperCase() : 'PENDING'}</span>
        </div>
        ${t.description ? `<div class="schedule-desc">${escHtml(t.description)}</div>` : ''}
        <div class="schedule-meta">
          ${t.due_at ? `<span>Due: ${formatDateTime(t.due_at)}</span>` : ''}
          ${t.recurrence ? `<span>Recurs: ${t.recurrence}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function addScheduledTask() {
  const titleInput = $('new-schedule-title');
  const dateInput = $('new-schedule-date');
  if (!titleInput) return;
  const title = titleInput.value.trim();
  if (!title) return;
  const due_at = dateInput ? dateInput.value : '';
  titleInput.value = '';
  if (dateInput) dateInput.value = '';
  await api('scheduled_tasks', 'POST', { title, due_at, status: 'pending', description: '' });
  playSuccessSound();
  showToast(`Task "${title}" scheduled`);
  loadSchedule();
}

// ══════════════════════════════════════════════════════════
//  MEMORY
// ══════════════════════════════════════════════════════════
async function loadMemory() {
  const memories = await api('memories') || [];
  const container = $('memory-list');
  if (!container) return;

  if (memories.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--sp-8);color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-sm)">
        MEMORY BANKS EMPTY<br>
        <span style="font-size:var(--text-xs);opacity:0.6">Use "remember [fact]" to store information</span>
      </div>`;
    return;
  }

  container.innerHTML = memories.map(m => `
    <div class="memory-card">
      <div class="memory-content">${escHtml(m.content)}</div>
      <div class="memory-meta">
        ${m.category ? `<span class="memory-category">${escHtml(m.category)}</span>` : ''}
        <span class="memory-date">${formatDateTime(m.created_at)}</span>
      </div>
    </div>
  `).join('');
}

async function addMemory() {
  const input = $('new-memory-input');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  await api('memories', 'POST', { content, category: 'general', tags: '' });
  playSuccessSound();
  showToast('Memory indexed');
  loadMemory();
}

// ══════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════
async function loadSettings() {
  const settings = await api('settings');

  const fields = [
    'user_name', 'voice_rate', 'voice_pitch', 'voice_volume',
    'glow_intensity', 'animation_speed', 'theme',
    'continuous_mode', 'wake_word',
    'el_enabled', 'el_apikey', 'el_voiceid', 'el_model'
  ];

  fields.forEach(field => {
    const el = $('setting-' + field.replace(/_/g, '-'));
    if (el && settings[field] !== undefined) {
      if (el.type === 'checkbox') {
        el.checked = settings[field] === 'true' || settings[field] === true;
      } else {
        el.value = settings[field];
      }
    }
  });

  // Populate voice selector
  const voiceSel = $('setting-voice-uri');
  if (voiceSel && State.availableVoices.length > 0) {
    voiceSel.innerHTML = '<option value="">-- System Default --</option>' +
      State.availableVoices.map(v => `<option value="${v.voiceURI}" ${v.voiceURI === settings.voice_uri ? 'selected' : ''}>${escHtml(v.name)} (${v.lang})</option>`).join('');
  }
}

async function saveSettings() {
  const fields = [
    'user_name', 'voice_rate', 'voice_pitch', 'voice_volume',
    'glow_intensity', 'animation_speed', 'theme',
    'continuous_mode', 'wake_word',
    'el_enabled', 'el_apikey', 'el_voiceid', 'el_model'
  ];

  const data = {};
  fields.forEach(field => {
    const el = $('setting-' + field.replace(/_/g, '-'));
    if (el) {
      data[field] = el.type === 'checkbox' ? String(el.checked) : el.value;
    }
  });

  const voiceSel = $('setting-voice-uri');
  if (voiceSel) data.voice_uri = voiceSel.value;

  await api('settings', 'POST', data);
  applySettings(data);
  playSuccessSound();
  showToast('Configuration saved, ' + State.userName + '.');
}

function applySettings(s) {
  if (s.user_name) {
    State.userName = s.user_name;
    updateGreeting();
  }
  if (s.voice_rate) State.voiceSettings.rate = parseFloat(s.voice_rate);
  if (s.voice_pitch) State.voiceSettings.pitch = parseFloat(s.voice_pitch);
  if (s.voice_volume) State.voiceSettings.volume = parseFloat(s.voice_volume);
  if (s.voice_uri) State.voiceSettings.voiceURI = s.voice_uri;
  if (s.glow_intensity !== undefined) {
    document.documentElement.style.setProperty('--glow-intensity', s.glow_intensity);
  }
  if (s.animation_speed !== undefined) {
    document.documentElement.style.setProperty('--anim-speed', s.animation_speed);
  }
  if (s.theme) {
    document.documentElement.setAttribute('data-theme', s.theme);
  }
  if (s.continuous_mode !== undefined) {
    State.continuousMode = s.continuous_mode === 'true' || s.continuous_mode === true;
  }
  if (s.wake_word !== undefined) {
    State.wakeWordActive = s.wake_word === 'true' || s.wake_word === true;
    if (State.wakeWordActive && !State.wakeRecognition) {
      startWakeWordListener();
    } else if (!State.wakeWordActive && State.wakeRecognition) {
      State.wakeRecognition.stop();
      State.wakeRecognition = null;
    }
  }
  // ElevenLabs settings
  if (s.el_enabled !== undefined) {
    State.elevenLabs.enabled = s.el_enabled === 'true' || s.el_enabled === true;
  }
  if (s.el_apikey) State.elevenLabs.apiKey = s.el_apikey;
  if (s.el_voiceid) State.elevenLabs.voiceId = s.el_voiceid;
  if (s.el_model) State.elevenLabs.model = s.el_model;
}

// ══════════════════════════════════════════════════════════
//  VOICE ENGINE — Web Speech API + ElevenLabs TTS
// ══════════════════════════════════════════════════════════

// ── ElevenLabs TTS ────────────────────────────────────────────────────
async function speakElevenLabs(text) {
  const { apiKey, voiceId, model, stability, similarityBoost, style } = State.elevenLabs;
  if (!apiKey || !voiceId) throw new Error('ElevenLabs not configured');

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`;
  const body = {
    text,
    model_id: model,
    voice_settings: { stability, similarity_boost: similarityBoost, style, use_speaker_boost: true },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`ElevenLabs API error: ${res.status}`);

  const blob = await res.blob();
  const audioUrl = URL.createObjectURL(blob);

  // Stop any currently playing ElevenLabs audio
  if (State.elevenLabsAudio) {
    State.elevenLabsAudio.pause();
    State.elevenLabsAudio.src = '';
  }

  const audio = _elAudio || new Audio();
  audio.src = audioUrl;
  State.elevenLabsAudio = audio;

  return new Promise((resolve, reject) => {
    audio.onended = () => { URL.revokeObjectURL(audioUrl); resolve(); };
    audio.onerror = reject;
    audio.play().catch(reject);
  });
}

// ── Main speak function ───────────────────────────────────────────────
function speak(text) {
  if (!text) return;
  State.speechQueue.push(text);
  if (!State.isSpeaking) _processQueue();
}

async function _processQueue() {
  if (State.speechQueue.length === 0) { State.isSpeaking = false; return; }
  State.isSpeaking = true;
  const text = State.speechQueue.shift();
  updateVoiceUI(true);

  try {
    if (State.elevenLabs.enabled && State.elevenLabs.apiKey) {
      await speakElevenLabs(text);
    } else {
      await _webSpeechSpeak(text);
    }
  } catch (err) {
    console.warn('TTS error:', err);
    // Fallback to Web Speech
    try { await _webSpeechSpeak(text); } catch(e) {}
  }

  updateVoiceUI(false);
  _processQueue();
}

function _webSpeechSpeak(text) {
  return new Promise((resolve) => {
    if (!State.synthesis) { resolve(); return; }
    State.synthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = State.voiceSettings.rate;
    utt.pitch = State.voiceSettings.pitch;
    utt.volume = State.voiceSettings.volume;
    if (State.selectedVoice) utt.voice = State.selectedVoice;
    utt.onend = resolve;
    utt.onerror = resolve;
    State.synthesis.speak(utt);
  });
}

function stopSpeaking() {
  State.speechQueue = [];
  if (State.synthesis) State.synthesis.cancel();
  if (State.elevenLabsAudio) {
    State.elevenLabsAudio.pause();
    State.elevenLabsAudio.src = '';
  }
  State.isSpeaking = false;
  updateVoiceUI(false);
}

function loadVoices() {
  const voices = State.synthesis ? State.synthesis.getVoices() : [];
  State.availableVoices = voices;
  if (State.voiceSettings.voiceURI) {
    State.selectedVoice = voices.find(v => v.voiceURI === State.voiceSettings.voiceURI) || null;
  }
}

// ── Voice input (STT) ─────────────────────────────────────────────────
function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  State.recognition = new SpeechRecognition();
  State.recognition.continuous = false;
  State.recognition.interimResults = true;
  State.recognition.lang = 'en-US';

  State.recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(r => r[0].transcript)
      .join('');
    const input = $('chat-input') || $('voice-input-display');
    if (input) input.value = transcript;

    // Auto-submit on final result
    if (event.results[event.results.length - 1].isFinal) {
      const chatInput = $('chat-input');
      if (chatInput) {
        chatInput.value = transcript;
        setTimeout(() => sendMessage(chatInput), 300);
      }
    }
  };

  State.recognition.onerror = (event) => {
    if (event.error !== 'no-speech') {
      console.warn('Speech recognition error:', event.error);
      showToast(`Voice error: ${event.error}`);
    }
    setListeningState(false);
  };

  State.recognition.onend = () => {
    if (State.continuousMode && State.isListening) {
      setTimeout(() => {
        if (State.isListening) State.recognition.start();
      }, 200);
    } else {
      setListeningState(false);
    }
  };
}

function toggleVoice() {
  _unlockAudio();
  if (State.isListening) {
    stopListening();
  } else {
    startListening();
  }
}

function startListening() {
  if (!State.recognition) {
    showToast('Voice recognition not available in this browser.');
    return;
  }
  try {
    State.recognition.start();
    setListeningState(true);
    playVoiceStartSound();
    speak(fillTemplate(pickRandom(JARVIS_RESPONSES.voice_start)));
  } catch (e) {
    console.warn('Could not start recognition:', e);
  }
}

function stopListening() {
  if (State.recognition) State.recognition.stop();
  setListeningState(false);
  speak(pickRandom(JARVIS_RESPONSES.voice_end));
}

function setListeningState(active) {
  State.isListening = active;
  updateVoiceUI(active);
  const label = $('arc-state-label');
  if (label) {
    label.textContent = active ? 'LISTENING — SPEAK YOUR COMMAND' : 'STANDBY — CLICK TO ACTIVATE VOICE';
  }
}

function updateVoiceUI(speaking) {
  const arc = $('jarvis-arc');
  const btn = $('voice-btn');
  if (arc) {
    arc.classList.toggle('listening', State.isListening);
    arc.classList.toggle('speaking', speaking && !State.isListening);
  }
  if (btn) {
    btn.classList.toggle('active', State.isListening || speaking);
  }
}

// ── Wake word listener ────────────────────────────────────────────────
function startWakeWordListener() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition || State.wakeRecognition) return;

  State.wakeRecognition = new SpeechRecognition();
  State.wakeRecognition.continuous = true;
  State.wakeRecognition.interimResults = false;
  State.wakeRecognition.lang = 'en-US';

  State.wakeRecognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
    if (transcript.includes('jarvis') || transcript.includes('hey jarvis')) {
      if (!State.isListening) startListening();
    }
  };

  State.wakeRecognition.onend = () => {
    if (State.wakeWordActive) {
      setTimeout(() => {
        if (State.wakeRecognition && State.wakeWordActive) {
          try { State.wakeRecognition.start(); } catch(e) {}
        }
      }, 500);
    }
  };

  try { State.wakeRecognition.start(); } catch(e) {}
}

// ── Audio visualizer ──────────────────────────────────────────────────
async function startAudioVisualizer() {
  if (!navigator.mediaDevices) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = State.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    State.audioCtx = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    State.analyser = analyser;
    State.micSource = source;
    State.audioVizActive = true;
    _drawVizFrame();
  } catch(e) {
    console.log('Mic not available for visualizer');
  }
}

function _drawVizFrame() {
  if (!State.audioVizActive || !State.analyser) return;
  const bufLen = State.analyser.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);
  State.analyser.getByteFrequencyData(dataArr);
  const avg = dataArr.reduce((a, b) => a + b, 0) / bufLen;
  const arc = $('jarvis-arc');
  if (arc && State.isListening) {
    const intensity = Math.min(avg / 128, 1);
    arc.style.setProperty('--mic-intensity', intensity.toFixed(2));
  }
  requestAnimationFrame(_drawVizFrame);
}

// ══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Space bar = toggle voice (when not in input)
    if (e.code === 'Space' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      toggleVoice();
    }
    // Escape = stop everything
    if (e.code === 'Escape') {
      stopSpeaking();
      stopListening();
      closeModal();
    }
    // Ctrl+D = dashboard
    if (e.ctrlKey && e.key === 'd') { e.preventDefault(); navigate('dashboard'); }
    // Ctrl+P = projects
    if (e.ctrlKey && e.key === 'p') { e.preventDefault(); navigate('projects'); }
    // Ctrl+M = memory
    if (e.ctrlKey && e.key === 'm') { e.preventDefault(); navigate('memory'); }
    // Ctrl+R = research
    if (e.ctrlKey && e.key === 'r') { e.preventDefault(); navigate('research'); }
  });
}

// ══════════════════════════════════════════════════════════
//  INITIALISATION
// ══════════════════════════════════════════════════════════
async function init() {
  initAudio();
  startClock();
  initVoiceRecognition();
  initKeyboardShortcuts();
  animateDiagnostics();

  // Load voices (async in some browsers)
  loadVoices();
  if (State.synthesis) State.synthesis.onvoiceschanged = loadVoices;

  // Load settings and apply
  const settings = await api('settings');
  applySettings(settings);
  updateGreeting();

  // Navigate to initial view
  const hash = window.location.hash.replace('#', '');
  const validViews = ['dashboard','projects','chat','operations','research','schedule','memory','settings'];
  navigate(validViews.includes(hash) ? hash : 'dashboard');

  // Greet user
  setTimeout(() => {
    const greeting = fillTemplate(pickRandom(JARVIS_RESPONSES.greetings), { time: timeOfDay(), name: State.userName });
    speakText(greeting);
    updateGreeting();
    playSuccessSound();
  }, 800);
}

// ══════════════════════════════════════════════════════════
//  EVENT BINDINGS — Chat form
// ══════════════════════════════════════════════════════════
function initChatForm() {
  const form = $('chat-form');
  const input = $('chat-input');
  if (form && input) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      sendMessage(input);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    });
  }
}

// ══════════════════════════════════════════════════════════
//  PIN LOCK SYSTEM
// ══════════════════════════════════════════════════════════
const PIN_KEY = 'jarvis_pin';
const PIN_ENABLED_KEY = 'jarvis_pin_enabled';
const PIN_LOCKED_KEY = 'jarvis_locked';

function _getPinStore() {
  // Use sessionStorage for lock state (clears on tab close)
  // Use localStorage for PIN config (persists)
  return {
    pin: localStorage.getItem(PIN_KEY),
    enabled: localStorage.getItem(PIN_ENABLED_KEY) === 'true',
    locked: sessionStorage.getItem(PIN_LOCKED_KEY) !== 'false',
  };
}

function _savePinStore(pin, enabled) {
  localStorage.setItem(PIN_KEY, pin || '');
  localStorage.setItem(PIN_ENABLED_KEY, enabled ? 'true' : 'false');
}

function showPinLock() {
  const overlay = $('pin-lock-overlay');
  if (overlay) overlay.classList.add('active');
  // Focus first pin input
  const first = document.querySelector('.pin-digit');
  if (first) setTimeout(() => first.focus(), 100);
}

function hidePinLock() {
  const overlay = $('pin-lock-overlay');
  if (overlay) overlay.classList.remove('active');
  sessionStorage.setItem(PIN_LOCKED_KEY, 'false');
}

function initPinInputs() {
  const digits = $$('.pin-digit');
  digits.forEach((input, idx) => {
    input.addEventListener('input', (e) => {
      // Allow only digits
      input.value = input.value.replace(/\D/g, '').slice(-1);
      if (input.value && idx < digits.length - 1) {
        digits[idx + 1].focus();
      }
      // Auto-submit when all filled
      if ([...digits].every(d => d.value)) {
        setTimeout(submitPin, 100);
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && idx > 0) {
        digits[idx - 1].focus();
        digits[idx - 1].value = '';
      }
    });
    // Handle paste
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      [...digits].forEach((d, i) => { d.value = text[i] || ''; });
      if (text.length >= digits.length) setTimeout(submitPin, 100);
    });
  });
}

function submitPin() {
  const digits = $$('.pin-digit');
  const entered = [...digits].map(d => d.value).join('');
  const { pin } = _getPinStore();

  if (entered === pin) {
    hidePinLock();
    playSuccessSound();
    // Clear inputs
    digits.forEach(d => d.value = '');
  } else {
    playErrorSound();
    // Shake animation
    const container = document.querySelector('.pin-inputs');
    if (container) {
      container.classList.add('shake');
      setTimeout(() => container.classList.remove('shake'), 600);
    }
    digits.forEach(d => d.value = '');
    const first = digits[0];
    if (first) first.focus();
  }
}

function setupPinInSettings() {
  const enableToggle = $('setting-pin-enabled');
  const pinSetup = $('pin-setup-section');
  const pinInput = $('setting-pin-value');
  const saveBtn = $('save-pin-btn');
  const { pin, enabled } = _getPinStore();

  if (enableToggle) {
    enableToggle.checked = enabled;
    enableToggle.addEventListener('change', () => {
      if (pinSetup) pinSetup.style.display = enableToggle.checked ? 'block' : 'none';
      if (!enableToggle.checked) {
        _savePinStore('', false);
        showToast('PIN lock disabled');
      }
    });
  }
  if (pinSetup) pinSetup.style.display = enabled ? 'block' : 'none';
  if (pinInput && pin) pinInput.value = pin;
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const newPin = pinInput ? pinInput.value.replace(/\D/g, '').slice(0, 6) : '';
      if (newPin.length < 4) {
        showToast('PIN must be at least 4 digits');
        return;
      }
      _savePinStore(newPin, true);
      showToast('PIN saved');
      playSuccessSound();
    });
  }
}

function _initPinSystem() {
  const { pin, enabled, locked } = _getPinStore();
  initPinInputs();
  setupPinInSettings();
  if (enabled && pin && locked) {
    showPinLock();
  }
  // Lock button in header
  const lockBtn = $('lock-btn');
  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      const { pin: p, enabled: e } = _getPinStore();
      if (e && p) {
        sessionStorage.setItem(PIN_LOCKED_KEY, 'true');
        showPinLock();
      } else {
        showToast('Enable PIN lock in settings first');
      }
    });
  }
  // Init chat form here too
  initChatForm();
  init();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', _initPinSystem);
