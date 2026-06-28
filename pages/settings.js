/**
 * Settings Page — all config, admin session, new event, backup/restore
 */
async function initSettings() {
  const page = document.getElementById('page-settings');

  // Render immediately from cached STATE (instant)
  renderSettings(page);

  // Background-fetch fresh settings and re-render
  if (STATE.gasUrl) {
    try {
      const data = await API.safeGet('settings', {}, 'settings');
      if (data?.settings) STATE.settings = data.settings;
      if (STATE.currentPage === 'settings') renderSettings(page);
    } catch (_) {}
  }
}

function renderSettings(page) {
  const s = STATE.settings;
  const groups = ['Event', 'Teams', 'Games', 'Scoring', 'Timer', 'Finals', 'UI', 'Sharing', 'Sounds', 'System'];

  // Group settings rows by Group column
  const gasRaw = CACHE.load('settings');
  let rawRows = gasRaw?.raw || buildDefaultRawRows();

  // Guarantee ADMIN_PASSWORD is in the list
  if (!rawRows.some(row => row.Key === 'ADMIN_PASSWORD')) {
    rawRows.push({
      Key: 'ADMIN_PASSWORD',
      Value: 'admin123',
      Label: 'Admin Password',
      Type: 'text',
      Group: 'System',
      Options: '',
      Description: 'Password to activate admin mode'
    });
  }

  const grouped = {};
  groups.forEach(g => { grouped[g] = []; });
  rawRows.forEach(row => {
    const g = row.Group || 'Event';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(row);
  });

  function renderControl(row) {
    const val = s[row.Key] !== undefined ? s[row.Key] : row.Value;
    if (!STATE.isAdmin) {
      return `<span style="font-size:var(--text-sm);color:var(--text-primary);font-weight:600">${val || '—'}</span>`;
    }
    switch (row.Type) {
      case 'boolean':
        return `<label class="toggle-switch">
          <input type="checkbox" ${val==='true'?'checked':''} onchange="saveSetting('${row.Key}',this.checked?'true':'false')">
          <span class="toggle-track"></span>
        </label>`;
      case 'color':
        return `<div class="flex items-center gap-2">
          <input type="color" value="${val||'#F5A623'}" onchange="saveSetting('${row.Key}',this.value)" style="width:36px;height:36px;border:none;border-radius:var(--radius-md);cursor:pointer;padding:0">
          <input type="text" class="form-control" value="${val||''}" onchange="saveSetting('${row.Key}',this.value)" style="width:100px;font-size:var(--text-xs)">
        </div>`;
      case 'select':
        return `<select class="form-control" style="min-width:150px" onchange="saveSetting('${row.Key}',this.value)">
          ${(row.Options||'').split(',').filter(Boolean).map(o => `<option ${val===o?'selected':''}>${o}</option>`).join('')}
        </select>`;
      case 'textarea':
        return `<textarea class="form-control" rows="3" style="min-width:260px;font-size:var(--text-xs)"
          onchange="saveSetting('${row.Key}',this.value)">${val||''}</textarea>`;
      case 'url':
        return `<input type="url" class="form-control" value="${val||''}" placeholder="https://..."
          style="min-width:260px" onchange="saveSetting('${row.Key}',this.value)">`;
      default:
        return `<input type="${row.Type==='number'?'number':'text'}" class="form-control"
          value="${val||''}" style="min-width:160px"
          onchange="saveSetting('${row.Key}',this.value)">`;
    }
  }

  const groupsHtml = groups.map(g => {
    const rows = grouped[g] || [];
    if (rows.length === 0) return '';
    return `
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--space-2)">${groupIcon(g)} ${g}</div>
        <div>
          ${rows.map(row => `
            <div class="settings-row">
              <div class="settings-row-info">
                <div class="settings-row-label">${row.Label}</div>
                ${row.Description ? `<div class="settings-row-desc">${row.Description}</div>` : ''}
              </div>
              <div class="settings-row-control">${renderControl(row)}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }).join('');

  page.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="section-title">⚙️ Settings</h2>
      ${STATE.isAdmin ? `<button class="btn btn-sm btn-success" onclick="saveAllSettings()">💾 Save All</button>` : ''}
    </div>

    <!-- GAS URL (always visible) -->
    <div class="card" style="border-color:var(--gold-400)55">
      <div class="card-title" style="margin-bottom:var(--space-4)">🔗 Google Apps Script Connection</div>
      <div class="form-group">
        <label class="form-label">Deployed Web App URL</label>
        ${(typeof HARDCODED_GAS_URL !== 'undefined' && HARDCODED_GAS_URL) ? `
          <div style="background:rgba(46,204,113,0.08);border:1px dashed var(--success);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-2);font-size:var(--text-sm);color:var(--success)">
            🔒 <strong>Connection Locked by Administrator</strong>: Pre-configured to execute for all admins and viewers.
          </div>
          <input type="url" class="form-control" id="gas-url-input"
            value="${HARDCODED_GAS_URL}" disabled style="opacity:0.75;font-family:monospace">
        ` : `
          <div class="flex gap-2">
            <input type="url" class="form-control" id="gas-url-input"
              value="${localStorage.getItem('gss_gasUrl')||''}"
              placeholder="https://script.google.com/macros/s/.../exec">
            <button class="btn btn-primary" onclick="saveGasUrl()">Connect</button>
            <button class="btn btn-secondary" onclick="testGasUrl()">Test</button>
          </div>
          <div class="form-hint">Paste your Google Apps Script web app URL here. See the setup guide for instructions.</div>
        `}
      </div>
      <div id="connection-status" style="margin-top:var(--space-3)">
        ${(typeof HARDCODED_GAS_URL !== 'undefined' && HARDCODED_GAS_URL) ? '<div style="color:var(--success);font-size:var(--text-sm);font-weight:600">✅ Connected! Google Sheets is active.</div>' : ''}
      </div>
    </div>

    <!-- Public Scoreboard Link -->
    <div class="card" style="border-color:rgba(46,204,113,0.3)">
      <div class="card-header">
        <div class="card-title">🌐 Public Live Scoreboard</div>
        <span class="badge badge-green" style="font-size:10px;padding:3px 8px">Read-Only</span>
      </div>
      <div style="font-size:var(--text-sm);color:var(--text-muted);margin-bottom:var(--space-4);line-height:1.6">
        Share this link with your audience so they can watch scores update live — no login required.
        Open it on a phone, tablet, or projector for a beautiful read-only view.
      </div>

      ${STATE.gasUrl ? `
      <!-- Shareable URL display -->
      <div style="background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:var(--space-3);margin-bottom:var(--space-4)">
        <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--space-2);text-transform:uppercase;letter-spacing:0.08em;font-weight:600">Shareable URL</div>
        <div style="font-size:var(--text-xs);color:var(--text-accent);word-break:break-all;font-family:monospace;line-height:1.5" id="public-url-display">${buildPublicScoreboardUrl()}</div>
      </div>

      <!-- Action Buttons -->
      <div class="flex gap-2" style="flex-wrap:wrap;margin-bottom:var(--space-4)">
        <button class="btn btn-success btn-sm" onclick="copyPublicLink()">📋 Copy Link</button>
        <button class="btn btn-secondary btn-sm" onclick="openPublicScoreboard()">🔗 Open in New Tab</button>
        <button class="btn btn-secondary btn-sm" onclick="openPublicScoreboardProjector()">📽️ Projector View</button>
      </div>

      <!-- QR Code Section -->
      <div style="display:flex;align-items:flex-start;gap:var(--space-5);flex-wrap:wrap">
        <div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:var(--space-2)">QR Code for Audience</div>
          <div id="qr-container" style="background:white;border-radius:var(--radius-md);padding:10px;display:inline-block;box-shadow:var(--shadow-md)">
            <img id="qr-img" src="${buildQrUrl()}" alt="QR Code" width="160" height="160" style="display:block;border-radius:4px" loading="lazy">
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:var(--space-2);text-align:center">Scan to open on phone</div>
        </div>
        <div style="flex:1;min-width:200px">
          <div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:var(--space-3)">How to Share</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            <div style="display:flex;align-items:flex-start;gap:var(--space-2);font-size:var(--text-sm);color:var(--text-secondary)">
              <span style="color:var(--success);flex-shrink:0">📱</span>
              <span>Show the QR code on your projector or screen so the audience can scan it</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:var(--space-2);font-size:var(--text-sm);color:var(--text-secondary)">
              <span style="color:var(--info);flex-shrink:0">💬</span>
              <span>Copy the link and paste it in your WhatsApp group</span>
            </div>
            <div style="display:flex;align-items:flex-start;gap:var(--space-2);font-size:var(--text-sm);color:var(--text-secondary)">
              <span style="color:var(--gold-400);flex-shrink:0">📽️</span>
              <span>Open Projector View on a second screen for a large-format live display</span>
            </div>
          </div>
        </div>
      </div>

      <!-- WhatsApp share text -->
      <div style="margin-top:var(--space-4);padding-top:var(--space-4);border-top:1px solid var(--border-subtle)">
        <div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:var(--space-2)">WhatsApp Message</div>
        <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:var(--space-3);font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;font-style:italic" id="whatsapp-msg">
          🏆 Watch the live ${STATE.settings.EVENT_NAME||'event'} scores here:<br>${buildPublicScoreboardUrl()}
        </div>
        <button class="btn btn-sm btn-ghost" style="margin-top:var(--space-2)" onclick="copyWhatsAppMsg()">📋 Copy WhatsApp Message</button>
      </div>` : `
      <div style="padding:var(--space-4);background:var(--bg-elevated);border-radius:var(--radius-md);text-align:center;color:var(--text-muted);font-size:var(--text-sm)">
        ⚠️ Connect your Google Apps Script URL above first — then a shareable link will appear here.
      </div>`}
    </div>

    <!-- Admin Mode Card -->
    <div class="card" style="border-color:${STATE.isAdmin ? 'var(--success)' : 'var(--border-medium)'}55">
      <div class="card-header">
        <div class="card-title">${STATE.isAdmin ? '🔓 Admin Mode Active' : '🔒 Admin Mode'}</div>
        ${STATE.isAdmin
          ? `<button class="btn btn-secondary btn-sm" onclick="deactivateAdmin()">Deactivate</button>`
          : `<button class="btn btn-primary btn-sm" onclick="showAdminActivateModal()">Activate</button>`}
      </div>
      <div style="font-size:var(--text-sm);color:var(--text-muted)">
        ${STATE.isAdmin
          ? 'Full admin access is active for this session. All controls are visible and editable.'
          : 'Viewer mode — scoreboard and dashboard visible. Activate admin for full control.'}
      </div>
    </div>

    <!-- All Settings Groups -->
    ${STATE.isAdmin ? groupsHtml : `
      <div class="card">
        <div class="empty-state" style="padding:var(--space-8)">
          <div class="empty-state-icon">🔒</div>
          <div class="empty-state-title">Admin Access Required</div>
          <div class="empty-state-text">Activate admin mode above to view and edit settings</div>
        </div>
      </div>`}

    <!-- Danger Zone -->
    ${STATE.isAdmin ? `
    <div class="card" style="border-color:rgba(231,76,60,0.4)">
      <div class="card-title" style="color:var(--error);margin-bottom:var(--space-4)">⚠️ Danger Zone</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        <div class="settings-row" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
          <div class="settings-row-info">
            <div class="settings-row-label">🔄 Start New Event</div>
            <div class="settings-row-desc">Clears all players, teams, scores. Keeps settings intact.</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="confirmNewEvent()">New Event</button>
        </div>
        <div class="settings-row" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
          <div class="settings-row-info">
            <div class="settings-row-label">💾 Backup Data</div>
            <div class="settings-row-desc">Download all current data as JSON backup.</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="backupData()">Backup</button>
        </div>
        <div class="settings-row" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
          <div class="settings-row-info">
            <div class="settings-row-label">📤 Restore Data</div>
            <div class="settings-row-desc">Restore from a previous backup JSON file.</div>
          </div>
          <label class="btn btn-secondary btn-sm" style="cursor:pointer">
            Restore <input type="file" accept=".json" onchange="restoreData(this)" style="display:none">
          </label>
        </div>
        <div class="settings-row" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
          <div class="settings-row-info">
            <div class="settings-row-label">🔧 Rebuild Scoreboard</div>
            <div class="settings-row-desc">Recalculate all scores and rankings from scratch.</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="rebuildScoreboard()">Rebuild</button>
        </div>
      </div>
    </div>` : ''}

    <!-- App Info -->
    <div class="card" style="text-align:center;padding:var(--space-8)">
      <div style="font-size:36px;margin-bottom:var(--space-3)">🎵</div>
      <div style="font-family:var(--font-display);font-size:var(--text-xl);color:var(--text-accent)">
        Universal Game Scoring System
      </div>
      <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-2)">
        Version 1.0.0 · Built for Antakshari &amp; all indoor competitions
      </div>
      <div style="margin-top:var(--space-4)">
        <a href="#" onclick="navigate('dashboard')" class="btn btn-ghost btn-sm">🏠 Dashboard</a>
        <button class="btn btn-ghost btn-sm" onclick="window.open('setup-guide.md')">📖 Setup Guide</button>
      </div>
    </div>

    <!-- Admin Activate Modal -->
    <div class="modal-overlay hidden" id="admin-activate-modal">
      <div class="modal" style="max-width:380px">
        <div class="modal-title">🔓 Activate Admin Mode</div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Admin Password</label>
            <input type="password" class="form-control" id="admin-pass-input"
              placeholder="Enter password (default: admin123)"
              onkeydown="if(event.key==='Enter')submitAdminPass()">
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-2)">
            Session-based access. Stays active until you close the browser or deactivate.
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="Modal.close('admin-activate-modal')">Cancel</button>
          <button class="btn btn-primary" onclick="submitAdminPass()">Activate</button>
        </div>
      </div>
    </div>
  `;
}

function groupIcon(g) {
  const icons = { Event:'🎪', Teams:'🎭', Games:'🎮', Scoring:'📊', Timer:'⏱️', Finals:'🏆', UI:'🎨', Sharing:'📱', Sounds:'🔊', System:'⚙️', GameLocks:'🔒' };
  return icons[g] || '⚙️';
}

function buildDefaultRawRows() {
  // Fallback if no cached raw rows — use key/value pairs we know
  return Object.entries(STATE.settings).map(([Key, Value]) => ({ Key, Value, Label: Key, Type: 'text', Group: 'Event', Options: '', Description: '' }));
}

async function saveSetting(key, value) {
  STATE.settings[key] = value;
  await API.safePost('save_settings', { data: { [key]: value } });
}

async function saveAllSettings() {
  // Collect all changed input values
  const inputs = document.querySelectorAll('[onchange*="saveSetting"]');
  const data = {};
  inputs.forEach(inp => {
    const match = inp.getAttribute('onchange')?.match(/saveSetting\('(.+?)',/);
    if (match) {
      const key = match[1];
      data[key] = inp.type === 'checkbox' ? (inp.checked ? 'true' : 'false') : inp.value;
    }
  });
  await API.safePost('save_settings', { data });
  Toast.success('All settings saved!');
}

function showAdminActivateModal() {
  Modal.open('admin-activate-modal');
  setTimeout(() => document.getElementById('admin-pass-input')?.focus(), 100);
}

function submitAdminPass() {
  const pass = document.getElementById('admin-pass-input')?.value || '';
  if (activateAdmin(pass)) {
    Modal.close('admin-activate-modal');
    // Refresh only the current visible page
    const initFn = PAGES[STATE.currentPage]?.init;
    if (initFn) initFn();
  }
}

async function saveGasUrl() {
  const url = document.getElementById('gas-url-input')?.value?.trim();
  if (!url) { Toast.warning('Please enter the GAS URL'); return; }
  localStorage.setItem('gss_gasUrl', url);
  STATE.gasUrl = url;
  Toast.success('URL saved! Testing connection...');
  await testGasUrl();
}

async function testGasUrl() {
  const statusEl = document.getElementById('connection-status');
  if (statusEl) statusEl.innerHTML = '<div class="flex gap-2 items-center"><div class="loading-spinner" style="width:20px;height:20px;border-width:2px"></div><span style="font-size:var(--text-sm)">Testing connection...</span></div>';
  try {
    const result = await API.get('ping');
    if (result?.status === 'ok') {
      if (statusEl) statusEl.innerHTML = '<div style="color:var(--success);font-size:var(--text-sm);font-weight:600">✅ Connected! Google Sheets is responding.</div>';
      Toast.success('Connection successful!');
      // Load real settings
      await loadSettings();
      await loadAllData();
    } else {
      throw new Error('Unexpected response');
    }
  } catch (err) {
    if (statusEl) statusEl.innerHTML = `<div style="color:var(--error);font-size:var(--text-sm)">❌ Connection failed: ${err.message}<br><span style="color:var(--text-muted)">Check the URL and make sure the script is deployed as a Web App with "Anyone" access.</span></div>`;
  }
}

async function confirmNewEvent() {
  const confirmed = await Modal.confirm(
    '<strong>⚠️ Start a New Event?</strong><br><br>This will permanently clear all:<br>• Players & team assignments<br>• All scores<br>• Finals data<br><br>Settings will be preserved. This cannot be undone.'
  );
  if (!confirmed) return;
  await API.safePost('reset_event', {});
  STATE.players    = [];
  STATE.teams      = [];
  STATE.teamMembers= [];
  STATE.scores     = [];
  STATE.scoreboard = [];
  STATE.undoStack  = [];
  CACHE.clear('players');
  CACHE.clear('teams');
  CACHE.clear('scores');
  CACHE.clear('scoreboard');
  Toast.success('🎉 New event started! All data cleared.');
  navigate('dashboard');
}

function backupData() {
  const backup = {
    ts: new Date().toISOString(),
    event: STATE.settings.EVENT_NAME,
    settings: STATE.settings,
    players: STATE.players,
    teams: STATE.teams,
    teamMembers: STATE.teamMembers,
    scores: STATE.scores,
    scoreboard: STATE.scoreboard,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gss-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  Toast.success('Backup downloaded');
}

function restoreData(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      Modal.confirm(`Restore backup from <strong>${data.ts?.slice(0,10)||'unknown date'}</strong> (${data.event||'unknown event'})? This will overwrite current data.`).then(async confirmed => {
        if (!confirmed) return;
        if (data.settings)   { STATE.settings = data.settings; CACHE.save('settings', { settings: data.settings }); }
        if (data.players)    { STATE.players    = data.players;    CACHE.save('players',    { players: data.players }); }
        if (data.teams)      { STATE.teams      = data.teams;      CACHE.save('teams',      { teams: data.teams }); }
        if (data.scores)     { STATE.scores     = data.scores;     CACHE.save('scores',     { scores: data.scores }); }
        if (data.scoreboard) { STATE.scoreboard = data.scoreboard; CACHE.save('scoreboard', { scoreboard: data.scoreboard }); }
        Toast.success('Data restored from backup!');
        navigate('dashboard');
      });
    } catch (_) {
      Toast.error('Invalid backup file');
    }
  };
  reader.readAsText(file);
}

async function rebuildScoreboard() {
  const btn = document.querySelector('[onclick="rebuildScoreboard()"]');
  if (btn) btn.textContent = 'Rebuilding...';
  try {
    await API.safePost('rebuild_scoreboard', {});
    const sb = await API.safeGet('scoreboard', {}, 'scoreboard');
    if (sb?.scoreboard) STATE.scoreboard = sb.scoreboard;
    Toast.success('Scoreboard rebuilt from all score entries');
  } catch (_) {
    Toast.error('Rebuild failed');
  } finally {
    if (btn) btn.textContent = 'Rebuild';
  }
}

// ── Public Scoreboard Link Helpers ────────────────────────────

/**
 * Build the URL for the public scoreboard page.
 * Embeds the GAS URL as a query param so the public page auto-connects.
 */
function buildPublicScoreboardUrl() {
  const base = window.location.href.replace(/[^/]*$/, '') + 'scoreboard-public.html';
  const gasUrl = STATE.gasUrl || localStorage.getItem('gss_gasUrl') || '';
  if (!gasUrl) return base;
  return `${base}?gas=${encodeURIComponent(gasUrl)}`;
}

/**
 * Build a QR code image URL using Google's Chart API (free, no key needed).
 */
function buildQrUrl() {
  const link = buildPublicScoreboardUrl();
  return `https://chart.googleapis.com/chart?cht=qr&chs=320x320&choe=UTF-8&chl=${encodeURIComponent(link)}&chld=M|2`;
}

/** Copy the public scoreboard URL to clipboard. */
function copyPublicLink() {
  const url = buildPublicScoreboardUrl();
  navigator.clipboard.writeText(url).then(() => {
    Toast.success('📋 Link copied to clipboard!');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    Toast.success('📋 Link copied!');
  });
}

/** Open the public scoreboard in a new tab (normal view). */
function openPublicScoreboard() {
  window.open(buildPublicScoreboardUrl(), '_blank');
}

/** Open the public scoreboard in a new tab with projector mode on. */
function openPublicScoreboardProjector() {
  const url = buildPublicScoreboardUrl();
  const projUrl = url + (url.includes('?') ? '&' : '?') + 'projector=1';
  window.open(projUrl, '_blank');
}

/** Copy a ready-made WhatsApp message with the link. */
function copyWhatsAppMsg() {
  const eventName = STATE.settings.EVENT_NAME || 'our event';
  const url = buildPublicScoreboardUrl();
  const msg = `🏆 Watch the live ${eventName} scores here:\n${url}\n\n(Auto-updates every 30 seconds!)`;
  navigator.clipboard.writeText(msg).then(() => {
    Toast.success('📋 WhatsApp message copied!');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = msg;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    Toast.success('📋 Copied!');
  });
}

