/**
 * JARVIS Cinematic VFX System
 * Iron Man HUD-style overlay animations for every JARVIS action
 * Stark Industries — Proprietary Holographic Display v1.0
 */

'use strict';

const CinematicVFX = (() => {

  // ─── State ───────────────────────────────────────────────
  let activeOverlay = null;
  let activeCanvas = null;
  let animFrame = null;
  let isAnimating = false;

  // ─── Color Palette ────────────────────────────────────────
  const CYAN   = '#00d4ff';
  const AMBER  = '#f0a500';
  const CYAN_A = 'rgba(0,212,255,';
  const AMB_A  = 'rgba(240,165,0,';
  const WHITE  = 'rgba(255,255,255,';

  // ─── Data Stream Characters ───────────────────────────────
  const HEX_CHARS = '0123456789ABCDEF';
  const DATA_CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノABCDEF<>{}[]|=+-/*$#@!?%';

  function rnd(min, max) { return Math.random() * (max - min) + min; }
  function rndInt(min, max) { return Math.floor(rnd(min, max + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ─── Overlay Factory ─────────────────────────────────────
  function createOverlay() {
    const el = document.createElement('div');
    el.className = 'vfx-overlay';
    el.id = 'vfx-overlay';
    return el;
  }

  function createCanvas(container) {
    const cv = document.createElement('canvas');
    cv.className = 'vfx-particles';
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    container.appendChild(cv);
    return cv;
  }

  function cleanup() {
    if (animFrame) { cancelAnimationFrame(animFrame); animFrame = null; }
    if (activeOverlay) {
      activeOverlay.classList.add('vfx-fade-out');
      setTimeout(() => {
        if (activeOverlay && activeOverlay.parentNode) {
          activeOverlay.parentNode.removeChild(activeOverlay);
        }
        activeOverlay = null;
        activeCanvas = null;
        isAnimating = false;
      }, 600);
    }
  }

  function showOverlay(durationMs = 2500) {
    if (isAnimating) cleanup();
    isAnimating = true;
    const overlay = createOverlay();
    document.body.appendChild(overlay);
    activeOverlay = overlay;
    // Trigger auto-cleanup
    setTimeout(cleanup, durationMs);
    return overlay;
  }

  // ═══════════════════════════════════════════════════════════
  //  1. DATA PROCESSING — spinning scanner + matrix data stream
  // ═══════════════════════════════════════════════════════════
  function playDataProcessing(label = 'PROCESSING') {
    const overlay = showOverlay(2400);
    const cv = createCanvas(overlay);
    activeCanvas = cv;
    const ctx = cv.getContext('2d');

    // Static HTML elements inside overlay
    overlay.innerHTML += `
      <div class="vfx-scanner"></div>
      <div class="vfx-grid"></div>
      <div class="vfx-center-hub">
        <div class="vfx-progress-ring">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle class="vfx-ring-bg" cx="60" cy="60" r="50" fill="none" stroke="rgba(0,212,255,0.12)" stroke-width="3"/>
            <circle class="vfx-ring-arc" cx="60" cy="60" r="50" fill="none" stroke="#00d4ff" stroke-width="3"
              stroke-dasharray="314" stroke-dashoffset="314" stroke-linecap="round"/>
          </svg>
          <div class="vfx-hub-text">${label}</div>
        </div>
      </div>
      <div class="vfx-status-line" style="top:78%;left:50%;transform:translateX(-50%)">ANALYZING DATA STREAMS</div>
      <div class="vfx-bracket vfx-bracket-tl"></div>
      <div class="vfx-bracket vfx-bracket-tr"></div>
      <div class="vfx-bracket vfx-bracket-bl"></div>
      <div class="vfx-bracket vfx-bracket-br"></div>
    `;

    // Animate ring arc
    const arc = overlay.querySelector('.vfx-ring-arc');
    if (arc) {
      let offset = 314;
      const ringInterval = setInterval(() => {
        offset = Math.max(0, offset - 6);
        arc.style.strokeDashoffset = offset;
        if (offset <= 0) clearInterval(ringInterval);
      }, 30);
    }

    // Canvas: Matrix data stream columns
    const cols = [];
    const colCount = Math.floor(cv.width / 18);
    for (let i = 0; i < colCount; i++) {
      cols.push({ x: i * 18 + 9, y: rnd(-cv.height, 0), speed: rnd(2, 6), chars: [] });
    }

    function drawMatrix(timestamp) {
      if (!isAnimating) return;
      ctx.clearRect(0, 0, cv.width, cv.height);

      // Scan line sweep
      const sweep = (timestamp * 0.4) % cv.height;
      const grad = ctx.createLinearGradient(0, sweep - 80, 0, sweep + 4);
      grad.addColorStop(0, 'rgba(0,212,255,0)');
      grad.addColorStop(0.8, 'rgba(0,212,255,0.04)');
      grad.addColorStop(1, 'rgba(0,212,255,0.12)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, sweep - 80, cv.width, 84);

      cols.forEach(col => {
        col.y += col.speed;
        if (col.y > cv.height + 200) { col.y = rnd(-300, -50); col.chars = []; }
        const len = rndInt(6, 18);
        for (let j = len - 1; j >= 0; j--) {
          const cy = col.y - j * 16;
          if (cy < 0 || cy > cv.height) continue;
          const alpha = j === 0 ? 0.9 : (1 - j / len) * 0.4;
          ctx.font = '12px monospace';
          ctx.fillStyle = j === 0 ? `rgba(200,240,255,${alpha})` : `${CYAN_A}${alpha})`;
          ctx.fillText(pick(HEX_CHARS), col.x, cy);
        }
      });

      animFrame = requestAnimationFrame(drawMatrix);
    }
    animFrame = requestAnimationFrame(drawMatrix);
  }

  // ═══════════════════════════════════════════════════════════
  //  2. PROJECT INITIALIZATION — blueprint schematics drawing
  // ═══════════════════════════════════════════════════════════
  function playProjectInit(projectName = 'NEW PROJECT') {
    const overlay = showOverlay(3000);
    const cv = createCanvas(overlay);
    activeCanvas = cv;
    const ctx = cv.getContext('2d');

    const cx = cv.width / 2;
    const cy = cv.height / 2;

    overlay.innerHTML += `
      <div class="vfx-bracket vfx-bracket-tl"></div>
      <div class="vfx-bracket vfx-bracket-tr"></div>
      <div class="vfx-bracket vfx-bracket-bl"></div>
      <div class="vfx-bracket vfx-bracket-br"></div>
      <div class="vfx-project-labels">
        <div class="vfx-label-line vfx-label-1">INITIALIZING PROJECT MATRIX</div>
        <div class="vfx-label-line vfx-label-2">ALLOCATING RESOURCES</div>
        <div class="vfx-label-line vfx-label-name">${projectName.toUpperCase()}</div>
        <div class="vfx-label-line vfx-label-3">PROJECT ONLINE</div>
      </div>
      <div class="vfx-flash" id="vfx-flash"></div>
    `;

    // Blueprint: rotating wireframe cube + schematic lines
    let angle = 0;
    let progress = 0; // 0..1
    const startTime = performance.now();
    const duration = 2800;

    // Blueprint grid lines in background
    function drawGrid(ctx) {
      ctx.strokeStyle = 'rgba(0,180,220,0.06)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < cv.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke();
      }
      for (let y = 0; y < cv.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cv.width, y); ctx.stroke();
      }
    }

    function drawWireframeCube(ctx, cx, cy, size, angle, alpha) {
      // 8 vertices of a cube
      const s = size;
      const verts3d = [
        [-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],
        [-1,-1, 1],[1,-1, 1],[1,1, 1],[-1,1, 1],
      ].map(([x,y,z]) => {
        // Rotate around Y and X axes
        const cosY = Math.cos(angle), sinY = Math.sin(angle);
        const cosX = Math.cos(angle * 0.6), sinX = Math.sin(angle * 0.6);
        const rx = x * cosY - z * sinY;
        const rz = x * sinY + z * cosY;
        const ry = y * cosX - rz * sinX;
        const rz2 = y * sinX + rz * cosX;
        const perspective = 3 / (3 + rz2 * 0.4);
        return [cx + rx * s * perspective, cy + ry * s * perspective];
      });
      const edges = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      ctx.strokeStyle = `${CYAN_A}${alpha * 0.9})`;
      ctx.lineWidth = 1.5;
      edges.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(verts3d[a][0], verts3d[a][1]);
        ctx.lineTo(verts3d[b][0], verts3d[b][1]);
        ctx.stroke();
      });
      // Glow on vertices
      verts3d.forEach(([vx, vy]) => {
        ctx.beginPath();
        ctx.arc(vx, vy, 2, 0, Math.PI * 2);
        ctx.fillStyle = `${CYAN_A}${alpha})`;
        ctx.fill();
      });
    }

    function drawSchematics(ctx, progress) {
      // Schematic lines radiating from center
      ctx.strokeStyle = `${CYAN_A}${0.15 * progress})`;
      ctx.lineWidth = 0.75;
      ctx.setLineDash([4, 8]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r1 = 90, r2 = 200 + Math.sin(a * 3) * 60;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.lineTo(cx + Math.cos(a) * r2 * progress, cy + Math.sin(a) * r2 * progress);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Dimension labels
      if (progress > 0.5) {
        ctx.font = '9px monospace';
        ctx.fillStyle = `${CYAN_A}${(progress - 0.5) * 1.6})`;
        const dims = ['1.21m', '0.89m', '2.3m', '45°', '0.62m', '180°'];
        dims.forEach((d, i) => {
          const a = (i / dims.length) * Math.PI * 2 - Math.PI / 2;
          const r = 160;
          ctx.fillText(d, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        });
      }
    }

    function frame(timestamp) {
      if (!isAnimating) return;
      ctx.clearRect(0, 0, cv.width, cv.height);
      progress = Math.min((timestamp - startTime) / duration, 1);
      angle += 0.02;

      drawGrid(ctx);
      drawSchematics(ctx, progress);
      drawWireframeCube(ctx, cx, cy, 55, angle, progress);

      // Center glow
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 100);
      glow.addColorStop(0, `${CYAN_A}${0.12 * progress})`);
      glow.addColorStop(1, 'rgba(0,212,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, cv.width, cv.height);

      if (progress < 1) animFrame = requestAnimationFrame(frame);
      else {
        // Flash on completion
        const flashEl = overlay.querySelector('#vfx-flash');
        if (flashEl) flashEl.classList.add('active');
      }
    }
    animFrame = requestAnimationFrame(frame);
  }

  // ═══════════════════════════════════════════════════════════
  //  3. MEMORY INDEXING — neural network nodes + connections
  // ═══════════════════════════════════════════════════════════
  function playMemoryIndex() {
    const overlay = showOverlay(2800);
    const cv = createCanvas(overlay);
    activeCanvas = cv;
    const ctx = cv.getContext('2d');

    overlay.innerHTML += `
      <div class="vfx-bracket vfx-bracket-tl"></div>
      <div class="vfx-bracket vfx-bracket-tr"></div>
      <div class="vfx-bracket vfx-bracket-bl"></div>
      <div class="vfx-bracket vfx-bracket-br"></div>
      <div class="vfx-center-hub" style="pointer-events:none">
        <div class="vfx-index-text">
          <span class="vfx-index-label">INDEXING</span>
          <span class="vfx-index-counter" id="vfx-idx-counter">000</span>
        </div>
      </div>
      <div class="vfx-status-line" style="top:75%;left:50%;transform:translateX(-50%)">NEURAL PATHWAY MAPPING ACTIVE</div>
    `;

    // Neural network nodes
    const nodeCount = 28;
    const nodes = [];
    const cx = cv.width / 2, cy = cv.height / 2;

    for (let i = 0; i < nodeCount; i++) {
      const ring = i < 1 ? 0 : i < 7 ? 1 : 2;
      const radii = [0, 130, 260];
      const r = radii[ring] + rnd(-20, 20);
      const countInRing = ring === 0 ? 1 : ring === 1 ? 6 : 21;
      const startIdx = ring === 0 ? 0 : ring === 1 ? 1 : 7;
      const angleInRing = ring === 0 ? 0 : ((i - startIdx) / countInRing) * Math.PI * 2;
      nodes.push({
        x: cx + Math.cos(angleInRing) * r,
        y: cy + Math.sin(angleInRing) * r,
        r: ring === 0 ? 8 : ring === 1 ? 5 : 3,
        active: false,
        pulse: 0,
        activateAt: rnd(200, 2000),
        ring,
      });
    }
    nodes[0].active = true; // center always active
    nodes[0].activateAt = 0;

    // Connections
    const connections = [];
    nodes.forEach((n, i) => {
      nodes.forEach((m, j) => {
        if (j <= i) return;
        const dx = n.x - m.x, dy = n.y - m.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 160 && Math.random() > 0.35) {
          connections.push({ a: i, b: j, progress: 0, active: false,
            startAt: Math.max(n.activateAt, m.activateAt) + rnd(50, 300) });
        }
      });
    });

    // Counter animation
    let count = 0;
    const counterEl = overlay.querySelector('#vfx-idx-counter');
    const counterInterval = setInterval(() => {
      count = Math.min(count + rndInt(1, 12), 999);
      if (counterEl) counterEl.textContent = String(count).padStart(3, '0');
    }, 80);

    const startTime = performance.now();

    function frame(timestamp) {
      if (!isAnimating) { clearInterval(counterInterval); return; }
      const elapsed = timestamp - startTime;
      ctx.clearRect(0, 0, cv.width, cv.height);

      // Activate nodes over time
      nodes.forEach(n => {
        if (!n.active && elapsed >= n.activateAt) {
          n.active = true;
          n.pulse = 1;
        }
        if (n.active && n.pulse > 0) n.pulse = Math.max(0, n.pulse - 0.025);
      });

      // Activate + draw connections
      connections.forEach(conn => {
        if (!conn.active && elapsed >= conn.startAt) conn.active = true;
        if (conn.active) {
          conn.progress = Math.min(conn.progress + 0.025, 1);
          const na = nodes[conn.a], nb = nodes[conn.b];
          if (!na.active || !nb.active) return;

          // Animated dash flow
          const dashOffset = -(timestamp * 0.05) % 20;
          ctx.save();
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = dashOffset;
          ctx.beginPath();
          ctx.moveTo(na.x, na.y);
          const midX = (na.x + nb.x) / 2 + rnd(-15, 15) * conn.progress;
          const midY = (na.y + nb.y) / 2 + rnd(-5, 5) * conn.progress;
          ctx.quadraticCurveTo(midX, midY, na.x + (nb.x - na.x) * conn.progress, na.y + (nb.y - na.y) * conn.progress);
          ctx.strokeStyle = `${CYAN_A}${0.3 * conn.progress})`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        }
      });

      // Draw nodes
      nodes.forEach(n => {
        if (!n.active) return;
        // Pulse ring
        if (n.pulse > 0) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.r + n.pulse * 20, 0, Math.PI * 2);
          ctx.strokeStyle = `${CYAN_A}${n.pulse * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        // Node fill
        const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.5);
        glow.addColorStop(0, `${CYAN_A}0.8)`);
        glow.addColorStop(1, `${CYAN_A}0)`);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);

    // Cleanup counter when overlay ends
    setTimeout(() => clearInterval(counterInterval), 2800);
  }

  // ═══════════════════════════════════════════════════════════
  //  4. OPERATION LAUNCH — countdown + scan lines + status bars
  // ═══════════════════════════════════════════════════════════
  function playOperationLaunch(opName = 'OPERATION') {
    const overlay = showOverlay(3000);
    const cv = createCanvas(overlay);
    activeCanvas = cv;
    const ctx = cv.getContext('2d');

    const statusLabels = ['PROPULSION', 'GUIDANCE', 'PAYLOAD', 'COMMS', 'CLEARANCE'];

    overlay.innerHTML += `
      <div class="vfx-bracket vfx-bracket-tl"></div>
      <div class="vfx-bracket vfx-bracket-tr"></div>
      <div class="vfx-bracket vfx-bracket-bl"></div>
      <div class="vfx-bracket vfx-bracket-br"></div>
      <div class="vfx-op-launch-panel">
        <div class="vfx-op-title">${opName.toUpperCase()}</div>
        <div class="vfx-op-countdown" id="vfx-countdown">T-05</div>
        <div class="vfx-op-status-list" id="vfx-status-list">
          ${statusLabels.map((l,i) => `<div class="vfx-op-status-row" id="vfx-sr-${i}">
            <div class="vfx-op-status-dot" id="vfx-sd-${i}"></div>
            <span>${l}</span>
            <span class="vfx-op-status-val" id="vfx-sv-${i}">STANDBY</span>
          </div>`).join('')}
        </div>
        <div class="vfx-op-deployed" id="vfx-deployed">OPERATION DEPLOYED</div>
      </div>
      <div class="vfx-flash" id="vfx-flash"></div>
    `;

    // Countdown sequence
    let count = 5;
    const countEl = overlay.querySelector('#vfx-countdown');
    const cdInterval = setInterval(() => {
      count--;
      if (countEl) countEl.textContent = count <= 0 ? 'LAUNCH' : `T-0${count}`;
      if (count <= 0) {
        clearInterval(cdInterval);
        // Show deployed
        const dep = overlay.querySelector('#vfx-deployed');
        if (dep) dep.classList.add('active');
        const flash = overlay.querySelector('#vfx-flash');
        if (flash) flash.classList.add('active');
      }
    }, 350);

    // Status rows lighting up
    statusLabels.forEach((_, i) => {
      setTimeout(() => {
        const dot = overlay.querySelector(`#vfx-sd-${i}`);
        const val = overlay.querySelector(`#vfx-sv-${i}`);
        if (dot) dot.classList.add('active');
        if (val) { val.textContent = 'GO'; val.style.color = CYAN; }
      }, 300 + i * 250);
    });

    const startTime = performance.now();

    function frame(timestamp) {
      if (!isAnimating) return;
      const elapsed = timestamp - startTime;
      ctx.clearRect(0, 0, cv.width, cv.height);

      // Horizontal scan lines sweeping up
      const speed = 180;
      const lineCount = 6;
      for (let i = 0; i < lineCount; i++) {
        const pos = cv.height - ((elapsed * speed / 1000 + i * (cv.height / lineCount)) % cv.height);
        const grad = ctx.createLinearGradient(0, pos - 2, 0, pos + 2);
        grad.addColorStop(0, 'rgba(0,212,255,0)');
        grad.addColorStop(0.5, 'rgba(0,212,255,0.15)');
        grad.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, pos - 2, cv.width, 4);
      }

      // Vertical accent lines
      [0.15, 0.85].forEach(xFrac => {
        const x = cv.width * xFrac;
        const grad2 = ctx.createLinearGradient(0, 0, 0, cv.height);
        const p = (elapsed / 3000);
        grad2.addColorStop(0, 'rgba(0,212,255,0)');
        grad2.addColorStop(Math.max(0, p - 0.05), 'rgba(0,212,255,0)');
        grad2.addColorStop(p, `${CYAN_A}0.4)`);
        grad2.addColorStop(Math.min(1, p + 0.05), 'rgba(0,212,255,0)');
        grad2.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.strokeStyle = grad2;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, cv.height); ctx.stroke();
      });

      animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);

    setTimeout(() => clearInterval(cdInterval), 3000);
  }

  // ═══════════════════════════════════════════════════════════
  //  5. RESEARCH ANALYSIS — magnifier scan + knowledge graph
  // ═══════════════════════════════════════════════════════════
  function playResearchAnalysis(topic = 'DATA') {
    const overlay = showOverlay(2800);
    const cv = createCanvas(overlay);
    activeCanvas = cv;
    const ctx = cv.getContext('2d');
    const cx = cv.width / 2, cy = cv.height / 2;

    overlay.innerHTML += `
      <div class="vfx-bracket vfx-bracket-tl"></div>
      <div class="vfx-bracket vfx-bracket-tr"></div>
      <div class="vfx-bracket vfx-bracket-bl"></div>
      <div class="vfx-bracket vfx-bracket-br"></div>
      <div class="vfx-research-panels">
        <div class="vfx-data-panel vfx-panel-left">
          <div class="vfx-panel-title">DATA STREAMS</div>
          ${Array.from({length:6},(_,i)=>`<div class="vfx-panel-row" style="animation-delay:${i*0.12}s">${Array.from({length:24},()=>pick(HEX_CHARS)).join(' ')}</div>`).join('')}
        </div>
        <div class="vfx-data-panel vfx-panel-right">
          <div class="vfx-panel-title">ANALYSIS VECTORS</div>
          ${Array.from({length:6},(_,i)=>`<div class="vfx-panel-row" style="animation-delay:${i*0.15}s">${Array.from({length:20},()=>pick(DATA_CHARS.split(''))).join('')}</div>`).join('')}
        </div>
      </div>
      <div class="vfx-magnifier-ring"></div>
      <div class="vfx-center-hub">
        <div class="vfx-research-label">ANALYZING</div>
        <div class="vfx-research-topic">${topic.slice(0,24).toUpperCase()}</div>
      </div>
      <div class="vfx-status-line" style="top:82%;left:50%;transform:translateX(-50%)">KNOWLEDGE GRAPH SYNTHESIS IN PROGRESS</div>
    `;

    // Canvas: knowledge graph nodes + scanning magnifier
    const graphNodes = [];
    const graphCount = 18;
    for (let i = 0; i < graphCount; i++) {
      const a = (i / graphCount) * Math.PI * 2;
      const r = rnd(90, 200);
      graphNodes.push({
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        r: rnd(3, 7),
        alpha: 0,
        speed: rnd(0.008, 0.02),
        color: Math.random() > 0.3 ? CYAN : AMBER,
      });
    }

    let magAngle = 0;
    const startTime = performance.now();

    function frame(timestamp) {
      if (!isAnimating) return;
      const elapsed = timestamp - startTime;
      ctx.clearRect(0, 0, cv.width, cv.height);

      // Background radial glow
      const bgGlow = ctx.createRadialGradient(cx, cy, 50, cx, cy, 300);
      bgGlow.addColorStop(0, 'rgba(0,212,255,0.04)');
      bgGlow.addColorStop(1, 'rgba(0,212,255,0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, cv.width, cv.height);

      // Grow graph nodes
      graphNodes.forEach((n, i) => {
        if (elapsed < i * 100) return;
        n.alpha = Math.min(n.alpha + n.speed, 1);

        // Connection to center
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(n.x, n.y);
        ctx.strokeStyle = `rgba(0,212,255,${n.alpha * 0.15})`;
        ctx.lineWidth = 0.75;
        ctx.stroke();

        // Node
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        const c = n.color === CYAN ? CYAN_A : AMB_A;
        ctx.fillStyle = `${c}${n.alpha * 0.6})`;
        ctx.fill();
        ctx.strokeStyle = `${c}${n.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Rotating magnifier ring
      magAngle += 0.03;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(magAngle);
      ctx.strokeStyle = `${CYAN_A}0.35)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 72, 0, Math.PI * 2);
      ctx.stroke();
      // Cross-hair lines
      ctx.setLineDash([]);
      ctx.strokeStyle = `${CYAN_A}0.25)`;
      ctx.lineWidth = 1;
      [0, Math.PI/2, Math.PI, Math.PI*3/2].forEach(a => {
        ctx.beginPath();
        ctx.moveTo(Math.cos(a)*60, Math.sin(a)*60);
        ctx.lineTo(Math.cos(a)*85, Math.sin(a)*85);
        ctx.stroke();
      });
      ctx.restore();

      animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);
  }

  // ═══════════════════════════════════════════════════════════
  //  BRIEFING GENERATION VFX (P7)
  // ═══════════════════════════════════════════════════════════
  function playBriefingGeneration(title) {
    cleanup();
    show();
    const start = performance.now();
    const duration = 2400;

    function frame(now) {
      const t = (now - start) / duration;
      if (t > 1) { cleanup(); return; }

      ctx.clearRect(-W/2, -H/2, W, H);
      drawScanlines(t);

      // Pulsing data streams
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + t * 2;
        const r = 60 + Math.sin(t * 4 + i) * 30;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        const alpha = 0.3 + Math.sin(t * 6 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `${CYAN_A}${alpha})`;
        ctx.fill();
        // Connect lines
        if (i > 0) {
          const prevAngle = ((i-1) / 12) * Math.PI * 2 + t * 2;
          const prevR = 60 + Math.sin(t * 4 + i - 1) * 30;
          ctx.beginPath();
          ctx.moveTo(Math.cos(prevAngle) * prevR, Math.sin(prevAngle) * prevR);
          ctx.lineTo(x, y);
          ctx.strokeStyle = `${CYAN_A}${alpha * 0.5})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // Center label
      ctx.fillStyle = `${CYAN_A}${Math.min(1, t * 3)})`;
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('GENERATING BRIEFING', 0, -8);
      ctx.font = `11px ${FONT}`;
      ctx.fillStyle = `${CYAN_A}0.6)`;
      ctx.fillText(title.toUpperCase().slice(0, 30), 0, 12);

      animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);
  }

  // ═══════════════════════════════════════════════════════════
  //  PARALLEL OPS VFX (P5)
  // ═══════════════════════════════════════════════════════════
  function playParallelOps(groupName) {
    cleanup();
    show();
    const start = performance.now();
    const duration = 2000;

    function frame(now) {
      const t = (now - start) / duration;
      if (t > 1) { cleanup(); return; }

      ctx.clearRect(-W/2, -H/2, W, H);
      drawScanlines(t);

      // Multiple parallel streams
      for (let lane = 0; lane < 4; lane++) {
        const y = -30 + lane * 20;
        const streamLen = 80 + lane * 20;
        const x = -streamLen / 2 + t * streamLen * 1.5;
        // Particle stream
        for (let p = 0; p < 8; p++) {
          const px = x - p * 10 + Math.sin(t * 8 + p + lane) * 3;
          const alpha = Math.max(0, 0.8 - p * 0.1);
          ctx.beginPath();
          ctx.arc(px, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `${CYAN_A}${alpha})`;
          ctx.fill();
        }
        // Lane line
        ctx.beginPath();
        ctx.moveTo(-streamLen/2, y);
        ctx.lineTo(streamLen/2, y);
        ctx.strokeStyle = `${CYAN_A}0.15)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = `${CYAN_A}${Math.min(1, t * 3)})`;
      ctx.font = `bold 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('PARALLEL EXECUTION', 0, 50);
      ctx.font = `10px ${FONT}`;
      ctx.fillStyle = `${CYAN_A}0.5)`;
      ctx.fillText(groupName.toUpperCase().slice(0, 30), 0, 66);

      animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);
  }

  // ═══════════════════════════════════════════════════════════
  //  SENTIMENT PULSE VFX (P4)
  // ═══════════════════════════════════════════════════════════
  function playSentimentPulse(sentiment) {
    cleanup();
    show();
    const start = performance.now();
    const duration = 1200;
    const colors = {
      positive: 'rgba(16,185,129,',
      negative: 'rgba(239,68,68,',
      neutral: 'rgba(100,116,139,',
      excited: 'rgba(245,158,11,',
    };
    const color = colors[sentiment] || colors.neutral;

    function frame(now) {
      const t = (now - start) / duration;
      if (t > 1) { cleanup(); return; }

      ctx.clearRect(-W/2, -H/2, W, H);
      // Expanding rings
      for (let i = 0; i < 3; i++) {
        const ringT = Math.max(0, t - i * 0.15);
        if (ringT <= 0) continue;
        const r = ringT * 80;
        const alpha = Math.max(0, 0.6 - ringT * 0.6);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}${alpha})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      animFrame = requestAnimationFrame(frame);
    }
    animFrame = requestAnimationFrame(frame);
  }

  // ═══════════════════════════════════════════════════════════
  //  PUBLIC API
  // ═══════════════════════════════════════════════════════════
  return {
    processing: (label) => playDataProcessing(label || 'PROCESSING'),
    projectInit: (name) => playProjectInit(name || 'NEW PROJECT'),
    memoryIndex: () => playMemoryIndex(),
    operationLaunch: (name) => playOperationLaunch(name || 'OPERATION'),
    researchAnalysis: (topic) => playResearchAnalysis(topic || 'DATA'),
    briefingGeneration: (title) => playBriefingGeneration(title || 'INTELLIGENCE'),
    parallelOps: (name) => playParallelOps(name || 'PARALLEL GROUP'),
    sentimentPulse: (sentiment) => playSentimentPulse(sentiment || 'neutral'),
    stop: cleanup,
  };

})();

// Make globally accessible
window.CinematicVFX = CinematicVFX;
