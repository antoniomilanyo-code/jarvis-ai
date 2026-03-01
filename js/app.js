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

// ── Session-persistent cache helpers ─────────────────────────────────
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
  return str.replace(/(\w+)/g, (_, k) => vars[k] || State.userName || 'Sir');
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

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', _initAuthSystem);