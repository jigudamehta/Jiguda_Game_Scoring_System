/**
 * Quiz Admin Page — Live Audience Question Control Panel
 */
let quizIntervalId = null;
let currentActiveQ  = null;
let quizSubmissions = [];
let databaseQuestions = [];

async function initQuizAdmin() {
  const page = document.getElementById('page-quiz-admin');
  if (!page) return;

  // 1. Fetch predefined questions from Google Sheets
  if (STATE.gasUrl) {
    try {
      const res = await API.get('quiz_questions');
      databaseQuestions = res?.questions || [];
    } catch (err) {
      console.warn('Failed to load questions pool:', err);
    }
  }

  renderQuizAdmin(page);
  await refreshQuizState();

  // Set up auto-poll (every 3 seconds when this page is active)
  clearInterval(quizIntervalId);
  quizIntervalId = setInterval(async () => {
    if (STATE.currentPage === 'quiz-admin') {
      await refreshQuizSubmissionsOnly();
    } else {
      clearInterval(quizIntervalId);
    }
  }, 3000);
}

function renderQuizAdmin(page) {
  const presetsHtml = databaseQuestions.map((q, i) => {
    const isAsked = q.Asked === 'Yes';
    const cardBg = isAsked ? 'rgba(255,255,255,0.015)' : 'var(--bg-elevated)';
    const cardBorder = isAsked ? 'rgba(255,255,255,0.03)' : 'var(--border-subtle)';
    const textOpacity = isAsked ? '0.45' : '1';
    
    return `
      <div style="padding:var(--space-3);background:${cardBg};border:1px solid ${cardBorder};border-radius:var(--radius-md);display:flex;flex-direction:column;gap:var(--space-2);opacity:${textOpacity}">
        <div style="font-weight:700;font-size:var(--text-sm);color:${isAsked ? 'var(--text-muted)' : 'var(--text-accent)'}">
          ${q.QuestionText} ${isAsked ? '<span style="font-size:10px;padding:1px 5px;background:rgba(255,255,255,0.1);border-radius:3px;margin-left:4px;color:var(--text-muted)">Asked ✓</span>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px;color:var(--text-secondary)">
          <div>A) ${q.OptionA}</div><div>B) ${q.OptionB}</div>
          <div>C) ${q.OptionC}</div><div>D) ${q.OptionD}</div>
        </div>
        <div class="flex items-center justify-between" style="margin-top:var(--space-2);border-top:1px solid rgba(255,255,255,0.05);padding-top:var(--space-2)">
          <span style="font-size:10px;color:var(--gold-400)">Correct: ${q.CorrectAnswer || 'None (Poll)'} · ${q.Duration}s</span>
          <div class="flex gap-1">
            <button class="btn btn-secondary btn-sm" onclick="loadQuizPreset(${i})" ${isAsked ? 'disabled style="display:none"' : ''}>⚡ Load</button>
            <button class="btn btn-success btn-sm" onclick="launchQuizPresetDirect('${q.QuestionID}')" ${isAsked ? 'disabled style="opacity:0.5"' : ''}>🔥 Launch</button>
          </div>
        </div>
      </div>
    `;
  }).join('') || `<div style="text-align:center;padding:var(--space-4);color:var(--text-muted);font-size:var(--text-sm)">No predefined questions in database. Add them in the "QuizQuestions" sheet tab!</div>`;

  page.innerHTML = `
    <div class="flex items-center justify-between">
      <h2 class="section-title">📢 Live Audience Quiz Panel</h2>
      <div class="flex gap-2">
        <button class="btn btn-sm btn-secondary" onclick="refreshQuizState()">🔄 Refresh Data</button>
        <button class="btn btn-sm btn-secondary" onclick="resetQuizQuestionPool()">🔄 Reset Pool</button>
        <button class="btn btn-sm btn-danger" onclick="confirmClearQuiz()">🗑️ Clear Logs</button>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1.2fr;gap:var(--space-6);align-items:start">

      <!-- Left Column: Controls and Launcher -->
      <div style="display:flex;flex-direction:column;gap:var(--space-5)">

        <!-- Live Status Card -->
        <div class="card" id="quiz-status-card" style="border-color:var(--border-subtle)">
          <div class="card-title" style="margin-bottom:var(--space-3)">📡 Live Question Status</div>
          <div id="quiz-status-info">
            <div style="padding:var(--space-6);text-align:center;color:var(--text-muted)">
              Loading status...
            </div>
          </div>
        </div>

        <!-- Launch Question Form -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-4)">🚀 Shoot Live Question</div>
          
          <div class="form-group" style="margin-bottom:var(--space-3)">
            <label class="form-label">Question Text</label>
            <textarea class="form-control" id="qa-text" rows="2" placeholder="Type the question or select a preset below..."></textarea>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-3)">
            <div class="form-group">
              <label class="form-label">Option A</label>
              <input type="text" class="form-control" id="qa-opt-a" placeholder="Option A">
            </div>
            <div class="form-group">
              <label class="form-label">Option B</label>
              <input type="text" class="form-control" id="qa-opt-b" placeholder="Option B">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-3)">
            <div class="form-group">
              <label class="form-label">Option C</label>
              <input type="text" class="form-control" id="qa-opt-c" placeholder="Option C">
            </div>
            <div class="form-group">
              <label class="form-label">Option D</label>
              <input type="text" class="form-control" id="qa-opt-d" placeholder="Option D">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div class="form-group">
              <label class="form-label">Correct Option</label>
              <select class="form-control" id="qa-correct">
                <option value="">None (Audience Poll)</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Timer Duration</label>
              <select class="form-control" id="qa-duration">
                <option value="15">15 Seconds</option>
                <option value="30" selected>30 Seconds</option>
                <option value="45">45 Seconds</option>
                <option value="60">60 Seconds</option>
                <option value="90">90 Seconds</option>
              </select>
            </div>
          </div>

          <div class="flex gap-2">
            <button class="btn btn-success flex-1" onclick="launchQuizQuestion()">🔥 Go Live Now</button>
            <button class="btn btn-secondary" onclick="clearLauncherForm()">Clear Form</button>
          </div>
        </div>

        <!-- Preset Questions List -->
        <div class="card">
          <div class="card-title" style="margin-bottom:var(--space-3)">📚 Question Presets</div>
          <div style="display:flex;flex-direction:column;gap:var(--space-3);max-height:300px;overflow-y:auto;padding-right:4px">
            ${presetsHtml}
          </div>
        </div>

      </div>

      <!-- Right Column: Live Submissions and Analytics -->
      <div style="display:flex;flex-direction:column;gap:var(--space-5)">

        <!-- Live Submissions Analytics Summary -->
        <div class="card" id="quiz-analytics-card" style="display:none">
          <div class="card-title" style="margin-bottom:var(--space-3)">📊 Live Submissions Summary</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-4)">
            <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:var(--space-3);text-align:center">
              <div style="font-size:24px;font-weight:900;color:var(--text-accent)" id="qa-stat-total">0</div>
              <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Total Submissions</div>
            </div>
            <div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:var(--space-3);text-align:center">
              <div style="font-size:24px;font-weight:900;color:var(--success)" id="qa-stat-correct">0%</div>
              <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase">Accuracy (% Correct)</div>
            </div>
          </div>
          <!-- Bar distribution chart -->
          <div style="display:flex;flex-direction:column;gap:6px" id="qa-stat-bars"></div>
        </div>

        <!-- Real-time submissions table -->
        <div class="card" style="flex:1">
          <div class="card-title" style="margin-bottom:var(--space-3)">📨 Live Submission Feed</div>
          <div style="max-height:480px;overflow-y:auto;border-radius:var(--radius-md);border:1px solid var(--border-subtle)">
            <table class="table" style="margin-bottom:0">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th style="text-align:center">Ans</th>
                  <th style="text-align:center">Result</th>
                </tr>
              </thead>
              <tbody id="quiz-submissions-list">
                <tr>
                  <td colspan="5" style="text-align:center;padding:var(--space-6);color:var(--text-muted)">
                    No submissions logged.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  `;
}

function loadQuizPreset(idx) {
  const q = databaseQuestions[idx];
  if (!q) return;
  document.getElementById('qa-text').value = q.QuestionText || '';
  document.getElementById('qa-opt-a').value = q.OptionA || '';
  document.getElementById('qa-opt-b').value = q.OptionB || '';
  document.getElementById('qa-opt-c').value = q.OptionC || '';
  document.getElementById('qa-opt-d').value = q.OptionD || '';
  document.getElementById('qa-correct').value = q.CorrectAnswer || '';
  document.getElementById('qa-duration').value = q.Duration || '30';
  Toast.success('Preset loaded successfully');
}

async function launchQuizPresetDirect(questionId) {
  const btn = document.querySelector(`[onclick*="launchQuizPresetDirect('${questionId}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const res = await API.safePost('launch_question', {
      data: { questionId }
    });

    if (res?.success) {
      Toast.success('Database question launched live!');
      
      // Auto-reload the pool to show grey status
      if (STATE.gasUrl) {
        const qPool = await API.get('quiz_questions');
        databaseQuestions = qPool?.questions || [];
        const initFn = PAGES['quiz-admin']?.init;
        if (initFn) initFn();
      }
    }
  } catch (err) {
    Toast.error('Launch failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔥 Launch'; }
  }
}

async function resetQuizQuestionPool() {
  const confirmed = await Modal.confirm('Reset the question pool? All greyed out questions will be marked active again.');
  if (!confirmed) return;

  try {
    const res = await API.safePost('reset_quiz_questions', {});
    if (res?.success) {
      Toast.success('Question pool reset successfully!');
      // Reload pool
      if (STATE.gasUrl) {
        const qPool = await API.get('quiz_questions');
        databaseQuestions = qPool?.questions || [];
        const initFn = PAGES['quiz-admin']?.init;
        if (initFn) initFn();
      }
    }
  } catch (err) {
    Toast.error('Reset pool failed: ' + err.message);
  }
}

function clearLauncherForm() {
  document.getElementById('qa-text').value = '';
  document.getElementById('qa-opt-a').value = '';
  document.getElementById('qa-opt-b').value = '';
  document.getElementById('qa-opt-c').value = '';
  document.getElementById('qa-opt-d').value = '';
  document.getElementById('qa-correct').value = '';
  document.getElementById('qa-duration').value = '30';
}

async function refreshQuizState() {
  if (!STATE.gasUrl) return;
  try {
    const res = await API.get('active_question');
    currentActiveQ = res?.active ? res : null;
    await refreshQuizSubmissionsOnly();
    updateQuizStatusCard();
  } catch (err) {
    Toast.error('Failed to get quiz state: ' + err.message);
  }
}

async function refreshQuizSubmissionsOnly() {
  if (!STATE.gasUrl) return;
  try {
    const res = await API.get('quiz_submissions', currentActiveQ ? { questionId: currentActiveQ.questionId } : {});
    quizSubmissions = res?.submissions || [];
    renderSubmissionsFeed();
    renderAnalyticsSummary();
  } catch (_) {}
}

function updateQuizStatusCard() {
  const card = document.getElementById('quiz-status-card');
  const info = document.getElementById('quiz-status-info');
  if (!card || !info) return;

  if (currentActiveQ) {
    card.style.borderColor = 'rgba(46, 204, 113, 0.4)';
    const end = new Date(currentActiveQ.endTime).getTime();
    const secLeft = Math.max(0, Math.round((end - Date.now()) / 1000));
    const statusText = secLeft > 0 ? `<span class="badge badge-green">LIVE</span> Receiving submissions` : `<span class="badge badge-muted">CLOSED</span> Questionnaire complete`;

    info.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-3)">
        <div style="display:flex;align-items:center;justify-content:between">
          <div style="font-size:var(--text-xs);color:var(--text-muted);font-weight:600;text-transform:uppercase">Active Question</div>
          <div>${statusText}</div>
        </div>
        <div style="font-size:var(--text-base);font-weight:700;color:var(--text-primary);margin-top:var(--space-1)">
          ${currentActiveQ.questionText}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;color:var(--text-secondary);background:var(--bg-elevated);padding:var(--space-3);border-radius:var(--radius-md)">
          <div>A) ${currentActiveQ.options.A}</div><div>B) ${currentActiveQ.options.B}</div>
          <div>C) ${currentActiveQ.options.C}</div><div>D) ${currentActiveQ.options.D}</div>
        </div>
        <div style="display:flex;justify-content:between;align-items:center;margin-top:var(--space-2)">
          <div style="font-size:var(--text-xs);color:var(--text-muted)">
            Timer: <strong style="color:var(--text-accent)" id="status-timer">${secLeft}s remaining</strong>
          </div>
          <button class="btn btn-danger btn-sm" onclick="closeLiveQuestion()">🛑 Close Early</button>
        </div>
      </div>
    `;

    // Active countdown loop
    const timerEl = document.getElementById('status-timer');
    if (timerEl && secLeft > 0) {
      let intervalSec = secLeft;
      const tId = setInterval(() => {
        intervalSec--;
        if (intervalSec <= 0) {
          clearInterval(tId);
          refreshQuizState();
        } else if (document.getElementById('status-timer')) {
          document.getElementById('status-timer').textContent = `${intervalSec}s remaining`;
        } else {
          clearInterval(tId);
        }
      }, 1000);
    }

  } else {
    card.style.borderColor = 'var(--border-subtle)';
    info.innerHTML = `
      <div style="padding:var(--space-5);text-align:center;color:var(--text-muted);font-size:var(--text-sm)">
        💤 No active live question. Choose a preset or type one below to launch!
      </div>
    `;
  }
}

async function launchQuizQuestion() {
  const text = document.getElementById('qa-text')?.value.trim();
  const a = document.getElementById('qa-opt-a')?.value.trim();
  const b = document.getElementById('qa-opt-b')?.value.trim();
  const c = document.getElementById('qa-opt-c')?.value.trim();
  const d = document.getElementById('qa-opt-d')?.value.trim();
  const correct = document.getElementById('qa-correct')?.value;
  const duration = Number(document.getElementById('qa-duration')?.value || 30);

  if (!text || !a || !b) {
    Toast.warning('Question text and options A & B are required.');
    return;
  }

  const btn = document.querySelector('[onclick="launchQuizQuestion()"]');
  if (btn) { btn.disabled = true; btn.textContent = 'Launching...'; }

  try {
    const res = await API.safePost('launch_question', {
      data: {
        questionText: text,
        optionA: a, optionB: b, optionC: c, optionD: d,
        correctAnswer: correct,
        duration: duration
      }
    });

    if (res?.success) {
      Toast.success('Question launched live to all screens!');
      clearLauncherForm();
      await refreshQuizState();
    }
  } catch (err) {
    Toast.error('Launch failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔥 Go Live Now'; }
  }
}

async function closeLiveQuestion() {
  const confirmed = await Modal.confirm('Close this question immediately? Submissions will stop.');
  if (!confirmed) return;

  try {
    const res = await API.safePost('close_question', {});
    if (res?.success) {
      Toast.info('Question closed.');
      await refreshQuizState();
    }
  } catch (err) {
    Toast.error('Failed to close: ' + err.message);
  }
}

async function confirmClearQuiz() {
  const confirmed = await Modal.confirm('<strong>⚠️ Clear Quiz Submissions?</strong><br><br>This will permanently clear all logs of viewer answers. Cannot be undone.');
  if (!confirmed) return;

  try {
    const res = await API.safePost('clear_quiz', {});
    if (res?.success) {
      Toast.success('Submissions cleared.');
      await refreshQuizState();
    }
  } catch (err) {
    Toast.error('Clear failed: ' + err.message);
  }
}

function renderSubmissionsFeed() {
  const tbody = document.getElementById('quiz-submissions-list');
  if (!tbody) return;

  if (quizSubmissions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center;padding:var(--space-6);color:var(--text-muted)">
          No submissions logged.
        </td>
      </tr>
    `;
    return;
  }

  const isPoll = !currentActiveQ || !currentActiveQ.correctAnswer;
  const sortedSubmissions = [...quizSubmissions].sort((a,b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

  tbody.innerHTML = sortedSubmissions.map(s => {
    const time = new Date(s.Timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const correct = s.IsCorrect === 'Yes';
    
    if (isPoll) {
      return `
        <tr style="background:rgba(255,255,255,0.01)">
          <td style="font-size:11px;color:var(--text-muted)">${time}</td>
          <td style="font-weight:600;font-size:12px;color:var(--text-primary)">${s.PlayerName}</td>
          <td style="font-size:11px;color:var(--text-secondary)">${s.Mobile}</td>
          <td style="text-align:center;font-weight:700;font-size:12px">${s.SubmittedAnswer}</td>
          <td style="text-align:center;font-size:12px;color:var(--text-muted)">
            Submitted ✓
          </td>
        </tr>
      `;
    }

    return `
      <tr class="${correct ? 'row-correct' : 'row-incorrect'}" style="background:${correct ? 'rgba(46,204,113,0.04)' : 'rgba(231,76,60,0.02)'}">
        <td style="font-size:11px;color:var(--text-muted)">${time}</td>
        <td style="font-weight:600;font-size:12px;color:var(--text-primary)">${s.PlayerName}</td>
        <td style="font-size:11px;color:var(--text-secondary)">${s.Mobile}</td>
        <td style="text-align:center;font-weight:700;font-size:12px">${s.SubmittedAnswer}</td>
        <td style="text-align:center;font-size:12px">
          ${correct ? '<span style="color:var(--success);font-weight:bold">Correct ✓</span>' : '<span style="color:var(--error)">Wrong ✗</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

function renderAnalyticsSummary() {
  const card = document.getElementById('quiz-analytics-card');
  const bars = document.getElementById('qa-stat-bars');
  if (!card || !bars) return;

  if (quizSubmissions.length === 0) {
    card.style.display = 'none';
    return;
  }
  card.style.display = 'block';

  const total = quizSubmissions.length;
  const correct = quizSubmissions.filter(s => s.IsCorrect === 'Yes').length;
  const accuracy = Math.round((correct / total) * 100);
  const isPoll = !currentActiveQ || !currentActiveQ.correctAnswer;

  document.getElementById('qa-stat-total').textContent = total;
  
  const accuracyCardVal = document.getElementById('qa-stat-correct');
  const accuracyCardLabel = accuracyCardVal.nextElementSibling;
  
  if (isPoll) {
    accuracyCardVal.textContent = 'Poll';
    accuracyCardVal.style.color = 'var(--gold-400)';
    accuracyCardLabel.textContent = 'Engagement Mode';
  } else {
    accuracyCardVal.textContent = accuracy + '%';
    accuracyCardVal.style.color = 'var(--success)';
    accuracyCardLabel.textContent = 'Accuracy (% Correct)';
  }

  // Count counts of A, B, C, D
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  quizSubmissions.forEach(s => {
    const ans = (s.SubmittedAnswer || '').toUpperCase();
    if (counts[ans] !== undefined) counts[ans]++;
  });

  const letters = ['A', 'B', 'C', 'D'];
  bars.innerHTML = letters.map(l => {
    const count = counts[l];
    const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
    
    // In poll mode, there is no correct answer to highlight, so we just use neutral purple
    const isThisCorrect = !isPoll && (currentActiveQ && currentActiveQ.correctAnswer === l);
    const color = isThisCorrect ? 'var(--success)' : 'var(--purple-400)';

    return `
      <div style="font-size:11px;display:grid;grid-template-columns:20px 1fr 40px;align-items:center;gap:var(--space-2)">
        <div style="font-weight:800;color:${color}">${l}</div>
        <div style="background:var(--bg-elevated);border-radius:4px;height:12px;overflow:hidden">
          <div style="width:${pct}%;background:${color};height:100%;transition:width 0.4s ease"></div>
        </div>
        <div style="text-align:right;color:var(--text-muted)">${count} (${pct}%)</div>
      </div>
    `;
  }).join('');
}
