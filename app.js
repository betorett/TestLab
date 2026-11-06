import { PAPA_OPTIONS, parseCsvMatrix } from './src/csv-bank.js';
import { gradeQuestion } from './src/grade.js';
import { importBankText } from './src/import-bank.js';
import { describeAttempt } from './src/report.js';
import { renderHistoryList } from './src/render-history.js';
import { renderQuestion } from './src/render-question.js';
import { createRepository } from './src/repository.js';
import { scoreExam } from './src/score.js';
import { blankAnswer, canAdvance, countsAsAnswered, isReadyToCheck, shuffleItems } from './src/session.js';
import { coerceStoredQuestion } from './src/storage.js';

let questions = [];
let optionOrders = [];
let mode = null;
let currentIndex = 0;
let userAnswers = [];
let isReviewing = false;
let isAnswerChecked = false;
let penaltyFactor = 0.33;
let currentExamName = '';

const $ = (id) => document.getElementById(id);
const repository = createRepository(localStorage);

const themeToggle = $('theme-toggle');
const htmlTag = document.documentElement;
const screens = {
  upload: $('upload-screen'),
  mode: $('mode-screen'),
  exam: $('exam-screen'),
  loading: $('loading-screen'),
  results: $('results-screen')
};
const ui = {
  dropZone: $('drop-zone'),
  fileInput: $('file-input'),
  browseBtn: $('browse-btn'),
  togglePasteBtn: $('toggle-paste-btn'),
  pasteCollapse: $('paste-collapse'),
  pasteInput: $('paste-input'),
  loadPasteBtn: $('load-paste-btn'),
  selectAllBtn: $('select-all-btn'),
  deleteSelectedBtn: $('delete-selected-btn'),
  historyList: $('history-list'),
  importErrors: $('import-errors'),
  backToUpload: $('back-to-upload'),
  questionCountLabel: $('question-count-label'),
  modeStudy: $('mode-study'),
  modeExam: $('mode-exam'),
  questionContainer: $('question-container'),
  questionStatus: $('question-status'),
  counter: $('question-counter'),
  progressFill: $('progress-fill'),
  prevBtn: $('prev-btn'),
  skipBtn: $('skip-btn'),
  aiHelpBtn: $('ai-help-btn'),
  checkMultipleBtn: $('check-multiple-btn'),
  nextBtn: $('next-btn'),
  submitBtn: $('submit-exam-btn'),
  quitBtn: $('quit-btn'),
  scoreRing: $('score-ring-fill'),
  scoreText: $('final-score'),
  scoreMessage: $('score-message'),
  scoreDetail: $('score-detail'),
  reviewBtn: $('review-btn'),
  generateReportBtn: $('generate-report-btn'),
  restartBtn: $('restart-btn'),
  toast: $('toast'),
  toastText: $('toast-text'),
  aiModal: $('ai-prompt-modal'),
  openAiPromptBtn: $('open-ai-prompt'),
  closeModalBtn: $('close-modal'),
  copyPromptBtn: $('copy-prompt-btn'),
  promptText: $('prompt-text'),
  settingsBtn: $('settings-btn'),
  settingsModal: $('settings-modal'),
  closeSettingsBtn: $('close-settings'),
  saveSettingsBtn: $('save-settings-btn'),
  penaltyInput: $('penalty-input')
};

const SCREEN_TITLES = {
  upload: 'TestLab — Exámenes interactivos',
  mode: 'TestLab — Cómo estudiar',
  exam: 'TestLab — Examen',
  loading: 'TestLab — Calculando',
  results: 'TestLab — Resultados'
};

function init() {
  const savedTheme = localStorage.getItem('testlab-theme') || 'dark';
  htmlTag.setAttribute('data-theme', savedTheme);
  themeToggle.addEventListener('click', toggleTheme);

  const savedPenalty = localStorage.getItem('testlab-penalty');
  if (savedPenalty !== null) penaltyFactor = Number.parseFloat(savedPenalty);
  ui.penaltyInput.value = penaltyFactor;
  ui.settingsBtn.addEventListener('click', () => ui.settingsModal.showModal());
  ui.closeSettingsBtn.addEventListener('click', () => ui.settingsModal.close());
  ui.saveSettingsBtn.addEventListener('click', () => {
    penaltyFactor = Number.parseFloat(ui.penaltyInput.value) || 0;
    localStorage.setItem('testlab-penalty', penaltyFactor);
    ui.settingsModal.close();
    showToast('Ajustes guardados');
  });

  ui.openAiPromptBtn.addEventListener('click', () => ui.aiModal.showModal());
  ui.closeModalBtn.addEventListener('click', () => ui.aiModal.close());
  ui.copyPromptBtn.addEventListener('click', copyAiPrompt);
  ui.aiModal.addEventListener('click', (event) => {
    const rect = ui.aiModal.getBoundingClientRect();
    const inside = event.clientY >= rect.top && event.clientY <= rect.bottom
      && event.clientX >= rect.left && event.clientX <= rect.right;
    if (!inside) ui.aiModal.close();
  });

  ui.dropZone.addEventListener('click', () => ui.fileInput.click());
  ui.browseBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    ui.fileInput.click();
  });
  ui.fileInput.addEventListener('change', (event) => {
    if (event.target.files.length) handleMultipleFiles(event.target.files);
  });
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((name) => {
    ui.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  ui.dropZone.addEventListener('dragover', () => ui.dropZone.classList.add('dragover'));
  ui.dropZone.addEventListener('dragleave', () => ui.dropZone.classList.remove('dragover'));
  ui.dropZone.addEventListener('drop', (event) => {
    ui.dropZone.classList.remove('dragover');
    if (event.dataTransfer.files.length) handleMultipleFiles(event.dataTransfer.files);
  });

  ui.togglePasteBtn.addEventListener('click', () => {
    ui.pasteCollapse.classList.toggle('hidden');
  });
  ui.pasteInput.addEventListener('input', () => {
    ui.loadPasteBtn.disabled = ui.pasteInput.value.trim() === '';
  });
  ui.loadPasteBtn.addEventListener('click', () => {
    const text = ui.pasteInput.value.trim();
    if (!text) return;
    const parsed = importBankText(text, '', globalThis.Papa);
    const name = parsed.title || `Examen pegado (${new Date().toLocaleDateString()})`;
    const notes = [];
    const saved = rememberBank(name, parsed, notes) ? 1 : 0;
    ui.pasteInput.value = '';
    ui.loadPasteBtn.disabled = true;
    ui.pasteCollapse.classList.add('hidden');
    renderHistory();
    showImportNotes(notes, saved);
  });

  ui.selectAllBtn.addEventListener('click', selectAllExams);
  ui.deleteSelectedBtn.addEventListener('click', deleteSelectedExams);
  ui.historyList.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === 'start') loadFromHistory(index);
    if (button.dataset.action === 'rename') renameHistory(index);
  });

  ui.backToUpload.addEventListener('click', () => showScreen('upload'));
  ui.modeStudy.addEventListener('click', () => { mode = 'study'; startExam(); });
  ui.modeExam.addEventListener('click', () => { mode = 'exam'; startExam(); });
  ui.prevBtn.addEventListener('click', prevQuestion);
  ui.nextBtn.addEventListener('click', nextQuestion);
  ui.skipBtn.addEventListener('click', skipQuestion);
  ui.aiHelpBtn.addEventListener('click', resolveDoubt);
  ui.checkMultipleBtn.addEventListener('click', checkAnswers);
  ui.submitBtn.addEventListener('click', finishExam);
  ui.quitBtn.addEventListener('click', resetApp);
  ui.reviewBtn.addEventListener('click', startReview);
  ui.restartBtn.addEventListener('click', resetApp);
  ui.generateReportBtn.addEventListener('click', generateFinalReport);
  renderHistory();
}

function toggleTheme() {
  const next = htmlTag.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  htmlTag.setAttribute('data-theme', next);
  localStorage.setItem('testlab-theme', next);
}

function copyAiPrompt() {
  navigator.clipboard.writeText(ui.promptText.textContent).then(() => {
    ui.copyPromptBtn.textContent = '¡Copiado!';
    setTimeout(() => { ui.copyPromptBtn.textContent = 'Copiar Prompt'; }, 2000);
  });
}

function showScreen(name) {
  Object.values(screens).forEach((screen) => screen.classList.remove('active'));
  screens[name].classList.add('active');
  document.title = SCREEN_TITLES[name];
}

function handleMultipleFiles(fileList) {
  const files = Array.from(fileList);
  const notes = [];
  let processed = 0;
  let saved = 0;

  const finish = () => {
    processed += 1;
    if (processed !== files.length) return;
    ui.fileInput.value = '';
    renderHistory();
    showImportNotes(notes, saved);
  };

  files.forEach((file) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.csv') && !name.endsWith('.json') && !name.endsWith('.txt')) {
      notes.push(`${file.name}: formato no admitido`);
      finish();
      return;
    }
    if (name.endsWith('.csv')) {
      globalThis.Papa.parse(file, {
        ...PAPA_OPTIONS,
        complete: (results) => {
          const parsed = parseCsvMatrix(results.data);
          if (results.errors?.length) {
            notes.push(...results.errors.map((error) => `${file.name}: ${error.message}`));
          }
          if (rememberBank(file.name.replace(/\.csv$/i, ''), parsed, notes)) saved += 1;
          finish();
        }
      });
      return;
    }
    file.text().then((text) => {
      const parsed = importBankText(text, file.name, globalThis.Papa);
      const bankName = file.name.replace(/\.(json|txt)$/i, '');
      if (rememberBank(bankName, parsed, notes)) saved += 1;
      finish();
    }).catch(() => {
      notes.push(`${file.name}: no se pudo leer`);
      finish();
    });
  });
}

function rememberBank(name, parsed, notes = []) {
  parsed.errors.forEach((error) => {
    notes.push(error.path ? `${error.path}: ${error.message}` : error.message);
  });
  if (!parsed.questions.length) return false;
  repository.save(name, parsed.questions);
  return true;
}

function showImportNotes(notes, saved) {
  ui.importErrors.replaceChildren();
  notes.forEach((note) => {
    const line = document.createElement('p');
    line.textContent = note;
    ui.importErrors.append(line);
  });
  if (saved > 0) showToast(notes.length ? 'Banco guardado con avisos' : 'Añadido al repositorio');
  else showToast(notes[0] || 'No se encontraron preguntas válidas');
}

function startExam() {
  currentIndex = 0;
  isReviewing = false;
  isAnswerChecked = false;
  userAnswers = questions.map((question) => blankAnswer(question));
  optionOrders = questions.map((question) => (
    question.type === 'MATCHING'
      ? shuffleItems(question.body.pairs.map((pair) => pair.right))
      : null
  ));
  showScreen('exam');
  renderCurrent();
}

function shouldReveal(question, answer) {
  if (isReviewing) return true;
  if (mode !== 'study' || question.type === 'SHORT_ANSWER') return false;
  if (answer === 'SKIPPED') return true;
  if (question.type === 'SINGLE' || question.type === 'TRUE_FALSE') {
    return gradeQuestion(question, answer) !== 'skipped';
  }
  return isAnswerChecked;
}

function renderCurrent() {
  const question = questions[currentIndex];
  const answer = userAnswers[currentIndex];
  ui.counter.textContent = `${currentIndex + 1} / ${questions.length}`;
  const answeredCount = userAnswers.filter((item, index) => countsAsAnswered(questions[index], item)).length;
  ui.progressFill.style.width = `${(answeredCount / questions.length) * 100}%`;
  renderQuestion(ui.questionContainer, question, answer, {
    idPrefix: `q${currentIndex}`,
    reveal: shouldReveal(question, answer),
    optionOrder: optionOrders[currentIndex],
    onAnswer
  });
  renderMath(ui.questionContainer);
  const status = ui.questionContainer.querySelector('.answer-status');
  ui.questionStatus.textContent = status ? status.textContent : '';
  updateNavButtons();
}

function onAnswer(next) {
  const index = currentIndex;
  const question = questions[index];
  userAnswers[index] = next;
  if (question.type !== 'SINGLE' && question.type !== 'TRUE_FALSE') isAnswerChecked = false;
  renderCurrent();
  if (mode === 'exam' && (question.type === 'SINGLE' || question.type === 'TRUE_FALSE')) {
    setTimeout(() => {
      if (currentIndex === index && currentIndex < questions.length - 1) nextQuestion();
    }, 300);
  }
}

function updateNavButtons() {
  const question = questions[currentIndex];
  const answer = userAnswers[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === questions.length - 1;
  const advanced = canAdvance({
    question,
    answer,
    mode,
    reviewing: isReviewing,
    checked: isAnswerChecked
  });
  const attempted = countsAsAnswered(question, answer);

  [ui.prevBtn, ui.skipBtn, ui.aiHelpBtn, ui.nextBtn, ui.submitBtn, ui.checkMultipleBtn]
    .forEach((button) => button.classList.add('hidden'));

  if ((isReviewing || (mode === 'study' && advanced)) && answer !== 'SKIPPED' && attempted) {
    ui.aiHelpBtn.classList.remove('hidden');
  }
  if (!isFirst && (isReviewing || mode === 'exam' || (mode === 'study' && advanced))) {
    ui.prevBtn.classList.remove('hidden');
  }

  if (isReviewing) {
    if (!isLast) ui.nextBtn.classList.remove('hidden');
    else showSubmit('Volver a resultados', () => showScreen('results'));
    return;
  }
  if (mode === 'exam') {
    if (!isLast) ui.nextBtn.classList.remove('hidden');
    else showSubmit('Finalizar', finishExam);
    if (!attempted) ui.skipBtn.classList.remove('hidden');
    return;
  }
  if (!advanced) {
    ui.skipBtn.classList.remove('hidden');
    if (!['SINGLE', 'TRUE_FALSE', 'SHORT_ANSWER'].includes(question.type)) {
      ui.checkMultipleBtn.classList.remove('hidden');
      ui.checkMultipleBtn.disabled = !isReadyToCheck(question, answer);
    }
    return;
  }
  if (!isLast) ui.nextBtn.classList.remove('hidden');
  else showSubmit('Finalizar', finishExam);
}

function showSubmit(label, handler) {
  ui.submitBtn.textContent = label;
  ui.submitBtn.onclick = handler;
  ui.submitBtn.classList.remove('hidden');
}

function prevQuestion() {
  if (currentIndex === 0) return;
  currentIndex -= 1;
  isAnswerChecked = false;
  renderCurrent();
}

function nextQuestion() {
  if (currentIndex >= questions.length - 1) return;
  currentIndex += 1;
  isAnswerChecked = false;
  renderCurrent();
}

function skipQuestion() {
  const index = currentIndex;
  userAnswers[index] = 'SKIPPED';
  isAnswerChecked = true;
  renderCurrent();
  if (mode === 'exam') {
    setTimeout(() => {
      if (currentIndex === index && currentIndex < questions.length - 1) nextQuestion();
    }, 150);
  }
}

function checkAnswers() {
  isAnswerChecked = true;
  renderCurrent();
}

function finishExam() {
  const result = scoreExam(questions, userAnswers, penaltyFactor);
  ui.scoreText.textContent = result.scoreLabel;
  const pending = result.pending ? ` | ⏳ ${result.pending} pendientes` : '';
  ui.scoreDetail.textContent = `✅ ${result.correct} | ❌ ${result.wrong} | ⏭️ ${result.skipped}${pending} (Penaliza: -${penaltyFactor})`;
  if (result.scoreOutOf10 >= 8) ui.scoreMessage.textContent = '¡Rendimiento Sobresaliente! 🎉';
  else if (result.scoreOutOf10 >= 5) ui.scoreMessage.textContent = 'Aprobado — ¡buen trabajo!';
  else ui.scoreMessage.textContent = 'Suspenso — Sigue practicando 💪';
  repository.updateScore(currentExamName, result.scoreLabel);

  const circumference = 2 * Math.PI * 52;
  showScreen('loading');
  setTimeout(() => {
    showScreen('results');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = (Math.max(0, result.scoreOutOf10) / 10) * circumference;
        ui.scoreRing.style.strokeDasharray = `${fill} ${circumference}`;
        ui.scoreRing.style.stroke = result.scoreOutOf10 < 5 ? 'var(--incorrect)' : 'var(--accent)';
      });
    });
  }, 1500);
}

function generateFinalReport() {
  let report = '** Reporte de Desempeño Escrito: TestLab **\n\n';
  report += 'Analiza mis respuestas. Las preguntas SHORT_ANSWER marcadas como PENDIENTE no están corregidas automáticamente.\n\n';
  questions.forEach((question, index) => {
    const attempt = describeAttempt(question, userAnswers[index]);
    report += `--- Pregunta ${index + 1} [${attempt.label}] ---\n${attempt.detail}\n\n`;
  });
  const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Reporte_TestLab_IA.txt';
  link.hidden = true;
  document.body.append(link);
  link.click();
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 100);
  showToast('Archivo descargado con éxito.');
}

function resolveDoubt() {
  const question = questions[currentIndex];
  const attempt = describeAttempt(question, userAnswers[currentIndex]);
  const prompt = attempt.status === 'correct'
    ? `He respondido correctamente.\n${attempt.detail}\n\nExplícame el mecanismo para asegurarme de que lo domino.`
    : attempt.status === 'pending'
      ? `Esta respuesta corta está pendiente de mi autoevaluación. No la des por incorrecta ni por correcta.\n${attempt.detail}\n\nAyúdame a compararla con la respuesta modelo.`
      : `Tengo una duda con esta pregunta.\n${attempt.detail}\n\nExplícame qué error hay.`;
  navigator.clipboard.writeText(prompt).then(() => {
    showToast('Texto copiado — pégalo ahora en Gemini');
    setTimeout(() => window.open('https://gemini.google.com/app', '_blank'), 800);
  });
}

function showToast(message) {
  ui.toastText.textContent = message;
  ui.toast.classList.add('show');
  setTimeout(() => ui.toast.classList.remove('show'), 3500);
}

function renderHistory() {
  const history = repository.list();
  renderHistoryList(ui.historyList, history);
  ui.historyList.querySelectorAll('.repo-checkbox').forEach((box) => {
    box.addEventListener('change', updateDeleteBtnVisibility);
  });
  const empty = history.length === 0;
  ui.selectAllBtn.classList.toggle('hidden', empty);
  if (empty) ui.deleteSelectedBtn.classList.add('hidden');
  else updateDeleteBtnVisibility();
  renderMath(ui.historyList);
}

function updateDeleteBtnVisibility() {
  const selected = ui.historyList.querySelectorAll('.repo-checkbox:checked').length > 0;
  ui.deleteSelectedBtn.classList.toggle('hidden', !selected);
}

function selectAllExams() {
  const boxes = [...ui.historyList.querySelectorAll('.repo-checkbox')];
  const allChecked = boxes.length > 0 && boxes.every((box) => box.checked);
  boxes.forEach((box) => { box.checked = !allChecked; });
  updateDeleteBtnVisibility();
}

function deleteSelectedExams() {
  const selected = [...ui.historyList.querySelectorAll('.repo-checkbox:checked')];
  if (!selected.length) return;
  if (!confirm(`¿Seguro que deseas borrar ${selected.length} exámenes de tu Repositorio?`)) return;
  repository.remove(selected.map((box) => Number(box.dataset.index)));
  renderHistory();
  showToast('Exámenes borrados');
}

function loadFromHistory(index) {
  const item = repository.list()[index];
  if (!item) return;
  currentExamName = item.name;
  questions = item.questions.map(coerceStoredQuestion);
  ui.questionCountLabel.textContent = `${questions.length} preguntas pre-cargadas`;
  showScreen('mode');
}

function renameHistory(index) {
  const item = repository.list()[index];
  if (!item) return;
  const newName = prompt('Introduce un nuevo nombre para este banco de preguntas:', item.name);
  if (!newName || !newName.trim()) return;
  repository.rename(index, newName);
  renderHistory();
  showToast('Nombre actualizado');
}

function startReview() {
  isReviewing = true;
  currentIndex = 0;
  isAnswerChecked = true;
  showScreen('exam');
  renderCurrent();
}

function resetApp() {
  questions = [];
  optionOrders = [];
  userAnswers = [];
  mode = null;
  isReviewing = false;
  isAnswerChecked = false;
  currentIndex = 0;
  ui.fileInput.value = '';
  ui.pasteInput.value = '';
  ui.loadPasteBtn.disabled = true;
  ui.pasteCollapse.classList.add('hidden');
  ui.scoreRing.style.strokeDasharray = '0 327';
  showScreen('upload');
  renderHistory();
}

function renderMath(element) {
  if (!globalThis.renderMathInElement) return;
  globalThis.renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
      { left: '\\(', right: '\\)', display: false }
    ],
    throwOnError: false
  });
}

init();
