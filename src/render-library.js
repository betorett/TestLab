const SVG_NS = 'http://www.w3.org/2000/svg';

function svgIcon(doc, paths, viewBox = '0 0 24 24') {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.85');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ui-icon');
  for (const d of paths) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function renderLibrary(container, view) {
  const doc = container.ownerDocument;
  container.replaceChildren();
  const breadcrumbs = view.breadcrumbs || [];
  const atRoot = breadcrumbs.length <= 1;

  if (breadcrumbs.length > 1) {
    const nav = doc.createElement('nav');
    nav.setAttribute('aria-label', 'Ruta de la biblioteca');
    const list = doc.createElement('ol');
    list.className = 'library-breadcrumbs';
    breadcrumbs.forEach((crumb, index) => {
      const item = doc.createElement('li');
      if (index === breadcrumbs.length - 1) {
        const here = doc.createElement('span');
        here.className = 'breadcrumb-current';
        here.textContent = crumb.name;
        here.setAttribute('aria-current', 'page');
        item.append(here);
      } else {
        const buttonEl = doc.createElement('button');
        buttonEl.type = 'button';
        buttonEl.className = 'breadcrumb-btn';
        buttonEl.dataset.action = 'open-folder';
        buttonEl.dataset.id = crumb.id ?? '';
        buttonEl.textContent = crumb.name;
        item.append(buttonEl);
      }
      list.append(item);
    });
    nav.append(list);
    container.append(nav);
  }

  const folders = view.folders || [];
  const tests = view.tests || [];
  if (!folders.length && !tests.length) {
    const emptyDiv = doc.createElement('div');
    emptyDiv.className = 'library-empty';

    const iconWrap = doc.createElement('div');
    iconWrap.className = 'library-empty-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    iconWrap.append(svgIcon(doc, [
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
      'M14 2v6h6',
      'M9 15l2 2 4-4'
    ]));

    const p = doc.createElement('p');
    p.className = 'library-empty-text';
    p.textContent = atRoot
      ? 'Todavía no hay tests. Un CSV o un JSON TestLab v1 válido se guarda solo en este navegador.'
      : 'Esta carpeta está vacía.';

    const actionsWrap = doc.createElement('div');
    actionsWrap.className = 'library-empty-actions';

    const emptyImport = doc.createElement('button');
    emptyImport.type = 'button';
    emptyImport.id = 'empty-import';
    emptyImport.className = 'nav-btn primary';
    emptyImport.textContent = 'Importar test';

    const emptyFolder = doc.createElement('button');
    emptyFolder.type = 'button';
    emptyFolder.id = 'empty-folder';
    emptyFolder.className = 'nav-btn';
    emptyFolder.textContent = 'Crear carpeta';

    actionsWrap.append(emptyImport, emptyFolder);
    emptyDiv.append(iconWrap, p, actionsWrap);
    container.append(emptyDiv);
    return;
  }

  for (const [index, folder] of folders.entries()) {
    container.append(renderFolder(doc, folder, index, folders.length, view.sort));
  }
  if (atRoot && tests.length) {
    const heading = doc.createElement('h3');
    heading.className = 'library-group';
    heading.textContent = 'Sin clasificar';
    container.append(heading);
  }
  for (const [index, item] of tests.entries()) {
    container.append(renderTest(doc, item, index, tests.length, view.sort));
  }
}

function renderFolder(doc, folder, index, total, sort) {
  const article = doc.createElement('article');
  article.className = 'library-row library-row-folder';

  const openBtn = doc.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'library-row-open';
  openBtn.dataset.action = 'open-folder';
  openBtn.dataset.kind = 'folder';
  openBtn.dataset.id = folder.id;
  openBtn.setAttribute('aria-label', `Abrir ${folder.name}`);

  const iconBadge = doc.createElement('span');
  iconBadge.className = 'row-leading-icon folder-icon';
  iconBadge.setAttribute('aria-hidden', 'true');
  iconBadge.append(svgIcon(doc, [
    'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'
  ]));

  const textCol = doc.createElement('span');
  textCol.className = 'library-row-main';

  const nameSpan = doc.createElement('span');
  nameSpan.className = 'library-name';
  nameSpan.textContent = folder.name;

  const metaSpan = doc.createElement('span');
  metaSpan.className = 'library-meta';
  metaSpan.textContent = `${folder.testCount} tests`;

  textCol.append(nameSpan, metaSpan);

  const chevron = doc.createElement('span');
  chevron.className = 'library-row-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.append(svgIcon(doc, ['M9 18l6-6-6-6']));

  openBtn.append(iconBadge, textCol, chevron);

  const menu = doc.createElement('details');
  menu.className = 'library-menu';
  const summary = doc.createElement('summary');
  summary.setAttribute('aria-label', `Acciones de ${folder.name}`);
  const summaryLabel = doc.createElement('span');
  summaryLabel.className = 'visually-hidden';
  summaryLabel.textContent = 'Acciones';
  summary.append(
    svgIcon(doc, [
      'M12 12h.01',
      'M19 12h.01',
      'M5 12h.01'
    ]),
    summaryLabel
  );

  const popover = doc.createElement('div');
  popover.className = 'library-menu-popover';

  const renameBtn = button(doc, 'Renombrar', 'rename-folder', 'folder', folder.id, 'menu-item-btn');
  renameBtn.setAttribute('aria-label', `Renombrar carpeta ${folder.name}`);

  const moveBtn = button(doc, 'Mover', 'move-folder', 'folder', folder.id, 'menu-item-btn');
  moveBtn.setAttribute('aria-label', `Mover carpeta ${folder.name}`);

  const upBtn = button(doc, 'Subir', 'move-up', 'folder', folder.id, 'menu-item-btn', movementDisabled(sort, index, total, -1));
  upBtn.setAttribute('aria-label', `Subir carpeta ${folder.name}`);

  const downBtn = button(doc, 'Bajar', 'move-down', 'folder', folder.id, 'menu-item-btn', movementDisabled(sort, index, total, 1));
  downBtn.setAttribute('aria-label', `Bajar carpeta ${folder.name}`);

  const deleteBtn = button(doc, 'Borrar', 'delete-folder', 'folder', folder.id, 'menu-item-btn menu-item-danger');
  deleteBtn.setAttribute('aria-label', `Borrar carpeta ${folder.name}`);

  popover.append(renameBtn, moveBtn, upBtn, downBtn, deleteBtn);
  menu.append(summary, popover);
  article.append(openBtn, menu);
  return article;
}

function renderTest(doc, item, index, total, sort) {
  const article = doc.createElement('article');
  article.className = 'library-row library-row-test';

  const label = doc.createElement('label');
  label.className = 'library-checkbox-label';
  const checkbox = doc.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'repo-checkbox';
  checkbox.dataset.id = item.id;
  checkbox.setAttribute('aria-label', `Seleccionar ${item.name}`);
  label.append(checkbox);

  const openBtn = doc.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'library-row-open';
  openBtn.dataset.action = 'start';
  openBtn.dataset.kind = 'test';
  openBtn.dataset.id = item.id;
  openBtn.setAttribute('aria-label', `Empezar ${item.name}`);

  const textCol = doc.createElement('span');
  textCol.className = 'library-row-main';

  const nameSpan = doc.createElement('span');
  nameSpan.className = 'library-name';
  nameSpan.textContent = item.name;

  const metaSpan = doc.createElement('span');
  metaSpan.className = 'library-meta';
  const questions = item.questionCount ?? item.questions?.length ?? 0;
  metaSpan.textContent = `${questions} preguntas • ${item.date ?? ''}`;

  textCol.append(nameSpan, metaSpan);

  const scoreSpan = doc.createElement('span');
  scoreSpan.className = 'library-score';
  if (item.lastScore != null) {
    const numeric = Number.parseFloat(item.lastScore);
    scoreSpan.dataset.tier = Number.isFinite(numeric) && numeric < 5 ? 'low' : 'high';
    scoreSpan.textContent = `Nota: ${item.lastScore}/10`;
  } else {
    scoreSpan.dataset.tier = 'none';
    scoreSpan.textContent = 'Sin realizar';
  }

  openBtn.append(textCol, scoreSpan);

  const quickActions = doc.createElement('div');
  quickActions.className = 'library-quick-actions';

  const quickStudyBtn = button(doc, 'Estudio', 'quick-study', 'test', item.id, 'quick-mode-btn');
  quickStudyBtn.setAttribute('aria-label', `Estudiar ${item.name}`);

  const quickExamBtn = button(doc, 'Examen', 'quick-exam', 'test', item.id, 'quick-mode-btn');
  quickExamBtn.setAttribute('aria-label', `Examinar ${item.name}`);

  quickActions.append(quickStudyBtn, quickExamBtn);

  const menu = doc.createElement('details');
  menu.className = 'library-menu';
  const summary = doc.createElement('summary');
  summary.setAttribute('aria-label', `Acciones de ${item.name}`);
  const summaryLabel = doc.createElement('span');
  summaryLabel.className = 'visually-hidden';
  summaryLabel.textContent = 'Acciones';
  summary.append(
    svgIcon(doc, [
      'M12 12h.01',
      'M19 12h.01',
      'M5 12h.01'
    ]),
    summaryLabel
  );

  const popover = doc.createElement('div');
  popover.className = 'library-menu-popover';

  const renameBtn = button(doc, 'Renombrar', 'rename-test', 'test', item.id, 'menu-item-btn');
  renameBtn.setAttribute('aria-label', `Renombrar ${item.name}`);

  const moveBtn = button(doc, 'Mover', 'move-test', 'test', item.id, 'menu-item-btn');
  moveBtn.setAttribute('aria-label', `Mover ${item.name}`);

  const upBtn = button(doc, 'Subir', 'move-up', 'test', item.id, 'menu-item-btn', movementDisabled(sort, index, total, -1));
  upBtn.setAttribute('aria-label', `Subir ${item.name}`);

  const downBtn = button(doc, 'Bajar', 'move-down', 'test', item.id, 'menu-item-btn', movementDisabled(sort, index, total, 1));
  downBtn.setAttribute('aria-label', `Bajar ${item.name}`);

  popover.append(renameBtn, moveBtn, upBtn, downBtn);
  menu.append(summary, popover);
  article.append(label, openBtn, quickActions, menu);
  return article;
}

function button(doc, label, action, kind, id, className = 'back-btn', disabled = false) {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = className;
  element.dataset.action = action;
  element.dataset.kind = kind;
  element.dataset.id = id;
  element.textContent = label;
  element.disabled = disabled;
  return element;
}

function movementDisabled(sort, index, total, direction) {
  if (sort !== 'manual') return true;
  if (direction < 0) return index === 0;
  return index >= total - 1;
}
