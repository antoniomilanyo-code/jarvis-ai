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