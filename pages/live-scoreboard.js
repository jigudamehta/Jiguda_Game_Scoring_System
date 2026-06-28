/**
 * Live Scoreboard Page — with auto-refresh, projector mode, movement arrows, and detailed breakdowns
 */
window.activeExpandedTeamIDs = window.activeExpandedTeamIDs || new Set();

async function initScoreboard() {
  const page = document.getElementById('page-scoreboard');

  // Render immediately from cached STATE (instant, no network wait)
  renderScoreboard(page);

  // Then background-fetch fresh data and re-render silently
  if (STATE.gasUrl) {
    try {
      const [sb, sc] = await Promise.all([
        API.safeGet('scoreboard', {}, 'scoreboard'),
        API.safeGet('scores', {}, 'scores')
      ]);
      if (sb?.scoreboard) STATE.scoreboard = sb.scoreboard;
      if (sc?.scores) STATE.scores = sc.scores;
      if (STATE.currentPage === 'scoreboard') renderScoreboard(page);
    } catch (_) {}
  }
}

function toggleScoreboardRowDetails(teamId) {
  if (window.activeExpandedTeamIDs.has(teamId)) {
    window.activeExpandedTeamIDs.delete(teamId);
  } else {
    window.activeExpandedTeamIDs.add(teamId);
  }
  renderScoreboard(document.getElementById('page-scoreboard'));
}

function renderDetailedScores(teamId) {
  const teamScores = (STATE.scores || [])
    .filter(s => s.TeamID === teamId && s.Voided !== 'Yes')
    .sort((a, b) => {
      const gDiff = (Number(a.Game) || 0) - (Number(b.Game) || 0);
      if (gDiff !== 0) return gDiff;
      const rDiff = (Number(a.Round) || 0) - (Number(b.Round) || 0);
      if (rDiff !== 0) return rDiff;
      return String(a.SubRound || '').localeCompare(String(b.SubRound || ''));
    });

  if (teamScores.length === 0) {
    return `<div style="color:var(--text-muted);font-size:var(--text-xs);text-align:center;padding:var(--space-4)">No detailed round scores recorded yet for this team.</div>`;
  }

  return `
    <div class="score-breakdown-table-wrapper">
      <table class="score-breakdown-table">
        <thead>
          <tr>
            <th>Round</th>
            <th class="text-right">Positive</th>
            <th class="text-right">Negative</th>
            <th class="text-right">Bonus</th>
            <th class="text-right">Penalty</th>
            <th class="text-right">Adjust</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${teamScores.map(s => {
            const subRoundText = s.SubRound ? ` · Sub ${s.SubRound}` : '';
            const totalVal = Number(s.Total) || 0;
            return `
              <tr>
                <td style="font-weight:700;color:var(--text-accent)">G${s.Game}·R${s.Round}${subRoundText}</td>
                <td class="text-right ${Number(s.Positive) > 0 ? 'text-success' : 'text-muted'}">+${s.Positive || 0}</td>
                <td class="text-right ${Number(s.Negative) > 0 ? 'text-danger' : 'text-muted'}">-${s.Negative || 0}</td>
                <td class="text-right ${Number(s.Bonus) > 0 ? 'text-gold' : 'text-muted'}">+${s.Bonus || 0}</td>
                <td class="text-right ${Number(s.Penalty) > 0 ? 'text-orange' : 'text-muted'}">-${s.Penalty || 0}</td>
                <td class="text-right ${Number(s.Adjustment) !== 0 ? 'text-info' : 'text-muted'}">${Number(s.Adjustment) >= 0 ? '+' : ''}${s.Adjustment || 0}</td>
                <td class="text-right ${totalVal >= 0 ? 'text-success' : 'text-danger'}" style="font-weight:800">${totalVal >= 0 ? '+' : ''}${totalVal}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderScoreboard(page) {
  const sb = STATE.scoreboard;
  const refreshSec = Number(STATE.settings.AUTO_REFRESH_SEC || 30);

  const rowsHtml = sb.length > 0 ? sb.map((t, i) => {
    const rank    = Number(t.Rank) || i + 1;
    const rankCls = rankBadgeClass(rank);
    const moveCls = t.RankMove || 'same';
    const moveIcon = rankMoveIcon(t.RankMove);
    const diff = Number(t.ScoreDiff) || 0;
    const breakdown = (() => {
      try { return JSON.parse(t.GamesBreakdown || '{}'); } catch (_) { return {}; }
    })();
    const gameChips = Object.entries(breakdown).map(([g, sc]) =>
      `<span class="score-chip ${sc>=0?'pos':'neg'}">G${g}:${sc>=0?'+':''}${sc}</span>`
    ).join('');

    const isExpanded = window.activeExpandedTeamIDs.has(t.TeamID);

    return `
      <tr class="scoreboard-row rank-${rank}" style="cursor:pointer" onclick="toggleScoreboardRowDetails('${t.TeamID}')">
        <td>
          <div class="rank-badge ${rankCls}">${
            rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank
          }</div>
        </td>
        <td>
          <div class="flex items-center gap-3">
            <div class="team-avatar" style="background:${t.Color};width:44px;height:44px">
              ${teamInitials(t.TeamName)}
            </div>
            <div>
              <div style="font-weight:700;font-size:var(--text-base);display:flex;align-items:baseline;gap:var(--space-2)">
                <span>${t.TeamName}</span>
                <span style="font-size:10px;color:var(--text-muted);font-weight:normal;letter-spacing:0.02em;white-space:nowrap">
                  ${isExpanded ? '▼ collapse' : '▶ click for details'}
                </span>
              </div>
              ${gameChips ? `<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">${gameChips}</div>` : ''}
            </div>
          </div>
        </td>
        <td>
          <div class="score-display">${t.TotalScore}</div>
        </td>
        <td>
          <div class="rank-move ${moveCls}">
            ${moveIcon}
            ${t.RankMove === 'same' ? '' : `<span style="font-size:var(--text-xs)">${Math.abs(t.PrevRank - rank)||''}</span>`}
          </div>
        </td>
        <td>
          ${diff !== 0 ? `<span class="badge ${diff>0?'badge-green':'badge-red'}">${diff>0?'+':''}${diff}</span>` : ''}
        </td>
        <td>
          ${t.Qualified==='Yes'||t.Qualified==='Manual'
            ? `<span class="badge badge-gold">✓ Finals</span>`
            : ''}
        </td>
      </tr>
      ${isExpanded ? `
      <tr class="scoreboard-details-row">
        <td colspan="6" style="padding:var(--space-3) var(--space-4) var(--space-4)">
          <div class="scoreboard-details-box">
            <div style="font-size:var(--text-xs);font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--space-2)">Detailed Round Breakdown</div>
            ${renderDetailedScores(t.TeamID)}
          </div>
        </td>
      </tr>` : ''}
    `;
  }).join('') : `
    <tr>
      <td colspan="6">
        <div class="empty-state">
          <div class="empty-state-icon">🏆</div>
          <div class="empty-state-title">No Scores Yet</div>
          <div class="empty-state-text">Scores will appear as games progress</div>
        </div>
      </td>
    </tr>`;

  page.innerHTML = `
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="section-title">🏆 Live Scoreboard</h2>
      <div class="flex gap-2" style="flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="initScoreboard()">🔄 Refresh</button>
        <button class="btn btn-sm btn-secondary projector-toggle" onclick="toggleProjector()"
          title="Projector Mode">📽️</button>
        <button class="btn btn-sm btn-secondary" onclick="toggleFullscreenScoreboard()">⛶</button>
        <button class="btn btn-sm btn-success" onclick="openPublicScoreboardFromBoard()" title="Open read-only public view">🌐 Share</button>
        ${STATE.isAdmin ? `<button class="btn btn-sm btn-primary" onclick="navigate('score-entry')">📝 Enter Scores</button>` : ''}
      </div>
    </div>

    <!-- Auto Refresh Countdown -->
    <div class="flex items-center gap-3">
      <span style="font-size:var(--text-xs);color:var(--text-muted)">
        🔄 Auto-refreshes every ${refreshSec}s
      </span>
      <span id="refresh-countdown" style="font-size:var(--text-xs);color:var(--text-accent);font-weight:700"></span>
      <span style="font-size:var(--text-xs);color:var(--text-muted)">
        Last updated: ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}
      </span>
    </div>

    <!-- Main Table -->
    <div class="card" id="scoreboard-card" style="padding:var(--space-4)">
      <div style="overflow-x:auto">
        <table class="scoreboard-table">
          <thead>
            <tr>
              <th style="width:60px">Rank</th>
              <th>Team</th>
              <th>Score</th>
              <th>Move</th>
              <th>Change</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="sb-tbody">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Score Distribution Chart -->
    ${sb.length > 0 ? `
    <div class="card">
      <div class="card-title" style="margin-bottom:var(--space-4)">📊 Score Distribution</div>
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        ${sb.map(t => {
          const maxScore = Math.max(...sb.map(x => Number(x.TotalScore)||0), 1);
          const pct = Math.max(0, Math.round((Number(t.TotalScore)||0) / maxScore * 100));
          return `
            <div>
              <div class="flex items-center justify-between" style="margin-bottom:4px">
                <span style="font-size:var(--text-sm);font-weight:600">${t.TeamName}</span>
                <span style="font-size:var(--text-sm);font-weight:800;color:var(--text-accent)">${t.TotalScore}</span>
              </div>
              <div style="height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${t.Color||'var(--gold-400)'};border-radius:4px;transition:width 0.8s ease;box-shadow:0 0 8px ${t.Color||'var(--gold-400)'}66"></div>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;

  // Start refresh countdown
  startRefreshCountdown(refreshSec);
}

let sbCountdownInterval = null;
function startRefreshCountdown(sec) {
  clearInterval(sbCountdownInterval);
  let remaining = sec;
  const el = document.getElementById('refresh-countdown');
  sbCountdownInterval = setInterval(() => {
    remaining--;
    if (el) el.textContent = `(${remaining}s)`;
    if (remaining <= 0) {
      clearInterval(sbCountdownInterval);
      if (STATE.currentPage === 'scoreboard') initScoreboard();
    }
  }, 1000);
}

function toggleFullscreenScoreboard() {
  const card = document.getElementById('scoreboard-card');
  if (!card) return;
  if (!document.fullscreenElement) {
    card.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

/**
 * Opens the public read-only scoreboard in a new tab.
 * Reuses buildPublicScoreboardUrl() from settings.js if loaded,
 * otherwise builds the URL inline.
 */
function openPublicScoreboardFromBoard() {
  let url;
  if (typeof buildPublicScoreboardUrl === 'function') {
    url = buildPublicScoreboardUrl();
  } else {
    const base = window.location.href.replace(/[^/]*$/, '') + 'scoreboard-public.html';
    const gasUrl = STATE.gasUrl || localStorage.getItem('gss_gasUrl') || '';
    url = gasUrl ? `${base}?gas=${encodeURIComponent(gasUrl)}` : base;
  }
  window.open(url, '_blank');
}
