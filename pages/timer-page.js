/**
 * Timer Page — Fullscreen countdown with last-seconds drama
 */
function initTimerPage() {
  renderTimerPage();
}

function renderTimerPage() {
  const page = document.getElementById('page-timer');
  const numGames  = Number(STATE.settings.NUM_GAMES   || 3);
  const numRounds = Number(STATE.settings.ROUNDS_PER_GAME || 3);

  // Build preset grid from settings
  const presets = [];
  for (let g = 1; g <= numGames; g++) {
    for (let r = 1; r <= numRounds; r++) {
      const key = `TIMER_G${g}_R${r}`;
      const val = STATE.settings[key];
      if (val) presets.push({ label: `G${g}R${r}`, seconds: Number(val), game: g, round: r });
    }
  }
  // Add default
  presets.unshift({ label: 'Default', seconds: Number(STATE.settings.DEFAULT_TIMER||60) });

  const m = Math.floor(STATE.timerSeconds / 60);
  const s = STATE.timerSeconds % 60;
  const timeStr = m > 0 ? `${m}:${String(s).padStart(2,'0')}` : String(s);
  const circ = 2 * Math.PI * 140;
  const pct = STATE.timerMax > 0 ? STATE.timerSeconds / STATE.timerMax : 1;
  const offset = circ * (1 - pct);

  page.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="section-title">⏱️ Timer</h2>
      <button class="btn btn-secondary" onclick="openTimerFullscreen()">⛶ Fullscreen</button>
    </div>

    <div style="display:grid;grid-template-columns:1fr 320px;gap:var(--space-6)">

      <!-- Timer Display -->
      <div class="card" style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);padding:var(--space-10)">

        <!-- SVG Ring -->
        <div style="position:relative;width:320px;height:320px">
          <svg width="320" height="320" style="transform:rotate(-90deg)">
            <circle cx="160" cy="160" r="140" fill="none" stroke="var(--bg-elevated)" stroke-width="12"/>
            <circle cx="160" cy="160" r="140" fill="none" stroke="var(--gold-400)"
              stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
              id="timer-progress-ring" style="transition:stroke-dashoffset 1s linear,stroke 0.3s"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-2)">
            <div class="timer-display" id="timer-main-display" style="font-size:80px">${timeStr}</div>
            <div class="timer-label">Seconds</div>
          </div>
        </div>

        <!-- Controls -->
        <div class="timer-controls">
          <button class="btn btn-lg btn-secondary" onclick="Timer.reset()" title="Reset">↺</button>
          <button class="btn btn-xl btn-primary" id="timer-play-btn" onclick="toggleTimer()">
            ${STATE.timerRunning ? '⏸ Pause' : '▶ Start'}
          </button>
          <button class="btn btn-lg btn-secondary" onclick="openTimerFullscreen()" title="Fullscreen">⛶</button>
        </div>

        <!-- Custom duration -->
        <div class="flex items-center gap-3">
          <input type="number" class="form-control" id="custom-duration" placeholder="Custom seconds"
            value="${STATE.timerMax}" min="5" max="3600" style="width:160px;text-align:center">
          <button class="btn btn-secondary" onclick="setCustomTimer()">Set</button>
        </div>
      </div>

      <!-- Right: Presets & Settings -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">

        <!-- Quick Presets -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-3)">⚡ Quick Presets</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            ${[30,45,60,90,120,180,300].map(sec => `
              <button class="btn btn-secondary" style="justify-content:space-between"
                onclick="Timer.init(${sec});updateTimerPageDisplay()">
                <span>${sec >= 60 ? Math.floor(sec/60)+'m'+(sec%60?sec%60+'s':'') : sec+'s'}</span>
                <span style="color:var(--text-muted)">${sec}s</span>
              </button>`).join('')}
          </div>
        </div>

        <!-- Game/Round Timers from Settings -->
        ${presets.length > 1 ? `
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-3)">🎮 Round Timers</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            ${presets.map(p => `
              <button class="btn btn-ghost" style="justify-content:space-between"
                onclick="Timer.init(${p.seconds});updateTimerPageDisplay()">
                <span>${p.label}</span>
                <span class="badge badge-gold">${p.seconds}s</span>
              </button>`).join('')}
          </div>
        </div>` : ''}

        <!-- Warning Settings -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-3)">⚠️ Warning Settings</div>
          <div class="settings-row" style="padding:0;border:none;flex-direction:column;align-items:flex-start;gap:var(--space-2)">
            <label class="form-label">Last-seconds warning at:</label>
            <div class="flex items-center gap-2" style="width:100%">
              <input type="number" class="form-control" id="warn-sec-input"
                value="${STATE.settings.LAST_SEC_WARN||10}" min="3" max="30">
              <span style="color:var(--text-muted);font-size:var(--text-sm)">seconds</span>
              ${STATE.isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="saveWarnSec()">Save</button>` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function toggleTimer() {
  if (STATE.timerRunning) {
    Timer.stop();
  } else {
    Timer.start();
  }
  const btn = document.getElementById('timer-play-btn');
  if (btn) btn.textContent = STATE.timerRunning ? '⏸ Pause' : '▶ Start';
}

function setCustomTimer() {
  const val = Number(document.getElementById('custom-duration')?.value || 60);
  if (val < 5) { Toast.warning('Minimum 5 seconds'); return; }
  Timer.init(val);
  updateTimerPageDisplay();
}

function updateTimerPageDisplay() {
  const m = Math.floor(STATE.timerSeconds / 60);
  const s = STATE.timerSeconds % 60;
  const el = document.getElementById('timer-main-display');
  if (el) el.textContent = m > 0 ? `${m}:${String(s).padStart(2,'0')}` : String(s);
  // Also update ring
  const ring = document.getElementById('timer-progress-ring');
  if (ring) {
    const circ = 2 * Math.PI * 140;
    ring.style.strokeDashoffset = circ * 0; // full ring
  }
  // Update play btn
  const btn = document.getElementById('timer-play-btn');
  if (btn) btn.textContent = STATE.timerRunning ? '⏸ Pause' : '▶ Start';
}

async function saveWarnSec() {
  const val = document.getElementById('warn-sec-input')?.value;
  STATE.settings.LAST_SEC_WARN = val;
  await API.safePost('save_settings', { data: { LAST_SEC_WARN: val } });
  Toast.success('Warning threshold saved');
}

// ── Fullscreen Timer Overlay ──────────────────────────────────
function openTimerFullscreen() {
  const overlay = document.getElementById('timer-fullscreen');
  if (overlay) overlay.classList.remove('hidden');
}

function closeTimerFullscreen() {
  const overlay = document.getElementById('timer-fullscreen');
  if (overlay) overlay.classList.add('hidden');
}
