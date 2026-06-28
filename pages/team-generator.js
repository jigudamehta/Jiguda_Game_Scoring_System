/**
 * Team Generator Page
 */
let tgPlayers = [];
let tgAssignments = [];

async function initTeamGenerator() {
  const page = document.getElementById('page-team-generator');

  // Render immediately from cached STATE (instant)
  tgPlayers = [...STATE.players];
  renderTeamGenerator(page);

  // Background-fetch fresh data and re-render
  if (STATE.gasUrl) {
    try {
      const [pd, td] = await Promise.all([
        API.safeGet('players', {}, 'players'),
        API.safeGet('teams', {}, 'teams')
      ]);
      if (pd?.players) STATE.players = pd.players;
      if (td?.teams)   STATE.teams   = td.teams;
      tgPlayers = [...STATE.players];
      if (STATE.currentPage === 'team-generator') renderTeamGenerator(page);
    } catch (_) {}
  }
}

function renderTeamGenerator(page) {
  const presentPlayers = tgPlayers.filter(p => p.Present === 'Yes');
  const assigned = tgPlayers.filter(p => p.AssignedTeam);
  const numTeams = Number(STATE.settings.NUM_TEAMS || 4);
  const teamsPerGameVal = STATE.settings.TEAMS_PER_GAME || 'ALL';
  const teamsPerGame = (teamsPerGameVal === 'ALL' || !teamsPerGameVal) ? numTeams : Number(teamsPerGameVal);
  const numGames = (teamsPerGame >= numTeams || teamsPerGame <= 0) ? 1 : Math.ceil(numTeams / teamsPerGame);
  const teams = STATE.teams;

  page.innerHTML = `
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="section-title">🎭 Team Generator</h2>
      ${STATE.isAdmin ? `<button class="btn btn-danger btn-sm" onclick="confirmResetTeams()">🔄 Reset Teams</button>` : ''}
    </div>

    <!-- Two Column Layout -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-6)">

      <!-- Left: Player Registration -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">👥 Players
            <span class="badge badge-gold">${presentPlayers.length} Present</span>
          </div>
          ${STATE.isAdmin ? `
          <div class="flex gap-2">
            <button class="btn btn-sm btn-primary" onclick="showAddPlayerModal()">+ Add Player</button>
            <button class="btn btn-sm btn-secondary" onclick="showBulkAddPlayerModal()">📥 Bulk Import</button>
          </div>` : ''}
        </div>

        <!-- Search -->
        <div class="form-group" style="margin-bottom:var(--space-4)">
          <input type="text" class="form-control" placeholder="🔍 Search players..."
            id="player-search" oninput="filterPlayers(this.value)">
        </div>

        <!-- Bulk Actions (Admin only) -->
        ${STATE.isAdmin ? `
        <div class="flex gap-2" style="margin-bottom:var(--space-3)">
          <button class="btn btn-sm btn-secondary" onclick="markAllPresent()">✅ All Present</button>
          <button class="btn btn-sm btn-secondary" onclick="markAllAbsent()">❌ All Absent</button>
        </div>` : ''}

        <!-- Player List -->
        <div id="player-list" style="max-height:420px;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-2)">
          ${renderPlayerList(tgPlayers)}
        </div>
      </div>

      <!-- Right: Teams & Assignment -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">

        <!-- Team Setup -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">🏷️ Teams</div>
            ${STATE.isAdmin ? `<button class="btn btn-sm btn-secondary" onclick="showTeamSetupModal()">Edit Teams</button>` : ''}
          </div>
          <div id="team-quick-list">
            ${teams.length === 0
              ? `<div class="empty-state" style="padding:var(--space-6)">
                  <div style="font-size:32px">🏷️</div>
                  <div style="font-size:var(--text-sm);color:var(--text-muted);margin-top:var(--space-2)">No teams configured yet</div>
                  ${STATE.isAdmin ? `<button class="btn btn-sm btn-primary" style="margin-top:var(--space-3)" onclick="showTeamSetupModal()">Setup Teams</button>` : ''}
                </div>`
              : teams.map(t => `
                <div class="flex items-center justify-between" style="padding:var(--space-3);border-bottom:1px solid var(--border-subtle)">
                  <div class="flex items-center gap-2">
                    <div class="team-avatar" style="width:32px;height:32px;background:${t.Color};font-size:12px">${teamInitials(t.TeamName)}</div>
                    <div>
                      <div style="font-weight:600;font-size:var(--text-sm)">${t.TeamName}</div>
                      <div style="font-size:var(--text-xs);color:var(--text-muted)">Captain: ${t.Captain || '—'}</div>
                    </div>
                  </div>
                  <span class="badge badge-purple">${Number(t.CurrentMembers||0)} members</span>
                </div>`).join('')}
          </div>
        </div>

        <!-- Game Assignment Card -->
        ${teams.length > 0 && STATE.isAdmin ? `
        <div class="card" style="border-color:rgba(124,58,237,0.3)">
          <div class="card-header">
            <div class="card-title">🎮 Game Assignments</div>
            <span class="badge badge-purple" style="font-size:10px">${numGames} Games</span>
          </div>
          <div style="font-size:var(--text-xs);color:var(--text-muted);margin-bottom:var(--space-3);line-height:1.5">
            Check which game(s) each team plays. Hit <strong>Save</strong> when done.
          </div>

          <!-- Pending changes banner (hidden until a checkbox is ticked) -->
          <div id="game-assign-pending" style="display:none;margin-bottom:var(--space-3);padding:var(--space-2) var(--space-3);background:rgba(243,156,18,0.12);border:1px solid rgba(243,156,18,0.35);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--warning);display:none;align-items:center;justify-content:space-between">
            <span>⚠️ Unsaved changes</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:0">
            ${teams.map(t => {
              const currentGames = (t.GamesPlaying || 'ALL').split(',').map(s=>s.trim()).filter(Boolean);
              const gameCheckboxes = Array.from({length: numGames}, (_, idx) => {
                const gName = `Game ${idx+1}`;
                const isChecked = currentGames.includes('ALL') || currentGames.includes(gName) || !t.GamesPlaying;
                return `<label style="display:flex;align-items:center;gap:4px;font-size:var(--text-xs);cursor:pointer;white-space:nowrap;padding:2px 6px;background:${isChecked?'rgba(124,58,237,0.12)':'transparent'};border-radius:4px">
                  <input type="checkbox" onchange="toggleTeamGame('${t.TeamID}','${gName}',this.checked)" ${isChecked?'checked':''}> G${idx+1}
                </label>`;
              }).join('');
              const labelText = (t.GamesPlaying && t.GamesPlaying !== 'ALL') ? t.GamesPlaying : 'All games';
              const labelColor = (t.GamesPlaying && t.GamesPlaying !== 'ALL') ? 'var(--gold-400)' : 'var(--text-muted)';
              const label = `<span class="game-assign-label" style="font-size:9px;color:${labelColor};font-weight:700;margin-left:4px">${labelText}</span>`;
              return `
                <div data-game-row="${t.TeamID}" style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-1);border-bottom:1px solid var(--border-subtle)">
                  <div style="display:flex;align-items:center;gap:var(--space-2);min-width:0;flex:1">
                    <div class="team-avatar" style="width:26px;height:26px;background:${t.Color};font-size:10px;flex-shrink:0">${teamInitials(t.TeamName)}</div>
                    <div style="font-weight:600;font-size:var(--text-xs);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.TeamName}${label}</div>
                  </div>
                  <div style="display:flex;gap:var(--space-1);flex-shrink:0;margin-left:var(--space-2)">${gameCheckboxes}</div>
                </div>`;
            }).join('')}
          </div>

          <!-- Save button -->
          <div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border-subtle)">
            <button id="game-assign-save-btn" class="btn btn-primary w-full" onclick="saveGameAssignments()">
              💾 Save Game Assignments
            </button>
          </div>
        </div>` : ''}

        <!-- Assignment Controls -->
        ${STATE.isAdmin ? `
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-4)">🎲 Assignment</div>

          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Balancing Mode</label>
            <select class="form-control" id="balance-mode">
              <option value="random">Random</option>
              <option value="gender">Random + Gender Balance</option>
              <option value="age">Random + Age Balance</option>
              <option value="both">Random + Gender + Age Balance</option>
            </select>
          </div>

          <div class="flex gap-3">
            <button class="btn btn-primary w-full" onclick="generateTeams()" style="flex:1">
              🎲 Generate Teams
            </button>
          </div>

          ${presentPlayers.length === 0 ? `
          <div style="margin-top:var(--space-3);padding:var(--space-3);background:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.3);border-radius:var(--radius-md);font-size:var(--text-xs);color:var(--warning)">
            ⚠️ Mark players as Present first to assign teams
          </div>` : `
          <div style="margin-top:var(--space-3);font-size:var(--text-xs);color:var(--text-muted)">
            ${presentPlayers.length} player(s) ready to be assigned to ${numTeams} teams
          </div>`}
        </div>` : ''}
      </div>
    </div>

    <!-- Assignment Result (shown after generate) -->
    <div id="assignment-result" style="display:none">
      <div class="flex items-center justify-between">
        <h3 class="section-title">📋 Team Assignments</h3>
        <div class="flex gap-2">
          <button class="btn btn-success" onclick="saveTeamAssignments()">💾 Save Assignments</button>
          <button class="btn btn-secondary" onclick="generateTeams()">🔄 Regenerate</button>
          <button class="btn btn-secondary" onclick="generateWhatsApp()">📱 Share</button>
        </div>
      </div>
      <div id="team-cards-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:var(--space-4)"></div>
    </div>

    <!-- WhatsApp Share Panel -->
    <div id="whatsapp-panel" style="display:none">
      <div class="card">
        <div class="card-header">
          <div class="card-title">📱 WhatsApp Sharing</div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('whatsapp-panel').style.display='none'">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4)">
          <div>
            <div class="form-label" style="margin-bottom:var(--space-2)">Formatted Text</div>
            <textarea id="wa-text" class="form-control" rows="10" readonly style="font-family:monospace;font-size:var(--text-xs)"></textarea>
            <button class="btn btn-primary w-full" style="margin-top:var(--space-2)" onclick="copyWAText()">📋 Copy Text</button>
          </div>
          <div>
            <div class="form-label" style="margin-bottom:var(--space-2)">Team Image</div>
            <canvas id="team-image-canvas" style="width:100%;border-radius:var(--radius-md);border:1px solid var(--border-subtle)"></canvas>
            <button class="btn btn-secondary w-full" style="margin-top:var(--space-2)" onclick="downloadTeamImage()">⬇️ Download Image</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPlayerList(players, filter = '') {
  const filtered = filter
    ? players.filter(p => p.PlayerName.toLowerCase().includes(filter.toLowerCase()))
    : players;

  if (filtered.length === 0) return `<div class="empty-state" style="padding:var(--space-6)">
    <div class="empty-state-icon" style="font-size:32px">👤</div>
    <div class="empty-state-text">No players found</div>
  </div>`;

  return filtered.map(p => `
    <div class="flex items-center gap-3" style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle)" id="prow-${p.PlayerID}">
      ${STATE.isAdmin ? `
      <label class="toggle-switch" style="margin:0">
        <input type="checkbox" ${p.Present === 'Yes' ? 'checked' : ''}
          onchange="togglePresent('${p.PlayerID}', this.checked)">
        <span class="toggle-track"></span>
      </label>` : `<span style="font-size:18px">${p.Present==='Yes'?'✅':'❌'}</span>`}
      <div style="flex:1">
        <div style="font-weight:600;font-size:var(--text-sm)">${p.PlayerName}</div>
        <div style="font-size:var(--text-xs);color:var(--text-muted)">
          ${p.Gender||'—'} · ${p.Age||'—'}
          ${p.AssignedTeam ? `· <span style="color:var(--gold-400)">${p.AssignedTeam}</span>` : ''}
        </div>
      </div>
      ${p.Captain === 'Yes' ? '<span class="badge badge-gold">Captain</span>' : ''}
      ${STATE.isAdmin ? `<button class="btn btn-ghost btn-sm" onclick="deletePlayerConfirm('${p.PlayerID}','${p.PlayerName}')">🗑️</button>` : ''}
    </div>`).join('');
}

function filterPlayers(value) {
  const el = document.getElementById('player-list');
  if (el) el.innerHTML = renderPlayerList(tgPlayers, value);
}

async function togglePresent(playerId, present) {
  const player = tgPlayers.find(p => p.PlayerID === playerId);
  if (!player) return;
  player.Present = present ? 'Yes' : 'No';
  await API.safePost('update_player', { data: { PlayerID: playerId, Present: player.Present } });
}

async function markAllPresent() {
  for (const p of tgPlayers) p.Present = 'Yes';
  document.getElementById('player-list').innerHTML = renderPlayerList(tgPlayers);
  for (const p of tgPlayers) {
    await API.safePost('update_player', { data: { PlayerID: p.PlayerID, Present: 'Yes' } });
  }
  Toast.success('All players marked present');
}

async function markAllAbsent() {
  for (const p of tgPlayers) p.Present = 'No';
  document.getElementById('player-list').innerHTML = renderPlayerList(tgPlayers);
  Toast.info('All players marked absent');
}

function generateTeams() {
  const presentPlayers = tgPlayers.filter(p => p.Present === 'Yes');
  if (presentPlayers.length === 0) {
    Toast.warning('No present players to assign!'); return;
  }
  if (STATE.teams.length === 0) {
    Toast.warning('No teams configured! Set up teams first.'); return;
  }

  const mode = document.getElementById('balance-mode')?.value || 'random';
  const numTeams = STATE.teams.length;

  // Shuffle players
  let pool = [...presentPlayers];
  shuffleArray(pool);

  // Balance if needed
  if (mode === 'gender' || mode === 'both') {
    pool = balanceByGender(pool, numTeams);
  }
  if (mode === 'age' || mode === 'both') {
    pool = balanceByAge(pool, numTeams);
  }

  // Assign round-robin
  tgAssignments = [];
  pool.forEach((player, i) => {
    const team = STATE.teams[i % numTeams];
    const isFirst = i < numTeams; // first player in each team = captain (mode: first)
    tgAssignments.push({
      PlayerID: player.PlayerID, PlayerName: player.PlayerName,
      TeamID: team.TeamID, TeamName: team.TeamName,
      Gender: player.Gender, Age: player.Age,
      Captain: isFirst && getSetting('CAPTAIN_MODE','first') === 'first' ? 'Yes' : 'No'
    });
  });

  renderAssignmentResult();
  Sound.play('team_assigned');
  if (STATE.settings.CONFETTI_ON !== 'false') Confetti.burst(80);
  Toast.success('Teams generated! Review and save.');
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function balanceByGender(pool, numTeams) {
  const males   = pool.filter(p => p.Gender === 'Male');
  const females = pool.filter(p => p.Gender === 'Female');
  const others  = pool.filter(p => !p.Gender || (p.Gender !== 'Male' && p.Gender !== 'Female'));
  shuffleArray(males); shuffleArray(females); shuffleArray(others);
  const result = [];
  // Interleave M/F
  let mi = 0, fi = 0;
  while (mi < males.length || fi < females.length) {
    if (mi < males.length)   result.push(males[mi++]);
    if (fi < females.length) result.push(females[fi++]);
  }
  result.push(...others);
  return result;
}

function balanceByAge(pool, numTeams) {
  return pool.sort((a, b) => (Number(a.Age)||25) - (Number(b.Age)||25));
}

function renderAssignmentResult() {
  const result = document.getElementById('assignment-result');
  const grid   = document.getElementById('team-cards-grid');
  if (!result || !grid) return;
  result.style.display = '';

  // Group by team
  const teamMap = {};
  tgAssignments.forEach(a => {
    if (!teamMap[a.TeamID]) teamMap[a.TeamID] = { ...STATE.teams.find(t => t.TeamID === a.TeamID), members: [] };
    teamMap[a.TeamID].members.push(a);
  });

  grid.innerHTML = Object.values(teamMap).map(team => `
    <div class="team-card" style="border-color:${team.Color}55">
      <div class="team-card-header" style="background:${team.Color}22;border-bottom:1px solid ${team.Color}33">
        <div class="team-avatar" style="background:${team.Color}">${teamInitials(team.TeamName)}</div>
        <div>
          <div class="team-card-name">${team.TeamName}</div>
          <div class="team-card-meta">${team.members.length} members</div>
        </div>
      </div>
      <div class="team-card-body">
        <div style="display:flex;flex-wrap:wrap">
          ${team.members.map(m => `
            <span class="member-pill ${m.Captain==='Yes'?'captain':''}">
              ${m.Captain==='Yes'?'👑 ':''}${m.PlayerName}
            </span>`).join('')}
        </div>
      </div>
      ${STATE.isAdmin ? `
      <div style="padding:0 var(--space-4) var(--space-4)">
        <button class="btn btn-ghost btn-sm w-full" onclick="showTeamEditModal('${team.TeamID}')">✏️ Edit Members</button>
      </div>` : ''}
    </div>`).join('');

  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function saveTeamAssignments() {
  if (tgAssignments.length === 0) { Toast.warning('No assignments to save'); return; }
  try {
    await API.safePost('assign_team_members', { assignments: tgAssignments });
    // Update local state
    tgPlayers.forEach(p => {
      const a = tgAssignments.find(x => x.PlayerID === p.PlayerID);
      if (a) { p.AssignedTeam = a.TeamName; p.Captain = a.Captain; }
    });
    STATE.players = tgPlayers;
    // Update status
    await API.safePost('save_settings', { data: { CURRENT_STATUS: 'games' } });
    STATE.settings.CURRENT_STATUS = 'games';
    Sound.play('confetti');
    Confetti.burst(150);
    Toast.success('✅ Teams saved successfully!');
    document.getElementById('player-list').innerHTML = renderPlayerList(tgPlayers);
  } catch (err) {
    Toast.error('Save failed: ' + err.message);
  }
}

function generateWhatsApp() {
  const panel = document.getElementById('whatsapp-panel');
  const textEl = document.getElementById('wa-text');
  if (!panel || !textEl) return;

  // Group by team
  const teamMap = {};
  tgAssignments.forEach(a => {
    if (!teamMap[a.TeamID]) teamMap[a.TeamID] = { ...STATE.teams.find(t=>t.TeamID===a.TeamID)||{}, members:[] };
    teamMap[a.TeamID].members.push(a);
  });

  const teamsText = Object.values(teamMap).map(team => {
    const captain = team.members.find(m => m.Captain === 'Yes');
    const others  = team.members.filter(m => m.Captain !== 'Yes');
    return `🎤 *${team.TeamName}*\n` +
           (captain ? `👑 Captain: ${captain.PlayerName}\n` : '') +
           `Members:\n${others.map(m => `• ${m.PlayerName}`).join('\n')}`;
  }).join('\n\n');

  let template = STATE.settings.WHATSAPP_TEMPLATE || '🎵 {EVENT_NAME} 🎵\n\n{TEAMS}\n\nReady for tonight!';
  const text = template
    .replace('{EVENT_NAME}', STATE.settings.EVENT_NAME || 'Event')
    .replace('{TEAMS}', teamsText);

  textEl.value = text;
  panel.style.display = '';
  generateTeamImage(teamMap);
  panel.scrollIntoView({ behavior: 'smooth' });
}

function copyWAText() {
  const el = document.getElementById('wa-text');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => Toast.success('Text copied!')).catch(() => {
    el.select(); document.execCommand('copy'); Toast.success('Text copied!');
  });
}

function generateTeamImage(teamMap) {
  const canvas = document.getElementById('team-image-canvas');
  if (!canvas) return;
  const W = Number(STATE.settings.IMAGE_WIDTH || 1200);
  const H = Number(STATE.settings.IMAGE_HEIGHT || 630);
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#0A0015');
  grad.addColorStop(0.5, '#1E0040');
  grad.addColorStop(1, '#0A0015');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Gold border
  ctx.strokeStyle = '#F5A623';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, W-20, H-20);

  // Title
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F5A623';
  ctx.font = `bold ${Math.floor(W/15)}px Cinzel, serif`;
  ctx.fillText('🎵 ' + (STATE.settings.EVENT_NAME || 'Team Assignment') + ' 🎵', W/2, 80);

  ctx.font = `${Math.floor(W/30)}px Inter, sans-serif`;
  ctx.fillStyle = '#B8A8D0';
  ctx.fillText('Team Assignments', W/2, 120);

  // Draw teams
  const teams = Object.values(teamMap);
  const cols  = Math.min(teams.length, 4);
  const rows  = Math.ceil(teams.length / cols);
  const cardW = (W - 80) / cols;
  const cardH = (H - 160) / rows;
  const startY = 145;

  teams.forEach((team, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 40 + col * cardW;
    const y = startY + row * cardH;

    // Card background
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    roundRect(ctx, x+5, y+5, cardW-10, cardH-10, 12);
    ctx.fill();

    // Team color stripe
    ctx.fillStyle = team.Color || '#7B3FA0';
    roundRect(ctx, x+5, y+5, cardW-10, 6, 6);
    ctx.fill();

    // Team name
    ctx.fillStyle = team.Color || '#F5A623';
    ctx.font = `bold ${Math.floor(W/40)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(team.TeamName, x + cardW/2, y + 40);

    // Members
    ctx.fillStyle = '#F5F0FF';
    ctx.font = `${Math.floor(W/55)}px Inter, sans-serif`;
    let memberY = y + 65;
    team.members.forEach(m => {
      if (memberY > y + cardH - 15) return;
      const prefix = m.Captain === 'Yes' ? '👑 ' : '• ';
      ctx.fillText(prefix + m.PlayerName, x + cardW/2, memberY);
      memberY += Math.floor(W/52);
    });
  });

  // Footer
  ctx.fillStyle = '#7A6890';
  ctx.font = `${Math.floor(W/70)}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(new Date().toLocaleDateString([], { weekday:'long', day:'numeric', month:'long', year:'numeric' }), W/2, H-20);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
}

function downloadTeamImage() {
  const canvas = document.getElementById('team-image-canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `${STATE.settings.EVENT_NAME || 'teams'}-teams.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  Toast.success('Image downloaded!');
}

function showAddPlayerModal() {
  const html = `
    <div class="modal-overlay" id="add-player-modal">
      <div class="modal">
        <div class="modal-title">👤 Add Player</div>
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div class="form-group">
              <label class="form-label">Player Name *</label>
              <input type="text" class="form-control" id="ap-name" placeholder="Full name" autofocus>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Gender</label>
                <select class="form-control" id="ap-gender">
                  <option value="">— Select —</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Age</label>
                <input type="number" class="form-control" id="ap-age" min="1" max="120">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Mobile</label>
              <input type="tel" class="form-control" id="ap-mobile" placeholder="Optional">
            </div>
            <div class="form-group">
              <label class="form-label">Remarks</label>
              <input type="text" class="form-control" id="ap-remarks" placeholder="Optional notes">
            </div>
            <label class="flex items-center gap-3" style="cursor:pointer">
              <input type="checkbox" id="ap-present" checked>
              <span class="form-label" style="margin:0">Mark as Present</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="Modal.closeAll()">Cancel</button>
          <button class="btn btn-primary" onclick="addPlayerSubmit()">Add Player</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('ap-name')?.focus();
  document.getElementById('add-player-modal').addEventListener('keydown', e => {
    if (e.key === 'Enter') addPlayerSubmit();
  });
}

async function addPlayerSubmit() {
  const name = document.getElementById('ap-name')?.value?.trim();
  if (!name) { Toast.warning('Player name is required'); return; }
  const data = {
    PlayerName: name,
    Gender:   document.getElementById('ap-gender')?.value || '',
    Age:      document.getElementById('ap-age')?.value || '',
    Mobile:   document.getElementById('ap-mobile')?.value || '',
    Remarks:  document.getElementById('ap-remarks')?.value || '',
    Present:  document.getElementById('ap-present')?.checked ? 'Yes' : 'No'
  };
  Modal.closeAll();
  const result = await API.safePost('add_player', { data });
  if (result?.player) {
    tgPlayers.push(result.player);
    tgPlayers.sort((a, b) => a.PlayerName.localeCompare(b.PlayerName));
    STATE.players = tgPlayers;
    document.getElementById('player-list').innerHTML = renderPlayerList(tgPlayers);
    Toast.success(`✅ ${name} added`);
  }
}

function showBulkAddPlayerModal() {
  const html = `
    <div class="modal-overlay" id="bulk-add-modal">
      <div class="modal" style="max-width:550px">
        <div class="modal-title">📥 Bulk Import Players</div>
        <div class="modal-body">
          <div style="display:flex;flex-direction:column;gap:var(--space-4)">
            <div style="font-size:var(--text-xs);color:var(--text-muted)">
              Paste your list of registered players below. Enter one player per line.<br>
              Formats supported:<br>
              • <code>John Doe</code> (Name only)<br>
              • <code>John Doe, Male, 25, 9876543210</code> (Name, Gender, Age, Mobile)
            </div>
            <div class="form-group">
              <label class="form-label">Player List *</label>
              <textarea class="form-control" id="bap-text" rows="8" placeholder="Rahul Sharma, Male, 28&#10;Priya Patel, Female, 24&#10;Amit Kumar"></textarea>
            </div>
            <label class="flex items-center gap-3" style="cursor:pointer">
              <input type="checkbox" id="bap-present">
              <span class="form-label" style="margin:0">Mark all imported players as Present at venue</span>
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="Modal.closeAll()">Cancel</button>
          <button class="btn btn-primary" onclick="submitBulkAddPlayers()">Import Players</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('bap-text')?.focus();
}

async function submitBulkAddPlayers() {
  const rawText = document.getElementById('bap-text')?.value?.trim();
  if (!rawText) { Toast.warning('Please paste or type player names'); return; }
  const markPresent = document.getElementById('bap-present')?.checked ? 'Yes' : 'No';
  
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) { Toast.warning('No valid lines found'); return; }

  const playersToImport = lines.map(line => {
    const parts = line.split(',').map(p => p.trim());
    return {
      PlayerName: parts[0] || '',
      Gender:     parts[1] || '',
      Age:        parts[2] || '',
      Mobile:     parts[3] || '',
      Present:    markPresent,
      Remarks:    'Bulk Import'
    };
  }).filter(p => p.PlayerName);

  if (playersToImport.length === 0) { Toast.warning('No valid player names parsed'); return; }

  Modal.closeAll();
  Toast.info(`Importing ${playersToImport.length} player(s)...`);

  const result = await API.safePost('bulk_add_players', { players: playersToImport });
  if (result?.players) {
    result.players.forEach(p => tgPlayers.push(p));
    tgPlayers.sort((a, b) => a.PlayerName.localeCompare(b.PlayerName));
    STATE.players = tgPlayers;
    document.getElementById('player-list').innerHTML = renderPlayerList(tgPlayers);
    Toast.success(`✅ Imported ${result.count} player(s) successfully!`);
  } else {
    Toast.error('Bulk import failed');
  }
}

async function deletePlayerConfirm(id, name) {
  const confirmed = await Modal.confirm(`Delete player <strong>${name}</strong>?`);
  if (!confirmed) return;
  await API.safePost('delete_player', { playerId: id });
  tgPlayers = tgPlayers.filter(p => p.PlayerID !== id);
  STATE.players = tgPlayers;
  document.getElementById('player-list').innerHTML = renderPlayerList(tgPlayers);
  Toast.success('Player deleted');
}

function showTeamSetupModal() {
  const numTeams = Number(STATE.settings.NUM_TEAMS || 4);
  const colors = ['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6','#1ABC9C','#E67E22','#34495E'];
  const names  = ['Sur','Taal','Raag','Lay','Sangeet','Swar','Dhun','Sangam'];

  const existing = STATE.teams.length > 0 ? STATE.teams : Array.from({length: numTeams}, (_, i) => ({
    TeamID: `TM_${i+1}`, TeamName: names[i] || `Team ${i+1}`, Color: colors[i], Captain: '', Logo: ''
  }));

  const html = `
    <div class="modal-overlay" id="team-setup-modal">
      <div class="modal" style="max-width:600px">
        <div class="modal-title">🏷️ Team Setup</div>
        <div class="modal-body">
          <div id="team-setup-rows">
            ${existing.map((t, i) => `
              <div class="flex items-center gap-3" style="margin-bottom:var(--space-3)">
                <input type="color" value="${t.Color}" id="tc-${i}" style="width:40px;height:40px;border:none;border-radius:var(--radius-md);cursor:pointer;padding:0">
                <input type="text" class="form-control" value="${t.TeamName}" id="tn-${i}" placeholder="Team name" style="flex:1">
              </div>`).join('')}
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost" onclick="Modal.closeAll()">Cancel</button>
          <button class="btn btn-primary" onclick="saveTeamSetup(${existing.length})">Save Teams</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveTeamSetup(count) {
  const existing = STATE.teams.length > 0 ? STATE.teams : Array.from({length: count}, (_, i) => ({ TeamID: `TM_${i+1}` }));
  const teams = existing.map((t, i) => ({
    ...t,
    TeamName: document.getElementById(`tn-${i}`)?.value || t.TeamName || `Team ${i+1}`,
    Color:    document.getElementById(`tc-${i}`)?.value || t.Color || '#7B3FA0',
  }));
  Modal.closeAll();
  await API.safePost('save_teams', { teams });
  STATE.teams = teams;
  Toast.success('Teams saved!');
  renderTeamGenerator(document.getElementById('page-team-generator'));
}

async function confirmResetTeams() {
  const confirmed = await Modal.confirm('Reset all team assignments? This will unassign all players.');
  if (!confirmed) return;
  await API.safePost('reset_event', {});
  tgAssignments = [];
  tgPlayers.forEach(p => { p.AssignedTeam = ''; p.Captain = 'No'; });
  STATE.players = tgPlayers;
  Toast.success('Teams reset');
  initTeamGenerator();
}

// ── Game Assignments ─────────────────────────────────────────
// Checkbox change: update memory only, NO API call yet
function toggleTeamGame(teamId, gameName, checked) {
  const team = STATE.teams.find(t => t.TeamID === teamId);
  if (!team) return;

  const numTeams = Number(STATE.settings.NUM_TEAMS || 4);
  const teamsPerGameVal = STATE.settings.TEAMS_PER_GAME || 'ALL';
  const teamsPerGame = (teamsPerGameVal === 'ALL' || !teamsPerGameVal) ? numTeams : Number(teamsPerGameVal);
  const numGames = (teamsPerGame >= numTeams || teamsPerGame <= 0) ? 1 : Math.ceil(numTeams / teamsPerGame);

  // Expand 'ALL' to explicit list so we can manipulate it
  let currentGames = (team.GamesPlaying || 'ALL').split(',').map(s => s.trim()).filter(Boolean);
  if (currentGames.includes('ALL') || !team.GamesPlaying) {
    currentGames = Array.from({length: numGames}, (_, i) => `Game ${i + 1}`);
  }

  if (checked) {
    if (!currentGames.includes(gameName)) currentGames.push(gameName);
  } else {
    currentGames = currentGames.filter(g => g !== gameName);
  }

  // Collapse back to 'ALL' if all games are selected
  if (currentGames.length >= numGames) {
    team.GamesPlaying = 'ALL';
  } else if (currentGames.length === 0) {
    team.GamesPlaying = 'NONE';
  } else {
    currentGames.sort();
    team.GamesPlaying = currentGames.join(', ');
  }

  // Update label inline without full re-render (preserves checkbox states)
  const row = document.querySelector(`[data-game-row="${teamId}"]`);
  if (row) {
    const lbl = row.querySelector('.game-assign-label');
    if (lbl) {
      lbl.textContent = (team.GamesPlaying && team.GamesPlaying !== 'ALL')
        ? team.GamesPlaying
        : 'All games';
      lbl.style.color = (team.GamesPlaying && team.GamesPlaying !== 'ALL')
        ? 'var(--gold-400)' : 'var(--text-muted)';
    }
  }

  // Show the pending-changes banner and highlight the save button
  const pending = document.getElementById('game-assign-pending');
  if (pending) pending.style.display = 'flex';
  const saveBtn = document.getElementById('game-assign-save-btn');
  if (saveBtn) {
    saveBtn.style.background = 'var(--gold-500)';
    saveBtn.style.color = '#000';
    saveBtn.textContent = '💾 Save Game Assignments ●';
  }
}

// Save button: this is the ONLY place that calls the API
async function saveGameAssignments() {
  const saveBtn = document.getElementById('game-assign-save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Saving…'; }
  try {
    await API.safePost('save_teams', { teams: STATE.teams });
    Toast.success('Game assignments saved!');
    // Full re-render to sync labels
    renderTeamGenerator(document.getElementById('page-team-generator'));
  } catch (err) {
    Toast.error('Save failed — will retry when connection restores');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Save Game Assignments ●'; }
  }
}
