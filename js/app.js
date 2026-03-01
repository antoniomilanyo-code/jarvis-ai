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

// ═══════════════════════════════════════════════════════
//  APPLICATION STATE
// ═══════════════════════════════════════════════════════
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
    apiKey: 'ae057a5a1eac4465a8d4ad630bda48d0a6aad444db35a024543ef51748464e43',
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

// ═══════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ── Session-persistent cache helpers ──────────────────────────────
// Uses in-memory cache; auth tokens are persisted via API
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
  el_apikey: 'ae057a5a1eac4465a8d4ad630bda48d0a6aad444db35a024543ef51748464e43',
  el_voiceid: 'P3TTlDkzxma0sdCGP8YZ',
  el_model: 'eleven_multilingual_v2',
};

// ── Remote API Configuration ─────────────────────────
// When deployed via Perplexity, __CGI_BIN__ is replaced with the real URL.
// When on GitHub Pages, we read the saved API endpoint from URL hash or prompt for it.
let API_BASE = '__CGI_BIN__/api.py';

// Detect if we're running on GitHub Pages (static, no CGI backend)
const _IS_GITHUB_PAGES = location.hostname.endsWith('.github.io') || location.hostname.endsWith('.pages.dev');
const _API_STORAGE_KEY = 'jarvis_api_endpoint';

if (_IS_GITHUB_PAGES) {
  // Try to load saved API endpoint from URL hash or cookie
  const hashMatch = location.hash.match(/api=([^&]+)/);
  if (hashMatch) {
    API_BASE = decodeURIComponent(hashMatch[1]);
  }
}

// Allow runtime API endpoint configuration
function setApiEndpoint(url) {
  API_BASE = url;
  // Store in URL hash for persistence on GitHub Pages
  if (_IS_GITHUB_PAGES) {
    const currentHash = location.hash.replace(/[?&]?api=[^&]+/, '');
    location.hash = currentHash + (currentHash ? '&' : '') + 'api=' + encodeURIComponent(url);
  }
}
function getApiEndpoint() { return API_BASE; }

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

    // ── ALL OTHER TABLES: fetch from remote API ─────────────
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
    // ── Offline fallback: use memory cache ──────────
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

// ═══════════════════════════════════════════════════════
//  AUDIO ENGINE — Web Audio API tones
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  CLOCK & GREETING
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  DIAGNOSTICS ANIMATION
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  ROUTING — View Navigation
// ═══════════════════════════════════════════════════════
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
  else if (viewName === 'proposals') loadProposals();
  else if (viewName === 'artifacts') loadArtifacts();
  else if (viewName === 'memory') loadMemory();
  else if (viewName === 'briefings') loadBriefings();
  else if (viewName === 'settings') loadSettings();
}

// ═══════════════════════════════════════════════════════
//  KPI COUNTER ANIMATION
// ═══════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════
async function loadDashboard() {
  const [projects, memories, operations, convos, scheduledTasks, proposals] = await Promise.all([
    api('projects'),
    api('memories'),
    api('operations'),
    api('conversations'),
    api('scheduled_tasks'),
    api('task_proposals'),
  ]);

  const activeProjects = (projects || []).filter(p => p.status.toLowerCase() === 'active').length;
  const totalMemories = (memories || []).length;
  const totalOps = (operations || []).length;
  const totalConvos = (convos || []).length;
  const pendingScheduled = (scheduledTasks || []).filter(t => t.status !== 'completed').length;
  const pendingProposals = (proposals || []).filter(p => p.status === 'pending_approval').length;

  animateCount($('kpi-projects'), activeProjects);
  animateCount($('kpi-memories'), totalMemories);
  animateCount($('kpi-operations'), totalOps);
  animateCount($('kpi-convos'), totalConvos);
  animateCount($('kpi-schedule-count'), pendingScheduled);
  animateCount($('kpi-proposals-pending'), pendingProposals);

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

// ═══════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════
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
  const sentiment = msg.sentiment ? getSentimentIndicator(msg.sentiment) : '';
  const source = msg.source ? `<span style="font-family:var(--font-mono);font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(0,212,255,0.08);color:var(--text-faint);margin-left:4px">${msg.source.toUpperCase()}</span>` : '';
  return `
    <div class="chat-message ${side}">
      <div class="chat-avatar">${avatar}</div>
      <div>
        <div class="chat-bubble">${escHtml(msg.content)}</div>
        <div class="chat-time">${isJarvis ? 'JARVIS' : State.userName} — ${time}${sentiment}${source}</div>
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

async function typewriterEffect(el, text, speed = 18) {
  el.textContent = '';
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    await new Promise(r => setTimeout(r, speed));
  }
}

async function sendUserMessage(text) {
  _unlockAudio();
  if (!text.trim()) return;
  playClickSound();

  // Show user message
  if (State.currentView === 'chat') appendChatMessage('user', text);

  // Update arc transcript
  const transcript = $('arc-transcript');
  if (transcript) transcript.textContent = text;

  // Save to backend
  api('conversations', 'POST', { role: 'user', content: text });

  // ── BRAIN INTEGRATION ──
  // Pass to JarvisBrain for NLU processing (autonomous decision-making)
  const brainHelpers = {
    navigate, loadProjects, loadDashboard, loadOperations, loadResearch,
    loadSchedule, loadMemory, renderKanban, playSuccessSound, showToast, openModal,
    State, CinematicVFX: window.CinematicVFX
  };

  let brainResult;
  try {
    brainResult = await JarvisBrain.process(text, api, brainHelpers);
  } catch (err) {
    console.warn('JarvisBrain error, falling back:', err);
    brainResult = { response: `Processing error detected, ${State.userName}. My apologies — could you rephrase that?`, intent: 'error', actionTaken: false };
  }

  await deliverJarvisResponse(brainResult, text);
}

// processCommand() — LEGACY: replaced by JarvisBrain.process()
// Kept as reference. All intent detection now handled by brain.js.
async function processCommand(input) {
  // This function is no longer called. JarvisBrain handles all input.
  return `I'm processing that, ${State.userName}.`;
}

async function deliverJarvisResponse(brainResult, userInput) {
  const responseText = typeof brainResult === 'string' ? brainResult : brainResult.response;
  const intent = brainResult?.intent || 'casual_chat';
  const actionTaken = brainResult?.actionTaken || false;

  // Show typing indicator in chat
  let typingEl = null;
  if (State.currentView === 'chat') {
    typingEl = showTypingIndicator();
  }

  // Cinematic VFX based on brain intent (only if action was taken OR it's a substantive intent)
  if (window.CinematicVFX && !actionTaken) {
    // Brain already triggers VFX during executeAction for actionTaken intents.
    // For non-action intents, show a processing cinematic for longer responses.
    if (responseText.length > 100 && ['casual_chat', 'status_check', 'help'].includes(intent)) {
      CinematicVFX.processing('PROCESSING');
    }
  }

  // Simulate processing delay (feels more intelligent)
  const delay = 600 + Math.random() * 800;
  await new Promise(r => setTimeout(r, delay));

  if (typingEl) typingEl.remove();

  // Save JARVIS response to backend
  api('conversations', 'POST', { role: 'jarvis', content: responseText, topic: userInput.slice(0, 60) });

  // Append to chat if visible
  if (State.currentView === 'chat') {
    const container = $('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-message jarvis';

    // Build optional action tag (e.g., "PROJECT CREATED" / "MEMORY INDEXED")
    let actionTag = '';
    if (actionTaken) {
      const tagLabels = {
        create_project: 'PROJECT INITIALIZED',
        save_memory: 'MEMORY INDEXED',
        research: 'RESEARCH INITIATED',
        create_task: 'TASK CREATED',
        launch_operation: 'OPERATION QUEUED',
        navigate: 'NAVIGATING',
        status_check: 'DIAGNOSTICS RUN'
      };
      const label = tagLabels[intent] || 'ACTION EXECUTED';
      actionTag = `<span class="chat-action-tag">${label}</span>`;
    }

    div.innerHTML = `
      <div class="chat-avatar">J</div>
      <div>
        ${actionTag}
        <div class="chat-bubble" id="jarvis-typing-bubble"></div>
        <div class="chat-time">JARVIS — Just now</div>
      </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    const bubble = div.querySelector('#jarvis-typing-bubble');
    if (bubble) await typewriterEffect(bubble, responseText);
  }

  // Speak the response
  speakText(responseText);

  // Update arc transcript
  const transcript = $('arc-transcript');
  if (transcript) {
    transcript.textContent = responseText.slice(0, 80) + (responseText.length > 80 ? '...' : '');
  }
}

// ═══════════════════════════════════════════════════════
//  VOICE SYSTEM
// ═══════════════════════════════════════════════════════
function initVoice() {
  // Speech Synthesis — load voices
  if ('speechSynthesis' in window) {
    const loadVoices = () => {
      State.availableVoices = window.speechSynthesis.getVoices();
      // Fallback chain: Google UK Male → en-GB male → any en-GB → any en
      const voice =
        State.availableVoices.find(v => v.name === 'Google UK English Male') ||
        State.availableVoices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('male')) ||
        State.availableVoices.find(v => v.lang === 'en-GB') ||
        State.availableVoices.find(v => v.lang.startsWith('en-GB')) ||
        State.availableVoices.find(v => v.lang.startsWith('en'));
      // Only override if user hasn't manually selected
      if (!State.voiceSettings.voiceURI) State.selectedVoice = voice || null;
      populateVoiceSelector();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Speech Recognition
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    State.recognition = new SR();
    State.recognition.continuous = false;
    State.recognition.interimResults = true;
    State.recognition.lang = 'en-GB';
    State.recognition.maxAlternatives = 1;

    State.recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript).join('');
      const arcTranscript = $('arc-transcript');
      if (arcTranscript) arcTranscript.textContent = transcript;
      if (e.results[e.results.length - 1].isFinal) {
        sendUserMessage(transcript);
      }
    };

    State.recognition.onstart = () => {
      State.isListening = true;
      setArcState('listening');
      playVoiceStartSound();
      startAudioVisualization();
    };

    State.recognition.onend = () => {
      State.isListening = false;
      const micBtn = $('mic-btn');
      const arc = $('arc-reactor');
      if (micBtn) { micBtn.classList.remove('active'); micBtn.setAttribute('aria-pressed', 'false'); }
      if (arc) arc.setAttribute('aria-pressed', 'false');
      $('voice-status-item') && ($('voice-status-item').style.display = 'none');
      stopAudioVisualization();
      if (!State.isSpeaking) {
        setArcState('idle');
        // Continuous mode: restart listening immediately
        if (State.continuousMode && !State.isSpeaking) {
          setTimeout(() => {
            if (!State.isListening && !State.isSpeaking) {
              try { State.recognition.start(); } catch(e) {}
            }
          }, 800);
        }
        // Wake word mode: go back to listening for "Hey JARVIS"
        else if (!State.continuousMode && !State.wakeWordActive) {
          const wwToggle = $('setting-wakeword');
          if (wwToggle && wwToggle.checked) {
            setTimeout(() => startWakeWordDetection(), 500);
          }
        }
      }
    };

    State.recognition.onerror = (e) => {
      // Suppress spammy errors — only show actionable ones once
      if (e.error === 'not-allowed') {
        if (!State._voicePermDenied) {
          State._voicePermDenied = true;
          showToast('Microphone blocked. Tap the lock icon in your browser address bar to allow mic access, then reload.', 5000);
        }
      } else if (e.error !== 'no-speech' && e.error !== 'aborted' && e.error !== 'network') {
        showToast(`Voice error: ${e.error}`, 2500);
      }
      State.isListening = false;
      stopAudioVisualization();
      setArcState('idle');
    };
  }
}

// ── Audio Visualization — real-time waveform around arc reactor ──
function startAudioVisualization() {
  if (State.audioVizActive) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
    if (!State.audioCtx) {
      try { State.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
    }
    if (State.audioCtx.state === 'suspended') State.audioCtx.resume();

    State.micSource = State.audioCtx.createMediaStreamSource(stream);
    State.analyser = State.audioCtx.createAnalyser();
    State.analyser.fftSize = 256;
    State.analyser.smoothingTimeConstant = 0.75;
    State.micSource.connect(State.analyser);
    State.audioVizActive = true;

    const arc = $('arc-reactor');
    if (!arc) return;
    const rect = arc.getBoundingClientRect();
    const cv = $('audio-viz-canvas');
    if (!cv) return;

    const size = Math.max(rect.width, rect.height) + 120;
    cv.width = size;
    cv.height = size;
    cv.style.width = size + 'px';
    cv.style.height = size + 'px';
    cv.style.left = (rect.left + rect.width / 2 - size / 2) + 'px';
    cv.style.top = (rect.top + rect.height / 2 - size / 2) + 'px';
    cv.style.position = 'fixed';
    cv.classList.add('active');

    const ctx2 = cv.getContext('2d');
    const bufLen = State.analyser.frequencyBinCount;
    const dataArr = new Uint8Array(bufLen);
    const cx2 = size / 2, cy2 = size / 2;
    const baseR = size / 2 - 18;

    function drawViz() {
      if (!State.audioVizActive) return;
      State.analyser.getByteFrequencyData(dataArr);
      ctx2.clearRect(0, 0, size, size);

      const bars = 64;
      for (let i = 0; i < bars; i++) {
        const idx = Math.floor(i / bars * bufLen * 0.7);
        const val = dataArr[idx] / 255;
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const r1 = baseR - 2;
        const r2 = baseR + 4 + val * 28;
        const alpha = 0.3 + val * 0.7;
        ctx2.beginPath();
        ctx2.moveTo(cx2 + Math.cos(angle) * r1, cy2 + Math.sin(angle) * r1);
        ctx2.lineTo(cx2 + Math.cos(angle) * r2, cy2 + Math.sin(angle) * r2);
        ctx2.strokeStyle = `rgba(0,212,255,${alpha})`;
        ctx2.lineWidth = 2;
        ctx2.stroke();
      }
      requestAnimationFrame(drawViz);
    }
    drawViz();

    // Stop stream tracks when visualization stops
    State._vizStream = stream;
  }).catch(() => {
    // Microphone not accessible for visualization — silent fail
  });
}

function stopAudioVisualization() {
  State.audioVizActive = false;
  const cv = $('audio-viz-canvas');
  if (cv) {
    cv.classList.remove('active');
    const ctx2 = cv.getContext('2d');
    if (ctx2) ctx2.clearRect(0, 0, cv.width, cv.height);
  }
  if (State.micSource) { try { State.micSource.disconnect(); } catch(e) {} State.micSource = null; }
  if (State._vizStream) {
    State._vizStream.getTracks().forEach(t => t.stop());
    State._vizStream = null;
  }
}

// ── Wake Word Detection ──
function startWakeWordDetection() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || State.wakeWordActive) return;

  const wr = new SR();
  wr.continuous = true;
  wr.interimResults = true;
  wr.lang = 'en-GB';
  State.wakeRecognition = wr;
  State.wakeWordActive = true;

  const indicator = $('wake-word-indicator');
  if (indicator) indicator.style.display = 'flex';

  wr.onresult = (e) => {
    const text = Array.from(e.results).map(r => r[0].transcript.toLowerCase()).join(' ');
    if (text.includes('hey jarvis') || text.includes('jarvis')) {
      wr.stop();
      State.wakeWordActive = false;
      if (indicator) indicator.style.display = 'none';
      // Activate main listening
      setTimeout(() => {
        if (!State.isListening && !State.isSpeaking) {
          toggleListening();
          speakText('Yes, ' + State.userName + '?');
        }
      }, 200);
    }
  };
  wr.onend = () => {
    // Restart if still in wake word mode
    if (State.wakeWordActive) {
      setTimeout(() => { try { wr.start(); } catch(e) {} }, 500);
    }
  };
  wr.onerror = (e) => {
    if (e.error === 'aborted') return;
    State.wakeWordActive = false;
    if (indicator) indicator.style.display = 'none';
  };

  try { wr.start(); } catch(e) {}
}

function stopWakeWordDetection() {
  State.wakeWordActive = false;
  if (State.wakeRecognition) {
    try { State.wakeRecognition.stop(); } catch(e) {}
    State.wakeRecognition = null;
  }
  const indicator = $('wake-word-indicator');
  if (indicator) indicator.style.display = 'none';
}

function setArcState(state) {
  const arc = $('arc-reactor');
  const label = $('arc-state-label');
  const waveform = $('waveform');

  if (!arc) return;
  arc.classList.remove('listening', 'speaking');

  if (state === 'listening') {
    arc.classList.add('listening');
    if (label) label.textContent = 'LISTENING — SPEAK YOUR COMMAND';
    if (waveform) waveform.style.display = 'flex';
  } else if (state === 'speaking') {
    arc.classList.add('speaking');
    if (label) label.textContent = 'JARVIS RESPONDING';
    if (waveform) waveform.style.display = 'flex';
  } else {
    if (label) label.textContent = 'STANDBY — CLICK TO ACTIVATE VOICE';
    if (waveform) waveform.style.display = 'none';
  }
}

function toggleListening() {
  if (!State.recognition) {
    showToast('Voice recognition not available in this browser. Try Chrome.', 3000);
    return;
  }
  if (State.isListening) {
    State.recognition.abort();
    State.isListening = false;
    setArcState('idle');
  } else {
    try {
      // Resume AudioContext if suspended (requires user gesture)
      if (State.audioCtx && State.audioCtx.state === 'suspended') {
        State.audioCtx.resume();
      }
      State.recognition.start();
      $('voice-status-item') && ($('voice-status-item').style.display = 'flex');
    } catch (e) {
      showToast('Could not start microphone. Please allow microphone access.', 3000);
    }
  }
  const micBtn = $('mic-btn');
  const arc = $('arc-reactor');
  if (micBtn) {
    micBtn.classList.toggle('active', State.isListening);
    micBtn.setAttribute('aria-pressed', String(State.isListening));
  }
  if (arc) arc.setAttribute('aria-pressed', String(State.isListening));
}

// ── Speech Queue: JARVIS finishes one utterance before starting next ──
function speakText(text) {
  State.speechQueue.push(text);
  if (!State.isSpeaking) _processSpeechQueue();
}

function _processSpeechQueue() {
  if (State.speechQueue.length === 0) return;
  const text = State.speechQueue.shift();

  // Remove markdown-ish formatting for speech
  const clean = text.replace(/[•▸\*\_`]/g, '').replace(/\n/g, '. ');

  // Route to ElevenLabs if enabled and configured
  const elEnabled = State.elevenLabs.enabled && State.elevenLabs.apiKey && State.elevenLabs.voiceId;
  console.log('[JARVIS TTS] enabled:', State.elevenLabs.enabled, 'apiKey:', !!State.elevenLabs.apiKey, 'voiceId:', !!State.elevenLabs.voiceId, '→ route:', elEnabled ? 'ElevenLabs' : 'BrowserTTS');
  if (elEnabled) {
    _speakElevenLabs(clean);
    return;
  }

  // Fallback: browser SpeechSynthesis
  _speakBrowserTTS(clean);
}

// ── ElevenLabs TTS Engine ──
async function _speakElevenLabs(text) {
  State.isSpeaking = true;
  setArcState('speaking');

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${State.elevenLabs.voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': State.elevenLabs.apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: State.elevenLabs.model,
          voice_settings: {
            stability: State.elevenLabs.stability,
            similarity_boost: State.elevenLabs.similarityBoost,
            style: State.elevenLabs.style,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn('ElevenLabs API error:', response.status, '— falling back to browser TTS');
      _speakBrowserTTS(text);
      return;
    }

    // Stream audio response
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Always create a fresh audio element for each TTS response
    // (Reusing a primed element fails on mobile Safari after first use)
    const audio = new Audio(audioUrl);
    audio.volume = State.voiceSettings.volume;
    State.elevenLabsAudio = audio;

    audio.onended = () => {
      State.isSpeaking = false;
      State.elevenLabsAudio = null;
      URL.revokeObjectURL(audioUrl);
      if (State.speechQueue.length > 0) {
        _processSpeechQueue();
      } else {
        if (!State.isListening) {
          setArcState('idle');
          // Continuous mode: auto-restart listening after JARVIS finishes speaking
          if (State.continuousMode && State.recognition) {
            setTimeout(() => {
              if (!State.isListening && !State.isSpeaking) {
                try { State.recognition.start(); } catch(e) {}
              }
            }, 800);
          }
          // Wake word: restart detection so user can say "Hey JARVIS" again
          else if (!State.continuousMode && !State.wakeWordActive) {
            const wwToggle = document.getElementById('setting-wakeword');
            if (wwToggle && wwToggle.checked) {
              setTimeout(() => startWakeWordDetection(), 500);
            }
          }
        }
      }
    };

    audio.onerror = (err) => {
      console.warn('ElevenLabs audio playback error:', err);
      State.isSpeaking = false;
      State.elevenLabsAudio = null;
      URL.revokeObjectURL(audioUrl);
      if (!State.isListening) setArcState('idle');
      if (State.speechQueue.length > 0) setTimeout(_processSpeechQueue, 200);
    };

    try {
      await audio.play();
    } catch (playErr) {
      console.warn('Audio play blocked:', playErr);
      // On mobile, autoplay may be blocked — try via the primed element
      if (_elAudio) {
        _elAudio.src = audioUrl;
        _elAudio.volume = State.voiceSettings.volume;
        State.elevenLabsAudio = _elAudio;
        _elAudio.onended = audio.onended;
        _elAudio.onerror = audio.onerror;
        try { await _elAudio.play(); } catch(e2) {
          console.warn('All audio play attempts failed, falling back to browser TTS');
          _speakBrowserTTS(text);
        }
      } else {
        console.warn('No primed audio element, falling back to browser TTS');
        _speakBrowserTTS(text);
      }
    }
  } catch (err) {
    console.warn('ElevenLabs fetch error:', err, '— falling back to browser TTS');
    _speakBrowserTTS(text);
  }
}

// ── Browser SpeechSynthesis Fallback ──
function _speakBrowserTTS(text) {
  if (!State.synthesis) {
    State.isSpeaking = false;
    if (State.speechQueue.length > 0) _processSpeechQueue();
    return;
  }

  const utt = new SpeechSynthesisUtterance(text);
  if (State.selectedVoice) utt.voice = State.selectedVoice;
  utt.rate = State.voiceSettings.rate;
  utt.pitch = State.voiceSettings.pitch;
  utt.volume = State.voiceSettings.volume;
  utt.lang = 'en-GB';

  utt.onstart = () => {
    State.isSpeaking = true;
    setArcState('speaking');
  };
  utt.onend = () => {
    State.isSpeaking = false;
    if (State.speechQueue.length > 0) {
      _processSpeechQueue();
    } else {
      if (!State.isListening) {
        setArcState('idle');
        if (State.continuousMode && State.recognition) {
          setTimeout(() => {
            if (!State.isListening && !State.isSpeaking) {
              try { State.recognition.start(); } catch(e) {}
            }
          }, 800);
        }
        else if (!State.continuousMode && !State.wakeWordActive) {
          const wwToggle = document.getElementById('setting-wakeword');
          if (wwToggle && wwToggle.checked) {
            setTimeout(() => startWakeWordDetection(), 500);
          }
        }
      }
    }
  };
  utt.onerror = () => {
    State.isSpeaking = false;
    if (!State.isListening) setArcState('idle');
    if (State.speechQueue.length > 0) setTimeout(_processSpeechQueue, 200);
  };

  State.synthesis.speak(utt);
}

// ── ElevenLabs Status & Test ──
function _updateElStatusDot() {
  const dot = $('el-status-dot');
  if (!dot) return;
  dot.className = 'el-status-dot';
  if (State.elevenLabs.enabled && State.elevenLabs.apiKey && State.elevenLabs.voiceId) {
    dot.classList.add('connected');
  }
}

async function testElevenLabsVoice() {
  const dot = $('el-status-dot');
  const statusText = $('el-test-status');
  if (dot) { dot.className = 'el-status-dot testing'; }
  if (statusText) statusText.textContent = 'Testing connection...';

  // Read current values from fields (even if not saved yet)
  const apiKey = $('setting-el-apikey')?.value || State.elevenLabs.apiKey;
  const voiceId = $('setting-el-voiceid')?.value || State.elevenLabs.voiceId;
  const model = $('setting-el-model')?.value || State.elevenLabs.model;

  if (!apiKey || !voiceId) {
    if (dot) dot.className = 'el-status-dot error';
    if (statusText) statusText.textContent = 'Missing API Key or Voice ID';
    return;
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({
          text: 'Systems online. All diagnostics nominal. At your service, Sir.',
          model_id: model,
          voice_settings: {
            stability: parseFloat($('setting-el-stability')?.value || '0.5'),
            similarity_boost: parseFloat($('setting-el-similarity')?.value || '0.75'),
            style: parseFloat($('setting-el-style')?.value || '0.4'),
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn('ElevenLabs test error:', response.status, errText);
      if (dot) dot.className = 'el-status-dot error';
      if (statusText) statusText.textContent = `Error ${response.status}: Check your API key and Voice ID`;
      return;
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.volume = State.voiceSettings.volume;
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    await audio.play();

    if (dot) dot.className = 'el-status-dot connected';
    if (statusText) statusText.textContent = 'Connected — voice verified';
  } catch (err) {
    console.warn('ElevenLabs test fetch error:', err);
    if (dot) dot.className = 'el-status-dot error';
    if (statusText) statusText.textContent = 'Connection failed — check network or CORS';
  }
}

function populateVoiceSelector() {
  const sel = $('setting-voice');
  if (!sel) return;
  sel.innerHTML = '<option value="">Default (Auto-select British)</option>';
  const voices = State.availableVoices.filter(v => v.lang.startsWith('en'));
  voices.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.voiceURI;
    opt.textContent = `${v.name} (${v.lang})`;
    if (State.selectedVoice && v.voiceURI === State.selectedVoice.voiceURI) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ═══════════════════════════════════════════════════════
//  PROJECTS
// ═══════════════════════════════════════════════════════
async function loadProjects() {
  const projects = await api('projects') || [];
  const grid = $('projects-grid');
  const detail = $('project-detail');
  if (!grid) return;

  // Hide detail, show grid
  grid.closest('section').querySelector('div').style.display = 'block';
  if (detail) detail.style.display = 'none';

  if (projects.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--sp-16);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">No active projects</div>
        <div style="font-size:var(--text-sm)">Initialize a new project to begin operations.</div>
      </div>`;
    return;
  }

  grid.innerHTML = projects.map(p => {
    const statusClass = p.status.toLowerCase();
    return `
      <div class="project-card" data-project-id="${p.id}" style="--project-color:${escHtml(p.color || '#00d4ff')}">
        <div class="project-name">${escHtml(p.name)}</div>
        <div class="project-status-badge ${statusClass}">
          <span class="status-dot ${statusClass === 'active' ? '' : statusClass === 'paused' ? 'amber' : ''}"></span>
          ${escHtml(p.status)}
        </div>
        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--sp-3)">${escHtml(p.description || 'No description')}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${p.progress || 0}%;background:${escHtml(p.color || '#00d4ff')}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:var(--sp-2)">
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-faint)">${formatDateTime(p.created_at)}</span>
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-cyan)">${p.progress || 0}%</span>
        </div>
      </div>`;
  }).join('');

  // Attach click handlers
  grid.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('click', () => {
      const pid = parseInt(card.dataset.projectId);
      openProjectDetail(pid);
    });
  });
}

async function openProjectDetail(projectId) {
  State.currentProjectId = projectId;
  const project = await api('projects', 'GET', null, `id=${projectId}`);
  if (!project) return;

  const grid = $('projects-grid');
  const detail = $('project-detail');
  const listView = $('view-projects').querySelector(':scope > div');

  if (grid) grid.closest('div').style.display = 'none';
  if (detail) detail.style.display = 'block';

  const nameEl = $('project-detail-name');
  const statusEl = $('project-detail-status');
  if (nameEl) nameEl.textContent = project.name;
  if (statusEl) {
    statusEl.textContent = project.status;
    statusEl.className = 'project-status-badge ' + project.status.toLowerCase();
  }

  renderKanban(projectId);
}

async function renderKanban(projectId) {
  const tasks = await api('tasks', 'GET', null, `project_id=${projectId}`) || [];
  const board = $('kanban-board');
  if (!board) return;

  const columns = {
    todo: { label: 'To Do', tasks: [] },
    inprogress: { label: 'In Progress', tasks: [] },
    done: { label: 'Done', tasks: [] },
  };

  tasks.forEach(t => {
    const col = t.status === 'todo' ? 'todo' : t.status === 'done' ? 'done' : 'inprogress';
    columns[col].tasks.push(t);
  });

  board.innerHTML = Object.entries(columns).map(([colId, col]) => `
    <div class="kanban-col" data-col="${colId}" id="col-${colId}">
      <div class="kanban-col-header">
        <span>${col.label}</span>
        <span class="panel-badge">${col.tasks.length}</span>
      </div>
      <div class="kanban-tasks" id="tasks-${colId}">
        ${col.tasks.map(t => renderTaskCard(t)).join('')}
      </div>
    </div>`).join('');

  // Drag and drop
  initKanbanDragDrop();
}

function renderTaskCard(task) {
  const priorityColors = { low: '#475569', medium: '#00d4ff', high: '#f0a500', critical: '#ff3b5c' };
  const color = priorityColors[task.priority] || '#00d4ff';
  return `
    <div class="task-card" draggable="true" data-task-id="${task.id}" data-status="${task.status}"
         style="border-left:3px solid ${color}">
      <div style="font-size:var(--text-sm);font-weight:500;color:var(--text-primary);margin-bottom:var(--sp-1)">${escHtml(task.title)}</div>
      ${task.description ? `<div style="font-size:var(--text-xs);color:var(--text-muted)">${escHtml(task.description)}</div>` : ''}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:var(--sp-2)">
        <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:${color};text-transform:uppercase">${task.priority}</span>
        <button onclick="deleteTask(${task.id})" style="color:var(--text-faint);width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:3px;transition:color 0.12s" onmouseover="this.style.color='var(--accent-red)'" onmouseout="this.style.color='var(--text-faint)'" aria-label="Delete task">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>`;
}

window.deleteTask = async function(taskId) {
  await api('tasks', 'DELETE', null, `id=${taskId}`);
  renderKanban(State.currentProjectId);
  playClickSound();
};

function initKanbanDragDrop() {
  const cards = $$('.task-card');
  const cols = $$('.kanban-col');

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  cols.forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = col.dataset.col === 'inprogress' ? 'inprogress' : col.dataset.col;
      await api('tasks', 'PUT', { id: taskId, status: newStatus }, `id=${taskId}`);
      playSuccessSound();
      renderKanban(State.currentProjectId);
    });
  });
}

// ═══════════════════════════════════════════════════════
//  OPERATIONS
// ═══════════════════════════════════════════════════════
async function loadOperations() {
  const ops = await api('operations') || [];
  const list = $('operations-list');
  if (!list) return;

  // Also load operation groups (P5)
  loadOperationGroups();

  if (ops.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:var(--sp-16);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">No operations queued</div>
        <div style="font-size:var(--text-sm)">Queue a new operation to begin processing.</div>
      </div>`;
    return;
  }

  list.innerHTML = ops.map(op => `
    <div class="operation-item ${op.status}" id="op-item-${op.id}">
      <div class="op-status-icon ${op.status}"></div>
      <div style="flex:1">
        <div class="op-name">${escHtml(op.name)}</div>
        ${op.result ? `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:2px">${escHtml(op.result)}</div>` : ''}
      </div>
      <div class="op-progress-bar"><div class="op-progress-fill" style="width:${op.progress}%"></div></div>
      <div class="op-percent">${op.progress}%</div>
      <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-faint);text-transform:uppercase;width:80px;text-align:right">${op.status}</span>
    </div>`).join('');

  // Simulate operation progress for queued/processing items
  ops.filter(o => o.status === 'queued' || o.status === 'processing').forEach(op => {
    simulateOperationProgress(op);
  });
}

function simulateOperationProgress(op) {
  if (op.status === 'queued') {
    setTimeout(async () => {
      if (window.CinematicVFX) CinematicVFX.operationLaunch(op.name);
      await api('operations', 'PUT', { id: op.id, status: 'processing', progress: 5 }, `id=${op.id}`);
      if (State.currentView === 'operations') loadOperations();
      simulateOperationProgress({ ...op, status: 'processing', progress: 5 });
    }, 2000 + Math.random() * 3000);
    return;
  }

  let progress = op.progress || 5;
  const interval = setInterval(async () => {
    progress += 5 + Math.random() * 10;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      await api('operations', 'PUT', { id: op.id, status: 'complete', progress: 100, result: 'Operation completed successfully' }, `id=${op.id}`);
      speakText(fillTemplate(`Operation ${op.name} complete, ${State.userName}.`, {}));
      showToast(`✓ Operation complete: ${op.name}`);
      playSuccessSound();
      if (State.currentView === 'operations' || State.currentView === 'dashboard') {
        loadOperations();
        loadDashboard();
      }
    } else {
      await api('operations', 'PUT', { id: op.id, status: 'processing', progress: Math.floor(progress) }, `id=${op.id}`);
      if (State.currentView === 'operations') loadOperations();
    }
  }, 1500 + Math.random() * 1000);
}

// ═══════════════════════════════════════════════════════
//  SCHEDULED TASKS
// ═══════════════════════════════════════════════════════
async function loadSchedule() {
  const tasks = await api('scheduled_tasks') || [];

  // Update KPIs
  const scheduled = tasks.filter(t => t.status === 'scheduled').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const delayed = tasks.filter(t => t.status === 'delayed').length;

  animateCount($('kpi-scheduled'), scheduled);
  animateCount($('kpi-in-progress'), inProgress);
  animateCount($('kpi-completed-tasks'), completed);
  animateCount($('kpi-delayed'), delayed);

  const timeline = $('schedule-timeline');
  if (!timeline) return;

  if (tasks.length === 0) {
    timeline.innerHTML = '<div style="color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-xs);text-align:center;padding:var(--sp-6)">No scheduled tasks yet. Ask JARVIS to schedule something via WhatsApp.</div>';
    return;
  }

  timeline.innerHTML = tasks.map(t => {
    const deadline = new Date(t.deadline);
    const now = new Date();
    const isOverdue = deadline < now && t.status !== 'completed';
    const statusColors = {
      'scheduled': 'var(--accent-cyan)',
      'in_progress': 'var(--accent-amber, #f59e0b)',
      'completed': 'var(--accent-green, #10b981)',
      'delayed': 'var(--accent-red, #ef4444)',
      'failed': 'var(--accent-red, #ef4444)'
    };
    const statusColor = statusColors[t.status] || 'var(--text-muted)';
    const statusLabel = t.status.replace('_', ' ').toUpperCase();
    const timeStr = deadline.toLocaleString('en-US', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const typeIcons = { report: '📊', app: '📱', research: '🔬', email: '📧', general: '⚡' };
    const icon = typeIcons[t.type] || '📋';

    return `
      <div class="schedule-card ${t.status}${isOverdue ? ' overdue' : ''}" style="
        border-left: 3px solid ${statusColor};
        background: var(--bg-card);
        border-radius: var(--radius-md);
        padding: var(--sp-4);
        margin-bottom: var(--sp-3);
        position: relative;
      ">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--sp-3)">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2)">
              <span style="font-size:1.1rem">${icon}</span>
              <span style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">${escHtml(t.title)}</span>
            </div>
            ${t.description ? `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--sp-2)">${escHtml(t.description)}</div>` : ''}
            <div style="display:flex;gap:var(--sp-3);flex-wrap:wrap;align-items:center">
              <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-faint)">⏰ ${timeStr}</span>
              <span style="font-family:var(--font-mono);font-size:10px;padding:2px 8px;border-radius:var(--radius-sm);background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44">${statusLabel}</span>
              ${t.priority === 'high' ? '<span style="font-family:var(--font-mono);font-size:10px;padding:2px 8px;border-radius:var(--radius-sm);background:#ef444422;color:#ef4444;border:1px solid #ef444444">HIGH</span>' : ''}
            </div>
            ${t.delay_reason ? `<div style="font-size:var(--text-xs);color:#ef4444;margin-top:var(--sp-2);font-style:italic">⚠ ${escHtml(t.delay_reason)}</div>` : ''}
            ${t.result && t.status === 'completed' ? `<div style="font-size:var(--text-xs);color:var(--accent-green, #10b981);margin-top:var(--sp-2)">✓ ${escHtml(t.result.substring(0, 200))}</div>` : ''}
          </div>
          <div style="text-align:right;min-width:60px">
            ${t.progress > 0 ? `
              <div style="font-family:var(--font-mono);font-size:var(--text-lg);font-weight:700;color:${statusColor}">${t.progress}%</div>
              <div style="width:60px;height:4px;background:var(--bg-dim);border-radius:2px;overflow:hidden;margin-top:var(--sp-1)">
                <div style="width:${t.progress}%;height:100%;background:${statusColor};transition:width 0.5s ease"></div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  TASK PROPOSALS (P1)
// ═══════════════════════════════════════════════════════
async function loadProposals() {
  const proposals = await api('task_proposals') || [];

  const pending = proposals.filter(p => p.status === 'pending_approval').length;
  const approved = proposals.filter(p => p.status === 'approved' || p.status === 'executing' || p.status === 'completed').length;
  const rejected = proposals.filter(p => p.status === 'rejected').length;

  animateCount($('kpi-pending-proposals'), pending);
  animateCount($('kpi-approved-proposals'), approved);
  animateCount($('kpi-rejected-proposals'), rejected);

  const list = $('proposals-list');
  if (!list) return;

  if (proposals.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:var(--sp-16);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">No task proposals yet</div>
        <div style="font-size:var(--text-sm)">JARVIS will propose tasks autonomously during conversations. Approve or reject via WhatsApp.</div>
      </div>`;
    return;
  }

  // Sort: pending first, then by date desc
  const sorted = [...proposals].sort((a, b) => {
    if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
    if (b.status === 'pending_approval' && a.status !== 'pending_approval') return 1;
    return (b.id || 0) - (a.id || 0);
  });

  list.innerHTML = sorted.map(p => {
    const statusColors = {
      'pending_approval': { bg: '#f59e0b22', border: '#f59e0b44', color: '#f59e0b', label: 'PENDING' },
      'approved': { bg: '#10b98122', border: '#10b98144', color: '#10b981', label: 'APPROVED' },
      'rejected': { bg: '#ef444422', border: '#ef444444', color: '#ef4444', label: 'REJECTED' },
      'executing': { bg: '#00d4ff22', border: '#00d4ff44', color: '#00d4ff', label: 'EXECUTING' },
      'completed': { bg: '#10b98122', border: '#10b98144', color: '#10b981', label: 'COMPLETED' },
    };
    const s = statusColors[p.status] || statusColors['pending_approval'];
    const priorityColors = { low: '#475569', medium: '#00d4ff', high: '#f0a500', critical: '#ff3b5c' };
    const pColor = priorityColors[p.priority] || '#00d4ff';

    // Parse steps if available
    let steps = [];
    try { steps = JSON.parse(p.steps_json || '[]'); } catch {}

    const isPending = p.status === 'pending_approval';

    return `
      <div class="hud-panel" style="padding:var(--sp-5);margin-bottom:var(--sp-4);border-left:3px solid ${s.color}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--sp-3);margin-bottom:var(--sp-3)">
          <div style="flex:1">
            <div style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--sp-1)">${escHtml(p.title)}</div>
            ${p.description ? `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--sp-2)">${escHtml(p.description)}</div>` : ''}
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center;flex-shrink:0">
            <span style="font-family:var(--font-mono);font-size:10px;padding:2px 8px;border-radius:var(--radius-sm);background:${s.bg};color:${s.color};border:1px solid ${s.border}">${s.label}</span>
            <span style="font-family:var(--font-mono);font-size:10px;padding:2px 8px;border-radius:var(--radius-sm);color:${pColor};text-transform:uppercase">${escHtml(p.priority || 'medium')}</span>
          </div>
        </div>
        ${steps.length > 0 ? `
          <div style="margin-bottom:var(--sp-3)">
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase;margin-bottom:var(--sp-2)">Execution Steps</div>
            <ol style="margin:0;padding-left:var(--sp-5);font-size:var(--text-xs);color:var(--text-muted)">
              ${steps.map(st => `<li style="margin-bottom:2px">${escHtml(typeof st === 'string' ? st : st.description || JSON.stringify(st))}</li>`).join('')}
            </ol>
          </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-faint)">${formatDateTime(p.created_at)}</span>
          ${isPending ? `
            <div style="display:flex;gap:var(--sp-2)">
              <button onclick="approveProposal(${p.id})" class="btn btn-primary" style="font-size:var(--text-xs);padding:4px 12px">APPROVE</button>
              <button onclick="rejectProposal(${p.id})" class="btn btn-danger" style="font-size:var(--text-xs);padding:4px 12px">REJECT</button>
            </div>` : ''}
          ${p.status === 'rejected' && p.rejection_reason ? `<span style="font-size:var(--text-xs);color:#ef4444;font-style:italic">${escHtml(p.rejection_reason)}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

window.approveProposal = async function(id) {
  await api('task_proposals', 'PUT', { id, status: 'approved', approved_at: new Date().toISOString() }, `id=${id}`);
  playSuccessSound();
  showToast('Proposal approved.');
  loadProposals();
};

window.rejectProposal = async function(id) {
  const reason = prompt('Rejection reason (optional):') || '';
  await api('task_proposals', 'PUT', { id, status: 'rejected', rejection_reason: reason }, `id=${id}`);
  playClickSound();
  showToast('Proposal rejected.');
  loadProposals();
};

// ═══════════════════════════════════════════════════════
//  ARTIFACTS (P2)
// ═══════════════════════════════════════════════════════
async function loadArtifacts() {
  const artifacts = await api('artifacts') || [];
  const grid = $('artifacts-grid');
  if (!grid) return;

  if (artifacts.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--sp-16);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">No artifacts generated</div>
        <div style="font-size:var(--text-sm)">JARVIS will store generated files, reports, and documents here.</div>
      </div>`;
    return;
  }

  const typeIcons = {
    'pdf': '📄', 'document': '📝', 'image': '🖼️', 'spreadsheet': '📊',
    'presentation': '📽️', 'code': '💻', 'audio': '🎵', 'video': '🎬',
    'report': '📋', 'analysis': '🔬', 'design': '🎨', 'other': '📁'
  };

  grid.innerHTML = artifacts.map(a => {
    const icon = typeIcons[a.type] || typeIcons['other'];
    const hasUrl = a.file_url && a.file_url.startsWith('http');

    return `
      <div class="hud-panel" style="padding:var(--sp-5)">
        <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-3)">
          <span style="font-size:1.5rem">${icon}</span>
          <div style="flex:1;min-width:0">
            <div style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(a.title)}</div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase">${escHtml(a.type || 'file')}</div>
          </div>
        </div>
        ${a.description ? `<div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--sp-3)">${escHtml(a.description)}</div>` : ''}
        ${a.content_json && a.content_json !== '{}' ? `<div style="font-size:10px;color:var(--text-faint);font-family:var(--font-mono);margin-bottom:var(--sp-3);word-break:break-all">${escHtml(typeof a.content_json === 'string' ? a.content_json.slice(0, 120) : JSON.stringify(a.content_json).slice(0, 120))}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-faint)">${formatDateTime(a.created_at)}</span>
          ${hasUrl ? `<a href="${escHtml(a.file_url)}" target="_blank" rel="noopener" style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--accent-cyan);text-decoration:none">OPEN →</a>` : ''}
        </div>
      </div>`;
  }).join('');
}
// ═══════════════════════════════════════════════════════
//  RESEARCH
// ═══════════════════════════════════════════════════════
async function loadResearch() {
  const entries = await api('research') || [];
  const list = $('research-list');
  if (!list) return;

  if (entries.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:var(--sp-16);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">No research entries</div>
        <div style="font-size:var(--text-sm)">Initiate a new research operation to populate the knowledge matrix.</div>
      </div>`;
    return;
  }

  list.innerHTML = entries.map(e => {
    let findings = [];
    try { findings = JSON.parse(e.findings || '[]'); } catch {}
    return `
      <div class="research-card hud-panel">
        <div style="padding:var(--sp-5)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp-3)">
            <div class="research-topic">${escHtml(e.topic)}</div>
            <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-faint)">${formatDateTime(e.created_at)}</span>
          </div>
          ${e.summary ? `<div style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--sp-4);line-height:1.6">${escHtml(e.summary)}</div>` : ''}
          ${findings.length > 0 ? `
            <ul class="research-findings">
              ${findings.map(f => `<li>${escHtml(f)}</li>`).join('')}
            </ul>` : ''}
          <div style="margin-top:var(--sp-4);display:flex;gap:var(--sp-3)">
            <button class="btn btn-danger btn-icon" onclick="deleteResearch(${e.id})" aria-label="Delete research entry">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
  }).join('');
}

window.deleteResearch = async function(id) {
  await api('research', 'DELETE', null, `id=${id}`);
  loadResearch();
  playClickSound();
};

// ═══════════════════════════════════════════════════════
//  MEMORY
// ═══════════════════════════════════════════════════════
async function loadMemory(searchQuery = '') {
  // Use enhanced version with category filtering (P6)
  return loadMemoryEnhanced(searchQuery, '');
}

/* --- Legacy loadMemory kept for reference ---
  const params = searchQuery ? `search=${encodeURIComponent(searchQuery)}` : '';
  const memories = await api('memories', 'GET', null, params) || [];
  const grid = $('memory-grid');
  if (!grid) return;

  if (memories.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--sp-16);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">${searchQuery ? 'No memories match your search' : 'Memory banks empty'}</div>
        <div style="font-size:var(--text-sm)">Start a conversation or save notes to populate memory banks.</div>
      </div>`;
    return;
  }

  grid.innerHTML = memories.map(m => {
    let tags = [];
    try { tags = JSON.parse(m.tags || '[]'); } catch {}
    return `
      <div class="memory-node">
        <div class="memory-title">${escHtml(m.title)}</div>
        <div class="memory-content">${escHtml(m.content)}</div>
        ${tags.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:var(--sp-3)">
            ${tags.map(t => `<span style="font-family:var(--font-mono);font-size:10px;padding:2px 6px;border-radius:100px;background:rgba(0,212,255,0.08);color:var(--accent-cyan);border:1px solid rgba(0,212,255,0.2)">${escHtml(t)}</span>`).join('')}
          </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--sp-3)">
          <span class="memory-date">${formatDateTime(m.created_at)}</span>
          <button onclick="deleteMemory(${m.id})" style="color:var(--text-faint);width:20px;height:20px;display:flex;align-items:center;justify-content:center" aria-label="Delete memory">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}
/* --- end legacy loadMemory --- */

window.deleteMemory = async function(id) {
  await api('memories', 'DELETE', null, `id=${id}`);
  loadMemory();
  playClickSound();
};

// ═══════════════════════════════════════════════════════
//  OPERATIONS — Enhanced with Operation Groups (P5)
// ═══════════════════════════════════════════════════════
async function loadOperationGroups() {
  try {
    const groups = await api('operation_groups') || [];
    const container = $('operation-groups-panel');
    if (!container) return;

    if (groups.length === 0) {
      container.innerHTML = '<div style="color:var(--text-faint);font-family:var(--font-mono);font-size:var(--text-xs);padding:var(--sp-4);text-align:center">No parallel operation groups active</div>';
      return;
    }

    container.innerHTML = groups.map(g => {
      let ops = [];
      try { ops = JSON.parse(g.operations_json || '[]'); } catch {}
      const totalOps = ops.length;
      const completedOps = ops.filter(o => o.status === 'complete').length;
      const groupProgress = totalOps > 0 ? Math.round((completedOps / totalOps) * 100) : 0;
      const statusColor = g.status === 'complete' ? 'var(--accent-green, #10b981)' : g.status === 'failed' ? 'var(--accent-red, #ef4444)' : 'var(--accent-cyan)';

      return `
        <div class="hud-panel" style="padding:var(--sp-4);margin-bottom:var(--sp-3);border-left:3px solid ${statusColor}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-3)">
            <div style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">${escHtml(g.name)}</div>
            <span style="font-family:var(--font-mono);font-size:10px;padding:2px 8px;border-radius:var(--radius-sm);background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44;text-transform:uppercase">${escHtml(g.status)}</span>
          </div>
          <div style="display:flex;gap:var(--sp-2);flex-wrap:wrap;margin-bottom:var(--sp-3)">
            ${ops.map(o => {
              const opColor = o.status === 'complete' ? '#10b981' : o.status === 'processing' ? '#00d4ff' : o.status === 'failed' ? '#ef4444' : '#475569';
              return `<div style="display:flex;align-items:center;gap:4px;font-size:10px;font-family:var(--font-mono);color:${opColor}"><span style="width:6px;height:6px;border-radius:50%;background:${opColor};display:inline-block"></span>${escHtml(o.name || 'Op')}</div>`;
            }).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:var(--sp-3)">
            <div class="op-progress-bar" style="flex:1"><div class="op-progress-fill" style="width:${groupProgress}%"></div></div>
            <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-cyan)">${completedOps}/${totalOps}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    console.warn('loadOperationGroups error:', err);
  }
}

// ═══════════════════════════════════════════════════════
//  ENHANCED MEMORY VIEW (P6)
// ═══════════════════════════════════════════════════════
async function loadMemoryEnhanced(searchQuery = '', filterCategory = '') {
  let params = '';
  if (searchQuery) params += `search=${encodeURIComponent(searchQuery)}`;
  if (filterCategory) params += `${params ? '&' : ''}category=${encodeURIComponent(filterCategory)}`;
  const memories = await api('memories', 'GET', null, params) || [];
  const grid = $('memory-grid');
  if (!grid) return;

  // Build category counts for filter bar
  const categories = {};
  memories.forEach(m => {
    const cat = m.category || 'general';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  const filterBar = $('memory-filter-bar');
  if (filterBar) {
    const catIcons = { technical: '💻', schedule: '📅', ideas: '💡', knowledge: '📚', contacts: '👤', financial: '💰', preferences: '⚙️', general: '📁' };
    filterBar.innerHTML = `
      <button class="memory-filter-btn ${!filterCategory ? 'active' : ''}" onclick="filterMemories('')" style="font-family:var(--font-mono);font-size:10px;padding:4px 10px;border-radius:100px;background:${!filterCategory ? 'rgba(0,212,255,0.15)' : 'transparent'};color:${!filterCategory ? 'var(--accent-cyan)' : 'var(--text-muted)'};border:1px solid ${!filterCategory ? 'rgba(0,212,255,0.3)' : 'var(--border-dim)'};cursor:pointer">ALL (${memories.length})</button>
      ${Object.entries(categories).map(([cat, count]) => `
        <button class="memory-filter-btn ${filterCategory === cat ? 'active' : ''}" onclick="filterMemories('${cat}')" style="font-family:var(--font-mono);font-size:10px;padding:4px 10px;border-radius:100px;background:${filterCategory === cat ? 'rgba(0,212,255,0.15)' : 'transparent'};color:${filterCategory === cat ? 'var(--accent-cyan)' : 'var(--text-muted)'};border:1px solid ${filterCategory === cat ? 'rgba(0,212,255,0.3)' : 'var(--border-dim)'};cursor:pointer">${catIcons[cat] || '📁'} ${cat.toUpperCase()} (${count})</button>
      `).join('')}
    `;
  }

  if (memories.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:var(--sp-16);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">${searchQuery || filterCategory ? 'No memories match your filters' : 'Memory banks empty'}</div>
        <div style="font-size:var(--text-sm)">Start a conversation or save notes to populate memory banks.</div>
      </div>`;
    return;
  }

  grid.innerHTML = memories.map(m => {
    let tags = [];
    try { tags = JSON.parse(m.tags || '[]'); } catch {}
    if (typeof tags === 'string') try { tags = JSON.parse(tags); } catch { tags = []; }
    const importance = m.importance || 5;
    const category = m.category || 'general';
    const catIcons = { technical: '💻', schedule: '📅', ideas: '💡', knowledge: '📚', contacts: '👤', financial: '💰', preferences: '⚙️', general: '📁' };
    const impColor = importance >= 8 ? '#ef4444' : importance >= 6 ? '#f59e0b' : importance >= 4 ? '#00d4ff' : '#475569';

    return `
      <div class="memory-node" style="position:relative">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp-2)">
          <div style="display:flex;align-items:center;gap:var(--sp-2)">
            <span style="font-size:0.9rem">${catIcons[category] || '📁'}</span>
            <div class="memory-title">${escHtml(m.title)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px">
            <span style="font-family:var(--font-mono);font-size:9px;padding:1px 6px;border-radius:var(--radius-sm);background:${impColor}22;color:${impColor};border:1px solid ${impColor}44" title="Importance: ${importance}/10">IMP:${importance}</span>
          </div>
        </div>
        <div class="memory-content">${escHtml(m.content)}</div>
        ${tags.length ? `
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:var(--sp-3)">
            ${tags.map(t => `<span style="font-family:var(--font-mono);font-size:10px;padding:2px 6px;border-radius:100px;background:rgba(0,212,255,0.08);color:var(--accent-cyan);border:1px solid rgba(0,212,255,0.2)">${escHtml(typeof t === 'string' ? t : String(t))}</span>`).join('')}
          </div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--sp-3)">
          <div style="display:flex;align-items:center;gap:var(--sp-2)">
            <span style="font-family:var(--font-mono);font-size:10px;padding:1px 6px;border-radius:var(--radius-sm);background:rgba(100,116,139,0.1);color:var(--text-faint);text-transform:uppercase">${escHtml(category)}</span>
            <span class="memory-date">${formatDateTime(m.created_at)}</span>
          </div>
          <button onclick="deleteMemory(${m.id})" style="color:var(--text-faint);width:20px;height:20px;display:flex;align-items:center;justify-content:center" aria-label="Delete memory">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

window.filterMemories = function(cat) {
  const searchVal = $('memory-search')?.value || '';
  loadMemoryEnhanced(searchVal, cat);
};

// ═══════════════════════════════════════════════════════
//  BRIEFINGS (P7) — Intelligence Dashboard
// ═══════════════════════════════════════════════════════
async function loadBriefings() {
  const [briefings, analytics] = await Promise.all([
    api('briefings') || [],
    api('analytics').catch(() => null),
  ]);

  const briefingsList = briefings || [];

  // Analytics summary
  const analyticsPanel = $('briefings-analytics');
  if (analyticsPanel && analytics) {
    const totalConvos = analytics.total_conversations || 0;
    const sentimentDist = analytics.sentiment_distribution || {};
    const activeHours = analytics.active_hours || [];
    const memoryGrowth = analytics.memory_growth || {};
    const topIntents = analytics.top_intents || [];

    // Build sentiment mini-chart
    const sentiments = ['positive', 'neutral', 'negative'];
    const sentColors = { positive: '#10b981', neutral: '#64748b', negative: '#ef4444' };
    const totalSent = sentiments.reduce((s, k) => s + (sentimentDist[k] || 0), 0) || 1;

    analyticsPanel.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--sp-4);margin-bottom:var(--sp-5)">
        <div class="hud-panel" style="padding:var(--sp-4);text-align:center">
          <div style="font-family:var(--font-mono);font-size:var(--text-2xl);font-weight:700;color:var(--accent-cyan)">${totalConvos}</div>
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase">Total Conversations</div>
        </div>
        <div class="hud-panel" style="padding:var(--sp-4)">
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase;margin-bottom:var(--sp-2)">Sentiment Distribution</div>
          <div style="display:flex;gap:2px;height:24px;border-radius:var(--radius-sm);overflow:hidden">
            ${sentiments.map(s => {
              const pct = Math.round(((sentimentDist[s] || 0) / totalSent) * 100);
              return pct > 0 ? `<div style="width:${pct}%;background:${sentColors[s]};position:relative" title="${s}: ${pct}%"></div>` : '';
            }).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:4px">
            ${sentiments.map(s => `<span style="font-family:var(--font-mono);font-size:9px;color:${sentColors[s]}">${s.charAt(0).toUpperCase() + s.slice(1)} ${sentimentDist[s] || 0}</span>`).join('')}
          </div>
        </div>
        <div class="hud-panel" style="padding:var(--sp-4)">
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase;margin-bottom:var(--sp-2)">Peak Activity Hours</div>
          <div style="display:flex;align-items:flex-end;gap:2px;height:32px">
            ${Array.from({length:24}, (_, h) => {
              const count = activeHours.find(a => a.hour === h)?.count || 0;
              const maxCount = Math.max(...activeHours.map(a => a.count || 0), 1);
              const barH = Math.max(2, Math.round((count / maxCount) * 32));
              const isActive = count > maxCount * 0.5;
              return `<div style="flex:1;height:${barH}px;background:${isActive ? 'var(--accent-cyan)' : 'var(--bg-dim)'};border-radius:1px" title="${h}:00 — ${count} msgs"></div>`;
            }).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:2px">
            <span style="font-family:var(--font-mono);font-size:8px;color:var(--text-faint)">00h</span>
            <span style="font-family:var(--font-mono);font-size:8px;color:var(--text-faint)">12h</span>
            <span style="font-family:var(--font-mono);font-size:8px;color:var(--text-faint)">23h</span>
          </div>
        </div>
      </div>
      ${topIntents.length > 0 ? `
        <div class="hud-panel" style="padding:var(--sp-4);margin-bottom:var(--sp-5)">
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase;margin-bottom:var(--sp-3)">Top Intents</div>
          <div style="display:flex;flex-wrap:wrap;gap:var(--sp-2)">
            ${topIntents.slice(0, 10).map(i => `<span style="font-family:var(--font-mono);font-size:10px;padding:3px 10px;border-radius:100px;background:rgba(0,212,255,0.08);color:var(--accent-cyan);border:1px solid rgba(0,212,255,0.2)">${escHtml(i.intent || i)} <span style="color:var(--text-faint)">(${i.count || ''})</span></span>`).join('')}
          </div>
        </div>` : ''}
    `;
  }

  // Briefings list
  const container = $('briefings-list');
  if (!container) return;

  if (briefingsList.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:var(--sp-12);color:var(--text-muted)">
        <div style="font-family:var(--font-display);font-size:var(--text-lg);margin-bottom:var(--sp-3)">No briefings generated yet</div>
        <div style="font-size:var(--text-sm)">JARVIS will generate intelligence briefings as interaction patterns emerge.</div>
      </div>`;
    return;
  }

  const typeIcons = { daily: '📋', weekly: '📊', insight: '💡', recommendation: '🎯', alert: '⚠️' };
  const typeColors = { daily: 'var(--accent-cyan)', weekly: '#8b5cf6', insight: '#f59e0b', recommendation: '#10b981', alert: '#ef4444' };

  container.innerHTML = briefingsList.map(b => {
    let metrics = {};
    try { metrics = JSON.parse(b.metrics_json || '{}'); } catch {}
    let recommendations = [];
    try { recommendations = JSON.parse(b.recommendations_json || '[]'); } catch {}
    const icon = typeIcons[b.type] || '📋';
    const color = typeColors[b.type] || 'var(--accent-cyan)';

    return `
      <div class="hud-panel" style="padding:var(--sp-5);margin-bottom:var(--sp-4);border-left:3px solid ${color}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--sp-3)">
          <div style="display:flex;align-items:center;gap:var(--sp-2)">
            <span style="font-size:1.1rem">${icon}</span>
            <div>
              <div style="font-family:var(--font-mono);font-size:var(--text-sm);font-weight:600;color:var(--text-primary)">${escHtml(b.title)}</div>
              <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase">${escHtml(b.type || 'briefing')} BRIEFING</div>
            </div>
          </div>
          <span style="font-family:var(--font-mono);font-size:var(--text-xs);color:var(--text-faint)">${formatDateTime(b.created_at)}</span>
        </div>
        ${b.content ? `<div style="font-size:var(--text-sm);color:var(--text-muted);line-height:1.6;margin-bottom:var(--sp-3)">${escHtml(b.content)}</div>` : ''}
        ${recommendations.length > 0 ? `
          <div style="margin-top:var(--sp-3)">
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-faint);text-transform:uppercase;margin-bottom:var(--sp-2)">Recommendations</div>
            <ul style="margin:0;padding-left:var(--sp-5);font-size:var(--text-xs);color:var(--text-muted)">
              ${recommendations.map(r => `<li style="margin-bottom:2px">${escHtml(typeof r === 'string' ? r : r.text || JSON.stringify(r))}</li>`).join('')}
            </ul>
          </div>` : ''}
      </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  CHAT — Sentiment Indicators (P4/P7)
// ═══════════════════════════════════════════════════════
function getSentimentIndicator(sentiment) {
  if (!sentiment) return '';
  const indicators = {
    positive: { icon: '🟢', label: 'Positive' },
    negative: { icon: '🔴', label: 'Negative' },
    neutral: { icon: '⚪', label: 'Neutral' },
    excited: { icon: '⚡', label: 'Excited' },
    frustrated: { icon: '😤', label: 'Frustrated' },
    curious: { icon: '🔍', label: 'Curious' },
  };
  const s = indicators[sentiment] || indicators['neutral'];
  return `<span style="font-size:10px;margin-left:4px" title="Mood: ${s.label}">${s.icon}</span>`;
}

// ═══════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════
async function loadSettings() {
  const settings = await api('settings') || {};
  if (settings.user_name) {
    State.userName = settings.user_name;
    const el = $('setting-username');
    if (el) el.value = settings.user_name;
  }
  if (settings.voice_rate) {
    State.voiceSettings.rate = parseFloat(settings.voice_rate);
    const el = $('setting-voice-rate');
    if (el) { el.value = settings.voice_rate; $('voice-rate-val').textContent = settings.voice_rate; }
  }
  if (settings.voice_pitch) {
    State.voiceSettings.pitch = parseFloat(settings.voice_pitch);
    const el = $('setting-voice-pitch');
    if (el) { el.value = settings.voice_pitch; $('voice-pitch-val').textContent = settings.voice_pitch; }
  }
  if (settings.voice_volume) {
    State.voiceSettings.volume = parseFloat(settings.voice_volume);
    const el = $('setting-voice-volume');
    if (el) { el.value = settings.voice_volume; $('voice-volume-val').textContent = settings.voice_volume; }
  }
  // ElevenLabs settings
  if (settings.el_enabled !== undefined) {
    State.elevenLabs.enabled = settings.el_enabled === 'true' || settings.el_enabled === true;
    const el = $('setting-el-enabled');
    if (el) el.checked = State.elevenLabs.enabled;
  }
  if (settings.el_apikey) {
    State.elevenLabs.apiKey = settings.el_apikey;
    const el = $('setting-el-apikey');
    if (el) el.value = settings.el_apikey;
  } else {
    // Use default from State if not saved yet
    const el = $('setting-el-apikey');
    if (el && State.elevenLabs.apiKey) el.value = State.elevenLabs.apiKey;
  }
  if (settings.el_voiceid) {
    State.elevenLabs.voiceId = settings.el_voiceid;
    const el = $('setting-el-voiceid');
    if (el) el.value = settings.el_voiceid;
  } else {
    const el = $('setting-el-voiceid');
    if (el && State.elevenLabs.voiceId) el.value = State.elevenLabs.voiceId;
  }
  if (settings.el_model) {
    State.elevenLabs.model = settings.el_model;
    const el = $('setting-el-model');
    if (el) el.value = settings.el_model;
  }
  if (settings.el_stability) {
    State.elevenLabs.stability = parseFloat(settings.el_stability);
    const el = $('setting-el-stability');
    if (el) { el.value = settings.el_stability; const v = $('el-stability-val'); if (v) v.textContent = settings.el_stability; }
  }
  if (settings.el_similarity) {
    State.elevenLabs.similarityBoost = parseFloat(settings.el_similarity);
    const el = $('setting-el-similarity');
    if (el) { el.value = settings.el_similarity; const v = $('el-similarity-val'); if (v) v.textContent = settings.el_similarity; }
  }
  if (settings.el_style) {
    State.elevenLabs.style = parseFloat(settings.el_style);
    const el = $('setting-el-style');
    if (el) { el.value = settings.el_style; const v = $('el-style-val'); if (v) v.textContent = settings.el_style; }
  }
  // Update ElevenLabs status dot
  _updateElStatusDot();
  populateVoiceSelector();
  updateGreeting();

  // Continuous mode & wake word — load from settings and auto-enable
  const cmEnabled = settings.continuous_mode === 'true' || settings.continuous_mode === true;
  State.continuousMode = cmEnabled;
  const cmToggle = $('setting-continuous');
  if (cmToggle) cmToggle.checked = cmEnabled;

  const wwEnabled = settings.wake_word === 'true' || settings.wake_word === true;
  const wwToggle = $('setting-wakeword');
  if (wwToggle) wwToggle.checked = wwEnabled;
  // Auto-start wake word after boot if enabled
  if (wwEnabled) {
    setTimeout(() => startWakeWordDetection(), 1500);
  }
}

async function saveSettings() {
  const settings = {
    user_name: $('setting-username')?.value || 'Sir',
    voice_rate: parseFloat($('setting-voice-rate')?.value || '0.9'),
    voice_pitch: parseFloat($('setting-voice-pitch')?.value || '1.0'),
    voice_volume: parseFloat($('setting-voice-volume')?.value || '1.0'),
    // ElevenLabs
    el_enabled: $('setting-el-enabled')?.checked ? 'true' : 'false',
    el_apikey: $('setting-el-apikey')?.value || '',
    el_voiceid: $('setting-el-voiceid')?.value || '',
    el_model: $('setting-el-model')?.value || 'eleven_multilingual_v2',
    el_stability: parseFloat($('setting-el-stability')?.value || '0.5'),
    el_similarity: parseFloat($('setting-el-similarity')?.value || '0.75'),
    el_style: parseFloat($('setting-el-style')?.value || '0.4'),
    // Voice modes
    continuous_mode: $('setting-continuous')?.checked ? 'true' : 'false',
    wake_word: $('setting-wakeword')?.checked ? 'true' : 'false',
  };

  State.userName = settings.user_name;
  State.voiceSettings.rate = settings.voice_rate;
  State.voiceSettings.pitch = settings.voice_pitch;
  State.voiceSettings.volume = settings.voice_volume;

  // ElevenLabs state sync
  State.elevenLabs.enabled = settings.el_enabled === 'true';
  State.elevenLabs.apiKey = settings.el_apikey;
  State.elevenLabs.voiceId = settings.el_voiceid;
  State.elevenLabs.model = settings.el_model;
  State.elevenLabs.stability = settings.el_stability;
  State.elevenLabs.similarityBoost = settings.el_similarity;
  State.elevenLabs.style = settings.el_style;

  // Voice selection
  const voiceSel = $('setting-voice');
  if (voiceSel && voiceSel.value) {
    const v = State.availableVoices.find(v => v.voiceURI === voiceSel.value);
    if (v) State.selectedVoice = v;
  }

  // Sync voice selection URI into settings for persistence check
  const voiceSelSave = $('setting-voice');
  if (voiceSelSave && voiceSelSave.value) {
    const v = State.availableVoices.find(v => v.voiceURI === voiceSelSave.value);
    if (v) { State.selectedVoice = v; State.voiceSettings.voiceURI = v.voiceURI; }
  }

  await api('settings', 'POST', settings);
  _updateElStatusDot();
  updateGreeting();
  playSuccessSound();
  showToast('Configuration saved, ' + settings.user_name + '.');
}

// ═══════════════════════════════════════════════════════
//  MODALS
// ═══════════════════════════════════════════════════════
function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove('hidden');
  playClickSound();
  // Focus first input
  setTimeout(() => {
    const input = modal.querySelector('input, textarea, select');
    if (input) input.focus();
  }, 50);
}

function closeModal(id) {
  const modal = $(id);
  if (modal) modal.classList.add('hidden');
}

// ═══════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════
function bindEvents() {
  // Unlock audio on first user interaction (for ElevenLabs TTS autoplay)
  document.addEventListener('click', _unlockAudio, { once: true });
  document.addEventListener('touchstart', _unlockAudio, { once: true });

  // Navigation (sidebar + bottom bar)
  $$('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) navigate(view);
    });
  });

  // Arc reactor click / keyboard
  const arc = $('arc-reactor');
  if (arc) {
    arc.addEventListener('click', (e) => {
      if (e.target.closest('.arc-mic-btn')) return; // mic btn handles itself
      toggleListening();
    });
    arc.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleListening(); }
    });
  }

  // Mic buttons
  const micBtn = $('mic-btn');
  if (micBtn) {
    micBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleListening();
    });
  }
  const chatMicBtn = $('chat-mic-btn');
  if (chatMicBtn) chatMicBtn.addEventListener('click', toggleListening);

  // Chat input
  const chatInput = $('chat-input');
  const chatSend = $('chat-send');
  if (chatInput) {
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const val = chatInput.value.trim();
        if (val) { chatInput.value = ''; sendUserMessage(val); }
      }
    });
  }
  if (chatSend) {
    chatSend.addEventListener('click', () => {
      const val = chatInput?.value.trim();
      if (val) { chatInput.value = ''; sendUserMessage(val); }
    });
  }

  // New project
  const newProjBtn = $('new-project-btn');
  const quickProjBtn = $('quick-project-btn');
  if (newProjBtn) newProjBtn.addEventListener('click', () => openModal('modal-new-project'));
  if (quickProjBtn) quickProjBtn.addEventListener('click', () => { navigate('projects'); setTimeout(() => openModal('modal-new-project'), 200); });

  const saveProjBtn = $('save-project-btn');
  if (saveProjBtn) {
    saveProjBtn.addEventListener('click', async () => {
      const name = $('proj-name')?.value.trim();
      if (!name) { showToast('Please enter a project name.'); return; }
      const p = await api('projects', 'POST', {
        name,
        status: $('proj-status')?.value || 'Active',
        description: $('proj-desc')?.value || '',
      });
      closeModal('modal-new-project');
      $('proj-name').value = ''; $('proj-desc').value = '';
      if (p) {
        if (window.CinematicVFX) CinematicVFX.projectInit(p.name);
        playSuccessSound();
        showToast(`Project "${p.name}" initialized.`);
        loadProjects();
        loadDashboard();
        speakText(fillTemplate(pickRandom(JARVIS_RESPONSES.project_created), { name: p.name, user: State.userName }));
      }
    });
  }

  // Back to projects list
  const backBtn = $('back-to-projects');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const detail = $('project-detail');
      const grid = $('projects-grid');
      if (detail) detail.style.display = 'none';
      const listDiv = $('view-projects').querySelector(':scope > div');
      if (listDiv) listDiv.style.display = 'block';
      State.currentProjectId = null;
    });
  }

  // Add task
  const addTaskBtn = $('add-task-btn');
  if (addTaskBtn) addTaskBtn.addEventListener('click', () => openModal('modal-new-task'));

  const saveTaskBtn = $('save-task-btn');
  if (saveTaskBtn) {
    saveTaskBtn.addEventListener('click', async () => {
      const title = $('task-title')?.value.trim();
      if (!title) { showToast('Please enter a task title.'); return; }
      const t = await api('tasks', 'POST', {
        title,
        description: $('task-desc')?.value || '',
        priority: $('task-priority')?.value || 'medium',
        project_id: State.currentProjectId,
        status: 'todo',
      });
      closeModal('modal-new-task');
      $('task-title').value = ''; $('task-desc').value = '';
      if (t) {
        playSuccessSound();
        showToast(`Task "${t.title}" created.`);
        renderKanban(State.currentProjectId);
      }
    });
  }

  // New research
  const newResBtn = $('new-research-btn');
  const quickResBtn = $('quick-research-btn');
  if (newResBtn) newResBtn.addEventListener('click', () => openModal('modal-new-research'));
  if (quickResBtn) quickResBtn.addEventListener('click', () => { navigate('research'); setTimeout(() => openModal('modal-new-research'), 200); });

  const saveResBtn = $('save-research-btn');
  if (saveResBtn) {
    saveResBtn.addEventListener('click', async () => {
      const topic = $('research-topic')?.value.trim();
      if (!topic) { showToast('Please enter a research topic.'); return; }
      const findingsRaw = $('research-findings')?.value || '';
      const findings = findingsRaw.split('\n').map(l => l.trim()).filter(Boolean);
      const r = await api('research', 'POST', {
        topic,
        summary: $('research-summary')?.value || '',
        findings,
      });
      closeModal('modal-new-research');
      $('research-topic').value = ''; $('research-summary').value = ''; $('research-findings').value = '';
      if (r) {
        if (window.CinematicVFX) CinematicVFX.researchAnalysis(r.topic);
        playSuccessSound();
        showToast(`Research "${r.topic}" logged.`);
        loadResearch();
        speakText(fillTemplate(pickRandom(JARVIS_RESPONSES.research_saved), { topic: r.topic }));
      }
    });
  }

  // New memory
  const newMemBtn = $('new-memory-btn');
  const quickMemBtn = $('quick-memory-btn');
  if (newMemBtn) newMemBtn.addEventListener('click', () => openModal('modal-new-memory'));
  if (quickMemBtn) quickMemBtn.addEventListener('click', () => { navigate('memory'); setTimeout(() => openModal('modal-new-memory'), 200); });

  const saveMemBtn = $('save-memory-btn');
  if (saveMemBtn) {
    saveMemBtn.addEventListener('click', async () => {
      const title = $('mem-title')?.value.trim();
      const content = $('mem-content')?.value.trim();
      if (!title || !content) { showToast('Please fill in title and content.'); return; }
      const tagsRaw = $('mem-tags')?.value || '';
      const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      const m = await api('memories', 'POST', { title, content, tags });
      closeModal('modal-new-memory');
      $('mem-title').value = ''; $('mem-content').value = ''; $('mem-tags').value = '';
      if (m) {
        if (window.CinematicVFX) CinematicVFX.memoryIndex();
        playSuccessSound();
        showToast('Memory indexed.');
        loadMemory();
        if (State.currentView === 'dashboard') loadDashboard();
        speakText(fillTemplate(pickRandom(JARVIS_RESPONSES.memory_saved), {}));
      }
    });
  }

  // New operation
  const newOpBtn = $('new-operation-btn');
  if (newOpBtn) newOpBtn.addEventListener('click', () => openModal('modal-new-operation'));

  const saveOpBtn = $('save-operation-btn');
  if (saveOpBtn) {
    saveOpBtn.addEventListener('click', async () => {
      const name = $('op-name')?.value.trim();
      if (!name) { showToast('Please enter an operation name.'); return; }
      const op = await api('operations', 'POST', { name, status: 'queued', progress: 0 });
      closeModal('modal-new-operation');
      $('op-name').value = '';
      if (op) {
        if (window.CinematicVFX) CinematicVFX.operationLaunch(op.name);
        playSuccessSound();
        showToast(`Operation "${op.name}" queued.`);
        loadOperations();
        speakText(`Operation ${op.name} queued for processing, ${State.userName}.`);
      }
    });
  }

  // Modal close buttons
  $$('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  // Click outside modal to close
  $$('.modal-backdrop').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModal(modal.id);
    });
  });

  // Escape key to close modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      $$('.modal-backdrop:not(.hidden)').forEach(m => closeModal(m.id));
    }
  });

  // Settings sliders
  const sliders = [
    ['setting-voice-rate', 'voice-rate-val'],
    ['setting-voice-pitch', 'voice-pitch-val'],
    ['setting-voice-volume', 'voice-volume-val'],
    ['setting-glow', 'glow-val'],
    ['setting-anim', 'anim-val'],
  ];
  sliders.forEach(([sliderId, valId]) => {
    const el = $(sliderId);
    if (el) el.addEventListener('input', () => {
      const valEl = $(valId);
      if (valEl) valEl.textContent = el.value;
    });
  });

  // Save settings
  const saveSettingsBtn = $('save-settings-btn');
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);

  // Test Voice button
  const testVoiceBtn = $('test-voice-btn');
  if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', () => {
      speakText(`Online and fully operational, ${State.userName}. All systems nominal. Voice calibration complete.`);
    });
  }

  // ElevenLabs Test Voice button
  const testElBtn = $('test-el-voice-btn');
  if (testElBtn) testElBtn.addEventListener('click', testElevenLabsVoice);

  // ElevenLabs range slider labels
  ['setting-el-stability', 'setting-el-similarity', 'setting-el-style'].forEach(id => {
    const el = $(id);
    if (el) {
      const valId = id.replace('setting-el-', 'el-') + '-val';
      el.addEventListener('input', () => {
        const valEl = $(valId);
        if (valEl) valEl.textContent = el.value;
      });
    }
  });

  // ElevenLabs enable toggle — update status dot live
  const elToggle = $('setting-el-enabled');
  if (elToggle) {
    elToggle.addEventListener('change', () => {
      State.elevenLabs.enabled = elToggle.checked;
      _updateElStatusDot();
    });
  }

  // Continuous mode toggle
  const continuousToggle = $('setting-continuous');
  if (continuousToggle) {
    continuousToggle.addEventListener('change', () => {
      State.continuousMode = continuousToggle.checked;
      if (State.continuousMode) {
        showToast('Continuous conversation mode enabled.');
      } else {
        showToast('Continuous mode disabled.');
      }
    });
  }

  // Wake word toggle
  const wakeWordToggle = $('setting-wakeword');
  if (wakeWordToggle) {
    wakeWordToggle.addEventListener('change', () => {
      if (wakeWordToggle.checked) {
        startWakeWordDetection();
        showToast('Wake word detection active. Say "Hey JARVIS" to activate.');
      } else {
        stopWakeWordDetection();
        showToast('Wake word detection disabled.');
      }
    });
  }

  // Export memories
  const exportBtn = $('export-memories-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const memories = await api('memories') || [];
      const blob = new Blob([JSON.stringify(memories, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'jarvis-memories.json';
      a.click();
      showToast('Memory banks exported.');
    });
  }

  // Clear conversations
  const clearConvosBtn = $('clear-convos-btn');
  if (clearConvosBtn) {
    clearConvosBtn.addEventListener('click', async () => {
      if (!confirm('Clear all conversation history?')) return;
      await api('conversations', 'DELETE');
      showToast('Conversation history cleared.');
      playClickSound();
    });
  }

  // Clear memories
  const clearMemBtn = $('clear-memories-btn');
  if (clearMemBtn) {
    clearMemBtn.addEventListener('click', async () => {
      if (!confirm('Purge all memory banks? This cannot be undone.')) return;
      await api('memories', 'DELETE');
      showToast('Memory banks purged.');
      loadMemory();
      loadDashboard();
      playErrorSound();
    });
  }

  // Memory search
  const memSearch = $('memory-search');
  if (memSearch) {
    let debounce;
    memSearch.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => loadMemory(memSearch.value), 300);
    });
  }

  // Mobile nav bottom bar
  const isMobile = () => window.innerWidth <= 600;
  function updateBottomBar() {
    $$('.mobile-nav-btn').forEach(b => b.style.display = isMobile() ? 'flex' : 'none');
    $$('.mobile-nav-btn').forEach(b => { if (!isMobile()) b.style.display = 'none'; });
    const qp = $('quick-project-btn');
    const qr = $('quick-research-btn');
    const qm = $('quick-memory-btn');
    if (!isMobile()) {
      [qp, qr, qm].forEach(el => { if (el) el.style.display = 'inline-flex'; });
    } else {
      [qp, qr, qm].forEach(el => { if (el) el.style.display = 'none'; });
    }
  }
  updateBottomBar();
  window.addEventListener('resize', updateBottomBar);

  // Handle hash routing
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) navigate(hash);
  });
}

// ═══════════════════════════════════════════════════════
//  AUTH SYSTEM (Username + Password — replaces PIN)
// ═══════════════════════════════════════════════════════
const AUTH_TOKEN_KEY = 'jarvis_auth_token';
const AUTH_USER_KEY = 'jarvis_user';
const AUTH_SESSION_KEY = 'jarvis_authenticated';

function _showAuthError(msg) {
  const el = $('pin-error');
  if (el) { el.textContent = msg; el.style.opacity = '1'; }
  setTimeout(() => { if (el) el.style.opacity = '0'; }, 3000);
}

async function _initAuthSystem() {
  const overlay = $('pin-overlay');
  if (!overlay) return _startBoot();

  // Check if already authenticated this session
  const savedToken = lsGet(AUTH_TOKEN_KEY);
  if (savedToken) {
    // Validate token with API
    try {
      const resp = await fetch(`${API_BASE}?action=auth&sub=validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: savedToken })
      });
      const data = await resp.json();
      if (data.valid) {
        lsSet(AUTH_SESSION_KEY, 'true');
        lsSet(AUTH_USER_KEY, data.display_name || 'Sir');
        overlay.classList.add('hidden');
        return _startBoot();
      }
    } catch(e) {
      // API not reachable — if on GitHub Pages, show API config prompt
      if (_IS_GITHUB_PAGES && (!API_BASE || API_BASE.includes('__CGI_BIN__'))) {
        _showApiConfigPrompt(overlay);
        return;
      }
    }
  }

  // Check if account exists
  let hasAccount = false;
  try {
    const statusResp = await fetch(`${API_BASE}?action=auth&sub=status`);
    const statusData = await statusResp.json();
    hasAccount = statusData.has_account;
  } catch(e) {
    // API not reachable
    if (_IS_GITHUB_PAGES && (!API_BASE || API_BASE.includes('__CGI_BIN__'))) {
      _showApiConfigPrompt(overlay);
      return;
    }
    // Fallback to legacy PIN for local deploy
    _initLegacyPin(overlay);
    return;
  }

  // Show login or register form
  const loginForm = $('auth-login-form');
  const pinForm = $('auth-pin-form');
  const titleEl = $('pin-title');
  const subtitleEl = $('pin-subtitle');
  const submitBtn = $('auth-submit-btn');

  if (loginForm) loginForm.style.display = 'block';
  if (pinForm) pinForm.style.display = 'none';

  if (hasAccount) {
    if (titleEl) titleEl.textContent = 'WELCOME BACK, SIR';
    if (subtitleEl) subtitleEl.textContent = 'Identity verification required';
    if (submitBtn) submitBtn.textContent = 'LOGIN';
  } else {
    if (titleEl) titleEl.textContent = 'CREATE YOUR ACCOUNT';
    if (subtitleEl) subtitleEl.textContent = 'Set up JARVIS access credentials';
    if (submitBtn) submitBtn.textContent = 'CREATE ACCOUNT';
  }

  // Handle submit
  const doAuth = async () => {
    const username = ($('auth-username') || {}).value || '';
    const password = ($('auth-password') || {}).value || '';
    if (!username.trim() || !password.trim()) {
      _showAuthError('Please enter username and password');
      return;
    }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'AUTHENTICATING...'; }

    const sub = hasAccount ? 'login' : 'register';
    try {
      const resp = await fetch(`${API_BASE}?action=auth&sub=${sub}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password, display_name: 'Sir' })
      });
      const data = await resp.json();
      if (data.success && data.token) {
        lsSet(AUTH_TOKEN_KEY, data.token);
        lsSet(AUTH_SESSION_KEY, 'true');
        lsSet(AUTH_USER_KEY, data.display_name || 'Sir');
        overlay.classList.add('hidden');
        _startBoot();
      } else {
        _showAuthError(data.error || 'Authentication failed');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = hasAccount ? 'LOGIN' : 'CREATE ACCOUNT'; }
      }
    } catch(e) {
      _showAuthError('Cannot reach JARVIS server');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = hasAccount ? 'LOGIN' : 'CREATE ACCOUNT'; }
    }
  };

  if (submitBtn) submitBtn.addEventListener('click', doAuth);
  const pwInput = $('auth-password');
  if (pwInput) pwInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAuth(); });

  overlay.style.display = 'flex';
  setTimeout(() => { const un = $('auth-username'); if (un) un.focus(); }, 300);
}

// Show API endpoint configuration for GitHub Pages
function _showApiConfigPrompt(overlay) {
  const titleEl = $('pin-title');
  const subtitleEl = $('pin-subtitle');
  const loginForm = $('auth-login-form');
  const pinForm = $('auth-pin-form');
  const footerEl = $('pin-footer');

  if (titleEl) titleEl.textContent = 'CONNECT TO JARVIS';
  if (subtitleEl) subtitleEl.textContent = 'Enter your JARVIS API endpoint';
  if (loginForm) loginForm.innerHTML = `
    <div class="pin-input-wrap">
      <input type="url" id="api-endpoint-input" class="pin-native-input" placeholder="https://your-api-url/cgi-bin/api.py" style="font-size:13px;letter-spacing:0.5px;">
    </div>
    <button class="pin-submit-btn" id="api-endpoint-btn" type="button">CONNECT</button>
  `;
  if (pinForm) pinForm.style.display = 'none';
  if (footerEl) footerEl.textContent = 'Paste the API URL from your JARVIS deployment';

  const connectBtn = $('api-endpoint-btn');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      const input = $('api-endpoint-input');
      const url = (input ? input.value : '').trim();
      if (!url || !url.startsWith('http')) {
        _showAuthError('Enter a valid API URL starting with https://');
        return;
      }
      connectBtn.disabled = true;
      connectBtn.textContent = 'CONNECTING...';
      try {
        const resp = await fetch(`${url}?action=auth&sub=status`);
        const data = await resp.json();
        setApiEndpoint(url);
        location.reload();
      } catch(e) {
        _showAuthError('Cannot reach that API endpoint');
        connectBtn.disabled = false;
        connectBtn.textContent = 'CONNECT';
      }
    });
  }
  overlay.style.display = 'flex';
}

// Legacy PIN fallback (backward compat)
function _initLegacyPin(overlay) {
  const loginForm = $('auth-login-form');
  const pinForm = $('auth-pin-form');
  if (loginForm) loginForm.style.display = 'none';
  if (pinForm) pinForm.style.display = 'block';

  const pinInput = $('pin-input');
  const submitBtn = $('pin-submit-btn');
  const titleEl = $('pin-title');
  const subtitleEl = $('pin-subtitle');

  let storedHash = null;
  try {
    const settings = api('settings');
    if (settings && settings.pin_hash) storedHash = settings.pin_hash;
  } catch(e) {}

  if (!storedHash) {
    if (titleEl) titleEl.textContent = 'CREATE ACCESS CODE';
    if (subtitleEl) subtitleEl.textContent = 'Set a 4-6 digit code';
  }

  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      // Simple PIN verify — just let through for now
      lsSet(AUTH_SESSION_KEY, 'true');
      overlay.classList.add('hidden');
      _startBoot();
    });
  }
}

function _startBoot() {
  init();
}

// ═══════════════════════════════════════════════════════
//  BOOT SEQUENCE
// ═══════════════════════════════════════════════════════
function runBootSequence() {
  return new Promise(resolve => {
    const bar = $('boot-bar');
    const statusText = $('boot-status-text');
    const steps = [
      [10, 'Loading JARVIS core systems...'],
      [25, 'Initializing arc reactor interface...'],
      [40, 'Connecting to Stark database...'],
      [55, 'Loading voice recognition module...'],
      [70, 'Synchronizing memory banks...'],
      [85, 'Running system diagnostics...'],
      [95, 'Finalizing interface protocols...'],
      [100, 'All systems operational.'],
    ];

    let i = 0;
    const next = () => {
      if (i >= steps.length) {
        setTimeout(resolve, 400);
        return;
      }
      const [pct, msg] = steps[i++];
      if (bar) bar.style.width = pct + '%';
      if (statusText) statusText.textContent = msg;
      setTimeout(next, 280 + Math.random() * 120);
    };
    next();
  });
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
async function init() {
  // Run boot sequence first
  await runBootSequence();

  // Hide boot overlay
  const bootOverlay = $('boot-overlay');
  const appShell = $('app-shell');
  if (bootOverlay) bootOverlay.classList.add('hidden');
  if (appShell) appShell.style.opacity = '1';

  // Init subsystems
  initAudio();
  initVoice();
  startClock();
  animateDiagnostics();
  bindEvents();

  // Load settings
  await loadSettings();

  // Determine initial view from hash
  const hash = window.location.hash.replace('#', '');
  const validViews = ['dashboard', 'chat', 'projects', 'operations', 'schedule', 'proposals', 'artifacts', 'research', 'memory', 'briefings', 'settings'];
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

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', _initAuthSystem);
