/**
 * ============================================================
 *  UNIVERSAL GAME SCORING SYSTEM — Google Apps Script Backend
 *  Version: 1.0.0
 *  Deploy as: Web App → Execute as Me → Access: Anyone
 * ============================================================
 */

// ─── CORS & Entry Points ────────────────────────────────────

function doGet(e) {
  const params = e.parameter || {};
  const action = params.action || 'ping';
  let result;
  try {
    result = routeGet(action, params);
  } catch (err) {
    result = { error: err.message, stack: err.stack };
  }
  return jsonResponse(result);
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse(e.postData.contents); } catch (_) {}
  const action = body.action || '';
  let result;
  try {
    result = routePost(action, body);
  } catch (err) {
    result = { error: err.message, stack: err.stack };
  }
  return jsonResponse(result);
}

function jsonResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── GET Router ─────────────────────────────────────────────

function routeGet(action, params) {
  switch (action) {
    case 'ping':             return { status: 'ok', ts: Date.now() };
    case 'settings':         return getSettings();
    case 'players':          return getPlayers();
    case 'teams':            return getTeams();
    case 'team_members':     return getTeamMembers();
    case 'scores':           return getScores(params);
    case 'scoreboard':       return getMasterScoreboard();
    case 'finals':           return getFinals();
    case 'event_log':        return getEventLog(params);
    case 'active_question':  return getActiveQuestion();
    case 'quiz_submissions': return getQuizSubmissions(params);
    case 'quiz_result':      return getQuizResult(params);
    case 'quiz_questions':   return getQuizQuestions();
    case 'quiz_history':     return getQuizHistory();
    default:                 return { error: 'Unknown GET action: ' + action };
  }
}

// ─── POST Router ────────────────────────────────────────────

function routePost(action, body) {
  switch (action) {
    case 'save_settings':      return saveSettings(body.data);
    case 'add_player':         return addPlayer(body.data);
    case 'bulk_add_players':   return bulkAddPlayers(body.players);
    case 'update_player':      return updatePlayer(body.data);
    case 'delete_player':      return deletePlayer(body.playerId);
    case 'save_teams':         return saveTeams(body.teams);
    case 'assign_team_members':return assignTeamMembers(body.assignments);
    case 'add_score':          return addScore(body.data);
    case 'undo_score':         return undoScore(body.scoreId);
    case 'lock_game':          return lockGame(body.gameId, body.locked);
    case 'save_finals':        return saveFinals(body.data);
    case 'add_final_score':    return addFinalScore(body.data);
    case 'log_event':          return logEvent(body.data);
    case 'reset_event':        return resetEvent();
    case 'rebuild_scoreboard': return rebuildMasterScoreboard();
    case 'launch_question':    return launchQuestion(body.data);
    case 'close_question':     return closeQuestion();
    case 'submit_answer':      return submitQuizAnswer(body.data);
    case 'clear_quiz':         return clearQuizSubmissions();
    case 'reset_quiz_questions':return resetQuizQuestions();
    default:                   return { error: 'Unknown POST action: ' + action };
  }
}

// ─── Sheet Helpers ──────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ensureSheet(name);
  return sheet;
}

function ensureSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.insertSheet(name);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function objectsToSheet(sheet, headers, rows) {
  sheet.clearContents();
  if (rows.length === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }
  const data = [headers, ...rows.map(r => headers.map(h => r[h] !== undefined ? r[h] : ''))];
  sheet.getRange(1, 1, data.length, headers.length).setValues(data);
}

function appendRow(sheet, headers, obj) {
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
}

function generateId(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
}

function now() {
  return new Date().toISOString();
}

// ─── SETTINGS ───────────────────────────────────────────────

const SETTINGS_HEADERS = [
  'Key', 'Value', 'Label', 'Type', 'Group', 'Options', 'Description'
];

const DEFAULT_SETTINGS = [
  // System
  { Key: 'GAS_URL',            Value: '',          Label: 'Apps Script URL',     Type: 'url',     Group: 'System',       Options: '', Description: 'Published web app URL' },
  { Key: 'EVENT_NAME',         Value: 'Antakshari Competition', Label: 'Event Name', Type: 'text', Group: 'Event',   Options: '', Description: 'Name of the event' },
  { Key: 'EVENT_LOGO',         Value: '',          Label: 'Event Logo URL',      Type: 'url',     Group: 'Event',        Options: '', Description: 'Logo image URL' },
  { Key: 'THEME_COLOR',        Value: '#F5A623',   Label: 'Theme Color',         Type: 'color',   Group: 'Event',        Options: '', Description: 'Primary accent color' },
  { Key: 'BACKGROUND_THEME',   Value: 'antakshari', Label: 'Background Theme',   Type: 'select',  Group: 'Event',        Options: 'antakshari,quiz,sports,generic', Description: 'Visual theme' },
  { Key: 'CURRENT_STATUS',     Value: 'setup',     Label: 'Event Status',        Type: 'select',  Group: 'Event',        Options: 'setup,registration,assignment,games,finals,complete', Description: 'Current stage' },
  // Teams
  { Key: 'NUM_TEAMS',          Value: '4',         Label: 'Number of Teams',     Type: 'number',  Group: 'Teams',        Options: '', Description: 'Total teams in event' },
  { Key: 'MEMBERS_PER_TEAM',   Value: '6',         Label: 'Members Per Team',    Type: 'number',  Group: 'Teams',        Options: '', Description: 'Target members per team' },
  { Key: 'MAX_PLAYERS',        Value: '30',        Label: 'Maximum Players',     Type: 'number',  Group: 'Teams',        Options: '', Description: 'Max players to register' },
  { Key: 'GENDER_BALANCE',     Value: 'false',     Label: 'Gender Balancing',    Type: 'boolean', Group: 'Teams',        Options: '', Description: 'Balance Male/Female in teams' },
  { Key: 'AGE_BALANCE',        Value: 'false',     Label: 'Age Balancing',       Type: 'boolean', Group: 'Teams',        Options: '', Description: 'Balance age across teams' },
  { Key: 'MIN_MALE',           Value: '2',         Label: 'Min Male Per Team',   Type: 'number',  Group: 'Teams',        Options: '', Description: 'Minimum males per team' },
  { Key: 'MIN_FEMALE',         Value: '2',         Label: 'Min Female Per Team', Type: 'number',  Group: 'Teams',        Options: '', Description: 'Minimum females per team' },
  { Key: 'CAPTAIN_MODE',       Value: 'first',     Label: 'Captain Selection',   Type: 'select',  Group: 'Teams',        Options: 'first,manual,vote', Description: 'How captain is chosen' },
  { Key: 'TEAMS_PER_GAME',      Value: 'ALL',       Label: 'Teams Per Game',      Type: 'select',  Group: 'Teams',        Options: 'ALL,2,3,4,5,6,7,8', Description: 'Number of teams playing in each game' },
  // Games
  { Key: 'NUM_GAMES',          Value: '3',         Label: 'Number of Games',     Type: 'number',  Group: 'Games',        Options: '', Description: 'Total games in event' },
  { Key: 'ROUNDS_PER_GAME',    Value: '3',         Label: 'Rounds Per Game',     Type: 'number',  Group: 'Games',        Options: '', Description: 'Default rounds per game' },
  { Key: 'SUB_ROUNDS',         Value: '2',         Label: 'Sub-Rounds Per Round',Type: 'number',  Group: 'Games',        Options: '', Description: 'Sub-rounds (A, B, C…)' },
  // Scoring
  { Key: 'POSITIVE_MARKS',     Value: '10',        Label: 'Positive Marks',      Type: 'number',  Group: 'Scoring',      Options: '', Description: 'Default positive score' },
  { Key: 'NEGATIVE_MARKS',     Value: '5',         Label: 'Negative Marks',      Type: 'number',  Group: 'Scoring',      Options: '', Description: 'Default negative score' },
  { Key: 'BONUS_MARKS',        Value: '5',         Label: 'Bonus Marks',         Type: 'number',  Group: 'Scoring',      Options: '', Description: 'Default bonus score' },
  { Key: 'PENALTY_MARKS',      Value: '5',         Label: 'Penalty Marks',       Type: 'number',  Group: 'Scoring',      Options: '', Description: 'Default penalty score' },
  // Timer
  { Key: 'TIMER_MODE',         Value: 'settings',  Label: 'Timer Mode',          Type: 'select',  Group: 'Timer',        Options: 'global,round,game_round,settings', Description: 'How timers are determined' },
  { Key: 'DEFAULT_TIMER',      Value: '60',        Label: 'Default Timer (sec)', Type: 'number',  Group: 'Timer',        Options: '', Description: 'Default countdown seconds' },
  { Key: 'LAST_SEC_WARN',      Value: '10',        Label: 'Last Seconds Warning',Type: 'number',  Group: 'Timer',        Options: '', Description: 'When drama animation starts' },
  // Qualification
  { Key: 'FINALISTS_COUNT',    Value: '2',         Label: 'Finalists Count',     Type: 'number',  Group: 'Finals',       Options: '', Description: 'Top N teams qualify' },
  // UI
  { Key: 'ANIMATION_ON',       Value: 'true',      Label: 'Animations',          Type: 'boolean', Group: 'UI',           Options: '', Description: 'Enable animations' },
  { Key: 'SOUND_ON',           Value: 'true',      Label: 'Sounds',              Type: 'boolean', Group: 'UI',           Options: '', Description: 'Enable sounds' },
  { Key: 'CONFETTI_ON',        Value: 'true',      Label: 'Confetti',            Type: 'boolean', Group: 'UI',           Options: '', Description: 'Enable confetti effects' },
  { Key: 'AUTO_SAVE',          Value: 'true',      Label: 'Auto Save',           Type: 'boolean', Group: 'UI',           Options: '', Description: 'Auto-save scores' },
  { Key: 'AUTO_RANKING',       Value: 'true',      Label: 'Auto Ranking',        Type: 'boolean', Group: 'UI',           Options: '', Description: 'Auto-update ranks on save' },
  { Key: 'DARK_MODE',          Value: 'true',      Label: 'Dark Mode Default',   Type: 'boolean', Group: 'UI',           Options: '', Description: 'Default to dark mode' },
  { Key: 'PROJECTOR_MODE',     Value: 'false',     Label: 'Projector Mode',      Type: 'boolean', Group: 'UI',           Options: '', Description: 'Large text projector view' },
  { Key: 'AUTO_REFRESH_SEC',   Value: '30',        Label: 'Auto Refresh (sec)',  Type: 'number',  Group: 'UI',           Options: '', Description: 'Live scoreboard refresh interval' },
  // Images
  { Key: 'IMAGE_WIDTH',        Value: '1200',      Label: 'Image Width (px)',    Type: 'number',  Group: 'Sharing',      Options: '', Description: 'WhatsApp image width' },
  { Key: 'IMAGE_HEIGHT',       Value: '630',       Label: 'Image Height (px)',   Type: 'number',  Group: 'Sharing',      Options: '', Description: 'WhatsApp image height' },
  { Key: 'WHATSAPP_TEMPLATE',  Value: '🎵 {EVENT_NAME} 🎵\n\n{TEAMS}\n\nReady for tonight!', Label: 'WhatsApp Template', Type: 'textarea', Group: 'Sharing', Options: '', Description: 'Team sharing text template' },
  // Sounds (Drive override links)
  { Key: 'SOUND_CORRECT',      Value: '',          Label: 'Sound: Correct',      Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for correct sound' },
  { Key: 'SOUND_WRONG',        Value: '',          Label: 'Sound: Wrong',        Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for wrong sound' },
  { Key: 'SOUND_TIMER_END',    Value: '',          Label: 'Sound: Timer End',    Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for timer end sound' },
  { Key: 'SOUND_WINNER',       Value: '',          Label: 'Sound: Winner',       Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for winner sound' },
  { Key: 'SOUND_APPLAUSE',     Value: '',          Label: 'Sound: Applause',     Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for applause' },
  { Key: 'SOUND_CONFETTI',     Value: '',          Label: 'Sound: Confetti',     Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for confetti sound' },
  { Key: 'SOUND_BONUS',        Value: '',          Label: 'Sound: Bonus',        Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for bonus sound' },
  { Key: 'SOUND_TEAM',         Value: '',          Label: 'Sound: Team Assigned',Type: 'url',     Group: 'Sounds',       Options: '', Description: 'Google Drive link for team assignment sound' },
  { Key: 'ADMIN_PASSWORD',     Value: 'admin123',  Label: 'Admin Password',      Type: 'text',    Group: 'System',       Options: '', Description: 'Password to activate admin mode' },
];

function getSettings() {
  const sheet = getSheet('Settings');
  let rows = sheetToObjects(sheet);
  if (rows.length === 0) {
    initSettings();
    return getSettings();
  }
  // Check for any missing settings from DEFAULT_SETTINGS and append them
  const existingKeys = {};
  rows.forEach(r => { existingKeys[r.Key] = true; });
  let updated = false;
  DEFAULT_SETTINGS.forEach(def => {
    if (!existingKeys[def.Key]) {
      appendRow(sheet, SETTINGS_HEADERS, def);
      updated = true;
    }
  });
  if (updated) {
    rows = sheetToObjects(sheet);
  }
  const settings = {};
  rows.forEach(r => { settings[r.Key] = r.Value; });
  return { settings, raw: rows };
}

function initSettings() {
  const sheet = getSheet('Settings');
  objectsToSheet(sheet, SETTINGS_HEADERS, DEFAULT_SETTINGS);
}

function saveSettings(data) {
  const sheet = getSheet('Settings');
  const rows = sheetToObjects(sheet);
  const map = {};
  rows.forEach((r, i) => { map[r.Key] = i + 2; }); // +2 for header + 1-indexed
  Object.entries(data).forEach(([key, value]) => {
    if (map[key]) {
      sheet.getRange(map[key], 2).setValue(value);
    }
  });
  logEvent({ action: 'SETTINGS_SAVED', detail: 'Settings updated', by: 'Admin' });
  return { success: true };
}

// ─── PLAYERS ────────────────────────────────────────────────

const PLAYER_HEADERS = [
  'PlayerID', 'PlayerName', 'Gender', 'Age', 'Mobile',
  'Present', 'AssignedTeam', 'Captain', 'Remarks', 'AddedAt'
];

function getPlayers() {
  const sheet = getSheet('Players');
  const rows = sheetToObjects(sheet);
  rows.sort((a, b) => String(a.PlayerName).localeCompare(String(b.PlayerName)));
  return { players: rows };
}

function addPlayer(data) {
  const sheet = getSheet('Players');
  if (sheet.getLastRow() < 1 || sheet.getRange(1, 1).getValue() !== 'PlayerID') {
    sheet.getRange(1, 1, 1, PLAYER_HEADERS.length).setValues([PLAYER_HEADERS]);
  }
  const player = {
    PlayerID:    generateId('PLR'),
    PlayerName:  data.PlayerName || '',
    Gender:      data.Gender || '',
    Age:         data.Age || '',
    Mobile:      data.Mobile || '',
    Present:     data.Present !== undefined ? data.Present : 'No',
    AssignedTeam:'',
    Captain:     'No',
    Remarks:     data.Remarks || '',
    AddedAt:     now()
  };
  appendRow(sheet, PLAYER_HEADERS, player);
  sortPlayerSheet();
  logEvent({ action: 'PLAYER_ADDED', detail: player.PlayerName, by: 'Admin' });
  return { success: true, player };
}

function bulkAddPlayers(playersList) {
  if (!Array.isArray(playersList) || playersList.length === 0) {
    return { error: 'No players provided' };
  }
  const sheet = getSheet('Players');
  if (sheet.getLastRow() < 1 || sheet.getRange(1, 1).getValue() !== 'PlayerID') {
    sheet.getRange(1, 1, 1, PLAYER_HEADERS.length).setValues([PLAYER_HEADERS]);
  }
  const addedPlayers = [];
  const timeStr = now();
  playersList.forEach((data, index) => {
    const player = {
      PlayerID:    generateId('PLR') + '_' + index,
      PlayerName:  data.PlayerName || '',
      Gender:      data.Gender || '',
      Age:         data.Age || '',
      Mobile:      data.Mobile || '',
      Present:     data.Present !== undefined ? data.Present : 'No',
      AssignedTeam:'',
      Captain:     'No',
      Remarks:     data.Remarks || 'Bulk Import',
      AddedAt:     timeStr
    };
    appendRow(sheet, PLAYER_HEADERS, player);
    addedPlayers.push(player);
  });
  sortPlayerSheet();
  logEvent({ action: 'BULK_PLAYERS_ADDED', detail: addedPlayers.length + ' players added', by: 'Admin' });
  return { success: true, count: addedPlayers.length, players: addedPlayers };
}

function updatePlayer(data) {
  const sheet = getSheet('Players');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx = headers.indexOf('PlayerID');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === data.PlayerID) {
      headers.forEach((h, j) => {
        if (data[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(data[h]);
        }
      });
      logEvent({ action: 'PLAYER_UPDATED', detail: data.PlayerName || data.PlayerID, by: 'Admin' });
      return { success: true };
    }
  }
  return { error: 'Player not found' };
}

function deletePlayer(playerId) {
  const sheet = getSheet('Players');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx = headers.indexOf('PlayerID');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === playerId) {
      sheet.deleteRow(i + 1);
      logEvent({ action: 'PLAYER_DELETED', detail: playerId, by: 'Admin' });
      return { success: true };
    }
  }
  return { error: 'Player not found' };
}

function sortPlayerSheet() {
  const sheet = getSheet('Players');
  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;
  const range = sheet.getRange(2, 1, lastRow - 1, PLAYER_HEADERS.length);
  range.sort({ column: 2, ascending: true }); // Column 2 = PlayerName
}

// ─── TEAMS ──────────────────────────────────────────────────

const TEAM_HEADERS = [
  'TeamID', 'TeamName', 'Captain', 'Color', 'Logo',
  'CurrentMembers', 'MaleCount', 'FemaleCount', 'AvgAge',
  'TotalScore', 'Rank', 'Qualified', 'Locked', 'GamesPlaying'
];

const DEFAULT_TEAM_COLORS = [
  '#E74C3C', '#3498DB', '#2ECC71', '#F39C12',
  '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'
];

function getTeams() {
  const sheet = getSheet('Teams');
  const rows = sheetToObjects(sheet);
  return { teams: rows };
}

function saveTeams(teams) {
  const sheet = getSheet('Teams');
  objectsToSheet(sheet, TEAM_HEADERS, teams.map((t, i) => ({
    TeamID:         t.TeamID || generateId('TM'),
    TeamName:       t.TeamName,
    Captain:        t.Captain || '',
    Color:          t.Color || DEFAULT_TEAM_COLORS[i % DEFAULT_TEAM_COLORS.length],
    Logo:           t.Logo || '',
    CurrentMembers: t.CurrentMembers || 0,
    MaleCount:      t.MaleCount || 0,
    FemaleCount:    t.FemaleCount || 0,
    AvgAge:         t.AvgAge || 0,
    TotalScore:     t.TotalScore || 0,
    Rank:           t.Rank || 0,
    Qualified:      t.Qualified || 'No',
    Locked:         t.Locked || 'No',
    GamesPlaying:   t.GamesPlaying || 'ALL'
  })));
  logEvent({ action: 'TEAMS_SAVED', detail: teams.map(t => t.TeamName).join(', '), by: 'Admin' });
  return { success: true };
}

// ─── TEAM MEMBERS ───────────────────────────────────────────

const MEMBER_HEADERS = [
  'Team', 'TeamID', 'Player', 'PlayerID', 'Gender', 'Age', 'Captain', 'AssignedAt'
];

function getTeamMembers() {
  const sheet = getSheet('Team Members');
  return { members: sheetToObjects(sheet) };
}

function assignTeamMembers(assignments) {
  // assignments: [{ TeamID, TeamName, PlayerID, PlayerName, Gender, Age, Captain }]
  const memberSheet = getSheet('Team Members');
  memberSheet.clearContents();
  memberSheet.getRange(1, 1, 1, MEMBER_HEADERS.length).setValues([MEMBER_HEADERS]);
  const ts = now();
  assignments.forEach(a => {
    appendRow(memberSheet, MEMBER_HEADERS, {
      Team: a.TeamName, TeamID: a.TeamID,
      Player: a.PlayerName, PlayerID: a.PlayerID,
      Gender: a.Gender, Age: a.Age,
      Captain: a.Captain || 'No',
      AssignedAt: ts
    });
  });

  // Update Players sheet AssignedTeam
  const playerSheet = getSheet('Players');
  const pRows = playerSheet.getDataRange().getValues();
  const pH = pRows[0];
  const pIdIdx = pH.indexOf('PlayerID');
  const pTeamIdx = pH.indexOf('AssignedTeam');
  const pCapIdx = pH.indexOf('Captain');
  assignments.forEach(a => {
    for (let i = 1; i < pRows.length; i++) {
      if (pRows[i][pIdIdx] === a.PlayerID) {
        playerSheet.getRange(i + 1, pTeamIdx + 1).setValue(a.TeamName);
        playerSheet.getRange(i + 1, pCapIdx + 1).setValue(a.Captain || 'No');
      }
    }
  });

  // Update Teams sheet counts
  updateTeamCounts(assignments);

  logEvent({ action: 'TEAMS_ASSIGNED', detail: assignments.length + ' players assigned', by: 'Admin' });
  return { success: true };
}

function updateTeamCounts(assignments) {
  const teamSheet = getSheet('Teams');
  const tRows = teamSheet.getDataRange().getValues();
  const tH = tRows[0];
  const tIdIdx = tH.indexOf('TeamID');

  const counts = {};
  assignments.forEach(a => {
    if (!counts[a.TeamID]) counts[a.TeamID] = { members: 0, male: 0, female: 0, ages: [], captain: '' };
    counts[a.TeamID].members++;
    if (a.Gender === 'Male') counts[a.TeamID].male++;
    if (a.Gender === 'Female') counts[a.TeamID].female++;
    if (a.Age) counts[a.TeamID].ages.push(Number(a.Age));
    if (a.Captain === 'Yes') counts[a.TeamID].captain = a.PlayerName;
  });

  for (let i = 1; i < tRows.length; i++) {
    const tid = tRows[i][tIdIdx];
    if (counts[tid]) {
      const c = counts[tid];
      const avgAge = c.ages.length ? (c.ages.reduce((s, a) => s + a, 0) / c.ages.length).toFixed(1) : 0;
      teamSheet.getRange(i + 1, tH.indexOf('CurrentMembers') + 1).setValue(c.members);
      teamSheet.getRange(i + 1, tH.indexOf('MaleCount') + 1).setValue(c.male);
      teamSheet.getRange(i + 1, tH.indexOf('FemaleCount') + 1).setValue(c.female);
      teamSheet.getRange(i + 1, tH.indexOf('AvgAge') + 1).setValue(avgAge);
      if (c.captain) teamSheet.getRange(i + 1, tH.indexOf('Captain') + 1).setValue(c.captain);
    }
  }
}

// ─── SCORES ─────────────────────────────────────────────────

const SCORE_HEADERS = [
  'ScoreID', 'Game', 'Round', 'SubRound', 'TeamID', 'TeamName',
  'Positive', 'Negative', 'Bonus', 'Penalty', 'Adjustment', 'Total',
  'EnteredBy', 'Timestamp', 'Remarks', 'Voided'
];

function getScores(params) {
  const sheet = getSheet('Scores');
  let rows = sheetToObjects(sheet).filter(r => r.Voided !== 'Yes');
  if (params.game) rows = rows.filter(r => r.Game == params.game);
  if (params.team) rows = rows.filter(r => r.TeamID === params.team || r.TeamName === params.team);
  return { scores: rows };
}

function addScore(data) {
  const sheet = getSheet('Scores');
  if (sheet.getLastRow() < 1 || sheet.getRange(1, 1).getValue() !== 'ScoreID') {
    sheet.getRange(1, 1, 1, SCORE_HEADERS.length).setValues([SCORE_HEADERS]);
  }

  const pos  = Number(data.Positive  || 0);
  const neg  = Number(data.Negative  || 0);
  const bon  = Number(data.Bonus     || 0);
  const pen  = Number(data.Penalty   || 0);
  const adj  = Number(data.Adjustment|| 0);
  const total = pos - neg + bon - pen + adj;

  const score = {
    ScoreID:    generateId('SC'),
    Game:       data.Game,
    Round:      data.Round,
    SubRound:   data.SubRound || '',
    TeamID:     data.TeamID,
    TeamName:   data.TeamName,
    Positive:   pos,
    Negative:   neg,
    Bonus:      bon,
    Penalty:    pen,
    Adjustment: adj,
    Total:      total,
    EnteredBy:  data.EnteredBy || 'Admin',
    Timestamp:  now(),
    Remarks:    data.Remarks || '',
    Voided:     'No'
  };

  const sheetRow = {};
  Object.keys(score).forEach(function(k) { sheetRow[k] = score[k]; });
  
  const nextRow = sheet.getLastRow() + 1;
  sheetRow.Total = "=G" + nextRow + "-H" + nextRow + "+I" + nextRow + "-J" + nextRow + "+K" + nextRow;

  appendRow(sheet, SCORE_HEADERS, sheetRow);
  rebuildMasterScoreboard();
  logEvent({ action: 'SCORE_ADDED', detail: `${data.TeamName} +${total} (G${data.Game}R${data.Round})`, by: score.EnteredBy });
  return { success: true, score };
}

function undoScore(scoreId) {
  const sheet = getSheet('Scores');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idIdx = headers.indexOf('ScoreID');
  const voidIdx = headers.indexOf('Voided');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idIdx] === scoreId) {
      sheet.getRange(i + 1, voidIdx + 1).setValue('Yes');
      rebuildMasterScoreboard();
      logEvent({ action: 'SCORE_UNDONE', detail: scoreId, by: 'Admin' });
      return { success: true };
    }
  }
  return { error: 'Score not found' };
}

function lockGame(gameId, locked) {
  const teamSheet = getSheet('Teams');
  // Store game lock in Settings
  const sheet = getSheet('Settings');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const keyIdx = headers.indexOf('Key');
  const valIdx = headers.indexOf('Value');
  const lockKey = 'GAME_LOCKED_' + gameId;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][keyIdx] === lockKey) {
      sheet.getRange(i + 1, valIdx + 1).setValue(locked ? 'true' : 'false');
      logEvent({ action: locked ? 'GAME_LOCKED' : 'GAME_UNLOCKED', detail: 'Game ' + gameId, by: 'Admin' });
      return { success: true };
    }
  }
  // Add new lock key
  appendRow(sheet, SETTINGS_HEADERS, {
    Key: lockKey, Value: locked ? 'true' : 'false',
    Label: 'Game ' + gameId + ' Locked', Type: 'boolean',
    Group: 'GameLocks', Options: '', Description: 'Lock status for game ' + gameId
  });
  logEvent({ action: locked ? 'GAME_LOCKED' : 'GAME_UNLOCKED', detail: 'Game ' + gameId, by: 'Admin' });
  return { success: true };
}

// ─── MASTER SCOREBOARD ──────────────────────────────────────

const SCOREBOARD_HEADERS = [
  'TeamID', 'TeamName', 'Color',
  'TotalScore', 'PrevScore', 'ScoreDiff', 'Rank', 'PrevRank', 'RankMove',
  'Qualified', 'GamesPlaying', 'GamesBreakdown'
];

function getMasterScoreboard() {
  // Always rebuild from raw scores so manual sheet edits are picked up
  rebuildMasterScoreboard();
  const sheet = getSheet('Master Scoreboard');
  return { scoreboard: sheetToObjects(sheet) };
}

function rebuildMasterScoreboard() {
  const teamSheet = getSheet('Teams');
  const scoreSheet = getSheet('Scores');
  const sbSheet = getSheet('Master Scoreboard');

  const teams = sheetToObjects(teamSheet);
  const scores = sheetToObjects(scoreSheet).filter(r => r.Voided !== 'Yes');

  // Previous scoreboard for rank movement
  const prevSB = sheetToObjects(sbSheet);
  const prevRankMap = {};
  const prevScoreMap = {};
  prevSB.forEach(r => {
    prevRankMap[r.TeamID] = Number(r.Rank) || 0;
    prevScoreMap[r.TeamID] = Number(r.TotalScore) || 0;
  });

  // Calculate totals per team
  const totals = {};
  const gameBreakdown = {};
  teams.forEach(t => {
    totals[t.TeamID] = 0;
    gameBreakdown[t.TeamID] = {};
  });

  scores.forEach(s => {
    if (totals[s.TeamID] !== undefined) {
      const pos = Number(s.Positive || 0);
      const neg = Number(s.Negative || 0);
      const bon = Number(s.Bonus || 0);
      const pen = Number(s.Penalty || 0);
      const adj = Number(s.Adjustment || 0);
      const calcTotal = pos - neg + bon - pen + adj;

      totals[s.TeamID] += calcTotal;
      if (!gameBreakdown[s.TeamID][s.Game]) gameBreakdown[s.TeamID][s.Game] = 0;
      gameBreakdown[s.TeamID][s.Game] += calcTotal;
    }
  });

  // Sort by score
  const sorted = teams.slice().sort((a, b) => (totals[b.TeamID] || 0) - (totals[a.TeamID] || 0));

  const sbRows = sorted.map((t, i) => {
    const rank = i + 1;
    const prev = prevRankMap[t.TeamID] || rank;
    const move = prev > rank ? 'up' : prev < rank ? 'down' : 'same';
    const prevScore = prevScoreMap[t.TeamID] || 0;
    return {
      TeamID:         t.TeamID,
      TeamName:       t.TeamName,
      Color:          t.Color,
      TotalScore:     totals[t.TeamID] || 0,
      PrevScore:      prevScore,
      ScoreDiff:      (totals[t.TeamID] || 0) - prevScore,
      Rank:           rank,
      PrevRank:       prev,
      RankMove:       move,
      Qualified:      t.Qualified || 'No',
      GamesPlaying:   t.GamesPlaying || 'ALL',
      GamesBreakdown: JSON.stringify(gameBreakdown[t.TeamID] || {})
    };
  });

  objectsToSheet(sbSheet, SCOREBOARD_HEADERS, sbRows);

  // Update Teams sheet ranks and totals
  const tRows = teamSheet.getDataRange().getValues();
  const tH = tRows[0];
  sbRows.forEach(sb => {
    for (let i = 1; i < tRows.length; i++) {
      if (tRows[i][tH.indexOf('TeamID')] === sb.TeamID) {
        teamSheet.getRange(i + 1, tH.indexOf('TotalScore') + 1).setValue(sb.TotalScore);
        teamSheet.getRange(i + 1, tH.indexOf('Rank') + 1).setValue(sb.Rank);
      }
    }
  });

  // Auto-qualify top N
  const settingsData = getSettings().settings;
  const finalistsCount = Number(settingsData.FINALISTS_COUNT) || 2;
  if (settingsData.AUTO_RANKING === 'true') {
    sbRows.forEach(sb => {
      const qualStatus = sb.Rank <= finalistsCount ? 'Yes' : 'No';
      for (let i = 1; i < tRows.length; i++) {
        if (tRows[i][tH.indexOf('TeamID')] === sb.TeamID) {
          if (tRows[i][tH.indexOf('Qualified')] !== 'Manual') {
            teamSheet.getRange(i + 1, tH.indexOf('Qualified') + 1).setValue(qualStatus);
          }
        }
      }
      // Update SB sheet too
      sbSheet.getRange(sbRows.indexOf(sb) + 2, SCOREBOARD_HEADERS.indexOf('Qualified') + 1).setValue(qualStatus);
    });
  }

  return { success: true, scoreboard: sbRows };
}

// ─── FINALS ─────────────────────────────────────────────────

const FINALS_HEADERS = [
  'ScoreID', 'TeamID', 'TeamName', 'Round', 'Positive', 'Negative',
  'Bonus', 'Penalty', 'Adjustment', 'Total', 'Timestamp', 'Remarks', 'Voided'
];

function getFinals() {
  const sheet = getSheet('Finals');
  const rows = sheetToObjects(sheet).filter(r => r.Voided !== 'Yes');

  // Also get qualified teams
  const teamsData = getTeams().teams.filter(t => t.Qualified === 'Yes' || t.Qualified === 'Manual');

  // Build final rankings
  const totals = {};
  teamsData.forEach(t => { totals[t.TeamID] = 0; });
  rows.forEach(s => {
    if (totals[s.TeamID] !== undefined) {
      totals[s.TeamID] += Number(s.Total) || 0;
    }
  });

  const ranked = teamsData.sort((a, b) => (totals[b.TeamID] || 0) - (totals[a.TeamID] || 0));
  return { scores: rows, qualifiedTeams: teamsData, ranked };
}

function saveFinals(data) {
  // data.qualifiedTeams = manually selected teams
  const teamSheet = getSheet('Teams');
  const tRows = teamSheet.getDataRange().getValues();
  const tH = tRows[0];
  // Reset all to No first
  for (let i = 1; i < tRows.length; i++) {
    if (tRows[i][tH.indexOf('Qualified')] !== 'Manual') {
      teamSheet.getRange(i + 1, tH.indexOf('Qualified') + 1).setValue('No');
    }
  }
  data.qualifiedTeams.forEach(tid => {
    for (let i = 1; i < tRows.length; i++) {
      if (tRows[i][tH.indexOf('TeamID')] === tid) {
        teamSheet.getRange(i + 1, tH.indexOf('Qualified') + 1).setValue('Manual');
      }
    }
  });
  logEvent({ action: 'FINALS_SETUP', detail: 'Qualified teams updated', by: 'Admin' });
  return { success: true };
}

function addFinalScore(data) {
  const sheet = getSheet('Finals');
  if (sheet.getLastRow() < 1 || sheet.getRange(1, 1).getValue() !== 'ScoreID') {
    sheet.getRange(1, 1, 1, FINALS_HEADERS.length).setValues([FINALS_HEADERS]);
  }
  const pos = Number(data.Positive || 0);
  const neg = Number(data.Negative || 0);
  const bon = Number(data.Bonus || 0);
  const pen = Number(data.Penalty || 0);
  const adj = Number(data.Adjustment || 0);
  const total = pos - neg + bon - pen + adj;

  const score = {
    ScoreID: generateId('FS'), TeamID: data.TeamID, TeamName: data.TeamName,
    Round: data.Round, Positive: pos, Negative: neg, Bonus: bon,
    Penalty: pen, Adjustment: adj, Total: total,
    Timestamp: now(), Remarks: data.Remarks || '', Voided: 'No'
  };
  appendRow(sheet, FINALS_HEADERS, score);
  logEvent({ action: 'FINAL_SCORE_ADDED', detail: `${data.TeamName} +${total}`, by: 'Admin' });
  return { success: true, score };
}

// ─── EVENT LOG ──────────────────────────────────────────────

const LOG_HEADERS = ['LogID', 'Action', 'Detail', 'By', 'Timestamp'];

function getEventLog(params) {
  const sheet = getSheet('Event Log');
  let rows = sheetToObjects(sheet);
  const limit = Number(params.limit) || 100;
  rows = rows.slice(-limit).reverse();
  return { log: rows };
}

function logEvent(data) {
  const sheet = getSheet('Event Log');
  if (sheet.getLastRow() < 1 || sheet.getRange(1, 1).getValue() !== 'LogID') {
    sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
  }
  appendRow(sheet, LOG_HEADERS, {
    LogID:     generateId('LOG'),
    Action:    data.action || '',
    Detail:    data.detail || '',
    By:        data.by || 'System',
    Timestamp: now()
  });
  return { success: true };
}

// ─── RESET EVENT ────────────────────────────────────────────

function resetEvent() {
  const sheetsToReset = ['Players', 'Teams', 'Team Members', 'Scores', 'Master Scoreboard', 'Finals', 'QuizActive', 'QuizSubmissions'];
  sheetsToReset.forEach(name => {
    const sheet = getSheet(name);
    sheet.clearContents();
  });
  logEvent({ action: 'EVENT_RESET', detail: 'All event data cleared', by: 'Admin' });
  // Reset status in settings
  saveSettings({ CURRENT_STATUS: 'setup' });
  return { success: true };
}

function setupSpreadsheet() {
  initSettings();
  // Create all sheets with headers
  objectsToSheet(getSheet('Players'), PLAYER_HEADERS, []);
  objectsToSheet(getSheet('Teams'), TEAM_HEADERS, []);
  objectsToSheet(getSheet('Team Members'), MEMBER_HEADERS, []);
  objectsToSheet(getSheet('Scores'), SCORE_HEADERS, []);
  objectsToSheet(getSheet('Master Scoreboard'), SCOREBOARD_HEADERS, []);
  objectsToSheet(getSheet('Finals'), FINALS_HEADERS, []);
  objectsToSheet(getSheet('Event Log'), LOG_HEADERS, []);
  objectsToSheet(getSheet('QuizActive'), QUIZ_ACTIVE_HEADERS, []);
  objectsToSheet(getSheet('QuizSubmissions'), QUIZ_SUBMISSION_HEADERS, []);
  objectsToSheet(getSheet('QuizQuestions'), QUIZ_QUESTIONS_HEADERS, DEFAULT_QUIZ_QUESTIONS);
  logEvent({ action: 'SETUP_COMPLETE', detail: 'Spreadsheet initialized', by: 'System' });
  return 'Setup complete!';
}

// ─── LIVE INTERACTIVE QUIZ BACKEND ───────────────────────────

const QUIZ_ACTIVE_HEADERS = [
  'QuestionID', 'QuestionText', 'OptionA', 'OptionB', 'OptionC', 'OptionD',
  'CorrectAnswer', 'Status', 'Duration', 'EndTime', 'LaunchedAt'
];

const QUIZ_QUESTIONS_HEADERS = [
  'QuestionID', 'QuestionText', 'OptionA', 'OptionB', 'OptionC', 'OptionD',
  'CorrectAnswer', 'Duration', 'Asked'
];

const DEFAULT_QUIZ_QUESTIONS = [
  { QuestionID: 'Q1', QuestionText: "🎵 Which singer is known as the 'Nightingale of India'?", OptionA: "Lata Mangeshkar", OptionB: "Asha Bhosle", OptionC: "Shreya Ghoshal", OptionD: "Alka Yagnik", CorrectAnswer: "A", Duration: 30, Asked: "No" },
  { QuestionID: 'Q2', QuestionText: "🎸 Complete the lyrics: 'Apna Time Aayega, Tu Nanga Hi To Aaya Hai, ___?'", OptionA: "Kya lekar jayega", OptionB: "Kya lekar aaya hai", OptionC: "Yahi reh jayega", OptionD: "Gully boy banega", CorrectAnswer: "A", Duration: 30, Asked: "No" },
  { QuestionID: 'Q3', QuestionText: "🎬 Which movie is Bollywood's longest-running film in theatres?", OptionA: "Sholay", OptionB: "Dilwale Dulhania Le Jayenge", OptionC: "Mughal-E-Azam", OptionD: "Hum Aapke Hain Koun..!", CorrectAnswer: "B", Duration: 30, Asked: "No" },
  { QuestionID: 'Q4', QuestionText: "🏏 Who won the 2011 ICC Cricket World Cup Player of the Tournament?", OptionA: "MS Dhoni", OptionB: "Yuvraj Singh", OptionC: "Sachin Tendulkar", OptionD: "Zaheer Khan", CorrectAnswer: "B", Duration: 30, Asked: "No" }
];

const QUIZ_SUBMISSION_HEADERS = [
  'SubmissionID', 'QuestionID', 'PlayerName', 'Mobile',
  'SubmittedAnswer', 'IsCorrect', 'SecondsLeft', 'Timestamp'
];

/**
 * Returns the currently active quiz question if any and not expired.
 */
function getActiveQuestion() {
  const sheet = getSheet('QuizActive');
  const rows = sheetToObjects(sheet);
  if (rows.length === 0) return { active: false };

  const current = rows[0]; // first row is active state
  if (current.Status !== 'active') return { active: false };

  // Check expiration
  if (current.EndTime) {
    const end = new Date(current.EndTime).getTime();
    if (Date.now() > end) {
      // Auto-close it
      current.Status = 'closed';
      objectsToSheet(sheet, QUIZ_ACTIVE_HEADERS, [current]);
      return { active: false };
    }
  }

  return {
    active: true,
    questionId: current.QuestionID,
    questionText: current.QuestionText,
    options: {
      A: current.OptionA,
      B: current.OptionB,
      C: current.OptionC,
      D: current.OptionD
    },
    duration: Number(current.Duration) || 30,
    endTime: current.EndTime,
    launchedAt: current.LaunchedAt
  };
}

/**
 * Sets a question as active with a countdown.
 * If data.questionId is provided, it loads it from QuizQuestions sheet
 * and marks it as Asked = 'Yes'.
 */
function launchQuestion(data) {
  const sheet = getSheet('QuizActive');
  let qText = data.questionText || '';
  let qA = data.optionA || '';
  let qB = data.optionB || '';
  let qC = data.optionC || '';
  let qD = data.optionD || '';
  let qCorrect = data.correctAnswer || '';
  let duration = Number(data.duration || 30);
  let qId = data.questionId || '';

  if (qId) {
    const questionsSheet = getSheet('QuizQuestions');
    const questions = sheetToObjects(questionsSheet);
    const index = questions.findIndex(q => q.QuestionID === qId);
    if (index !== -1) {
      const q = questions[index];
      qText = q.QuestionText;
      qA = q.OptionA;
      qB = q.OptionB;
      qC = q.OptionC;
      qD = q.OptionD;
      qCorrect = q.CorrectAnswer;
      duration = Number(q.Duration) || duration;
      
      // Mark as Asked = 'Yes'
      questionsSheet.getRange(index + 2, 9).setValue('Yes'); // Column 9 is Asked
    }
  }

  if (!qId) {
    qId = generateId('Q');
  }

  const launchedAt = new Date();
  const endTime = new Date(launchedAt.getTime() + duration * 1000);

  const activeQuestion = {
    QuestionID: qId,
    QuestionText: qText,
    OptionA: qA,
    OptionB: qB,
    OptionC: qC,
    OptionD: qD,
    CorrectAnswer: qCorrect.toUpperCase(),
    Status: 'active',
    Duration: duration,
    EndTime: endTime.toISOString(),
    LaunchedAt: launchedAt.toISOString()
  };

  // Rewrite active sheet to have only this active row
  objectsToSheet(sheet, QUIZ_ACTIVE_HEADERS, [activeQuestion]);
  logEvent({ action: 'QUIZ_LAUNCHED', detail: activeQuestion.QuestionText, by: 'Admin' });

  return { success: true, question: activeQuestion };
}

/**
 * Returns all predefined questions in the database.
 */
function getQuizQuestions() {
  const sheet = getSheet('QuizQuestions');
  const rows = sheetToObjects(sheet);
  return { questions: rows };
}

/**
 * Resets all questions in the pool back to Asked = 'No'.
 */
function resetQuizQuestions() {
  const sheet = getSheet('QuizQuestions');
  const rows = sheetToObjects(sheet);
  rows.forEach((r, i) => {
    sheet.getRange(i + 2, 9).setValue('No'); // Column 9 is Asked
  });
  logEvent({ action: 'QUIZ_QUESTIONS_RESET', detail: 'Question pool reset', by: 'Admin' });
  return { success: true };
}

/**
 * Closes the active question immediately.
 */
function closeQuestion() {
  const sheet = getSheet('QuizActive');
  const rows = sheetToObjects(sheet);
  if (rows.length > 0) {
    rows[0].Status = 'closed';
    objectsToSheet(sheet, QUIZ_ACTIVE_HEADERS, rows);
  }
  logEvent({ action: 'QUIZ_CLOSED', detail: 'Live question closed', by: 'Admin' });
  return { success: true };
}

/**
 * Submits a viewer's answer.
 */
function submitQuizAnswer(data) {
  const active = getActiveQuestion();
  if (!active.active) {
    return { error: 'No active question currently accepting answers.' };
  }

  if (active.questionId !== data.questionId) {
    return { error: 'Question has expired or changed.' };
  }

  // Get active question row to verify correct answer
  const activeSheet = getSheet('QuizActive');
  const activeRow = sheetToObjects(activeSheet)[0];
  const correctAns = (activeRow.CorrectAnswer || '').toUpperCase();
  const submittedAns = (data.submittedAnswer || '').toUpperCase();
  const isCorrect = (correctAns && submittedAns === correctAns) ? 'Yes' : 'No';

  // Log submission
  const submissionsSheet = getSheet('QuizSubmissions');
  const submission = {
    SubmissionID: generateId('SUB'),
    QuestionID: data.questionId,
    PlayerName: data.playerName || 'Anonymous',
    Mobile: data.mobile || 'None',
    SubmittedAnswer: submittedAns,
    IsCorrect: isCorrect,
    SecondsLeft: Number(data.secondsLeft) || 0,
    Timestamp: now()
  };

  appendRow(submissionsSheet, QUIZ_SUBMISSION_HEADERS, submission);
  return { success: true, correct: isCorrect === 'Yes' };
}

/**
 * Gets all submissions.
 */
function getQuizSubmissions(params) {
  const sheet = getSheet('QuizSubmissions');
  const rows = sheetToObjects(sheet);
  
  if (params && params.questionId) {
    return { submissions: rows.filter(r => r.QuestionID === params.questionId) };
  }
  return { submissions: rows };
}

/**
 * Gets the detailed result of a question (including correct answer).
 */
function getQuizResult(params) {
  const sheet = getSheet('QuizActive');
  const rows = sheetToObjects(sheet);
  if (rows.length === 0) return { error: 'No quiz history found.' };

  const current = rows[0];
  // Verify it matches requested ID (if provided)
  if (params && params.questionId && current.QuestionID !== params.questionId) {
    return { error: 'Question ID mismatch.' };
  }

  return {
    questionId: current.QuestionID,
    questionText: current.QuestionText,
    options: {
      A: current.OptionA,
      B: current.OptionB,
      C: current.OptionC,
      D: current.OptionD
    },
    correctAnswer: current.CorrectAnswer,
    status: current.Status,
    duration: Number(current.Duration) || 30
  };
}

/**
 * Clears quiz submissions.
 */
function clearQuizSubmissions() {
  const sheet = getSheet('QuizSubmissions');
  sheet.clearContents();
  objectsToSheet(sheet, QUIZ_SUBMISSION_HEADERS, []);
  logEvent({ action: 'QUIZ_CLEARED', detail: 'Quiz submissions cleared', by: 'Admin' });
  return { success: true };
}

/**
 * Returns full quiz history: each past question with its stats and top-3 correct answerers.
 * Groups all submissions by QuestionID and enriches with question text from QuizQuestions.
 */
function getQuizHistory() {
  const subsSheet = getSheet('QuizSubmissions');
  const subs = sheetToObjects(subsSheet);

  if (subs.length === 0) return { history: [] };

  // Group submissions by QuestionID
  const groups = {};
  subs.forEach(function(s) {
    if (!groups[s.QuestionID]) groups[s.QuestionID] = [];
    groups[s.QuestionID].push(s);
  });

  // Enrich with question metadata from QuizQuestions sheet
  const questionsSheet = getSheet('QuizQuestions');
  const questionPool = sheetToObjects(questionsSheet);
  const questionLookup = {};
  questionPool.forEach(function(q) { questionLookup[q.QuestionID] = q; });

  var history = Object.keys(groups).map(function(qid) {
    var allSubs = groups[qid];
    var total = allSubs.length;
    var correctSubs = allSubs.filter(function(s) { return s.IsCorrect === 'Yes'; });

    // Top 3: correct answers sorted by most seconds left (fastest responder)
    var top3 = correctSubs
      .sort(function(a, b) { return Number(b.SecondsLeft) - Number(a.SecondsLeft); })
      .slice(0, 3)
      .map(function(s) {
        return {
          name: s.PlayerName,
          mobile: s.Mobile,
          secondsLeft: Number(s.SecondsLeft),
          timestamp: s.Timestamp
        };
      });

    // Count option votes
    var votes = { A: 0, B: 0, C: 0, D: 0 };
    allSubs.forEach(function(s) {
      var ans = (s.SubmittedAnswer || '').toUpperCase();
      if (votes[ans] !== undefined) votes[ans]++;
    });

    var poolQ = questionLookup[qid];
    return {
      questionId: qid,
      questionText: poolQ ? poolQ.QuestionText : ('Question ' + qid),
      options: poolQ ? { A: poolQ.OptionA, B: poolQ.OptionB, C: poolQ.OptionC, D: poolQ.OptionD } : {},
      correctAnswer: poolQ ? poolQ.CorrectAnswer : '',
      total: total,
      correctCount: correctSubs.length,
      votes: votes,
      top3: top3
    };
  });

  return { history: history };
}
