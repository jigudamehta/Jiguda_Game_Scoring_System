/**
 * Dashboard Page
 */
async function initDashboard() {
  const page = document.getElementById('page-dashboard');

  // Render immediately from cached STATE (instant)
  renderDashboard(page);

  // Load fresh scoreboard in background then re-render
  if (STATE.gasUrl) {
    try {
      const sb = await API.safeGet('scoreboard', {}, 'scoreboard');
      if (sb?.scoreboard) STATE.scoreboard = sb.scoreboard;
      if (STATE.currentPage === 'dashboard') renderDashboard(page);
    } catch (_) {}
  }
}

function renderDashboard(page) {
  const s = STATE.settings;
  const eventName = s.EVENT_NAME || 'Game Scoring System';
  const status    = s.CURRENT_STATUS || 'setup';
  const numGames  = Number(s.NUM_GAMES || 3);
  const numTeams  = Number(s.NUM_TEAMS || 4);

  const statusSteps = ['setup','registration','assignment','games','finals','complete'];
  const statusLabels = { setup:'Setup', registration:'Registration', assignment:'Teams', games:'Games', finals:'Finals', complete:'Done' };
  const statusIcons  = { setup:'⚙️', registration:'📋', assignment:'🎭', games:'🎮', finals:'🏆', complete:'🎉' };
  const curIdx = statusSteps.indexOf(status);

  const stepperHtml = statusSteps.map((st, i) => {
    const cls = i < curIdx ? 'done' : i === curIdx ? 'current' : 'pending';
    return `
      <div class="status-step">
        ${i > 0 ? `<div class="status-line ${i <= curIdx ? 'done' : ''}"></div>` : ''}
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <div class="status-dot ${cls}">${statusIcons[st]}</div>
          <div class="status-label">${statusLabels[st]}</div>
        </div>
      </div>`;
  }).join('');

  const presentCount  = STATE.players.filter(p => p.Present === 'Yes').length;
  const assignedCount = STATE.players.filter(p => p.AssignedTeam).length;
  const topTeam       = STATE.scoreboard[0];
  const totalScoreEntries = STATE.scoreboard.reduce((s, t) => s + (Number(t.TotalScore)||0), 0);

  const top5Html = STATE.scoreboard.slice(0, 5).map((t, i) => {
    const rank = i + 1;
    const rankCls = rankBadgeClass(rank);
    const moveCls = t.RankMove || 'same';
    const moveIcon = rankMoveIcon(t.RankMove);
    return `
      <tr class="scoreboard-row rank-${rank}">
        <td><div class="rank-badge ${rankCls}">${rank}</div></td>
        <td>
          <div class="flex items-center gap-2">
            <div class="team-avatar" style="width:32px;height:32px;background:${t.Color};font-size:13px">
              ${teamInitials(t.TeamName)}
            </div>
            <span style="font-weight:600">${t.TeamName}</span>
          </div>
        </td>
        <td><span class="score-display" style="font-size:var(--text-xl)">${t.TotalScore}</span></td>
        <td><span class="rank-move ${moveCls}">${moveIcon}</span></td>
        <td>${t.Qualified === 'Yes' || t.Qualified === 'Manual' ? '<span class="badge badge-gold">✓ Qualified</span>' : ''}</td>
      </tr>`;
  }).join('') || `<tr><td colspan="5"><div class="empty-state" style="padding:var(--space-8)">
    <div class="empty-state-icon">📊</div>
    <div class="empty-state-title">No scores yet</div>
    <div class="empty-state-text">Scores will appear here once the event starts</div>
  </div></td></tr>`;

  const quickBtns = [
    { page:'team-generator', icon:'🎭', label:'Team Generator', color:'var(--purple-400)', admin:true },
    { page:'score-entry',    icon:'📝', label:'Score Entry',    color:'var(--gold-400)',   admin:true },
    { page:'scoreboard',     icon:'🏆', label:'Live Board',     color:'var(--success)',    admin:false },
    { page:'finals',         icon:'🎖️', label:'Finals',         color:'var(--error)',      admin:true },
    { page:'timer',          icon:'⏱️', label:'Timer',          color:'var(--info)',       admin:false },
    { page:'reports',        icon:'📋', label:'Reports',        color:'#9B59B6',           admin:true },
  ];

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  page.innerHTML = `
    <!-- Hero Header -->
    <div class="card" style="background:linear-gradient(135deg,var(--bg-surface),var(--bg-elevated));border-color:var(--border-medium);text-align:center;padding:var(--space-10);position:relative;overflow:hidden">
      <div class="music-deco" style="top:10px;left:20px;animation-delay:0s">🎵</div>
      <div class="music-deco" style="top:30px;right:30px;animation-delay:1s">🎶</div>
      <div class="music-deco" style="bottom:20px;left:40%;animation-delay:2s">🎤</div>

      <div style="font-size:56px;margin-bottom:var(--space-3)">🎵</div>
      <h1 style="font-family:var(--font-display);font-size:var(--text-4xl);font-weight:900;color:var(--text-accent);margin-bottom:var(--space-2);text-shadow:var(--glow-gold)">
        ${eventName}
      </h1>
      <div style="font-size:var(--text-base);color:var(--text-muted);margin-bottom:var(--space-5)">${dateStr}</div>

      <div style="font-size:var(--text-5xl);font-family:var(--font-display);font-weight:900;color:var(--text-primary);letter-spacing:0.05em" id="dash-clock">${timeStr}</div>
    </div>

    <!-- Event Status -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">📍 Event Status</div>
        ${STATE.isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="showStatusModal()">Change Status</button>` : ''}
      </div>
      <div class="status-stepper">${stepperHtml}</div>
    </div>

    <!-- Stats Row -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${STATE.players.length}</div>
        <div class="stat-label">Total Players</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-value">${presentCount}</div>
        <div class="stat-label">Present Today</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎭</div>
        <div class="stat-value">${numTeams}</div>
        <div class="stat-label">Teams</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🎮</div>
        <div class="stat-value">${numGames}</div>
        <div class="stat-label">Games</div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="card">
      <div class="card-title" style="margin-bottom:var(--space-4)">⚡ Quick Actions</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:var(--space-3)">
        ${quickBtns.map(b => `
          <button onclick="navigate('${b.page}')" class="btn btn-secondary"
            style="flex-direction:column;gap:var(--space-2);padding:var(--space-5);height:auto;${b.admin && !STATE.isAdmin ? 'opacity:0.5' : ''}">
            <span style="font-size:32px">${b.icon}</span>
            <span style="font-size:var(--text-sm);font-weight:700">${b.label}</span>
          </button>`).join('')}
      </div>
    </div>

    <!-- Live Rankings Preview -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">🏆 Live Rankings</div>
        <button class="btn btn-sm btn-primary" onclick="navigate('scoreboard')">Full Board →</button>
      </div>
      <div style="overflow-x:auto">
        <table class="scoreboard-table">
          <thead>
            <tr>
              <th>Rank</th><th>Team</th><th>Score</th><th>Move</th><th></th>
            </tr>
          </thead>
          <tbody>${top5Html}</tbody>
        </table>
      </div>
    </div>

    <!-- Top Team Spotlight -->
    ${topTeam ? `
    <div class="card" style="background:linear-gradient(135deg,rgba(245,166,35,0.1),rgba(123,63,160,0.1));border-color:var(--border-medium)">
      <div class="card-title" style="margin-bottom:var(--space-4)">👑 Current Leader</div>
      <div class="flex items-center gap-4">
        <div class="team-avatar" style="width:64px;height:64px;background:${topTeam.Color};font-size:24px;border-radius:var(--radius-lg);box-shadow:0 4px 20px ${topTeam.Color}66">
          ${teamInitials(topTeam.TeamName)}
        </div>
        <div style="flex:1">
          <div style="font-size:var(--text-2xl);font-weight:800;color:var(--text-primary)">${topTeam.TeamName}</div>
          <div style="font-size:var(--text-sm);color:var(--text-muted)">Leading the competition</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:var(--text-4xl);font-weight:900;color:var(--text-accent)">${topTeam.TotalScore}</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);text-transform:uppercase">Total Points</div>
        </div>
      </div>
    </div>` : ''}
  `;

  // Live clock
  setInterval(() => {
    const clk = document.getElementById('dash-clock');
    if (clk) clk.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 1000);
}

function showStatusModal() {
  const statuses = ['setup','registration','assignment','games','finals','complete'];
  const labels   = { setup:'⚙️ Setup', registration:'📋 Registration', assignment:'🎭 Team Assignment',
                     games:'🎮 Playing Games', finals:'🏆 Finals', complete:'🎉 Event Complete' };
  const current  = STATE.settings.CURRENT_STATUS || 'setup';
  const html = `
    <div class="modal-overlay" id="status-modal">
      <div class="modal">
        <div class="modal-title">📍 Change Event Status</div>
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:var(--space-2)">
            ${statuses.map(s => `
              <button onclick="changeStatus('${s}')"
                class="btn ${s === current ? 'btn-primary' : 'btn-secondary'}"
                style="justify-content:flex-start;padding:var(--space-4)">${labels[s]}</button>
            `).join('')}
          </div>
        </div>
        <div class="modal-actions"><button class="btn btn-ghost" onclick="Modal.close('status-modal')">Close</button></div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('status-modal').id = 'status-modal';
}

async function changeStatus(newStatus) {
  Modal.closeAll();
  await API.safePost('save_settings', { data: { CURRENT_STATUS: newStatus } });
  STATE.settings.CURRENT_STATUS = newStatus;
  Toast.success('Event status updated to: ' + newStatus);
  navigate('dashboard');
}
