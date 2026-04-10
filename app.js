// ===== STATE =====
let questions = [];
let mode = null;
let currentIndex = 0;
let userAnswers = []; // Arrays of selected option IDs, or 'SKIPPED'
let isReviewing = false;
let isAnswerChecked = false;
let penaltyFactor = 0.33;
let currentExamName = '';

// ===== DOM REFERENCES =====
const $ = id => document.getElementById(id);

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
    backToUpload: $('back-to-upload'),
    questionCountLabel: $('question-count-label'),
    modeStudy: $('mode-study'),
    modeExam: $('mode-exam'),
    questionContainer: $('question-container'),
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

    // settings modal
    settingsBtn: $('settings-btn'),
    settingsModal: $('settings-modal'),
    closeSettingsBtn: $('close-settings'),
    saveSettingsBtn: $('save-settings-btn'),
    penaltyInput: $('penalty-input')
};

// Gemini Icon SVG
const geminiIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2C12 2 11.5 8.5 8 12C11.5 15.5 12 22 12 22C12 22 12.5 15.5 16 12C12.5 8.5 12 2 12 2Z" fill="currentColor"/></svg>`;
const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

// ===== INIT =====
function init() {
    // Theme setup
    const savedTheme = localStorage.getItem('testlab-theme') || 'dark';
    htmlTag.setAttribute('data-theme', savedTheme);
    themeToggle.addEventListener('click', toggleTheme);

    // Settings setup
    const savedPenalty = localStorage.getItem('testlab-penalty');
    if (savedPenalty !== null) penaltyFactor = parseFloat(savedPenalty);
    ui.penaltyInput.value = penaltyFactor;

    ui.settingsBtn.addEventListener('click', () => ui.settingsModal.showModal());
    ui.closeSettingsBtn.addEventListener('click', () => ui.settingsModal.close());
    ui.saveSettingsBtn.addEventListener('click', () => {
        penaltyFactor = parseFloat(ui.penaltyInput.value) || 0;
        localStorage.setItem('testlab-penalty', penaltyFactor);
        ui.settingsModal.close();
        showToast('Ajustes guardados');
    });

    // Modal setup
    ui.openAiPromptBtn.addEventListener('click', () => ui.aiModal.showModal());
    ui.closeModalBtn.addEventListener('click', () => ui.aiModal.close());
    ui.copyPromptBtn.addEventListener('click', copyAiPrompt);
    ui.aiModal.addEventListener('click', e => {
        const rect = ui.aiModal.getBoundingClientRect();
        if (e.clientY < rect.top || e.clientY > rect.bottom || e.clientX < rect.left || e.clientX > rect.right) {
            ui.aiModal.close();
        }
    });

    // Upload setup
    ui.dropZone.addEventListener('click', () => ui.fileInput.click());
    ui.browseBtn.addEventListener('click', e => { e.stopPropagation(); ui.fileInput.click(); });
    ui.fileInput.addEventListener('change', e => { if (e.target.files.length) handleMultipleFiles(e.target.files); });

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
        ui.dropZone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); })
    );
    ui.dropZone.addEventListener('dragover', () => ui.dropZone.classList.add('dragover'));
    ui.dropZone.addEventListener('dragleave', () => ui.dropZone.classList.remove('dragover'));
    ui.dropZone.addEventListener('drop', e => {
        ui.dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleMultipleFiles(e.dataTransfer.files);
    });

    // Paste toggle
    ui.togglePasteBtn.addEventListener('click', () => {
        const isHidden = ui.pasteCollapse.classList.contains('hidden');
        if (isHidden) ui.pasteCollapse.classList.remove('hidden');
        else ui.pasteCollapse.classList.add('hidden');
    });

    // Paste setup
    ui.pasteInput.addEventListener('input', () => {
        ui.loadPasteBtn.disabled = ui.pasteInput.value.trim() === '';
    });
    ui.loadPasteBtn.addEventListener('click', () => {
        const text = ui.pasteInput.value.trim();
        if (text) processText(text);
    });

    // Repository Nav & Selection
    ui.selectAllBtn.addEventListener('click', selectAllExams);
    ui.deleteSelectedBtn.addEventListener('click', deleteSelectedExams);

    // Mode selection
    ui.backToUpload.addEventListener('click', () => showScreen('upload'));
    ui.modeStudy.addEventListener('click', () => { mode = 'study'; startExam(); });
    ui.modeExam.addEventListener('click', () => { mode = 'exam'; startExam(); });

    // Exam Nav
    ui.prevBtn.addEventListener('click', prevQuestion);
    ui.nextBtn.addEventListener('click', nextQuestion);
    ui.skipBtn.addEventListener('click', skipQuestion);
    ui.aiHelpBtn.addEventListener('click', resolveDoubt);
    ui.checkMultipleBtn.addEventListener('click', checkMultipleAnswers);
    ui.submitBtn.addEventListener('click', finishExam);
    ui.quitBtn.addEventListener('click', resetApp);

    // Results Page
    ui.reviewBtn.addEventListener('click', startReview);
    ui.restartBtn.addEventListener('click', resetApp);
    ui.generateReportBtn.addEventListener('click', generateFinalReport);

    // Render original state
    renderHistory();
}

// ===== THEME =====
function toggleTheme() {
    const current = htmlTag.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    htmlTag.setAttribute('data-theme', next);
    localStorage.setItem('testlab-theme', next);
}

// ===== MODAL =====
function copyAiPrompt() {
    navigator.clipboard.writeText(ui.promptText.textContent).then(() => {
        ui.copyPromptBtn.textContent = '¡Copiado!';
        setTimeout(() => ui.copyPromptBtn.textContent = 'Copiar Prompt', 2000);
    });
}

function showScreen(name) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screens[name]) screens[name].classList.add('active');
}

// ===== FILE PARSING =====
function handleMultipleFiles(files) {
    let processedCount = 0;
    const fileArray = Array.from(files);
    
    fileArray.forEach(file => {
        if (!file.name.endsWith('.csv')) {
            processedCount++;
            checkIfDone(processedCount, fileArray.length);
            return;
        }

        Papa.parse(file, {
            header: false,
            skipEmptyLines: true,
            delimiter: "",
            complete: results => {
                parseAndSaveToRepo(results.data, file.name);
                processedCount++;
                checkIfDone(processedCount, fileArray.length);
            }
        });
    });
}

function checkIfDone(processed, total) {
    if (processed === total) {
        ui.fileInput.value = ''; // reset
        renderHistory();
        showToast(`${total} archivo(s) añadido(s) al repositorio`);
    }
}

function processText(text) {
    const today = new Date();
    const nameStr = `Examen Pegado (${today.toLocaleDateString()})`;
    Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        delimiter: "",
        complete: results => {
            parseAndSaveToRepo(results.data, nameStr);
            ui.pasteInput.value = '';
            ui.loadPasteBtn.disabled = true;
            ui.pasteCollapse.classList.add('hidden');
            renderHistory();
            showToast('Añadido al repositorio');
        }
    });
}

function parseAndSaveToRepo(data, fileName) {
    let parsedQuestions = [];
    let startFrom = 0;

    if (data[0] && data[0][0] && (
        data[0][0].toLowerCase().includes('pregunta') ||
        data[0][0].toLowerCase().includes('question')
    )) {
        startFrom = 1;
    }

    for (let i = startFrom; i < data.length; i++) {
        const row = data[i];
        if (row.length < 5) continue;

        const qText = row[0].trim();
        const typeRaw = row[1].trim().toUpperCase();
        const qType = typeRaw.includes('MULT') ? 'MULTIPLE' : 'SINGLE';
        const correctRaw = String(row[row.length - 1]).trim().toUpperCase();
        
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const optionsRaw = row.slice(2, row.length - 1);
        const options = optionsRaw.map((optText, idx) => ({
            id: letters[idx] || '?',
            text: optText.trim()
        }));

        const correctArray = correctRaw.split('|').map(s => s.trim()).filter(Boolean);

        parsedQuestions.push({
            text: qText,
            type: qType,
            options: options,
            correct: correctArray
        });
    }

    if (parsedQuestions.length > 0) {
        let nameToSave = fileName.replace('.csv', '');
        saveToHistory(nameToSave, parsedQuestions);
    }
}

// ===== EXAM =====
function startExam() {
    currentIndex = 0;
    userAnswers = questions.map(() => []); // empty array of selected IDs for each question
    isReviewing = false;
    isAnswerChecked = false;
    showScreen('exam');
    renderQuestion();
}

function renderQuestion() {
    const q = questions[currentIndex];
    
    // Sólo pintar el DOM al cambiar de pregunta
    const total = questions.length;
    ui.counter.textContent = `${currentIndex + 1} / ${total}`;
    
    const tipoLabel = q.type === 'MULTIPLE' ? '<span class="meta" style="color:var(--text-secondary);">(Múltiples respuestas permitidas)</span><br/><br/>' : '';
    let html = `<div class="question-text">${tipoLabel}${q.text}</div><div class="options-list">`;

    q.options.forEach(opt => {
        const checkboxHtml = q.type === 'MULTIPLE' ? `<div class="checkbox-icon"></div>` : '';
        html += `
            <button class="option-btn" data-id="${opt.id}">
                <span class="option-letter">${opt.id}</span>
                <span class="option-text">${opt.text}</span>
                ${checkboxHtml}
            </button>`;
    });

    html += `</div>`;
    ui.questionContainer.innerHTML = html;

    // Attach base events
    ui.questionContainer.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => selectOption(btn.dataset.id));
    });

    // Actualiza las clases visuales de los botones sin borrar el DOM
    updateOptionsUI();
    
    // Render LaTeX equations if any
    renderMath(ui.questionContainer);
}

// updateOptionsUI: Muta las clases CSS sobre los botones ya inyectados
function updateOptionsUI() {
    const q = questions[currentIndex];
    const userState = userAnswers[currentIndex];
    const isSkipped = userState === 'SKIPPED';
    const selectedOptions = Array.isArray(userState) ? userState : [];
    
    let isAnswered = false;
    if (isReviewing || mode === 'exam') {
        isAnswered = isSkipped || selectedOptions.length > 0;
    } else {
        if (isSkipped) {
            isAnswered = true;
        } else if (q.type === 'SINGLE') {
            isAnswered = selectedOptions.length > 0;
        } else {
            isAnswered = isAnswerChecked;
        }
    }

    const total = questions.length;
    const answeredCount = userAnswers.filter(ans => ans === 'SKIPPED' || (Array.isArray(ans) && ans.length > 0)).length;
    ui.progressFill.style.width = `${(answeredCount / total) * 100}%`;

    const btns = ui.questionContainer.querySelectorAll('.option-btn');
    if (!btns.length) return;

    btns.forEach(btn => {
        const optId = btn.dataset.id;
        const isSelected = selectedOptions.includes(optId);
        const isCorrect = q.correct.includes(optId);

        // Reset
        btn.className = 'option-btn';
        btn.disabled = false;
        
        let shouldCheckIcon = false;

        if (isAnswered || isReviewing) {
            if (isSkipped) btn.classList.add('skipped');
            if (isSelected) btn.classList.add('selected');
            
            if ((mode === 'study' && isAnswered) || isReviewing) {
                if (isCorrect && isSelected) btn.classList.add('correct');
                if (!isCorrect && isSelected) btn.classList.add('incorrect');
                if (isCorrect && !isSelected) btn.classList.add('missed', 'outline-correct');
                if (isSelected || isCorrect) shouldCheckIcon = true;
            } else {
                if (isSelected) shouldCheckIcon = true;
            }
        } else {
            if (isSelected) {
                btn.classList.add('selected');
                shouldCheckIcon = true;
            }
        }

        if ((isAnswered && mode === 'study') || isReviewing) {
            btn.disabled = true;
        }

        // SVG check logic inside
        if (q.type === 'MULTIPLE') {
            const cb = btn.querySelector('.checkbox-icon');
            if (cb) cb.innerHTML = shouldCheckIcon ? checkIcon : '';
        }
    });

    updateNavButtons();
}

function selectOption(optId) {
    const q = questions[currentIndex];
    
    if (userAnswers[currentIndex] === 'SKIPPED') {
        userAnswers[currentIndex] = []; // Revoke skip if they click something
    }

    const currentSelections = userAnswers[currentIndex];
    
    if (q.type === 'SINGLE') {
        userAnswers[currentIndex] = [optId];
        updateOptionsUI();
        
        if (mode === 'exam') {
            setTimeout(() => {
                if (currentIndex < questions.length - 1) nextQuestion();
                else updateNavButtons();
            }, 300);
        }
    } else {
        if (currentSelections.includes(optId)) {
            userAnswers[currentIndex] = currentSelections.filter(id => id !== optId);
        } else {
            userAnswers[currentIndex].push(optId);
        }
        updateOptionsUI();
    }
}

function skipQuestion() {
    userAnswers[currentIndex] = 'SKIPPED';
    updateOptionsUI();
    if (mode === 'exam') {
        setTimeout(() => {
            if (currentIndex < questions.length - 1) nextQuestion();
            else updateNavButtons();
        }, 150);
    }
}

function checkMultipleAnswers() {
    isAnswerChecked = true;
    updateOptionsUI();
}

function updateNavButtons() {
    const q = questions[currentIndex];
    const userState = userAnswers[currentIndex];
    const isSkipped = userState === 'SKIPPED';
    const selectedOptions = Array.isArray(userState) ? userState : [];
    const hasSelection = selectedOptions.length > 0 || isSkipped;
    
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === questions.length - 1;

    let isAnswered = false;
    if (isReviewing || mode === 'exam') isAnswered = hasSelection;
    else if (q.type === 'SINGLE') isAnswered = isSkipped || selectedOptions.length > 0;
    else isAnswered = isAnswerChecked || isSkipped;

    ui.prevBtn.classList.add('hidden');
    ui.skipBtn.classList.add('hidden');
    ui.aiHelpBtn.classList.add('hidden');
    ui.nextBtn.classList.add('hidden');
    ui.submitBtn.classList.add('hidden');
    ui.checkMultipleBtn.classList.add('hidden');

    // Show AI Help button if applicable
    if (((mode === 'study' && isAnswered) || isReviewing) && !isSkipped && selectedOptions.length > 0) {
        ui.aiHelpBtn.classList.remove('hidden');
    }

    if (!isFirst) {
        if (isReviewing || mode === 'exam') ui.prevBtn.classList.remove('hidden');
        else if (mode === 'study' && isAnswered) ui.prevBtn.classList.remove('hidden');
    }

    if (isReviewing) {
        if (!isLast) ui.nextBtn.classList.remove('hidden');
        else {
            ui.submitBtn.textContent = 'Volver a resultados';
            ui.submitBtn.onclick = () => showScreen('results');
            ui.submitBtn.classList.remove('hidden');
        }
    } else if (mode === 'exam') {
        if (!isLast) {
            ui.nextBtn.classList.remove('hidden');
            if (!hasSelection) ui.skipBtn.classList.remove('hidden');
        } else {
            ui.submitBtn.textContent = 'Finalizar';
            ui.submitBtn.onclick = finishExam;
            ui.submitBtn.classList.remove('hidden');
            if (!hasSelection) ui.skipBtn.classList.remove('hidden');
        }
    } else if (mode === 'study') {
        if (!isAnswered) {
            ui.skipBtn.classList.remove('hidden');
            if (q.type === 'MULTIPLE') {
                ui.checkMultipleBtn.classList.remove('hidden');
                ui.checkMultipleBtn.disabled = selectedOptions.length === 0;
            }
        } else {
            if (!isLast) ui.nextBtn.classList.remove('hidden');
            else {
                ui.submitBtn.textContent = 'Finalizar';
                ui.submitBtn.onclick = finishExam;
                ui.submitBtn.classList.remove('hidden');
            }
        }
    }
}

function prevQuestion() {
    if (currentIndex > 0) { 
        currentIndex--; 
        isAnswerChecked = false; // Reset checking 
        renderQuestion(); 
    }
}

function nextQuestion() {
    if (currentIndex < questions.length - 1) { 
        currentIndex++; 
        isAnswerChecked = false;
        renderQuestion(); 
    }
}

function checkIfCorrect(question, userAnsArray) {
    if (!Array.isArray(userAnsArray)) return false;
    if (userAnsArray.length !== question.correct.length) return false;
    const sortedUser = [...userAnsArray].sort();
    const sortedCorrect = [...question.correct].sort();
    return sortedUser.every((val, index) => val === sortedCorrect[index]);
}

function finishExam() {
    let numCorrect = 0;
    let numWrong = 0;
    let numSkipped = 0;
    
    questions.forEach((q, i) => {
        const uAns = userAnswers[i];
        if (uAns === 'SKIPPED' || (Array.isArray(uAns) && uAns.length === 0)) {
            numSkipped++;
        } else if (checkIfCorrect(q, uAns)) {
            numCorrect++;
        } else {
            numWrong++;
        }
    });

    const totalQ = questions.length;
    // Calculate raw score points
    const pointsCorrect = numCorrect * 1;
    const pointsPenalty = numWrong * penaltyFactor;
    let rawScore = Math.max(0, pointsCorrect - pointsPenalty);
    
    // Scale out of 10
    const scoreVal = (rawScore / totalQ) * 10;
    const pct = Math.round((rawScore / totalQ) * 100);
    const scoreStr = scoreVal.toFixed(2).replace('.00', '');

    const circumference = 2 * Math.PI * 52; 

    ui.scoreText.textContent = `${scoreStr}`;
    ui.scoreDetail.textContent = `✅ ${numCorrect} | ❌ ${numWrong} | ⏭️ ${numSkipped} (Penaliza: -${penaltyFactor})`;

    if (scoreVal >= 8) ui.scoreMessage.textContent = '¡Rendimiento Sobresaliente! 🎉';
    else if (scoreVal >= 5) ui.scoreMessage.textContent = 'Aprobado — ¡buen trabajo!';
    else ui.scoreMessage.textContent = 'Suspenso — Sigue practicando 💪';

    // Save score to history
    updateHistoryScore(currentExamName, scoreStr);

    // Animation transition
    showScreen('loading');
    
    setTimeout(() => {
        showScreen('results');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const fill = (Math.max(0, scoreVal) / 10) * circumference;
                ui.scoreRing.style.strokeDasharray = `${fill} ${circumference}`;
                if (scoreVal < 5) ui.scoreRing.style.stroke = 'var(--incorrect)';
                else ui.scoreRing.style.stroke = 'var(--accent)';
            });
        });
    }, 1500);
}

// ===== REPORT GENERATION =====
function generateFinalReport() {
    let reportText = `** Reporte de Desempeño Escrito: TestLab **\n\n`;
    reportText += `He realizado un test y estos son mis resultados detallados. Quiero que analices mis respuestas correctas, falladas y omitidas, identifiques en qué conceptos estoy confundido y me des una explicación clara con estrategias para potenciar mi conocimiento.\n\n`;
    
    questions.forEach((q, i) => {
        const uAns = userAnswers[i];
        const isSkipped = uAns === 'SKIPPED' || (Array.isArray(uAns) && uAns.length === 0);
        const isCorrect = isSkipped ? false : checkIfCorrect(q, uAns);

        let icon = isSkipped ? '⏭️ OMITIDA' : (isCorrect ? '✅ CORRECTA' : '❌ INCORRECTA');
        reportText += `--- Pregunta ${i+1} [${icon}] ---\n`;
        reportText += `${q.text}\n`;
        
        q.options.forEach(opt => {
            reportText += `  ${opt.id}) ${opt.text}\n`;
        });
        
        if (isSkipped) {
            reportText += `\n-> Mi selección: (Dejada en blanco)\n`;
        } else {
            const userText = uAns.join(' y ');
            reportText += `\n-> Mi selección: ${userText}\n`;
        }
        reportText += `-> Selección correcta: ${q.correct.join(' y ')}\n\n`;
    });

    // Create a physical file
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `Reporte_TestLab_IA.txt`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    showToast('Archivo descargado con éxito.');
}

// ===== SINGLE QUESTION GEMINI INTEGRATION =====
function resolveDoubt() {
    const q = questions[currentIndex];
    const uAnsRaw = userAnswers[currentIndex];
    const uAnsIds = Array.isArray(uAnsRaw) ? uAnsRaw : [];
    
    let prompt;
    const isCorrect = checkIfCorrect(q, uAnsIds);

    const txtCorrect = q.correct.map(c => {
        let o = q.options.find(op => op.id === c);
        return o ? `[${c}] ${o.text}` : c;
    }).join(' AND ');

    if (isCorrect) {
        prompt = `Pregunta: "${q.text}"\nRespuesta(s) correcta(s): ${txtCorrect}\n\nHe respondido correctamente a esto, pero ¿podrías darme una explicación didáctica y profunda sobre el mecanismo subyacente para asegurarme de que lo domino al 100%?`;
    } else {
        const txtUser = uAnsIds.map(c => {
            let o = q.options.find(op => op.id === c);
            return o ? `[${c}] ${o.text}` : c;
        }).join(' AND ') || "Ninguna";

        let optionsPrompt = "";
        q.options.forEach(o => { optionsPrompt += `${o.id}) ${o.text}\n`; });

        prompt = `Tengo una duda con esta pregunta:\n"${q.text}"\nOpciones:\n${optionsPrompt}\nLa respuesta correcta es: ${txtCorrect}.\nMi respuesta errónea fue: ${txtUser}.\n\n¿Por qué es esa la correcta y qué error conceptual he cometido al elegir lo que elegí?`;
    }

    navigator.clipboard.writeText(prompt).then(() => {
        showToast('Texto copiado — pégalo ahora en Gemini');
        setTimeout(() => window.open('https://gemini.google.com/app', '_blank'), 800);
    });
}

// ===== TOAST =====
function showToast(msg) {
    ui.toastText.textContent = msg;
    ui.toast.classList.add('show');
    setTimeout(() => ui.toast.classList.remove('show'), 3500);
}

// ===== HISTORY MANAGEMENT =====
function getHistory() {
    return JSON.parse(localStorage.getItem('testlab-history') || '[]');
}

function saveToHistory(name, qArray) {
    let history = getHistory();
    // Reemplaza si ya existe uno con el mismo nombre y mismas preguntas (evitar duplicados masivos de clicks)
    const existingIndex = history.findIndex(h => h.name === name && h.questions.length === qArray.length);
    const item = {
        name: name,
        date: new Date().toLocaleDateString(),
        questions: qArray,
        lastScore: null
    };

    if (existingIndex > -1) {
        history[existingIndex] = item;
    } else {
        history.unshift(item); // insert at top
    }

    localStorage.setItem('testlab-history', JSON.stringify(history));
}

function updateHistoryScore(name, score) {
    let history = getHistory();
    const existing = history.find(h => h.name === name);
    if (existing) {
        existing.lastScore = score;
        localStorage.setItem('testlab-history', JSON.stringify(history));
    }
}

function renderHistory() {
    const history = getHistory();
    ui.historyList.innerHTML = '';
    
    // Hide UI elements if history is empty
    if (history.length === 0) {
        ui.historyList.innerHTML = '<div style="text-align: center; color: var(--text-tertiary); padding: 40px 0;">Repositorio vacío.</div>';
        ui.selectAllBtn.classList.add('hidden');
        ui.deleteSelectedBtn.classList.add('hidden');
        return;
    }
    
    ui.selectAllBtn.classList.remove('hidden');
    // Keep deleteSelectedBtn hidden until something is selected
    const selectedCheckboxes = Array.from(document.querySelectorAll('.repo-checkbox:checked'));
    if (selectedCheckboxes.length > 0) {
        ui.deleteSelectedBtn.classList.remove('hidden');
    } else {
        ui.deleteSelectedBtn.classList.add('hidden');
    }

    history.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.style.display = 'flex';
        div.style.gap = '12px';
        div.style.alignItems = 'flex-start';
        
        const scoreHtml = item.lastScore !== null ? `<strong style="color:var(--text-primary);">Nota: ${item.lastScore}/10</strong>` : `<em>Sin realizar</em>`;
        
        div.innerHTML = `
            <div style="padding-top: 4px;">
                <input type="checkbox" class="repo-checkbox" data-index="${index}" style="width: 18px; height: 18px; cursor: pointer;">
            </div>
            <div style="flex: 1; width: 100%;">
                <div class="history-title" style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="word-break: break-all;">${item.name}</span>
                    <button class="back-btn" style="width: 28px; height: 28px; margin-left: 8px; border: none; background: transparent;" title="Renombrar examen" onclick="renameHistory(${index})">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                </div>
                <div class="history-meta">
                    <span>${item.questions.length} preguntas • ${item.date}</span>
                    <span>${scoreHtml}</span>
                </div>
                <div class="history-actions" style="margin-top: 12px;">
                    <button class="nav-btn primary" style="padding: 6px 12px; font-size: 0.8rem; width: 100%; justify-content: center;" onclick="loadFromHistory(${index})">Empezar Examen</button>
                </div>
            </div>
        `;
        ui.historyList.appendChild(div);
    });

    // Add listeners to checkboxes
    document.querySelectorAll('.repo-checkbox').forEach(cb => {
        cb.addEventListener('change', updateDeleteBtnVisibility);
    });

    renderMath(ui.historyList);
}

function updateDeleteBtnVisibility() {
    const hasSel = document.querySelectorAll('.repo-checkbox:checked').length > 0;
    if (hasSel) ui.deleteSelectedBtn.classList.remove('hidden');
    else ui.deleteSelectedBtn.classList.add('hidden');
}

function selectAllExams() {
    const allCb = document.querySelectorAll('.repo-checkbox');
    const allChecked = Array.from(allCb).every(cb => cb.checked);
    allCb.forEach(cb => cb.checked = !allChecked);
    updateDeleteBtnVisibility();
}

function deleteSelectedExams() {
    const selectedCb = Array.from(document.querySelectorAll('.repo-checkbox:checked'));
    if (selectedCb.length === 0) return;
    
    if (confirm(`¿Seguro que deseas borrar ${selectedCb.length} exámenes de tu Repositorio?`)) {
        // Collect indices descending to avoid shifting issues when deleting
        const indices = selectedCb.map(cb => parseInt(cb.dataset.index)).sort((a,b) => b-a);
        let history = getHistory();
        indices.forEach(i => history.splice(i, 1));
        localStorage.setItem('testlab-history', JSON.stringify(history));
        renderHistory();
        showToast('Exámenes borrados');
    }
}

window.loadFromHistory = function(index) {
    const history = getHistory();
    const item = history[index];
    if (item) {
        currentExamName = item.name;
        questions = item.questions;
        ui.questionCountLabel.textContent = `${questions.length} preguntas pre-cargadas`;
        showScreen('mode');
    }
}

window.renameHistory = function(index) {
    let history = getHistory();
    const item = history[index];
    if (item) {
        const newName = prompt("Introduce un nuevo nombre para este banco de preguntas:", item.name);
        if (newName && newName.trim() !== "") {
            item.name = newName.trim();
            localStorage.setItem('testlab-history', JSON.stringify(history));
            renderHistory(); // Refresh view
            showToast("Nombre actualizado");
        }
    }
}

// ===== REVIEW / RESET =====
function startReview() {
    isReviewing = true;
    currentIndex = 0;
    showScreen('exam');
    renderQuestion();
}

function resetApp() {
    questions = [];
    userAnswers = [];
    mode = null;
    isReviewing = false;
    isAnswerChecked = false;
    currentIndex = 0;

    ui.dropZone.classList.remove('loaded');
    const mainP = ui.dropZone.querySelector('.drop-main');
    const subP = ui.dropZone.querySelector('.drop-sub');
    if (mainP) mainP.textContent = 'Arrastra tu archivo CSV aquí';
    if (subP) subP.innerHTML = `o <button type="button" class="link-btn" id="browse-btn">busca en tu equipo</button>`;
    ui.fileInput.value = '';
    ui.pasteInput.value = '';
    ui.loadPasteBtn.disabled = true;
    ui.pasteCollapse.classList.add('hidden');

    const newBrowse = $('browse-btn');
    if (newBrowse) newBrowse.addEventListener('click', e => { e.stopPropagation(); ui.fileInput.click(); });

    ui.scoreRing.style.strokeDasharray = '0 327';
    showScreen('upload');
}

// Run
init();

// ===== LATEX RENDERER =====
function renderMath(element) {
    if (window.renderMathInElement) {
        renderMathInElement(element, {
            delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '\\[', right: '\\]', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}
            ],
            throwOnError: false
        });
    }
}
