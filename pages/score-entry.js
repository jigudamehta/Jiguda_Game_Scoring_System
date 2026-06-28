/**
 * Score Entry Page — with Quick Team Picker, Undo Stack (5 steps), Game Lock
 */
let seSelectedTeam = null;
const SE_MAX_UNDO = 5;

async function initScoreEntry() {
  const page = document.getElementById('page-score-entry');

  // Render immediately from cached STATE (instant)
  renderScoreEntry(page);

  // Background-fetch fresh data and re-render
  if (STATE.gasUrl) {
    try {
      const [sd, td] = await Promise.all([
        API.safeGet('scores', {}, 'scores'),
        API.safeGet('teams',  {}, 'teams')
      ]);
      if (sd?.scores) STATE.scores = sd.scores;
      if (td?.teams)  STATE.teams  = td.teams;
      if (STATE.currentPage === 'score-entry') renderScoreEntry(page);
    } catch (_) {}
  }
}

function renderScoreEntry(page) {
  const numGames  = Number(STATE.settings.NUM_GAMES   || 3);
  const numRounds = Number(STATE.settings.ROUNDS_PER_GAME || 3);
  const numSub    = Number(STATE.settings.SUB_ROUNDS  || 2);
  const subLabels = Array.from({length: numSub}, (_, i) => String.fromCharCode(65 + i)); // A, B, C...

  // Game options
  const gameOpts = Array.from({length: numGames}, (_, i) => `<option value="${i+1}" ${STATE.currentGame===i+1?'selected':''}>Game ${i+1}</option>`).join('');
  const roundOpts = Array.from({length: numRounds}, (_, i) => `<option value="${i+1}" ${STATE.currentRound===i+1?'selected':''}>Round ${i+1}</option>`).join('');
  const subOpts = subLabels.map(l => `<option value="${l}" ${STATE.currentSubRound===l?'selected':''}>${l}</option>`).join('');

  // Check game lock
  const lockKey = `GAME_LOCKED_${STATE.currentGame}`;
  const isLocked = STATE.settings[lockKey] === 'true';

  // Recent scores for this game/round
  const recentScores = (STATE.scores || [])
    .filter(s => s.Game == STATE.currentGame && s.Round == STATE.currentRound && s.Voided !== 'Yes')
    .slice(-10).reverse();

  // Undo stack
  const undoHtml = STATE.undoStack.slice(0, 5).map((entry, i) => `
    <div class="undo-item">
      <span style="color:${entry.team.Color||'var(--text-accent)'}">${entry.team.TeamName}</span>
      <span style="color:var(--text-secondary);font-size:var(--text-xs)">G${entry.data.Game}·R${entry.data.Round}${entry.data.SubRound||''}</span>
      <span class="badge ${entry.total>=0?'badge-green':'badge-red'}">${entry.total>=0?'+':''}${entry.total}</span>
      <button class="btn btn-danger btn-sm" onclick="undoScore('${entry.scoreId}',${i})">↩</button>
    </div>`).join('') || `<div style="color:var(--text-muted);font-size:var(--text-xs);padding:var(--space-2)">No recent entries</div>`;

  page.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="section-title">📝 Score Entry</h2>
      ${STATE.isAdmin ? `
      <div class="flex gap-2">
        <button class="btn btn-sm ${isLocked?'btn-danger':'btn-secondary'}" onclick="toggleGameLock()">
          ${isLocked ? '🔒 Unlock Game' : '🔓 Lock Game'}
        </button>
      </div>` : ''}
    </div>

    ${isLocked && STATE.isAdmin ? `
    <div style="padding:var(--space-4);background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);border-radius:var(--radius-md);color:var(--error);font-weight:600">
      🔒 Game ${STATE.currentGame} is locked. Unlock to enter scores.
    </div>` : ''}

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:var(--space-6)">

      <!-- Left: Score Entry Form -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">

        <!-- Context Selector -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-4)">📍 Context</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-3)">
            <div class="form-group">
              <label class="form-label">Game</label>
              <select class="form-control" id="se-game" onchange="onContextChange()">
                ${gameOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Round</label>
              <select class="form-control" id="se-round" onchange="onContextChange()">
                ${roundOpts}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Sub-Round</label>
              <select class="form-control" id="se-subround" onchange="onContextChange()">
                ${subOpts}
              </select>
            </div>
          </div>
          <div class="flex gap-2" style="margin-top:var(--space-3)">
            <button class="btn btn-sm btn-secondary" onclick="Timer.loadFromSettings(STATE.currentGame,STATE.currentRound);openTimerFullscreen()">
              ⏱️ Start Round Timer
            </button>
          </div>
        </div>

        <!-- Team Picker -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-4)">🏷️ Select Team</div>
          <div class="team-picker-grid" id="team-picker">
            ${STATE.teams.map(t => {
              const teamScore = (STATE.scores||[])
                .filter(s => s.TeamID === t.TeamID && s.Voided !== 'Yes')
                .reduce((acc, s) => acc + (Number(s.Total)||0), 0);
              return `
                <button class="team-picker-btn ${seSelectedTeam?.TeamID===t.TeamID?'selected':''}"
                  style="border-color:${seSelectedTeam?.TeamID===t.TeamID?t.Color:'transparent'}"
                  onclick="selectTeam('${t.TeamID}')">
                  <div class="team-avatar" style="background:${t.Color};width:48px;height:48px">${teamInitials(t.TeamName)}</div>
                  <div class="team-picker-score">${teamScore}</div>
                  <div class="team-picker-name">${t.TeamName}</div>
                </button>`;
            }).join('') || `<div style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:var(--space-6)">No teams configured</div>`}
          </div>
        </div>

        <!-- Score Form -->
        <div class="card ${!seSelectedTeam ? 'opacity-50' : ''}">
          <div class="card-header">
            <div class="card-title">
              ${seSelectedTeam ? `
                <div class="team-avatar" style="width:32px;height:32px;background:${seSelectedTeam.Color};font-size:13px">
                  ${teamInitials(seSelectedTeam.TeamName)}
                </div>
                Scoring: ${seSelectedTeam.TeamName}
              ` : '📊 Score Entry'}
            </div>
          </div>

          <div class="score-input-grid" id="score-form">
            ${['positive','negative','bonus','penalty','adjust'].map((type, i) => {
              const labels = ['Positive','Negative','Bonus','Penalty','Adjustment'];
              const ids    = ['se-pos','se-neg','se-bon','se-pen','se-adj'];
              const defaults = [0, 0, 0, 0, 0];
              return `
                <div class="score-input-wrapper ${type}">
                  <span class="score-input-label ${type}">${labels[i]}</span>
                  <input type="number" id="${ids[i]}" value="${defaults[i]}" min="0" step="1"
                    ${!seSelectedTeam || (isLocked && !STATE.isAdmin) ? 'disabled' : ''}
                    oninput="updateScorePreview()"
                    onclick="this.select()">
                </div>`;
            }).join('')}
          </div>

          <!-- Score Preview -->
          <div class="score-total-preview" style="margin-top:var(--space-4)" id="score-preview">
            <div class="score-total-num zero" id="preview-total">0</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:var(--space-1)">Total Points</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:4px" id="preview-formula"></div>
          </div>

          <div class="form-group" style="margin-top:var(--space-4)">
            <label class="form-label">Remarks (optional)</label>
            <input type="text" class="form-control" id="se-remarks" placeholder="e.g. Bollywood round, bonus for speed">
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3" style="margin-top:var(--space-4)">
            <button class="btn btn-primary flex-1 btn-lg" id="save-score-btn"
              onclick="submitScore()" ${!seSelectedTeam || (isLocked && !STATE.isAdmin) ? 'disabled' : ''}>
              ✅ Save Score
            </button>
            <button class="btn btn-secondary" onclick="resetScoreForm()">🔄 Reset</button>
          </div>
        </div>
      </div>

      <!-- Right: Undo & History -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">

        <!-- Undo Stack -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-3)">↩️ Undo (Last ${SE_MAX_UNDO})</div>
          <div class="undo-stack" id="undo-stack-list">
            ${undoHtml}
          </div>
        </div>

        <!-- Score History -->
        <div class="card" style="flex:1">
          <div class="card-title" style="margin-bottom:var(--space-3)">📜 This Round Scores</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);max-height:400px;overflow-y:auto">
            ${recentScores.length > 0 ? recentScores.map(s => `
              <div style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
                <div class="flex items-center justify-between">
                  <span style="font-weight:600;color:${getTeamColor(s.TeamID)||'var(--text-accent)'}">${s.TeamName}</span>
                  <span class="badge ${s.Total>=0?'badge-green':'badge-red'}">${s.Total>=0?'+':''}${s.Total}</span>
                </div>
                <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:4px">
                  ${s.SubRound ? `Sub-Round ${s.SubRound} · ` : ''}${formatTime(s.Timestamp)}
                  ${s.Remarks ? ` · ${s.Remarks}` : ''}
                </div>
                <div style="font-size:var(--text-xs);color:var(--text-muted);display:flex;gap:var(--space-2);margin-top:3px;flex-wrap:wrap">
                  ${s.Positive > 0 ? `<span class="score-chip pos">+${s.Positive}</span>` : ''}
                  ${s.Negative > 0 ? `<span class="score-chip neg">-${s.Negative}</span>` : ''}
                  ${s.Bonus    > 0 ? `<span class="score-chip bon">★${s.Bonus}</span>` : ''}
                </div>
              </div>`).join('')
            : `<div class="empty-state" style="padding:var(--space-6)">
                <div class="empty-state-icon" style="font-size:32px">📊</div>
                <div class="empty-state-text">No scores this round yet</div>
              </div>`}
          </div>
        </div>
      </div>
    </div>
  `;

  updateScorePreview();
}

function selectTeam(teamId) {
  seSelectedTeam = STATE.teams.find(t => t.TeamID === teamId);
  // Update picker UI
  document.querySelectorAll('.team-picker-btn').forEach(btn => btn.classList.remove('selected'));
  const btn = document.querySelector(`.team-picker-btn[onclick*="${teamId}"]`);
  if (btn) {
    btn.classList.add('selected');
    btn.style.borderColor = seSelectedTeam?.Color || 'transparent';
  }
  // Enable form
  const inputs = document.querySelectorAll('#score-form input');
  inputs.forEach(inp => inp.disabled = false);
  const saveBtn = document.getElementById('save-score-btn');
  if (saveBtn) saveBtn.disabled = false;
  // Update card title
  const title = document.querySelector('.card-title');
  updateScorePreview();
}

function onContextChange() {
  const game    = Number(document.getElementById('se-game')?.value || 1);
  const round   = Number(document.getElementById('se-round')?.value || 1);
  const subRound = document.getElementById('se-subround')?.value || 'A';
  STATE.currentGame     = game;
  STATE.currentRound    = round;
  STATE.currentSubRound = subRound;
  Timer.loadFromSettings(game, round);
  // Reload recent scores
  initScoreEntry();
}

function updateScorePreview() {
  const pos = Number(document.getElementById('se-pos')?.value || 0);
  const neg = Number(document.getElementById('se-neg')?.value || 0);
  const bon = Number(document.getElementById('se-bon')?.value || 0);
  const pen = Number(document.getElementById('se-pen')?.value || 0);
  const adj = Number(document.getElementById('se-adj')?.value || 0);
  const total = pos - neg + bon - pen + adj;

  const totalEl   = document.getElementById('preview-total');
  const formulaEl = document.getElementById('preview-formula');

  if (totalEl) {
    totalEl.textContent = (total >= 0 ? '+' : '') + total;
    totalEl.className = `score-total-num ${scoreClass(total)}`;
    totalEl.classList.add('score-anim');
    setTimeout(() => totalEl.classList.remove('score-anim'), 500);
  }
  if (formulaEl) {
    const parts = [];
    if (pos) parts.push(`+${pos}`);
    if (neg) parts.push(`−${neg}`);
    if (bon) parts.push(`★${bon}`);
    if (pen) parts.push(`⚠${pen}`);
    if (adj) parts.push(`adj${adj>=0?'+':''}${adj}`);
    formulaEl.textContent = parts.join(' ') || '0';
  }
}

async function submitScore() {
  if (!seSelectedTeam) { Toast.warning('Select a team first'); return; }
  if (!STATE.isAdmin)  { Toast.error('Admin access required'); return; }

  const lockKey = `GAME_LOCKED_${STATE.currentGame}`;
  if (STATE.settings[lockKey] === 'true') {
    Toast.error('Game is locked. Unlock first.'); return;
  }

  const pos = Number(document.getElementById('se-pos')?.value || 0);
  const neg = Number(document.getElementById('se-neg')?.value || 0);
  const bon = Number(document.getElementById('se-bon')?.value || 0);
  const pen = Number(document.getElementById('se-pen')?.value || 0);
  const adj = Number(document.getElementById('se-adj')?.value || 0);
  const total = pos - neg + bon - pen + adj;

  const data = {
    Game: STATE.currentGame, Round: STATE.currentRound, SubRound: STATE.currentSubRound,
    TeamID: seSelectedTeam.TeamID, TeamName: seSelectedTeam.TeamName,
    Positive: pos, Negative: neg, Bonus: bon, Penalty: pen, Adjustment: adj,
    EnteredBy: 'Admin',
    Remarks: document.getElementById('se-remarks')?.value || ''
  };

  // Optimistic UI
  const btn = document.getElementById('save-score-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const result = await API.safePost('add_score', { data });
    if (result?.score || result?.success) {
      const scoreId = result.score?.ScoreID || 'local_' + Date.now();
      // Add to undo stack
      STATE.undoStack.unshift({ scoreId, data, team: seSelectedTeam, total });
      if (STATE.undoStack.length > SE_MAX_UNDO) STATE.undoStack.pop();

      // Add to local scores
      STATE.scores = STATE.scores || [];
      STATE.scores.push({ ...data, ScoreID: scoreId, Total: total, Voided: 'No', Timestamp: new Date().toISOString() });

      // Sound
      if (total > 0) Sound.play('correct');
      else if (total < 0) Sound.play('wrong');
      if (bon > 0) Sound.play('bonus');

      Toast.success(`✅ +${total} saved for ${seSelectedTeam.TeamName}`);
      resetScoreForm();

      // Refresh scoreboard in background
      if (STATE.gasUrl) {
        API.safeGet('scoreboard', {}, 'scoreboard').then(sb => {
          if (sb?.scoreboard) STATE.scoreboard = sb.scoreboard;
        });
      }
    }
  } catch (err) {
    Toast.error('Save failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✅ Save Score'; }
  }

  // Refresh undo stack display
  const undoList = document.getElementById('undo-stack-list');
  if (undoList) {
    undoList.innerHTML = STATE.undoStack.slice(0, 5).map((entry, i) => `
      <div class="undo-item">
        <span style="color:${entry.team.Color||'var(--text-accent)'}">${entry.team.TeamName}</span>
        <span style="color:var(--text-secondary);font-size:var(--text-xs)">G${entry.data.Game}·R${entry.data.Round}${entry.data.SubRound||''}</span>
        <span class="badge ${entry.total>=0?'badge-green':'badge-red'}">${entry.total>=0?'+':''}${entry.total}</span>
        <button class="btn btn-danger btn-sm" onclick="undoScore('${entry.scoreId}',${i})">↩</button>
      </div>`).join('') || `<div style="color:var(--text-muted);font-size:var(--text-xs);padding:var(--space-2)">No recent entries</div>`;
  }
}

async function undoScore(scoreId, stackIdx) {
  const confirmed = await Modal.confirm('Undo this score entry?');
  if (!confirmed) return;
  await API.safePost('undo_score', { scoreId });
  STATE.undoStack.splice(stackIdx, 1);
  STATE.scores = (STATE.scores || []).filter(s => s.ScoreID !== scoreId);
  Toast.info('Score undone');
  initScoreEntry();
}

function resetScoreForm() {
  document.getElementById('se-pos').value = 0;
  document.getElementById('se-neg').value = 0;
  document.getElementById('se-bon').value = 0;
  document.getElementById('se-pen').value = 0;
  document.getElementById('se-adj').value = 0;
  if (document.getElementById('se-remarks')) document.getElementById('se-remarks').value = '';
  updateScorePreview();
}

async function toggleGameLock() {
  const lockKey = `GAME_LOCKED_${STATE.currentGame}`;
  const isLocked = STATE.settings[lockKey] === 'true';
  if (!isLocked) {
    const confirmed = await Modal.confirm(`Lock Game ${STATE.currentGame}? No new scores can be entered while locked.`);
    if (!confirmed) return;
  }
  await API.safePost('lock_game', { gameId: STATE.currentGame, locked: !isLocked });
  STATE.settings[lockKey] = isLocked ? 'false' : 'true';
  Toast.success(`Game ${STATE.currentGame} ${isLocked ? 'unlocked' : 'locked'}`);
  initScoreEntry();
}
