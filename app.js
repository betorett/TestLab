import { SYSTEM_PROMPT_JSON_V1 } from './src/ai-prompt.js';
import { PAPA_OPTIONS, parseCsvMatrix } from './src/csv-bank.js';
import { gradeQuestion } from './src/grade.js';
import { importBankText } from './src/import-bank.js';
import { createLibrary } from './src/library.js';
import { describeAttempt, formatReference } from './src/report.js';
import { renderLibrary } from './src/render-library.js';
import { renderQuestion } from './src/render-question.js';
import { scoreExam } from './src/score.js';
import { blankAnswer, canAdvance, countsAsAnswered, isReadyToCheck, shuffleItems } from './src/session.js';
import { coerceStoredQuestion } from './src/storage.js';

let questions = [];
let optionOrders = [];
let mode = null;
let currentIndex = 0;
let userAnswers = [];
let checkedQuestions = [];
let isReviewing = false;
let isAnswerChecked = false;
let penaltyFactor = 0.33;
let currentExamId = '';
let currentFolderId = null;
let pendingDelete = null;
let libraryDialogAction = null;
let dragDepth = 0;

const $ = (id) => document.getElementById(id);
const repository = createLibrary(localStorage);

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
  globalDropOverlay: $('global-drop-overlay'),
  dropZone: $('drop-zone'),
  fileInput: $('file-input'),
  importDialog: $('import-dialog'),
  importBtn: $('import-btn'),
  chooseFilesBtn: $('choose-files-btn'),
  closeImportDialog: $('close-import-dialog'),
  libraryTitle: $('library-title'),
  libraryStats: $('library-stats'),
  pasteInput: $('paste-input'),
  loadPasteBtn: $('load-paste-btn'),
  selectAllBtn: $('select-all-btn'),
  deleteSelectedBtn: $('delete-selected-btn'),
  historyList: $('history-list'),
  newFolderBtn: $('new-folder-btn'),
  librarySort: $('library-sort'),
  importFolder: $('import-folder'),
  libraryDialog: $('library-dialog'),
  libraryForm: $('library-form'),
  libraryDialogTitle: $('library-dialog-title'),
  libraryDialogError: $('library-dialog-error'),
  libraryNameField: $('library-name-field'),
  libraryNameInput: $('library-name-input'),
  libraryDestField: $('library-dest-field'),
  libraryDestSelect: $('library-dest-select'),
  libraryDialogConfirm: $('library-dialog-confirm'),
  libraryDialogClose: $('library-dialog-close'),
  deleteDialog: $('delete-dialog'),
  deleteDialogText: $('delete-dialog-text'),
  importErrors: $('import-errors'),
  backToUpload: $('back-to-upload'),
  activeBankTitle: $('active-bank-title'),
  questionCountLabel: $('question-count-label'),
  modeStudy: $('mode-study'),
  modeExam: $('mode-exam'),
  examModeBadge: $('exam-mode-badge'),
  questionMap: $('question-map'),
  questionContainer: $('question-container'),
  questionStatus: $('question-status'),
  counter: $('question-counter'),
  examProgress: $('exam-progress'),
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
  resultsBreakdown: $('results-breakdown'),
  retryBtn: $('retry-btn'),
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
  upload: 'TestLab — Mis tests',
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

  ui.promptText.textContent = SYSTEM_PROMPT_JSON_V1;
  ui.newFolderBtn.addEventListener('click', openNewFolderDialog);
  ui.librarySort.addEventListener('change', () => {
    repository.setSort(ui.librarySort.value);
    renderHistory();
  });
  ui.libraryForm.addEventListener('submit', (event) => {
    const needsName = !ui.libraryNameField.classList.contains('hidden');
    if (event.submitter?.value === 'confirm' && needsName && ui.libraryNameInput.value.trim() === '') {
      event.preventDefault();
      ui.libraryDialogError.textContent = 'El nombre no puede estar vacío.';
      ui.libraryNameInput.focus();
    }
  });
  ui.libraryDialog.addEventListener('close', () => {
    const value = ui.libraryDialog.returnValue;
    ui.libraryDialog.returnValue = '';
    const action = libraryDialogAction;
    libraryDialogAction = null;
    if (value !== 'confirm' || !action) return;
    action({
      name: ui.libraryNameInput.value,
      destination: ui.libraryDestSelect.value || null
    });
  });
  ui.libraryDialogClose.addEventListener('click', () => ui.libraryDialog.close());
  ui.libraryDialog.addEventListener('click', (event) => {
    if (event.target === ui.libraryDialog) ui.libraryDialog.close();
  });
  ui.deleteDialog.addEventListener('close', () => {
    const value = ui.deleteDialog.returnValue;
    ui.deleteDialog.returnValue = '';
    const pending = pendingDelete;
    pendingDelete = null;
    if (value !== 'confirm' || !pending) return;
    if (pending.kind === 'tests') repository.deleteTests(pending.ids);
    else repository.deleteFolder(pending.id);
    renderHistory();
    showToast(pending.kind === 'tests' ? 'Exámenes borrados' : 'Carpeta eliminada');
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

  ui.importBtn.addEventListener('click', () => ui.importDialog.showModal());
  ui.chooseFilesBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    ui.fileInput.click();
  });
  ui.closeImportDialog.addEventListener('click', () => ui.importDialog.close());

  ui.dropZone.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
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

  initGlobalDragAndDrop();

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
    if (saved > 0 && ui.importDialog.open) ui.importDialog.close();
    renderHistory();
    showImportNotes(notes, saved);
  });

  ui.selectAllBtn.addEventListener('click', selectAllExams);
  ui.deleteSelectedBtn.addEventListener('click', deleteSelectedExams);
  ui.historyList.addEventListener('click', onLibraryClick);

  document.addEventListener('click', (event) => {
    const openMenus = ui.historyList.querySelectorAll('details.library-menu[open]');
    openMenus.forEach((menu) => {
      if (!menu.contains(event.target)) menu.removeAttribute('open');
    });
  });

  document.addEventListener('keydown', onGlobalKeyDown);

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
  ui.retryBtn?.addEventListener('click', () => {
    if (!questions.length) return;
    mode = mode || 'study';
    startExam();
  });
  ui.reviewBtn.addEventListener('click', () => startReview(0));
  ui.restartBtn.addEventListener('click', resetApp);
  ui.generateReportBtn.addEventListener('click', generateFinalReport);
  renderHistory();
}

function initGlobalDragAndDrop() {
  window.addEventListener('dragenter', (event) => {
    if (screens.upload.hasAttribute('hidden') || ui.importDialog.open) return;
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    dragDepth += 1;
    ui.globalDropOverlay?.removeAttribute('hidden');
  });

  window.addEventListener('dragover', (event) => {
    if (screens.upload.hasAttribute('hidden') || ui.importDialog.open) return;
    if (!event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
  });

  window.addEventListener('dragleave', (event) => {
    if (screens.upload.hasAttribute('hidden') || ui.importDialog.open) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0 || event.relatedTarget === null) {
      dragDepth = 0;
      ui.globalDropOverlay?.setAttribute('hidden', '');
    }
  });

  window.addEventListener('drop', (event) => {
    if (screens.upload.hasAttribute('hidden') || ui.importDialog.open) return;
    dragDepth = 0;
    ui.globalDropOverlay?.setAttribute('hidden', '');
    if (!event.dataTransfer?.files?.length) return;
    event.preventDefault();
    if (currentFolderId && !ui.importFolder.value) {
      ui.importFolder.value = currentFolderId;
    }
    handleMultipleFiles(event.dataTransfer.files);
  });
}

function anyDialogOpen() {
  return Boolean(document.querySelector('dialog[open]'));
}

function isEditableTarget(target) {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    const type = target.getAttribute('type');
    return type !== 'radio' && type !== 'checkbox';
  }
  return target.isContentEditable;
}

function onGlobalKeyDown(event) {
  if (event.key === 'Escape') {
    const openMenus = [...ui.historyList.querySelectorAll('details.library-menu[open]')];
    if (openMenus.length && !anyDialogOpen()) {
      openMenus.forEach((menu) => {
        if (menu.contains(document.activeElement)) {
          menu.querySelector('summary')?.focus();
        }
        menu.removeAttribute('open');
      });
      return;
    }
  }

  if (anyDialogOpen()) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;

  if (!screens.mode.hasAttribute('hidden')) {
    if (event.key === '1') {
      event.preventDefault();
      mode = 'study';
      startExam();
    } else if (event.key === '2') {
      event.preventDefault();
      mode = 'exam';
      startExam();
    }
    return;
  }

  if (screens.exam.hasAttribute('hidden')) return;
  if (isEditableTarget(event.target)) return;

  if (event.key === 'Enter') {
    if (event.target?.closest?.('button')) return;
    if (!ui.checkMultipleBtn.classList.contains('hidden') && !ui.checkMultipleBtn.disabled) {
      event.preventDefault();
      ui.checkMultipleBtn.click();
      return;
    }
    if (!ui.nextBtn.classList.contains('hidden') && !ui.nextBtn.disabled) {
      event.preventDefault();
      ui.nextBtn.click();
      return;
    }
    if (!ui.submitBtn.classList.contains('hidden') && !ui.submitBtn.disabled) {
      event.preventDefault();
      ui.submitBtn.click();
      return;
    }
  }

  if (event.key === 'ArrowLeft' && !ui.prevBtn.classList.contains('hidden')) {
    event.preventDefault();
    prevQuestion();
    return;
  }
  if (event.key === 'ArrowRight' && !ui.nextBtn.classList.contains('hidden')) {
    event.preventDefault();
    nextQuestion();
    return;
  }

  const question = questions[currentIndex];
  const answer = userAnswers[currentIndex];
  if (!question) return;

  if (!shouldReveal(question, answer)) {
    if (question.type === 'SINGLE' || question.type === 'MULTIPLE') {
      const choices = question.body.choices;
      let choiceIndex = -1;
      if (/^[1-9]$/.test(event.key)) {
        choiceIndex = Number.parseInt(event.key, 10) - 1;
      } else if (/^[a-iA-I]$/.test(event.key)) {
        const upper = event.key.toUpperCase();
        choiceIndex = choices.findIndex((c) => c.id.toUpperCase() === upper);
        if (choiceIndex === -1) {
          choiceIndex = upper.charCodeAt(0) - 65;
        }
      }
      if (choiceIndex >= 0 && choiceIndex < choices.length) {
        event.preventDefault();
        const buttons = ui.questionContainer.querySelectorAll('.option-btn');
        buttons[choiceIndex]?.click();
      }
    } else if (question.type === 'TRUE_FALSE') {
      const lower = event.key.toLowerCase();
      if (lower === 'v' || lower === '1') {
        event.preventDefault();
        onAnswer(['V']);
      } else if (lower === 'f' || lower === '2') {
        event.preventDefault();
        onAnswer(['F']);
      }
    }
  }
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
  Object.entries(screens).forEach(([key, screen]) => {
    const active = key === name;
    screen.classList.toggle('active', active);
    screen.toggleAttribute('hidden', !active);
  });
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
    if (saved > 0 && ui.importDialog.open) ui.importDialog.close();
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
  const saved = repository.saveTest(name, parsed.questions, ui.importFolder.value || null);
  if (!saved.ok) {
    notes.push(saved.error === 'missing' ? 'La carpeta de destino ya no existe' : 'No se pudo guardar el banco');
    return false;
  }
  return true;
}

function showImportNotes(notes, saved) {
  ui.importErrors.replaceChildren();
  notes.forEach((note) => {
    const line = document.createElement('p');
    line.textContent = note;
    ui.importErrors.append(line);
  });
  if (saved > 0) showToast(notes.length ? 'Banco guardado con avisos' : 'Añadido a Mis tests');
  else showToast(notes[0] || 'No se encontraron preguntas válidas');
}

function startExam() {
  currentIndex = 0;
  isReviewing = false;
  isAnswerChecked = false;
  userAnswers = questions.map((question) => blankAnswer(question));
  checkedQuestions = questions.map(() => false);
  optionOrders = questions.map((question) => (
    question.type === 'MATCHING'
      ? shuffleItems(question.body.pairs.map((pair) => pair.right))
      : null
  ));
  updateExamModeBadge();
  showScreen('exam');
  renderCurrent();
}

function updateExamModeBadge() {
  if (!ui.examModeBadge) return;
  if (isReviewing) {
    ui.examModeBadge.textContent = 'Revisión';
    ui.examModeBadge.dataset.mode = 'review';
  } else if (mode === 'exam') {
    ui.examModeBadge.textContent = 'Modo Examen';
    ui.examModeBadge.dataset.mode = 'exam';
  } else {
    ui.examModeBadge.textContent = 'Modo Estudio';
    ui.examModeBadge.dataset.mode = 'study';
  }
}

function shouldReveal(question, answer) {
  if (isReviewing) return true;
  if (mode !== 'study') return false;
  if (answer === 'SKIPPED') return true;
  if (question.type === 'SINGLE' || question.type === 'TRUE_FALSE') {
    return gradeQuestion(question, answer) !== 'skipped';
  }
  return isAnswerChecked;
}

function renderQuestionMap() {
  if (!ui.questionMap) return;
  ui.questionMap.replaceChildren();
  if (questions.length <= 1) {
    ui.questionMap.classList.add('hidden');
    return;
  }
  ui.questionMap.classList.remove('hidden');
  questions.forEach((question, index) => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'question-pill';
    pill.textContent = String(index + 1);
    const ans = userAnswers[index];
    const attempted = countsAsAnswered(question, ans);

    if (index === currentIndex) {
      pill.classList.add('pill-current');
      pill.setAttribute('aria-current', 'step');
    }

    const revealed = isReviewing || (
      mode === 'study' && (
        ans === 'SKIPPED'
        || ((question.type === 'SINGLE' || question.type === 'TRUE_FALSE') && attempted)
        || checkedQuestions[index]
        || (question.type === 'SHORT_ANSWER' && (ans?.verdict === 'correct' || ans?.verdict === 'incorrect'))
      )
    );

    let statusDescription = 'sin responder';
    if (revealed) {
      const verdict = gradeQuestion(question, ans);
      if (verdict === 'correct') {
        pill.classList.add('pill-correct');
        statusDescription = 'correcta';
      } else if (verdict === 'incorrect') {
        pill.classList.add('pill-incorrect');
        statusDescription = 'incorrecta';
      } else if (verdict === 'skipped') {
        pill.classList.add('pill-skipped');
        statusDescription = 'omitida';
      } else {
        pill.classList.add('pill-answered');
        statusDescription = 'respondida';
      }
    } else if (attempted) {
      pill.classList.add('pill-answered');
      statusDescription = 'respondida';
    }

    const currentTag = index === currentIndex ? ', actual' : '';
    pill.setAttribute('aria-label', `Pregunta ${index + 1} (${statusDescription}${currentTag})`);

    const canJump = isReviewing || mode === 'exam' || index <= currentIndex || attempted;
    pill.disabled = !canJump;
    pill.addEventListener('click', () => {
      if (index === currentIndex) return;
      currentIndex = index;
      isAnswerChecked = Boolean(checkedQuestions[index]);
      renderCurrent();
    });
    ui.questionMap.append(pill);
  });
  const currentPill = ui.questionMap.querySelector('.pill-current');
  const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  currentPill?.scrollIntoView?.({
    inline: 'center',
    block: 'nearest',
    behavior: prefersReduced ? 'auto' : 'smooth'
  });
}

function renderCurrent() {
  const question = questions[currentIndex];
  const answer = userAnswers[currentIndex];
  ui.counter.textContent = `${currentIndex + 1} / ${questions.length}`;
  const answeredCount = userAnswers.filter((item, index) => countsAsAnswered(questions[index], item)).length;
  ui.examProgress.max = questions.length;
  ui.examProgress.value = answeredCount;
  renderQuestionMap();
  const rendered = renderQuestion(ui.questionContainer, question, answer, {
    idPrefix: `q${currentIndex}`,
    reveal: shouldReveal(question, answer),
    optionOrder: optionOrders[currentIndex],
    isReviewing,
    onAnswer
  });
  if (!rendered?.preserved) renderMath(ui.questionContainer);
  const status = ui.questionContainer.querySelector('.answer-status');
  ui.questionStatus.textContent = status ? status.textContent : '';
  updateNavButtons();
}

function onAnswer(next) {
  const index = currentIndex;
  const question = questions[index];
  userAnswers[index] = next;
  if (question.type !== 'SINGLE' && question.type !== 'TRUE_FALSE') {
    if (question.type === 'SHORT_ANSWER' && next?.verdict != null) {
      isAnswerChecked = true;
      checkedQuestions[index] = true;
    } else {
      isAnswerChecked = false;
      checkedQuestions[index] = false;
    }
  }
  renderCurrent();
  if (mode === 'exam' && (question.type === 'SINGLE' || question.type === 'TRUE_FALSE')) {
    setTimeout(() => {
      if (currentIndex === index && currentIndex < questions.length - 1) nextQuestion();
    }, 260);
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
    else showSubmit('Volver a resultados', () => {
      renderResultsBreakdown();
      showScreen('results');
    });
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
    if (!['SINGLE', 'TRUE_FALSE'].includes(question.type) && !isAnswerChecked) {
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
  isAnswerChecked = Boolean(checkedQuestions[currentIndex]);
  renderCurrent();
}

function nextQuestion() {
  if (currentIndex >= questions.length - 1) return;
  currentIndex += 1;
  isAnswerChecked = Boolean(checkedQuestions[currentIndex]);
  renderCurrent();
}

function skipQuestion() {
  const index = currentIndex;
  userAnswers[index] = 'SKIPPED';
  isAnswerChecked = true;
  checkedQuestions[index] = true;
  renderCurrent();
  if (mode === 'exam') {
    setTimeout(() => {
      if (currentIndex === index && currentIndex < questions.length - 1) nextQuestion();
    }, 150);
  }
}

function checkAnswers() {
  const q = questions[currentIndex];
  if (q.type === 'ORDERING' && userAnswers[currentIndex]) {
    userAnswers[currentIndex] = {
      ...userAnswers[currentIndex],
      confirmed: true
    };
  }
  isAnswerChecked = true;
  checkedQuestions[currentIndex] = true;
  renderCurrent();
}

function renderResultsBreakdown() {
  if (!ui.resultsBreakdown) return;
  ui.resultsBreakdown.replaceChildren();
  questions.forEach((question, index) => {
    const attempt = describeAttempt(question, userAnswers[index]);
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `breakdown-row breakdown-${attempt.status}`;
    item.setAttribute('aria-label', `Revisar pregunta ${index + 1}: ${attempt.label}`);

    const top = document.createElement('div');
    top.className = 'breakdown-row-top';

    const num = document.createElement('span');
    num.className = 'breakdown-num';
    num.textContent = `#${index + 1}`;

    const badge = document.createElement('span');
    badge.className = `breakdown-badge badge-${attempt.status}`;
    badge.textContent = attempt.status === 'correct'
      ? 'Correcta'
      : attempt.status === 'incorrect'
        ? 'Incorrecta'
        : attempt.status === 'pending'
          ? 'Pendiente'
          : 'Omitida';

    top.append(num, badge);

    const promptP = document.createElement('p');
    promptP.className = 'breakdown-prompt';
    promptP.textContent = question.prompt;

    const refP = document.createElement('p');
    refP.className = 'breakdown-ref';
    refP.textContent = `Solución: ${formatReference(question)}`;

    item.append(top, promptP, refP);
    item.addEventListener('click', () => startReview(index));
    ui.resultsBreakdown.append(item);
  });
  renderMath(ui.resultsBreakdown);
}

function finishExam() {
  questions.forEach((question, index) => {
    if (question.type === 'ORDERING' && userAnswers[index] && userAnswers[index] !== 'SKIPPED') {
      userAnswers[index] = { ...userAnswers[index], confirmed: true };
    }
  });
  const result = scoreExam(questions, userAnswers, penaltyFactor);
  ui.scoreText.textContent = result.scoreLabel;
  const pending = result.pending ? ` | ⏳ ${result.pending} pendientes` : '';
  ui.scoreDetail.textContent = `✅ ${result.correct} | ❌ ${result.wrong} | ⏭️ ${result.skipped}${pending} (Penaliza: -${penaltyFactor})`;
  if (result.scoreOutOf10 >= 8) ui.scoreMessage.textContent = '¡Rendimiento Sobresaliente! 🎉';
  else if (result.scoreOutOf10 >= 5) ui.scoreMessage.textContent = 'Aprobado — ¡buen trabajo!';
  else ui.scoreMessage.textContent = 'Suspenso — Sigue practicando 💪';
  if (currentExamId) repository.updateScore(currentExamId, result.scoreLabel);

  renderResultsBreakdown();

  const circumference = 2 * Math.PI * 52;
  showScreen('results');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const fill = (Math.max(0, result.scoreOutOf10) / 10) * circumference;
      ui.scoreRing.style.strokeDasharray = `${fill} ${circumference}`;
      ui.scoreRing.style.stroke = result.scoreOutOf10 < 5 ? 'var(--incorrect)' : 'var(--accent)';
    });
  });
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
  let view = repository.view(currentFolderId);
  if (!view.ok) {
    currentFolderId = null;
    view = repository.view(null);
  }
  if (currentFolderId === null) {
    ui.libraryTitle.setAttribute('aria-current', 'page');
  } else {
    ui.libraryTitle.removeAttribute('aria-current');
  }
  if (ui.libraryStats) {
    const folderCount = view.folders?.length || 0;
    const testCount = view.tests?.length || 0;
    if (folderCount === 0 && testCount === 0) {
      ui.libraryStats.textContent = 'Sin bancos en este nivel · Arrastra archivos aquí o pulsa Importar test';
    } else {
      const parts = [];
      if (folderCount > 0) parts.push(countLabel(folderCount, 'carpeta', 'carpetas'));
      if (testCount > 0) parts.push(countLabel(testCount, 'test', 'tests'));
      ui.libraryStats.textContent = parts.join(' · ');
    }
  }
  renderLibrary(ui.historyList, view);
  const currentCrumb = ui.historyList.querySelector('.library-breadcrumbs [aria-current="page"]');
  currentCrumb?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });

  fillSelect(ui.importFolder, repository.listFolders(), 'Sin clasificar');
  ui.librarySort.value = view.sort;
  ui.historyList.querySelectorAll('.repo-checkbox').forEach((box) => {
    box.addEventListener('change', updateDeleteBtnVisibility);
  });
  const empty = view.tests.length === 0;
  ui.selectAllBtn.classList.toggle('hidden', empty);
  if (empty) ui.deleteSelectedBtn.classList.add('hidden');
  else updateDeleteBtnVisibility();
  ui.historyList.querySelector('#empty-import')?.addEventListener('click', () => ui.importDialog.showModal());
  ui.historyList.querySelector('#empty-folder')?.addEventListener('click', openNewFolderDialog);
  ui.historyList.querySelectorAll('details.library-menu').forEach((menu) => {
    menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      ui.historyList.querySelectorAll('details.library-menu[open]').forEach((other) => {
        if (other !== menu) other.removeAttribute('open');
      });
    });
  });
  renderMath(ui.historyList);
}

function fillSelect(select, folders, emptyLabel, selected = select.value) {
  select.replaceChildren();
  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = emptyLabel;
  select.append(empty);
  for (const folder of folders) {
    const option = document.createElement('option');
    option.value = folder.id;
    option.textContent = folder.path;
    select.append(option);
  }
  select.value = [...select.options].some((option) => option.value === selected) ? selected : '';
}

function countLabel(amount, singular, plural) {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

function libraryFailure(error) {
  if (error === 'cycle') return 'No se puede mover una carpeta dentro de sí misma';
  if (error === 'empty-name') return 'El nombre no puede estar vacío';
  if (error === 'unsupported-version') return 'Esta biblioteca no se puede modificar';
  return 'No se pudo completar la acción';
}

function openLibraryDialog(options) {
  libraryDialogAction = options.onConfirm;
  ui.libraryDialogTitle.textContent = options.title;
  ui.libraryDialogConfirm.textContent = options.confirmLabel;
  ui.libraryDialogError.textContent = '';
  ui.libraryNameField.classList.toggle('hidden', !options.showName);
  ui.libraryDestField.classList.toggle('hidden', !options.showDest);
  ui.libraryNameInput.value = options.name || '';
  if (options.showDest) {
    fillSelect(ui.libraryDestSelect, options.destinations || [], options.emptyLabel, '');
  }
  ui.libraryDialog.returnValue = '';
  ui.libraryDialog.showModal();
  if (options.showName) ui.libraryNameInput.focus();
  else ui.libraryDestSelect.focus();
}

function openNewFolderDialog() {
  openLibraryDialog({
    title: 'Nueva carpeta',
    confirmLabel: 'Crear',
    showName: true,
    showDest: false,
    onConfirm: ({ name }) => {
      const result = repository.createFolder(currentFolderId, name);
      if (!result.ok) {
        showToast(libraryFailure(result.error));
        return;
      }
      renderHistory();
      showToast('Carpeta creada');
    }
  });
}

function folderMoveDestinations(id) {
  const blocked = new Set(repository.descendantFolderIds(id));
  return repository.listFolders().filter((folder) => !blocked.has(folder.id));
}

function onLibraryClick(event) {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  const id = button.dataset.id || null;
  if (button.dataset.action === 'open-folder') {
    currentFolderId = id;
    renderHistory();
    return;
  }
  if (button.dataset.action === 'start') {
    loadFromHistory(id);
    return;
  }
  if (button.dataset.action === 'quick-study') {
    if (prepareExamFromHistory(id)) {
      mode = 'study';
      startExam();
    }
    return;
  }
  if (button.dataset.action === 'quick-exam') {
    if (prepareExamFromHistory(id)) {
      mode = 'exam';
      startExam();
    }
    return;
  }
  if (button.dataset.action === 'rename-test') {
    renameHistory(id);
    return;
  }
  if (button.dataset.action === 'rename-folder') {
    const folder = repository.listFolders().find((item) => item.id === id);
    if (!folder) return;
    openLibraryDialog({
      title: 'Renombrar carpeta',
      confirmLabel: 'Guardar',
      showName: true,
      showDest: false,
      name: folder.name,
      onConfirm: ({ name }) => {
        const result = repository.renameFolder(id, name);
        if (!result.ok) {
          showToast(libraryFailure(result.error));
          return;
        }
        renderHistory();
        showToast('Nombre actualizado');
      }
    });
    return;
  }
  if (button.dataset.action === 'move-folder') {
    openLibraryDialog({
      title: 'Mover carpeta',
      confirmLabel: 'Mover',
      showName: false,
      showDest: true,
      emptyLabel: 'Mis tests',
      destinations: folderMoveDestinations(id),
      onConfirm: ({ destination }) => {
        const result = repository.moveFolder(id, destination);
        if (!result.ok) {
          showToast(libraryFailure(result.error));
          return;
        }
        renderHistory();
        showToast('Carpeta movida');
      }
    });
    return;
  }
  if (button.dataset.action === 'move-test') {
    openLibraryDialog({
      title: 'Mover test',
      confirmLabel: 'Mover',
      showName: false,
      showDest: true,
      emptyLabel: 'Sin clasificar',
      destinations: repository.listFolders(),
      onConfirm: ({ destination }) => {
        const result = repository.moveTest(id, destination);
        if (!result.ok) {
          showToast(libraryFailure(result.error));
          return;
        }
        renderHistory();
        showToast('Test movido');
      }
    });
    return;
  }
  if (button.dataset.action === 'move-up' || button.dataset.action === 'move-down') {
    repository.moveInOrder(button.dataset.kind, id, button.dataset.action === 'move-up' ? -1 : 1);
    renderHistory();
    return;
  }
  if (button.dataset.action === 'delete-folder') {
    const preview = repository.removalPreview(id);
    if (!preview.ok) return;
    pendingDelete = { kind: 'folder', id };
    ui.deleteDialogText.textContent = `Se eliminarán ${countLabel(preview.folders, 'carpeta', 'carpetas')} y ${countLabel(preview.tests, 'test', 'tests')}. Esta acción no se puede deshacer.`;
    ui.deleteDialog.returnValue = '';
    ui.deleteDialog.showModal();
  }
}

function updateDeleteBtnVisibility() {
  const selectedCount = ui.historyList.querySelectorAll('.repo-checkbox:checked').length;
  ui.deleteSelectedBtn.classList.toggle('hidden', selectedCount === 0);
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
  pendingDelete = { kind: 'tests', ids: selected.map((box) => box.dataset.id) };
  ui.deleteDialogText.textContent = `¿Seguro que deseas borrar ${countLabel(selected.length, 'test', 'tests')}? Esta acción no se puede deshacer.`;
  ui.deleteDialog.returnValue = '';
  ui.deleteDialog.showModal();
}

function prepareExamFromHistory(id) {
  const item = repository.getTest(id);
  if (!item) return false;
  currentExamId = id;
  questions = item.questions.map(coerceStoredQuestion);
  if (ui.activeBankTitle) ui.activeBankTitle.textContent = item.name;
  ui.questionCountLabel.textContent = `${questions.length} preguntas pre-cargadas`;
  return true;
}

function loadFromHistory(id) {
  if (!prepareExamFromHistory(id)) return;
  showScreen('mode');
}

function renameHistory(id) {
  const item = repository.getTest(id);
  if (!item) return;
  openLibraryDialog({
    title: 'Renombrar test',
    confirmLabel: 'Guardar',
    showName: true,
    showDest: false,
    name: item.name,
    onConfirm: ({ name }) => {
      if (!name || !name.trim()) return;
      repository.renameTest(id, name.trim());
      renderHistory();
      showToast('Nombre actualizado');
    }
  });
}

function startReview(initialIndex = 0) {
  isReviewing = true;
  currentIndex = Math.max(0, Math.min(initialIndex, questions.length - 1));
  isAnswerChecked = true;
  updateExamModeBadge();
  ui.resultsBreakdown?.replaceChildren();
  showScreen('exam');
  renderCurrent();
}

function resetApp() {
  questions = [];
  optionOrders = [];
  userAnswers = [];
  checkedQuestions = [];
  mode = null;
  isReviewing = false;
  isAnswerChecked = false;
  currentIndex = 0;
  currentExamId = '';
  ui.fileInput.value = '';
  ui.pasteInput.value = '';
  ui.loadPasteBtn.disabled = true;
  ui.scoreRing.style.strokeDasharray = '0 327';
  ui.resultsBreakdown?.replaceChildren();
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
