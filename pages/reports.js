/**
 * Reports Page — PDF, Team Cards, Attendance, Game Scores, Scoreboard
 */
async function initReports() {
  const page = document.getElementById('page-reports');

  // Render immediately from cached STATE (instant)
  renderReports(page);

  // Load fresh data in background then re-render
  if (STATE.gasUrl) {
    try {
      const [pd, sb, sd] = await Promise.all([
        API.safeGet('players',    {}, 'players'),
        API.safeGet('scoreboard', {}, 'scoreboard'),
        API.safeGet('scores',     {}, 'scores'),
      ]);
      if (pd?.players)    STATE.players    = pd.players;
      if (sb?.scoreboard) STATE.scoreboard = sb.scoreboard;
      if (sd?.scores)     STATE.scores     = sd.scores;
      if (STATE.currentPage === 'reports') renderReports(page);
    } catch (_) {}
  }
}

function renderReports(page) {
  const numGames  = Number(STATE.settings.NUM_GAMES || 3);
  const eventName = STATE.settings.EVENT_NAME || 'Event';

  page.innerHTML = `
    <h2 class="section-title">📋 Reports</h2>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:var(--space-4)">

      <!-- Scoreboard Report -->
      <div class="card" style="border-color:var(--gold-400)55">
        <div class="stat-icon">🏆</div>
        <div class="card-title" style="margin-bottom:var(--space-2)">Overall Scoreboard</div>
        <div style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4)">
          Complete ranking with team scores, rank movement and qualification status.
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" onclick="printScoreboard()">🖨️ Print</button>
          <button class="btn btn-secondary flex-1" onclick="downloadScoreboardCSV()">⬇️ CSV</button>
        </div>
      </div>

      <!-- Attendance Report -->
      <div class="card" style="border-color:var(--success)55">
        <div class="stat-icon">✅</div>
        <div class="card-title" style="margin-bottom:var(--space-2)">Attendance Report</div>
        <div style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4)">
          Player list with present/absent status, team assignment and captain markers.
        </div>
        <div class="flex gap-2">
          <button class="btn btn-success flex-1" onclick="printAttendance()">🖨️ Print</button>
          <button class="btn btn-secondary flex-1" onclick="downloadAttendanceCSV()">⬇️ CSV</button>
        </div>
      </div>

      <!-- Game-Wise Score Report -->
      <div class="card" style="border-color:var(--info)55">
        <div class="stat-icon">🎮</div>
        <div class="card-title" style="margin-bottom:var(--space-2)">Game-Wise Scores</div>
        <div style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4)">
          Detailed score breakdown per game, round, and sub-round for every team.
        </div>
        <div class="flex gap-2">
          <button class="btn btn-accent flex-1" onclick="printGameScores()">🖨️ Print</button>
          <button class="btn btn-secondary flex-1" onclick="downloadGameScoresCSV()">⬇️ CSV</button>
        </div>
      </div>

      <!-- Team Cards Report -->
      <div class="card" style="border-color:var(--purple-400)55">
        <div class="stat-icon">🎭</div>
        <div class="card-title" style="margin-bottom:var(--space-2)">Team Cards (Image)</div>
        <div style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4)">
          Generate a shareable high-res image showing all team compositions.
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary flex-1" onclick="generateTeamCardsReport()">🖼️ Generate</button>
          <button class="btn btn-secondary flex-1" onclick="navigate('team-generator')">→ Team Gen</button>
        </div>
      </div>

      <!-- Final Results Report -->
      <div class="card" style="border-color:var(--warning)55">
        <div class="stat-icon">🎖️</div>
        <div class="card-title" style="margin-bottom:var(--space-2)">Final Results</div>
        <div style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4)">
          Winner, Runner-Up and Third Place with final scores and overall performance.
        </div>
        <div class="flex gap-2">
          <button class="btn btn-primary flex-1" onclick="printFinalResults()">🖨️ Print</button>
          <button class="btn btn-secondary flex-1" onclick="downloadFinalResultsCSV()">⬇️ CSV</button>
        </div>
      </div>

      <!-- Event Log -->
      <div class="card" style="border-color:var(--text-muted)55">
        <div class="stat-icon">📜</div>
        <div class="card-title" style="margin-bottom:var(--space-2)">Event Log</div>
        <div style="color:var(--text-muted);font-size:var(--text-sm);margin-bottom:var(--space-4)">
          Complete audit trail — every score, undo, reset and team change with timestamps.
        </div>
        <div class="flex gap-2">
          <button class="btn btn-secondary flex-1" onclick="showEventLog()">👁️ View</button>
          <button class="btn btn-secondary flex-1" onclick="downloadLogCSV()">⬇️ CSV</button>
        </div>
      </div>
    </div>

    <!-- Hidden Print Frames -->
    <div id="print-area" style="display:none"></div>
    <canvas id="report-canvas" style="display:none"></canvas>

    <!-- Preview Area -->
    <div id="report-preview" style="display:none">
      <div class="card">
        <div class="card-header">
          <div class="card-title" id="preview-title">Preview</div>
          <div class="flex gap-2">
            <button class="btn btn-primary btn-sm" onclick="window.print()">🖨️ Print This</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('report-preview').style.display='none'">✕</button>
          </div>
        </div>
        <div id="preview-content"></div>
      </div>
    </div>

    <!-- Event Log Modal -->
    <div class="modal-overlay hidden" id="log-modal">
      <div class="modal" style="max-width:700px;max-height:80vh">
        <div class="modal-title">📜 Event Log</div>
        <div class="modal-body" id="log-modal-body" style="max-height:55vh;overflow-y:auto"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="downloadLogCSV()">⬇️ Download CSV</button>
          <button class="btn btn-ghost" onclick="Modal.close('log-modal')">Close</button>
        </div>
      </div>
    </div>
  `;
}

// ── Helper: trigger print ─────────────────────────────────────
function triggerPrint(html, title) {
  const preview = document.getElementById('report-preview');
  const previewTitle = document.getElementById('preview-title');
  const previewContent = document.getElementById('preview-content');
  if (preview && previewContent) {
    previewTitle.textContent = title;
    previewContent.innerHTML = html;
    preview.style.display = '';
    preview.scrollIntoView({ behavior: 'smooth' });
  }
}

// ── Helper: CSV download ──────────────────────────────────────
function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename + '.csv'; a.click();
  URL.revokeObjectURL(url);
  Toast.success('CSV downloaded');
}

// ── Scoreboard Report ─────────────────────────────────────────
function printScoreboard() {
  const sb = STATE.scoreboard;
  const eventName = STATE.settings.EVENT_NAME || 'Event';
  const rows = sb.map((t, i) => `
    <tr style="border-bottom:1px solid #ddd">
      <td style="padding:10px;font-weight:700;text-align:center">${t.Rank||i+1}</td>
      <td style="padding:10px;font-weight:600">${t.TeamName}</td>
      <td style="padding:10px;text-align:center;font-weight:800;font-size:20px">${t.TotalScore}</td>
      <td style="padding:10px;text-align:center">${t.RankMove==='up'?'▲ Up':t.RankMove==='down'?'▼ Down':'—'}</td>
      <td style="padding:10px;text-align:center">${t.Qualified==='Yes'||t.Qualified==='Manual'?'✓ Qualified':''}</td>
    </tr>`).join('');

  const html = `
    <style>@media print{body{margin:0}}table{width:100%;border-collapse:collapse}th{background:#1E0040;color:#F5A623;padding:12px;text-align:left}</style>
    <div style="font-family:Inter,sans-serif;padding:20px">
      <div style="text-align:center;margin-bottom:20px">
        <h1 style="font-size:28px;color:#1E0040;margin:0">🏆 ${eventName}</h1>
        <h2 style="font-size:18px;color:#666;margin:5px 0">Overall Scoreboard</h2>
        <div style="font-size:14px;color:#999">${new Date().toLocaleDateString([], {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      <table>
        <thead><tr><th>Rank</th><th>Team</th><th>Score</th><th>Move</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  triggerPrint(html, '🏆 Overall Scoreboard');
}

function downloadScoreboardCSV() {
  const rows = [['Rank','Team','Total Score','Rank Move','Qualified']];
  STATE.scoreboard.forEach(t => rows.push([t.Rank, t.TeamName, t.TotalScore, t.RankMove||'same', t.Qualified]));
  downloadCSV(rows, `${STATE.settings.EVENT_NAME||'event'}-scoreboard`);
}

// ── Attendance Report ─────────────────────────────────────────
function printAttendance() {
  const players = STATE.players;
  const eventName = STATE.settings.EVENT_NAME || 'Event';
  const present = players.filter(p => p.Present === 'Yes').length;

  const rows = players.map(p => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:8px">${p.PlayerName}</td>
      <td style="padding:8px;text-align:center">${p.Gender||'—'}</td>
      <td style="padding:8px;text-align:center">${p.Age||'—'}</td>
      <td style="padding:8px;text-align:center;font-weight:700;color:${p.Present==='Yes'?'#27AE60':'#E74C3C'}">${p.Present==='Yes'?'✓ Present':'✗ Absent'}</td>
      <td style="padding:8px">${p.AssignedTeam||'—'}</td>
      <td style="padding:8px;text-align:center">${p.Captain==='Yes'?'👑':''}</td>
    </tr>`).join('');

  const html = `
    <style>@media print{body{margin:0}}table{width:100%;border-collapse:collapse}th{background:#27AE60;color:white;padding:10px;text-align:left}</style>
    <div style="font-family:Inter,sans-serif;padding:20px">
      <div style="text-align:center;margin-bottom:20px">
        <h1 style="color:#1E0040;margin:0">📋 ${eventName}</h1>
        <h2 style="color:#666;margin:5px 0">Attendance Report</h2>
        <div style="font-size:14px;color:#999">${new Date().toLocaleDateString([], {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        <div style="margin-top:8px;font-size:14px"><strong>${present}/${players.length}</strong> players present</div>
      </div>
      <table>
        <thead><tr><th>Name</th><th>Gender</th><th>Age</th><th>Status</th><th>Team</th><th>Captain</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  triggerPrint(html, '✅ Attendance Report');
}

function downloadAttendanceCSV() {
  const rows = [['Player Name','Gender','Age','Mobile','Present','Team','Captain','Remarks']];
  STATE.players.forEach(p => rows.push([p.PlayerName,p.Gender,p.Age,p.Mobile,p.Present,p.AssignedTeam,p.Captain,p.Remarks]));
  downloadCSV(rows, `${STATE.settings.EVENT_NAME||'event'}-attendance`);
}

// ── Game-Wise Scores ──────────────────────────────────────────
function printGameScores() {
  const scores  = (STATE.scores || []).filter(s => s.Voided !== 'Yes');
  const numGames = Number(STATE.settings.NUM_GAMES || 3);
  const eventName = STATE.settings.EVENT_NAME || 'Event';

  let gamesHtml = '';
  for (let g = 1; g <= numGames; g++) {
    const gameScores = scores.filter(s => String(s.Game) === String(g));
    if (gameScores.length === 0) continue;

    // Group by team
    const teamTotals = {};
    gameScores.forEach(s => {
      if (!teamTotals[s.TeamName]) teamTotals[s.TeamName] = 0;
      teamTotals[s.TeamName] += Number(s.Total)||0;
    });

    const teamRows = Object.entries(teamTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => `<tr style="border-bottom:1px solid #eee"><td style="padding:8px;font-weight:600">${name}</td><td style="padding:8px;text-align:center;font-weight:800">${total}</td></tr>`)
      .join('');

    const detailRows = gameScores.map(s => `
      <tr style="border-bottom:1px solid #f5f5f5;font-size:13px">
        <td style="padding:6px">${s.TeamName}</td>
        <td style="padding:6px;text-align:center">R${s.Round}${s.SubRound||''}</td>
        <td style="padding:6px;text-align:center;color:#27AE60">${s.Positive>0?'+'+s.Positive:''}</td>
        <td style="padding:6px;text-align:center;color:#E74C3C">${s.Negative>0?'-'+s.Negative:''}</td>
        <td style="padding:6px;text-align:center;color:#F39C12">${s.Bonus>0?'★'+s.Bonus:''}</td>
        <td style="padding:6px;text-align:center;font-weight:700">${s.Total>=0?'+':''} ${s.Total}</td>
        <td style="padding:6px;color:#999;font-size:11px">${s.Remarks||''}</td>
      </tr>`).join('');

    gamesHtml += `
      <div style="margin-bottom:30px">
        <h3 style="color:#1E0040;border-bottom:2px solid #F5A623;padding-bottom:8px">Game ${g}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>
            <h4>Team Summary</h4>
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#1E0040;color:#F5A623"><th style="padding:8px;text-align:left">Team</th><th style="padding:8px">Score</th></tr></thead>
              <tbody>${teamRows}</tbody>
            </table>
          </div>
          <div>
            <h4>All Entries</h4>
            <table style="width:100%;border-collapse:collapse">
              <thead><tr style="background:#f5f5f5"><th style="padding:6px;text-align:left;font-size:12px">Team</th><th style="padding:6px">Round</th><th>+</th><th>-</th><th>★</th><th>Total</th><th>Remarks</th></tr></thead>
              <tbody>${detailRows}</tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  const html = `
    <style>@media print{body{margin:0}}</style>
    <div style="font-family:Inter,sans-serif;padding:20px">
      <div style="text-align:center;margin-bottom:20px">
        <h1 style="color:#1E0040;margin:0">🎮 ${eventName}</h1>
        <h2 style="color:#666;margin:5px 0">Game-Wise Score Report</h2>
        <div style="font-size:14px;color:#999">${new Date().toLocaleDateString([], {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      ${gamesHtml || '<p style="text-align:center;color:#999">No scores recorded yet</p>'}
    </div>`;
  triggerPrint(html, '🎮 Game-Wise Scores');
}

function downloadGameScoresCSV() {
  const scores = (STATE.scores || []).filter(s => s.Voided !== 'Yes');
  const rows = [['Game','Round','Sub-Round','Team','Positive','Negative','Bonus','Penalty','Adjustment','Total','Remarks','Time']];
  scores.forEach(s => rows.push([s.Game,s.Round,s.SubRound,s.TeamName,s.Positive,s.Negative,s.Bonus,s.Penalty,s.Adjustment,s.Total,s.Remarks,s.Timestamp]));
  downloadCSV(rows, `${STATE.settings.EVENT_NAME||'event'}-game-scores`);
}

// ── Team Cards Report ─────────────────────────────────────────
function generateTeamCardsReport() {
  navigate('team-generator');
  setTimeout(() => {
    document.getElementById('whatsapp-panel')?.scrollIntoView({ behavior: 'smooth' });
  }, 500);
}

// ── Final Results ─────────────────────────────────────────────
function printFinalResults() {
  const sb = STATE.scoreboard;
  const eventName = STATE.settings.EVENT_NAME || 'Event';
  const podium = sb.slice(0, 3);
  const medals = ['🥇 Champion', '🥈 Runner-Up', '🥉 Third Place'];

  const podiumHtml = podium.map((t, i) => `
    <div style="text-align:center;padding:20px;border:2px solid ${i===0?'#FFD700':i===1?'#C0C0C0':'#CD7F32'};border-radius:12px">
      <div style="font-size:48px">${medals[i].split(' ')[0]}</div>
      <div style="font-size:22px;font-weight:800;color:#1E0040;margin-top:8px">${t.TeamName}</div>
      <div style="font-size:14px;color:#666;margin-top:4px">${medals[i].split(' ').slice(1).join(' ')}</div>
      <div style="font-size:32px;font-weight:900;color:${i===0?'#F5A623':'#666'};margin-top:8px">${t.TotalScore} pts</div>
    </div>`).join('');

  const allRows = sb.map((t, i) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:10px;font-weight:700;text-align:center">${t.Rank||i+1}</td>
      <td style="padding:10px;font-weight:600">${t.TeamName}</td>
      <td style="padding:10px;text-align:center;font-weight:800">${t.TotalScore}</td>
      <td style="padding:10px;text-align:center">${t.Qualified==='Yes'||t.Qualified==='Manual'?'✓':''}</td>
    </tr>`).join('');

  const html = `
    <style>@media print{body{margin:0}}</style>
    <div style="font-family:Inter,sans-serif;padding:20px">
      <div style="text-align:center;margin-bottom:30px">
        <div style="font-size:48px">🏆</div>
        <h1 style="color:#1E0040;margin:5px 0">${eventName}</h1>
        <h2 style="color:#666;margin:5px 0">Final Results</h2>
        <div style="font-size:14px;color:#999">${new Date().toLocaleDateString([], {weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      ${podium.length > 0 ? `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:30px">${podiumHtml}</div>` : ''}
      <h3 style="color:#1E0040;border-bottom:2px solid #F5A623;padding-bottom:8px">Complete Rankings</h3>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:#1E0040;color:#F5A623"><th style="padding:10px">Rank</th><th style="padding:10px;text-align:left">Team</th><th style="padding:10px">Score</th><th style="padding:10px">Finals</th></tr></thead>
        <tbody>${allRows}</tbody>
      </table>
    </div>`;
  triggerPrint(html, '🎖️ Final Results');
}

function downloadFinalResultsCSV() {
  const rows = [['Rank','Team','Total Score','Qualified']];
  STATE.scoreboard.forEach(t => rows.push([t.Rank, t.TeamName, t.TotalScore, t.Qualified]));
  downloadCSV(rows, `${STATE.settings.EVENT_NAME||'event'}-final-results`);
}

// ── Event Log ─────────────────────────────────────────────────
async function showEventLog() {
  const modal = document.getElementById('log-modal');
  const body  = document.getElementById('log-modal-body');
  Modal.open('log-modal');
  body.innerHTML = '<div class="flex" style="justify-content:center;padding:var(--space-8)"><div class="loading-spinner"></div></div>';
  try {
    const data = await API.safeGet('event_log', { limit: 200 }, 'event_log');
    const logs  = data?.log || [];
    body.innerHTML = logs.length > 0
      ? `<table class="data-table">
          <thead><tr><th>Time</th><th>Action</th><th>Detail</th><th>By</th></tr></thead>
          <tbody>
            ${logs.map(l => `<tr>
              <td style="white-space:nowrap">${formatTime(l.Timestamp)}</td>
              <td><span class="badge badge-purple">${l.Action}</span></td>
              <td>${l.Detail}</td>
              <td style="color:var(--text-muted)">${l.By}</td>
            </tr>`).join('')}
          </tbody>
        </table>`
      : '<div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-text">No events logged yet</div></div>';
  } catch (_) {
    body.innerHTML = '<div style="color:var(--error);padding:var(--space-4)">Failed to load event log</div>';
  }
}

async function downloadLogCSV() {
  try {
    const data = await API.safeGet('event_log', { limit: 1000 }, 'event_log');
    const logs  = data?.log || [];
    const rows  = [['Time','Action','Detail','By']];
    logs.forEach(l => rows.push([l.Timestamp, l.Action, l.Detail, l.By]));
    downloadCSV(rows, `${STATE.settings.EVENT_NAME||'event'}-event-log`);
  } catch (_) { Toast.error('Could not load event log'); }
}
