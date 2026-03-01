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

  // Wait for API endpoint to be resolved (especially on GitHub Pages)
  if (_apiReady) await _apiReady;

  // If API_BASE is still unresolved placeholder, show config prompt
  if (API_BASE.includes('__CGI_BIN__')) {
    if (_IS_GITHUB_PAGES) {
      _showApiConfigPrompt(overlay);
      return;
    }
    // On Perplexity deploy this should never happen, but fallback
    return _startBoot();
  }

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
      // API not reachable — show login anyway (user can retry)
    }
  }

  // Check if account exists
  let hasAccount = false;
  try {
    const statusResp = await fetch(`${API_BASE}?action=auth&sub=status`);
    const statusData = await statusResp.json();
    hasAccount = statusData.has_account;
  } catch(e) {
    // API not reachable — show login form anyway, user can retry
    hasAccount = true; // Assume account exists, login will fail gracefully
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
