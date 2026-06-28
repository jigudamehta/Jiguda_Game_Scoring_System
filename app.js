/**
 * ============================================================
 *  GAME SCORING SYSTEM — Global State, Router & Core Logic
 * ============================================================
 */

// ─── Optional Hardcoded Web App URL ──────────────────────────
// Paste your deployed Google Apps Script Web App URL below if you want it hardcoded!
const HARDCODED_GAS_URL = 'https://script.google.com/macros/s/AKfycbyGYZDs8pYhB7x3ii9Ae0pLbvaGZLaDt4c_YErQGSPNG_i53bpCl-ckvxYMKSCulOPFLw/exec'; 

// ─── Global State ────────────────────────────────────────────
const STATE = {
  gasUrl: '',
  settings: {},
  players: [],
  teams: [],
  teamMembers: [],
  scores: [],
  scoreboard: [],
  finals: [],
  eventLog: [],
  isAdmin: false,
  isOnline: true,
  isDarkMode: true,
  isProjector: false,
  currentPage: 'dashboard',
  currentGame: 1,
  currentRound: 1,
  currentSubRound: 'A',
  timerSeconds: 60,
  timerRunning: false,
  timerInterval: null,
  timerMax: 60,
  pendingUploads: [],   // offline queue
  undoStack: [],        // 5-step undo
  lastRefresh: 0,
  autoRefreshInterval: null,
};

// ─── Offline Queue / Local Cache ─────────────────────────────
const CACHE = {
  save(key, data) {
    try { localStorage.setItem('gss_' + key, JSON.stringify({ data, ts: Date.now() })); } catch (_) {}
  },
  load(key) {
    try {
      const item = localStorage.getItem('gss_' + key);
      if (!item) return null;
      return JSON.parse(item).data;
    } catch (_) { return null; }
  },
  loadFull(key) {
    try {
      const item = localStorage.getItem('gss_' + key);
      if (!item) return null;
      return JSON.parse(item);
    } catch (_) { return null; }
  },
  clear(key) { localStorage.removeItem('gss_' + key); },
  saveQueue(queue) { this.save('pendingQueue', queue); },
  loadQueue() { return this.load('pendingQueue') || []; },
};

// ─── API Layer ───────────────────────────────────────────────
const API = {
  async get(action, params = {}) {
    if (!STATE.gasUrl) throw new Error('GAS URL not configured');
    const qs = new URLSearchParams({ action, ...params }).toString();
    const url = `${STATE.gasUrl}?${qs}`;
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  async post(action, data = {}) {
    if (!STATE.gasUrl) throw new Error('GAS URL not configured');
    const body = JSON.stringify({ action, ...data });
    const res = await fetch(STATE.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  },

  // Safe versions with offline fallback
  async safeGet(action, params, cacheKey) {
    try {
      const data = await this.get(action, params);
      if (cacheKey) CACHE.save(cacheKey, data);
      return data;
    } catch (err) {
      if (cacheKey) {
        const cached = CACHE.load(cacheKey);
        if (cached) { setOnlineStatus(false); return cached; }
      }
      throw err;
    }
  },

  async safePost(action, data, cacheKey) {
    if (!STATE.gasUrl) {
      // Offline / local preview mode without backend URL configured yet
      return { success: true, localOnly: true };
    }
    if (!STATE.isOnline) {
      STATE.pendingUploads.push({ action, data, ts: Date.now() });
      CACHE.saveQueue(STATE.pendingUploads);
      Toast.warning('Offline — action queued, will sync when back online');
      return { success: true, offline: true };
    }
    try {
      const result = await this.post(action, data);
      if (cacheKey) CACHE.clear(cacheKey);
      return result;
    } catch (err) {
      console.warn('API post failed, queuing offline action:', err);
      STATE.pendingUploads.push({ action, data, ts: Date.now() });
      CACHE.saveQueue(STATE.pendingUploads);
      Toast.warning('Save queued — will retry when connection restored');
      return { success: true, offline: true };
    }
  }
};

// ─── Online/Offline Detection ────────────────────────────────
function setOnlineStatus(online) {
  STATE.isOnline = online;
  const banner = document.getElementById('offline-banner');
  if (banner) banner.classList.toggle('visible', !online);
  if (online) syncPendingQueue();
}

async function syncPendingQueue() {
  const queue = [...STATE.pendingUploads];
  if (queue.length === 0) return;
  let synced = 0;
  for (const item of queue) {
    try {
      await API.post(item.action, item.data);
      synced++;
    } catch (_) { break; }
  }
  STATE.pendingUploads = STATE.pendingUploads.slice(synced);
  CACHE.saveQueue(STATE.pendingUploads);
  if (synced > 0) Toast.success(`Synced ${synced} offline action(s)`);
}

window.addEventListener('online',  () => setOnlineStatus(true));
window.addEventListener('offline', () => setOnlineStatus(false));

// ─── Toast Notifications ─────────────────────────────────────
const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  success: (m, d) => Toast.show(m, 'success', d),
  error:   (m, d) => Toast.show(m, 'error', d),
  warning: (m, d) => Toast.show(m, 'warning', d),
  info:    (m, d) => Toast.show(m, 'info', d),
};

// ─── Modal System ─────────────────────────────────────────────
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('hidden'); document.body.style.overflow = ''; }
  },
  closeAll() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    document.body.style.overflow = '';
  },
  confirm(message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal" style="max-width:400px">
          <div class="modal-title">⚠️ Confirm</div>
          <div class="modal-body"><p>${message}</p></div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="mc-cancel">Cancel</button>
            <button class="btn btn-danger"    id="mc-ok">Confirm</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#mc-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
      overlay.querySelector('#mc-ok').addEventListener('click',     () => { overlay.remove(); resolve(true); });
    });
  }
};

// Close modals on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) Modal.closeAll();
});

// ─── Router ───────────────────────────────────────────────────
const PAGES = {
  dashboard:        { icon: '🏠', label: 'Dashboard',       init: () => initDashboard() },
  'team-generator': { icon: '🎭', label: 'Team Generator',  init: () => initTeamGenerator() },
  'score-entry':    { icon: '📊', label: 'Score Entry',     init: () => initScoreEntry() },
  scoreboard:       { icon: '🏆', label: 'Live Scoreboard', init: () => initScoreboard() },
  finals:           { icon: '🎖️', label: 'Finals',          init: () => initFinals() },
  timer:            { icon: '⏱️', label: 'Timer',            init: () => initTimerPage() },
  reports:          { icon: '📋', label: 'Reports',          init: () => initReports() },
  settings:         { icon: '⚙️', label: 'Settings',         init: () => initSettings() },
  'quiz-admin':     { icon: '📢', label: 'Quiz Admin',       init: () => initQuizAdmin() },
};

// ─── Page Transition Progress Bar ────────────────────────────
let _navBarTimer = null;
function showNavProgress() {
  let bar = document.getElementById('nav-progress-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'nav-progress-bar';
    bar.style.cssText = `
      position:fixed;top:0;left:0;height:3px;width:0%;
      background:linear-gradient(90deg,var(--gold-400),var(--purple-400,#a855f7));
      z-index:99999;transition:width 0.3s ease;border-radius:0 2px 2px 0;
      box-shadow:0 0 8px var(--gold-400);pointer-events:none;`;
    document.body.appendChild(bar);
  }
  bar.style.width = '0%';
  bar.style.opacity = '1';
  clearTimeout(_navBarTimer);
  // Animate to 80% quickly, hold, complete on done
  requestAnimationFrame(() => { bar.style.width = '70%'; });
}
function finishNavProgress() {
  const bar = document.getElementById('nav-progress-bar');
  if (!bar) return;
  bar.style.width = '100%';
  _navBarTimer = setTimeout(() => {
    bar.style.opacity = '0';
    setTimeout(() => { bar.style.width = '0%'; bar.style.opacity = '1'; }, 300);
  }, 200);
}

function navigate(pageId) {
  if (!PAGES[pageId]) return;

  // Admin-only pages — redirect to settings to activate
  const adminPages = ['team-generator', 'score-entry', 'finals', 'reports', 'quiz-admin'];
  if (adminPages.includes(pageId) && !STATE.isAdmin) {
    Toast.warning('Admin access required. Activate in Settings ⚙️');
    pageId = 'settings';
  }

  // Show top progress bar immediately
  showNavProgress();

  // Deactivate current
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(l => l.classList.remove('active'));

  // Activate target
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');

  document.querySelectorAll(`[data-nav="${pageId}"]`).forEach(el => el.classList.add('active'));

  // Update topbar title
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = PAGES[pageId]?.label || pageId;

  STATE.currentPage = pageId;

  // Init page (guarded — an error here won't break navigation)
  const initResult = (() => {
    try {
      if (PAGES[pageId]?.init) return PAGES[pageId].init();
    } catch (err) {
      console.error(`Page init error [${pageId}]:`, err);
      const pg = document.getElementById(`page-${pageId}`);
      if (pg) pg.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">Page Error</div>
        <div class="empty-state-text" style="color:var(--error)">${err.message}</div>
        <button class="btn btn-secondary" style="margin-top:var(--space-4)" onclick="navigate('dashboard')">← Dashboard</button>
      </div>`;
    }
  })();

  // If the init returned a Promise, finish the progress bar when it resolves
  if (initResult && typeof initResult.then === 'function') {
    initResult.finally(() => finishNavProgress());
  } else {
    finishNavProgress();
  }

  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('mobile-open');

  // Update URL hash
  history.pushState(null, '', '#' + pageId);
}

// Handle back/forward
window.addEventListener('popstate', () => {
  const hash = location.hash.replace('#', '') || 'dashboard';
  navigate(hash);
});

// ─── Admin Session ────────────────────────────────────────────
function activateAdmin(password) {
  const storedPass = STATE.settings.ADMIN_PASSWORD || 'admin123';
  if (password && password === storedPass) {
    STATE.isAdmin = true;
    sessionStorage.setItem('gss_admin', '1');
    updateAdminUI();
    Toast.success('Admin mode activated');
    return true;
  }
  Toast.error('Incorrect password');
  return false;
}

function deactivateAdmin() {
  STATE.isAdmin = false;
  sessionStorage.removeItem('gss_admin');
  updateAdminUI();
  Toast.info('Admin mode deactivated');
}

function checkAdminSession() {
  if (sessionStorage.getItem('gss_admin') === '1') {
    STATE.isAdmin = true;
    updateAdminUI();
  }
}

function updateAdminUI() {
  const indicator = document.getElementById('admin-indicator');
  if (indicator) {
    if (STATE.isAdmin) {
      indicator.className = 'admin-indicator';
      indicator.innerHTML = '<span>🔓</span><span>Admin Active</span>';
    } else {
      indicator.className = 'admin-indicator inactive';
      indicator.innerHTML = '<span>🔒</span><span>Viewer Mode</span>';
    }
  }
  // Show/hide admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = STATE.isAdmin ? '' : 'none';
  });
  // Update topbar admin button
  const adminBtn = document.getElementById('admin-quick-btn');
  if (adminBtn) {
    adminBtn.textContent = STATE.isAdmin ? '🔓 Admin' : '🔒 Admin';
    adminBtn.title = STATE.isAdmin ? 'Click to deactivate admin' : 'Click to activate admin';
  }
  // Toggle Quick Score FAB via body class
  document.body.classList.toggle('admin-active', STATE.isAdmin);
}


// ─── Dark/Light Mode ──────────────────────────────────────────
function setTheme(dark) {
  STATE.isDarkMode = dark;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('gss_theme', dark ? 'dark' : 'light');
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  });
}

function toggleTheme() { setTheme(!STATE.isDarkMode); }

// ─── Projector Mode ───────────────────────────────────────────
function setProjector(on) {
  STATE.isProjector = on;
  document.documentElement.setAttribute('data-projector', on ? 'true' : 'false');
  document.querySelectorAll('.projector-toggle').forEach(btn => {
    btn.textContent = on ? '🖥️' : '📽️';
    btn.title = on ? 'Exit Projector Mode' : 'Projector Mode';
  });
}

function toggleProjector() { setProjector(!STATE.isProjector); }

// ─── Timer Engine ─────────────────────────────────────────────
const Timer = {
  init(seconds) {
    Timer.stop();
    STATE.timerSeconds = seconds;
    STATE.timerMax = seconds;
    Timer.updateDisplay();
  },

  start() {
    if (STATE.timerRunning || STATE.timerSeconds <= 0) return;
    STATE.timerRunning = true;
    document.getElementById('timer-fab')?.classList.add('running');
    STATE.timerInterval = setInterval(() => {
      if (STATE.timerSeconds <= 0) { Timer.finish(); return; }
      STATE.timerSeconds--;
      Timer.updateDisplay();
      const warnSec = Number(STATE.settings.LAST_SEC_WARN || 10);
      if (STATE.timerSeconds <= warnSec) Timer.setWarning(true);
      if (STATE.timerSeconds === 0) Timer.finish();
    }, 1000);
  },

  stop() {
    STATE.timerRunning = false;
    clearInterval(STATE.timerInterval);
    document.getElementById('timer-fab')?.classList.remove('running', 'warning');
    Timer.setWarning(false);
  },

  reset() {
    Timer.stop();
    STATE.timerSeconds = STATE.timerMax;
    Timer.updateDisplay();
  },

  finish() {
    Timer.stop();
    Sound.play('timer_end');
    Timer.setWarning(false);
    // Flash screen
    const flash = document.createElement('div');
    flash.style.cssText = 'position:fixed;inset:0;background:rgba(231,76,60,0.3);pointer-events:none;z-index:9997;animation:fadeIn 0.1s ease';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 600);
    Toast.warning('⏱️ Time is up!');
  },

  setWarning(on) {
    const fab  = document.getElementById('timer-fab');
    const disp = document.getElementById('timer-main-display');
    if (on) {
      fab?.classList.add('warning');
      disp?.classList.add('warning');
    } else {
      fab?.classList.remove('warning');
      disp?.classList.remove('warning');
    }
  },

  updateDisplay() {
    const m = Math.floor(STATE.timerSeconds / 60);
    const s = STATE.timerSeconds % 60;
    const str = m > 0 ? `${m}:${String(s).padStart(2,'0')}` : String(s);
    const fab  = document.getElementById('timer-fab-time');
    const disp = document.getElementById('timer-main-display');
    if (fab)  fab.textContent  = str;
    if (disp) disp.textContent = str;
    // Update progress
    const pct = STATE.timerMax > 0 ? (STATE.timerSeconds / STATE.timerMax) : 0;
    const ring = document.getElementById('timer-progress-ring');
    if (ring) {
      const circ = 2 * Math.PI * 140;
      ring.style.strokeDashoffset = circ * (1 - pct);
    }
  },

  loadFromSettings(game, round) {
    const mode = STATE.settings.TIMER_MODE || 'global';
    let seconds = Number(STATE.settings.DEFAULT_TIMER || 60);
    if (mode === 'round' || mode === 'game_round' || mode === 'settings') {
      const roundKey = `TIMER_G${game}_R${round}`;
      const roundSec = STATE.settings[roundKey];
      if (roundSec) seconds = Number(roundSec);
    }
    Timer.init(seconds);
  }
};

// ─── Sound Engine ─────────────────────────────────────────────
const Sound = {
  ctx: null,
  buffers: {},

  getCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    return this.ctx;
  },

  // Play built-in synthesized sounds
  playBuiltin(name) {
    if (!STATE.settings.SOUND_ON || STATE.settings.SOUND_ON === 'false') return;
    const ctx = this.getCtx();

    const presets = {
      correct: () => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(523, ctx.currentTime);
        o.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        o.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.start(); o.stop(ctx.currentTime + 0.5);
      },
      wrong: () => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, ctx.currentTime);
        o.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        o.start(); o.stop(ctx.currentTime + 0.3);
      },
      timer_end: () => {
        [523, 494, 440, 392].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq;
          g.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
          o.start(ctx.currentTime + i * 0.12);
          o.stop(ctx.currentTime + i * 0.12 + 0.3);
        });
      },
      winner: () => {
        [523, 659, 784, 1047, 1319].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq;
          o.type = 'triangle';
          g.gain.setValueAtTime(0, ctx.currentTime + i * 0.1);
          g.gain.linearRampToValueAtTime(0.4, ctx.currentTime + i * 0.1 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.5);
          o.start(ctx.currentTime + i * 0.1);
          o.stop(ctx.currentTime + i * 0.1 + 0.5);
        });
      },
      applause: () => {
        for (let i = 0; i < 20; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const f = ctx.createBiquadFilter();
          o.connect(f); f.connect(g); g.connect(ctx.destination);
          o.type = 'sawtooth';
          o.frequency.value = 200 + Math.random() * 3000;
          f.type = 'bandpass';
          f.frequency.value = 2000 + Math.random() * 3000;
          const t = ctx.currentTime + Math.random() * 2;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.02, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          o.start(t); o.stop(t + 0.08);
        }
      },
      confetti: () => {
        [800, 1000, 1200].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq;
          o.type = 'sine';
          const t = ctx.currentTime + i * 0.08;
          g.gain.setValueAtTime(0.2, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          o.start(t); o.stop(t + 0.2);
        });
      },
      bonus: () => {
        [659, 784, 1047].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = freq;
          const t = ctx.currentTime + i * 0.1;
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          o.start(t); o.stop(t + 0.3);
        });
      },
      team_assigned: () => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(440, ctx.currentTime);
        o.frequency.setValueAtTime(550, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.3, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.start(); o.stop(ctx.currentTime + 0.4);
      }
    };

    try { if (presets[name]) presets[name](); } catch (_) {}
  },

  async playDriveFile(url) {
    if (!url) return;
    // Convert Drive link to direct audio
    const id = url.match(/[-\w]{25,}/)?.[0];
    if (!id) return;
    const directUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    try {
      const audio = new Audio(directUrl);
      audio.volume = 0.8;
      await audio.play();
    } catch (_) {}
  },

  play(name) {
    if (!STATE.settings.SOUND_ON || STATE.settings.SOUND_ON === 'false') return;
    const driveKeyMap = {
      correct:      'SOUND_CORRECT',
      wrong:        'SOUND_WRONG',
      timer_end:    'SOUND_TIMER_END',
      winner:       'SOUND_WINNER',
      applause:     'SOUND_APPLAUSE',
      confetti:     'SOUND_CONFETTI',
      bonus:        'SOUND_BONUS',
      team_assigned:'SOUND_TEAM',
    };
    const driveKey = driveKeyMap[name];
    const driveUrl = driveKey && STATE.settings[driveKey];
    if (driveUrl) {
      this.playDriveFile(driveUrl);
    } else {
      this.playBuiltin(name);
    }
  }
};

// ─── Confetti Engine ──────────────────────────────────────────
const Confetti = {
  particles: [],
  canvas: null,
  ctx: null,
  running: false,
  colors: ['#FFD700','#FF6B6B','#4CAF50','#2196F3','#FF9800','#9C27B0','#00BCD4','#F5A623'],

  init() {
    this.canvas = document.getElementById('confetti-canvas');
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d');
    window.addEventListener('resize', () => {
      this.canvas.width  = window.innerWidth;
      this.canvas.height = window.innerHeight;
    });
  },

  burst(count = 120) {
    if (!STATE.settings.CONFETTI_ON || STATE.settings.CONFETTI_ON === 'false') return;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * window.innerWidth,
        y: -20,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 4 + 2,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
        life: 1,
        decay: Math.random() * 0.008 + 0.002
      });
    }
    if (!this.running) this.animate();
  },

  animate() {
    if (!this.ctx) return;
    this.running = true;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.1; // gravity
      p.vx *= 0.99;
      p.rotation += p.rotSpeed;
      p.life -= p.decay;
      if (p.life <= 0 || p.y > this.canvas.height) return false;
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size/2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
      return true;
    });
    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.running = false;
    }
  }
};

// ─── Fireworks Engine ─────────────────────────────────────────
const Fireworks = {
  particles: [],
  canvas: null,
  ctx: null,
  running: false,
  intervalId: null,

  init() {
    this.canvas = document.getElementById('fireworks-canvas');
    if (!this.canvas) return;
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx = this.canvas.getContext('2d');
  },

  launch() {
    if (!STATE.settings.CONFETTI_ON || STATE.settings.CONFETTI_ON === 'false') return;
    const colors = ['#FFD700','#FF4444','#44FF44','#4444FF','#FF44FF','#44FFFF','#FF8800'];
    const cx = Math.random() * window.innerWidth;
    const cy = Math.random() * window.innerHeight * 0.5 + 50;
    for (let i = 0; i < 80; i++) {
      const angle = (Math.PI * 2 / 80) * i;
      const speed = Math.random() * 5 + 2;
      this.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 4 + 2,
        life: 1,
        decay: Math.random() * 0.015 + 0.008
      });
    }
    if (!this.running) this.animate();
  },

  animate() {
    if (!this.ctx) return;
    this.running = true;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.05;
      p.vx *= 0.98;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return true;
    });
    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.animate());
    } else {
      this.running = false;
    }
  },

  startShow(duration = 8000) {
    this.launch();
    this.intervalId = setInterval(() => this.launch(), 600);
    setTimeout(() => this.stopShow(), duration);
  },

  stopShow() {
    clearInterval(this.intervalId);
  }
};

// ─── Data Loaders ─────────────────────────────────────────────
async function loadAllData() {
  const gasUrl = (typeof HARDCODED_GAS_URL !== 'undefined' && HARDCODED_GAS_URL) || STATE.settings.GAS_URL || CACHE.load('gasUrl');
  if (!gasUrl) return;
  STATE.gasUrl = gasUrl;

  const loaders = [
    API.safeGet('players',    {}, 'players'),
    API.safeGet('teams',      {}, 'teams'),
    API.safeGet('scoreboard', {}, 'scoreboard'),
    API.safeGet('team_members', {}, 'team_members'),
  ];
  try {
    const [pd, td, sb, tm] = await Promise.all(loaders);
    if (pd?.players)    STATE.players     = pd.players;
    if (td?.teams)      STATE.teams       = td.teams;
    if (sb?.scoreboard) STATE.scoreboard  = sb.scoreboard;
    if (tm?.members)    STATE.teamMembers = tm.members;
  } catch (err) {
    console.warn('Data load error:', err);
  }
}

async function loadSettings() {
  // 1. Instant Cache Load (synchronously populates settings to prevent default password fallbacks)
  const cached = CACHE.load('settings');
  if (cached?.settings) {
    STATE.settings = cached.settings;
  }

  const gasUrl = (typeof HARDCODED_GAS_URL !== 'undefined' && HARDCODED_GAS_URL) || localStorage.getItem('gss_gasUrl') || '';
  STATE.gasUrl = gasUrl;
  if (!gasUrl) return;

  // 2. Fetch fresh settings in background (updates STATE and caches it)
  try {
    const data = await API.safeGet('settings', {}, 'settings');
    if (data?.settings) {
      STATE.settings = data.settings;
      CACHE.save('settings', data);
    }
  } catch (err) {
    console.warn('Network settings load failed, using cached values:', err);
  }
}

// ─── Sidebar Toggle ───────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

// ─── App Initialization ───────────────────────────────────────
async function initApp() {
  // Theme
  const savedTheme = localStorage.getItem('gss_theme') || 'dark';
  setTheme(savedTheme === 'dark');

  // Offline queue
  STATE.pendingUploads = CACHE.loadQueue();

  // Load settings first
  await loadSettings();

  // Check admin session
  checkAdminSession();

  // Timer init
  Timer.init(Number(STATE.settings.DEFAULT_TIMER || 60));

  // Confetti + Fireworks init
  Confetti.init();
  Fireworks.init();

  // Load all data
  await loadAllData();

  // Navigate to initial page
  const hash = location.hash.replace('#', '') || 'dashboard';
  navigate(hash);

  // Auto-refresh for scoreboard
  const refreshSec = Number(STATE.settings.AUTO_REFRESH_SEC || 30) * 1000;
  STATE.autoRefreshInterval = setInterval(() => {
    if (STATE.currentPage === 'scoreboard') initScoreboard();
  }, refreshSec);

  // Update admin UI
  updateAdminUI();

  // Update sidebar event name + status
  const nameEl   = document.getElementById('sidebar-event-name');
  const statusEl = document.getElementById('sidebar-status');
  if (nameEl)   nameEl.textContent   = STATE.settings.EVENT_NAME || 'Game Scoring';
  if (statusEl) statusEl.textContent = (STATE.settings.CURRENT_STATUS || 'setup').toUpperCase();
}

// ─── Helpers ──────────────────────────────────────────────────
function getSetting(key, fallback = '') {
  return STATE.settings[key] !== undefined ? STATE.settings[key] : fallback;
}

function getTeamColor(teamId) {
  const team = STATE.teams.find(t => t.TeamID === teamId);
  return team?.Color || '#7B3FA0';
}

function getTeamName(teamId) {
  const team = STATE.teams.find(t => t.TeamID === teamId);
  return team?.TeamName || teamId;
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function teamInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function scoreClass(score) {
  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'zero';
}

function rankBadgeClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return 'other';
}

function rankMoveIcon(move) {
  if (move === 'up')   return '▲';
  if (move === 'down') return '▼';
  return '—';
}

// ─── Quick Score Panel ────────────────────────────────────────
const QS = {
  selectedTeam: null,
  step: 'team',  // 'team' | 'score'

  open() {
    if (!STATE.isAdmin) { Toast.warning('Admin mode required'); return; }
    this.selectedTeam = null;
    this.step = 'team';
    this._populateContextSelectors();
    this._renderTeamStep();
    document.getElementById('quick-score-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  },

  close() {
    document.getElementById('quick-score-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  },

  _populateContextSelectors() {
    const numGames  = Number(STATE.settings.NUM_GAMES        || 3);
    const numRounds = Number(STATE.settings.ROUNDS_PER_GAME  || 3);
    const numSub    = Number(STATE.settings.SUB_ROUNDS       || 2);
    const gameEl  = document.getElementById('qs-game');
    const rndEl   = document.getElementById('qs-round');
    const subEl   = document.getElementById('qs-sub');
    if (gameEl) gameEl.innerHTML  = Array.from({length: numGames},  (_, i) => `<option value="${i+1}" ${STATE.currentGame===i+1?'selected':''}>G${i+1}</option>`).join('');
    if (rndEl)  rndEl.innerHTML   = Array.from({length: numRounds}, (_, i) => `<option value="${i+1}" ${STATE.currentRound===i+1?'selected':''}>R${i+1}</option>`).join('');
    if (subEl) {
      const labels = Array.from({length: numSub}, (_, i) => String.fromCharCode(65+i));
      subEl.innerHTML = labels.map(l => `<option value="${l}" ${STATE.currentSubRound===l?'selected':''}>${l}</option>`).join('');
    }
  },

  onContextChange() {
    STATE.currentGame     = Number(document.getElementById('qs-game')?.value  || 1);
    STATE.currentRound    = Number(document.getElementById('qs-round')?.value || 1);
    STATE.currentSubRound = document.getElementById('qs-sub')?.value || 'A';
  },

  _renderTeamStep() {
    const body = document.getElementById('qs-body');
    if (!body) return;
    if (STATE.teams.length === 0) {
      body.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
        <div style="font-size:48px;margin-bottom:16px">🎭</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px">No teams yet</div>
        <div style="font-size:13px">Set up teams in the Team Generator first.</div></div>`;
      return;
    }
    const teamHtml = STATE.teams.map(t => {
      const teamTotal = (STATE.scores || [])
        .filter(s => s.TeamID === t.TeamID && s.Voided !== 'Yes')
        .reduce((acc, s) => acc + (Number(s.Total) || 0), 0);
      const isSel = this.selectedTeam?.TeamID === t.TeamID;
      return `<button class="qs-team-btn ${isSel ? 'selected' : ''}"
          style="--team-color:${t.Color};border-color:${isSel ? t.Color : 'transparent'}"
          onclick="QS.selectTeam('${t.TeamID}')">
          <div class="qs-team-avatar" style="background:${t.Color};box-shadow:0 4px 16px ${t.Color}44">${teamInitials(t.TeamName)}</div>
          <div class="qs-team-name">${t.TeamName}</div>
          <div class="qs-team-score">${teamTotal >= 0 ? '+' : ''}${teamTotal} pts</div>
        </button>`;
    }).join('');
    body.innerHTML = `<div>
      <div class="qs-step-label">Step 1 of 2 — Tap a team to score</div>
      <div class="qs-team-grid">${teamHtml}</div></div>`;
  },

  selectTeam(teamId) {
    this.selectedTeam = STATE.teams.find(t => t.TeamID === teamId);
    if (!this.selectedTeam) return;
    this.step = 'score';
    this._renderScoreStep();
  },

  _renderScoreStep() {
    const body = document.getElementById('qs-body');
    if (!body) return;
    const t   = this.selectedTeam;
    const pos = Number(STATE.settings.POSITIVE_MARKS || 10);
    const neg = Number(STATE.settings.NEGATIVE_MARKS || 5);
    const bon = Number(STATE.settings.BONUS_MARKS    || 5);
    const pen = Number(STATE.settings.PENALTY_MARKS  || 5);
    body.innerHTML = `<div class="qs-score-panel">
      <div class="qs-step-label">Step 2 of 2 — Choose score for this team</div>
      <div class="qs-selected-team-header">
        <div class="qs-team-avatar" style="background:${t.Color};box-shadow:0 4px 16px ${t.Color}44;width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;color:white;flex-shrink:0">${teamInitials(t.TeamName)}</div>
        <div>
          <div class="qs-selected-label">Scoring for</div>
          <div class="qs-selected-name" style="color:${t.Color}">${t.TeamName}</div>
        </div>
        <button class="qs-change-btn" onclick="QS.backToTeams()">← Change Team</button>
      </div>

      <div class="qs-preset-section">
        <div class="qs-preset-title">✅ Correct / Positive</div>
        <div class="qs-preset-row">
          <button class="qs-preset-btn pos" onclick="QS.quickSave({Positive:${pos}})">+${pos}<span class="qs-preset-sub">Standard</span></button>
          <button class="qs-preset-btn pos" onclick="QS.quickSave({Positive:${pos*2}})">+${pos*2}<span class="qs-preset-sub">Double</span></button>
          <button class="qs-preset-btn bonus" onclick="QS.quickSave({Bonus:${bon}})">+${bon}<span class="qs-preset-sub">Bonus ★</span></button>
        </div>
      </div>

      <div class="qs-preset-section">
        <div class="qs-preset-title">❌ Wrong / Penalty</div>
        <div class="qs-preset-row">
          <button class="qs-preset-btn neg" onclick="QS.quickSave({Negative:${neg}})">−${neg}<span class="qs-preset-sub">Wrong</span></button>
          <button class="qs-preset-btn pen" onclick="QS.quickSave({Penalty:${pen}})">−${pen}<span class="qs-preset-sub">Penalty</span></button>
          <button class="qs-preset-btn neg" onclick="QS.quickSave({Negative:${neg},Penalty:${pen}})">−${neg+pen}<span class="qs-preset-sub">Both</span></button>
        </div>
      </div>

      <div class="qs-preset-section">
        <div class="qs-preset-title">✏️ Custom Score</div>
        <div class="qs-custom-row">
          <select id="qs-custom-type">
            <option value="Positive">+Positive</option>
            <option value="Negative">−Negative</option>
            <option value="Bonus">★ Bonus</option>
            <option value="Penalty">⚠ Penalty</option>
            <option value="Adjustment">± Adjust</option>
          </select>
          <input type="number" id="qs-custom-val" value="${pos}" min="0" step="1" onclick="this.select()">
          <button class="qs-custom-save" onclick="QS.saveCustom()">Save ✓</button>
        </div>
      </div>
    </div>`;
  },

  backToTeams() {
    this.step = 'team';
    this._renderTeamStep();
  },

  async quickSave(scoreData) {
    if (!this.selectedTeam || !STATE.isAdmin) return;
    const pos = Number(scoreData.Positive   || 0);
    const neg = Number(scoreData.Negative   || 0);
    const bon = Number(scoreData.Bonus      || 0);
    const pen = Number(scoreData.Penalty    || 0);
    const adj = Number(scoreData.Adjustment || 0);
    const total = pos - neg + bon - pen + adj;
    await this._doSave({ Positive:pos, Negative:neg, Bonus:bon, Penalty:pen, Adjustment:adj }, total);
    const panel = document.querySelector('.qs-score-panel');
    if (panel) panel.classList.add('qs-save-flash');
    setTimeout(() => { if (panel) panel.classList.remove('qs-save-flash'); this.backToTeams(); }, 650);
  },

  async saveCustom() {
    const type = document.getElementById('qs-custom-type')?.value;
    const val  = Math.abs(Number(document.getElementById('qs-custom-val')?.value || 0));
    if (!type || val === 0) { Toast.warning('Enter a value > 0'); return; }
    const sd = { Positive:0, Negative:0, Bonus:0, Penalty:0, Adjustment:0 };
    sd[type] = val;
    const total = sd.Positive - sd.Negative + sd.Bonus - sd.Penalty + sd.Adjustment;
    await this._doSave(sd, total);
    const panel = document.querySelector('.qs-score-panel');
    if (panel) panel.classList.add('qs-save-flash');
    setTimeout(() => { if (panel) panel.classList.remove('qs-save-flash'); this.backToTeams(); }, 650);
  },

  async _doSave(scoreFields, total) {
    const t = this.selectedTeam;
    const data = {
      Game: STATE.currentGame, Round: STATE.currentRound, SubRound: STATE.currentSubRound,
      TeamID: t.TeamID, TeamName: t.TeamName, ...scoreFields,
      EnteredBy: 'Admin (Quick)', Remarks: 'Quick Score'
    };
    try {
      const result  = await API.safePost('add_score', { data });
      const scoreId = result?.score?.ScoreID || 'qs_' + Date.now();
      STATE.scores  = STATE.scores || [];
      STATE.scores.push({ ...data, ScoreID: scoreId, Total: total, Voided: 'No', Timestamp: new Date().toISOString() });
      STATE.undoStack.unshift({ scoreId, data, team: t, total });
      if (STATE.undoStack.length > 5) STATE.undoStack.pop();
      if (total > 0) Sound.play('correct');
      else if (total < 0) Sound.play('wrong');
      if (scoreFields.Bonus > 0) Sound.play('bonus');
      Toast.success(`⚡ ${total >= 0 ? '+' : ''}${total} → ${t.TeamName}`);
      const lastEl = document.getElementById('qs-last-save');
      if (lastEl) lastEl.innerHTML = `<span class="check">✓</span> Last: <strong style="color:${t.Color}">${t.TeamName}</strong> ${total >= 0 ? '+' : ''}${total} · G${data.Game}R${data.Round}${data.SubRound}`;
      if (STATE.gasUrl) API.safeGet('scoreboard', {}, 'scoreboard').then(sb => { if (sb?.scoreboard) STATE.scoreboard = sb.scoreboard; });
    } catch (err) {
      Toast.error('Save failed: ' + (err.message || 'unknown'));
    }
  }
};

function openQuickScore()    { QS.open(); }
function closeQuickScore()   { QS.close(); }
function qsOnContextChange() { QS.onContextChange(); }

// Q key = toggle Quick Score (capture phase runs first)
document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
  if ((e.key === 'q' || e.key === 'Q') && STATE.isAdmin) {
    document.getElementById('quick-score-overlay')?.classList.contains('hidden')
      ? QS.open() : QS.close();
  }
  if (e.key === 'Escape' && !document.getElementById('quick-score-overlay')?.classList.contains('hidden')) {
    QS.close();
  }
}, true);

// ─── Start ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => initApp());

