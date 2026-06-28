/**
 * Finals Page — Full celebration: 3rd → 2nd → 1st reveal, fireworks, spotlight, applause
 */
let finalsData = { qualifiedTeams: [], ranked: [], scores: [] };
let revealStep = 0;

async function initFinals() {
  const page = document.getElementById('page-finals');
  if (STATE.gasUrl) {
    try {
      const fd = await API.safeGet('finals', {}, 'finals');
      if (fd) {
        finalsData.qualifiedTeams = fd.qualifiedTeams || [];
        finalsData.ranked         = fd.ranked         || [];
        finalsData.scores         = fd.scores         || [];
      }
    } catch (_) {}
  }
  renderFinals(page);
}

function renderFinals(page) {
  const qualified = finalsData.qualifiedTeams;
  const ranked    = finalsData.ranked;
  const scores    = finalsData.scores;

  // Calculate finals totals
  const finalTotals = {};
  qualified.forEach(t => { finalTotals[t.TeamID] = 0; });
  scores.forEach(s => {
    if (finalTotals[s.TeamID] !== undefined) finalTotals[s.TeamID] += Number(s.Total)||0;
  });
  const finalRanked = [...qualified].sort((a, b) => (finalTotals[b.TeamID]||0) - (finalTotals[a.TeamID]||0));

  const recentScores = [...scores].slice(-8).reverse();

  page.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="section-title">🎖️ Finals</h2>
      ${STATE.isAdmin ? `
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" onclick="showQualifyModal()">🏆 Set Qualified Teams</button>
        <button class="btn btn-sm btn-danger" onclick="startCelebration()">🎆 Reveal Winner!</button>
      </div>` : ''}
    </div>

    ${qualified.length === 0 ? `
    <div class="card">
      <div class="empty-state">
        <div class="empty-state-icon">🏆</div>
        <div class="empty-state-title">No Finalists Qualified Yet</div>
        <div class="empty-state-text">Use the button above to auto-qualify top teams, pick randomly, or manually select finalists. You can also run Semifinal → Final bracket.</div>
        ${STATE.isAdmin ? `
        <div style="display:flex;gap:var(--space-2);margin-top:var(--space-4);flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" onclick="showQualifyModal()">🏆 Set Qualified Teams</button>
          <button class="btn btn-secondary" onclick="autoQualifyTeams()">⚡ Auto-Qualify Top ${STATE.settings.FINALISTS_COUNT || 2}</button>
        </div>` : ''}
      </div>
    </div>` : `

    <!-- Finals Scoreboard -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:var(--space-6)">

      <!-- Left: Score Entry + Ranking -->
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">

        <!-- Qualified Teams -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-4)">🎭 Finalist Teams</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-3)">
            ${qualified.map(t => `
              <div class="team-card" style="border-color:${t.Color}55">
                <div class="team-card-header" style="background:${t.Color}22;border-bottom:1px solid ${t.Color}33">
                  <div class="team-avatar" style="background:${t.Color}">${teamInitials(t.TeamName)}</div>
                  <div>
                    <div class="team-card-name">${t.TeamName}</div>
                    <div class="team-card-meta">Finals Score: <strong>${finalTotals[t.TeamID]||0}</strong></div>
                  </div>
                </div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Finals Ranking -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-4)">🏅 Finals Ranking</div>
          <div style="overflow-x:auto">
            <table class="scoreboard-table">
              <thead>
                <tr><th>Rank</th><th>Team</th><th>Finals Score</th><th>Overall Score</th></tr>
              </thead>
              <tbody>
                ${finalRanked.map((t, i) => {
                  const rank = i + 1;
                  const rankCls = rankBadgeClass(rank);
                  return `
                    <tr class="scoreboard-row rank-${rank}">
                      <td><div class="rank-badge ${rankCls}">${rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank}</div></td>
                      <td>
                        <div class="flex items-center gap-2">
                          <div class="team-avatar" style="background:${t.Color};width:36px;height:36px">${teamInitials(t.TeamName)}</div>
                          <span style="font-weight:700">${t.TeamName}</span>
                        </div>
                      </td>
                      <td><span class="score-display" style="font-size:var(--text-xl)">${finalTotals[t.TeamID]||0}</span></td>
                      <td><span style="color:var(--text-muted)">${t.TotalScore||0}</span></td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${STATE.isAdmin ? `
        <!-- Finals Score Entry -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-4)">📝 Enter Finals Score</div>
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Team</label>
            <div class="team-picker-grid">
              ${qualified.map(t => `
                <button class="team-picker-btn" id="fpick-${t.TeamID}" onclick="selectFinalTeam('${t.TeamID}')">
                  <div class="team-avatar" style="background:${t.Color};width:40px;height:40px">${teamInitials(t.TeamName)}</div>
                  <div class="team-picker-score">${finalTotals[t.TeamID]||0}</div>
                  <div class="team-picker-name">${t.TeamName}</div>
                </button>`).join('')}
            </div>
          </div>
          <div class="form-row" style="margin-bottom:var(--space-3)">
            <div class="form-group">
              <label class="form-label">Round</label>
              <select class="form-control" id="finals-round">
                ${Array.from({length:Number(STATE.settings.ROUNDS_PER_GAME||3)},(_,i)=>`<option>Round ${i+1}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="score-input-grid" style="grid-template-columns:repeat(4,1fr)">
            ${[['Positive','fpos','positive'],['Negative','fneg','negative'],['Bonus','fbon','bonus'],['Adjustment','fadj','adjust']].map(([l,id,cls]) => `
              <div class="score-input-wrapper ${cls}">
                <span class="score-input-label ${cls}">${l}</span>
                <input type="number" id="${id}" value="${l==='Negative'||l==='Bonus'?'0':l==='Positive'?STATE.settings.POSITIVE_MARKS||10:'0'}" min="0" oninput="updateFinalPreview()">
              </div>`).join('')}
          </div>
          <div class="score-total-preview" style="margin-top:var(--space-4)">
            <div class="score-total-num zero" id="final-preview">0</div>
            <div style="font-size:var(--text-xs);color:var(--text-muted)">Finals Points</div>
          </div>
          <div class="form-group" style="margin-top:var(--space-3)">
            <input type="text" class="form-control" id="final-remarks" placeholder="Remarks (optional)">
          </div>
          <button class="btn btn-primary w-full" style="margin-top:var(--space-3)" onclick="submitFinalScore()">✅ Save Finals Score</button>
        </div>` : ''}
      </div>

      <!-- Right: Score History -->
      <div class="card">
        <div class="card-title" style="margin-bottom:var(--space-3)">📜 Finals History</div>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);max-height:500px;overflow-y:auto">
          ${recentScores.length > 0 ? recentScores.map(s => `
            <div style="padding:var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
              <div class="flex items-center justify-between">
                <span style="font-weight:600;font-size:var(--text-sm)">${s.TeamName}</span>
                <span class="badge ${s.Total>=0?'badge-green':'badge-red'}">${s.Total>=0?'+':''}${s.Total}</span>
              </div>
              <div style="font-size:var(--text-xs);color:var(--text-muted);margin-top:3px">
                ${s.Round||''} · ${formatTime(s.Timestamp)}
              </div>
            </div>`).join('')
          : `<div class="empty-state" style="padding:var(--space-6)">
              <div class="empty-state-icon" style="font-size:32px">📊</div>
              <div class="empty-state-text">No finals scores yet</div>
            </div>`}
        </div>
        ${STATE.isAdmin && finalRanked.length >= 2 ? `
        <div class="divider"></div>
        <button class="btn btn-primary w-full btn-lg" onclick="startCelebration()">
          🎆 Reveal Winners!
        </button>` : ''}
      </div>
    </div>`}

    <!-- Celebration Overlay -->
    <div id="celebration-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:8500;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-8)">
      <div style="position:absolute;top:var(--space-6);right:var(--space-6)">
        <button class="btn btn-ghost" onclick="endCelebration()">✕ Exit</button>
      </div>
      <div style="text-align:center">
        <div id="reveal-announcement" style="font-family:var(--font-display);font-size:var(--text-3xl);color:var(--gold-400);margin-bottom:var(--space-4);text-shadow:var(--glow-gold)"></div>
        <div class="reveal-podium" id="reveal-podium"></div>
      </div>
      <button id="reveal-next-btn" class="btn btn-xl btn-primary" onclick="revealNext()" style="display:none">
        🎺 Reveal Next
      </button>
    </div>
  `;
}

let finalSelectedTeam = null;

function selectFinalTeam(teamId) {
  finalSelectedTeam = finalsData.qualifiedTeams.find(t => t.TeamID === teamId);
  document.querySelectorAll('[id^="fpick-"]').forEach(b => b.classList.remove('selected'));
  const btn = document.getElementById(`fpick-${teamId}`);
  if (btn) { btn.classList.add('selected'); btn.style.borderColor = finalSelectedTeam?.Color || 'transparent'; }
}

function updateFinalPreview() {
  const pos = Number(document.getElementById('fpos')?.value||0);
  const neg = Number(document.getElementById('fneg')?.value||0);
  const bon = Number(document.getElementById('fbon')?.value||0);
  const adj = Number(document.getElementById('fadj')?.value||0);
  const total = pos - neg + bon + adj;
  const el = document.getElementById('final-preview');
  if (el) {
    el.textContent = (total>=0?'+':'')+total;
    el.className = `score-total-num ${scoreClass(total)}`;
  }
}

async function submitFinalScore() {
  if (!finalSelectedTeam) { Toast.warning('Select a team first'); return; }
  const pos = Number(document.getElementById('fpos')?.value||0);
  const neg = Number(document.getElementById('fneg')?.value||0);
  const bon = Number(document.getElementById('fbon')?.value||0);
  const adj = Number(document.getElementById('fadj')?.value||0);
  const data = {
    TeamID: finalSelectedTeam.TeamID, TeamName: finalSelectedTeam.TeamName,
    Round:  document.getElementById('finals-round')?.value || 'Round 1',
    Positive: pos, Negative: neg, Bonus: bon, Penalty: 0, Adjustment: adj,
    Remarks: document.getElementById('final-remarks')?.value || ''
  };
  await API.safePost('add_final_score', { data });
  Sound.play('correct');
  Toast.success(`Finals score saved for ${finalSelectedTeam.TeamName}`);
  initFinals();
}

async function autoQualifyTeams() {
  const count = Number(STATE.settings.FINALISTS_COUNT || 2);
  const top = STATE.scoreboard.slice(0, count);
  if (top.length === 0) { Toast.warning('No scoreboard data yet'); return; }
  await API.safePost('save_finals', { data: { qualifiedTeams: top.map(t => t.TeamID) } });
  Toast.success(`Top ${count} teams qualified`);
  initFinals();
}

function showQualifyModal() {
  const allTeams = STATE.teams;
  const qualifiedIds = finalsData.qualifiedTeams.map(t => t.TeamID);

  const teamRows = allTeams.map(t => {
    const isChecked = qualifiedIds.includes(t.TeamID);
    return `
      <label id="qm-label-${t.TeamID}" class="flex items-center gap-3"
        style="padding:var(--space-2) var(--space-3);background:var(--bg-elevated);border-radius:var(--radius-md);cursor:pointer;border:1.5px solid ${isChecked ? t.Color + '55' : 'transparent'};transition:border-color 0.2s">
        <input type="checkbox" value="${t.TeamID}" ${isChecked ? 'checked' : ''} id="qm-${t.TeamID}"
          onchange="document.getElementById('qm-label-${t.TeamID}').style.borderColor = this.checked ? '${t.Color}55' : 'transparent'">
        <div class="team-avatar" style="width:28px;height:28px;background:${t.Color};font-size:11px">${teamInitials(t.TeamName)}</div>
        <span style="font-weight:600;font-size:var(--text-sm);flex:1">${t.TeamName}</span>
        <span style="color:var(--text-muted);font-size:var(--text-xs)">Score: ${t.TotalScore || 0}</span>
      </label>`;
  }).join('');

  const html = `
    <div class="modal-overlay" id="qualify-modal">
      <div class="modal" style="max-width:520px;max-height:90vh;display:flex;flex-direction:column">
        <div style="padding:var(--space-5) var(--space-5) var(--space-3);border-bottom:1px solid var(--border-subtle);flex-shrink:0">
          <div style="font-size:var(--text-lg);font-weight:800;margin-bottom:4px">🏆 Finals Qualification</div>
          <div style="font-size:var(--text-xs);color:var(--text-muted)">Choose how teams qualify for the Finals or Semifinals</div>
        </div>

        <div style="overflow-y:auto;flex:1;padding:var(--space-4) var(--space-5)">

          <!-- ── Quick Presets ── -->
          <div style="margin-bottom:var(--space-4)">
            <div style="font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-2)">⚡ Quick Presets</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
              <button class="btn btn-secondary btn-sm" onclick="qualifyPreset('top',4)">🏆 Top 4 Teams</button>
              <button class="btn btn-secondary btn-sm" onclick="qualifyPreset('top',2)">🏆 Top 2 Teams</button>
              <button class="btn btn-secondary btn-sm" onclick="qualifyPreset('top',3)">🏆 Top 3 Teams</button>
              <button class="btn btn-secondary btn-sm" onclick="qualifyPreset('top', Number(STATE.settings.FINALISTS_COUNT||2))">🏆 Top ${STATE.settings.FINALISTS_COUNT || 2} (Setting)</button>
            </div>
          </div>

          <div style="border-top:1px solid var(--border-subtle);margin:var(--space-3) 0"></div>

          <!-- ── Random Picker ── -->
          <div style="margin-bottom:var(--space-4)">
            <div style="font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-2)">🎲 Random Picker</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
              <button class="btn btn-secondary btn-sm" onclick="qualifyPreset('random',4)">🎲 4 Random Teams</button>
              <button class="btn btn-secondary btn-sm" onclick="qualifyPreset('random',2)">🎲 2 Random Teams</button>
            </div>
          </div>

          <div style="border-top:1px solid var(--border-subtle);margin:var(--space-3) 0"></div>

          <!-- ── Manual Selection ── -->
          <div style="margin-bottom:var(--space-4)">
            <div style="font-size:10px;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:var(--space-2)">✏️ Manual Selection</div>
            <div style="display:flex;flex-direction:column;gap:var(--space-2)">
              ${teamRows}
            </div>
          </div>

          <!-- ── Bracket Tip ── -->
          <div style="background:rgba(124,58,237,0.08);border:1px solid rgba(124,58,237,0.25);border-radius:var(--radius-md);padding:var(--space-3);font-size:var(--text-xs);line-height:1.6;color:var(--text-secondary)">
            💡 <strong>Running a Semifinal + Final bracket?</strong><br>
            <strong>Step 1:</strong> Use <em>Top 4</em> or pick 4 teams → Save. Play the Semifinal rounds and enter scores.<br>
            <strong>Step 2:</strong> Come back here, <em>uncheck the losing 2 teams</em>, leaving only the 2 Finalists → Save again. Play the Grand Final!
          </div>
        </div>

        <div style="padding:var(--space-3) var(--space-5);border-top:1px solid var(--border-subtle);display:flex;gap:var(--space-2);justify-content:flex-end;flex-shrink:0">
          <button class="btn btn-ghost" onclick="Modal.closeAll()">Cancel</button>
          <button class="btn btn-primary" onclick="saveQualified()">✅ Save Qualified Teams</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

function qualifyPreset(type, count) {
  // Uncheck all first
  document.querySelectorAll('[id^="qm-"]:not([id*="label"])').forEach(cb => {
    cb.checked = false;
    const lbl = document.getElementById('qm-label-' + cb.value);
    if (lbl) lbl.style.borderColor = 'transparent';
  });

  let selectedIds = [];
  if (type === 'top') {
    selectedIds = (STATE.scoreboard || []).slice(0, count).map(t => t.TeamID);
    if (selectedIds.length === 0) {
      // Fallback: use teams sorted by TotalScore
      selectedIds = [...STATE.teams]
        .sort((a, b) => (Number(b.TotalScore) || 0) - (Number(a.TotalScore) || 0))
        .slice(0, count).map(t => t.TeamID);
    }
  } else if (type === 'random') {
    selectedIds = [...STATE.teams]
      .sort(() => 0.5 - Math.random())
      .slice(0, count).map(t => t.TeamID);
  }

  selectedIds.forEach(id => {
    const cb = document.getElementById('qm-' + id);
    if (cb) {
      cb.checked = true;
      const lbl = document.getElementById('qm-label-' + id);
      const team = STATE.teams.find(t => t.TeamID === id);
      if (lbl && team) lbl.style.borderColor = team.Color + '55';
    }
  });

  const label = type === 'top' ? `Top ${count}` : `Random ${count}`;
  Toast.success(`✅ ${label} teams selected — click "Save" to apply`);
}

async function saveQualified() {
  const checked = [...document.querySelectorAll('[id^="qm-"]:not([id*="label"]):checked')].map(cb => cb.value);
  Modal.closeAll();
  if (checked.length === 0) {
    Toast.warning('No teams selected');
    return;
  }
  await API.safePost('save_finals', { data: { qualifiedTeams: checked } });
  Toast.success(`${checked.length} team(s) qualified for Finals`);
  initFinals();
}


// ── Celebration / Reveal ──────────────────────────────────────

function startCelebration() {
  // Sort by score: reveal 3rd → 2nd → 1st
  const finals = finalsData.qualifiedTeams.slice();
  const finalTotals = {};
  finals.forEach(t => { finalTotals[t.TeamID] = 0; });
  finalsData.scores.forEach(s => {
    if (finalTotals[s.TeamID] !== undefined) finalTotals[s.TeamID] += Number(s.Total)||0;
  });
  const ranked = [...finals].sort((a, b) => (finalTotals[b.TeamID]||0) - (finalTotals[a.TeamID]||0));
  // Store reveal order: [3rd, 2nd, 1st]
  window._revealOrder = ranked.slice().reverse(); // worst to best
  window._finalTotals = finalTotals;
  revealStep = 0;

  const overlay = document.getElementById('celebration-overlay');
  if (overlay) {
    overlay.style.display = 'flex';
    document.getElementById('reveal-podium').innerHTML = '';
    document.getElementById('reveal-announcement').textContent = '';
    document.getElementById('reveal-next-btn').style.display = '';
  }

  // Spotlight effect
  const spot = document.createElement('div');
  spot.className = 'spotlight-overlay';
  spot.id = 'spotlight';
  document.body.appendChild(spot);

  revealNext();
}

function revealNext() {
  const order = window._revealOrder || [];
  const totals = window._finalTotals || {};
  if (revealStep >= order.length) { endCelebration(); return; }

  const team = order[revealStep];
  const positionsFromBottom = order.length - revealStep;
  const posLabel = positionsFromBottom === 1 ? '🥇 1st Place' : positionsFromBottom === 2 ? '🥈 2nd Place' : '🥉 3rd Place';
  const posClass = positionsFromBottom === 1 ? 'first' : positionsFromBottom === 2 ? 'second' : 'third';

  // Announcement
  const ann = document.getElementById('reveal-announcement');
  if (ann) {
    ann.textContent = posLabel;
    ann.style.animation = 'none';
    setTimeout(() => { ann.style.animation = 'scorePopIn 0.6s var(--transition-bounce)'; }, 10);
  }

  // Add podium block
  const podium = document.getElementById('reveal-podium');
  if (podium) {
    const div = document.createElement('div');
    div.className = 'podium-position hidden';
    div.style.order = positionsFromBottom === 1 ? 2 : positionsFromBottom === 2 ? 1 : 3; // visual order 2nd-1st-3rd
    div.innerHTML = `
      <div class="team-avatar" style="width:72px;height:72px;background:${team.Color};font-size:28px;border-radius:50%;box-shadow:0 0 30px ${team.Color}66;margin-bottom:var(--space-3)">
        ${teamInitials(team.TeamName)}
      </div>
      <div class="podium-team-name glow-text" style="color:${team.Color}">${team.TeamName}</div>
      <div class="podium-score">${totals[team.TeamID]||0} pts</div>
      <div class="podium-block ${posClass}">${posLabel.split(' ')[0]}</div>
    `;
    podium.appendChild(div);
    setTimeout(() => div.classList.remove('hidden'), 50);
  }

  // Sound + effects
  if (positionsFromBottom === 1) {
    Sound.play('winner');
    setTimeout(() => { Sound.play('applause'); Fireworks.startShow(8000); Confetti.burst(200); }, 500);
    const btn = document.getElementById('reveal-next-btn');
    if (btn) btn.style.display = 'none';
  } else {
    Sound.play('applause');
    Confetti.burst(80);
  }

  revealStep++;
}

function endCelebration() {
  const overlay = document.getElementById('celebration-overlay');
  if (overlay) overlay.style.display = 'none';
  const spot = document.getElementById('spotlight');
  if (spot) spot.remove();
  Fireworks.stopShow();
}
