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
        here.textContent = crumb.name;
        here.setAttribute('aria-current', 'page');
        item.append(here);
      } else {
        const buttonEl = doc.createElement('button');
        buttonEl.type = 'button';
        buttonEl.className = 'back-btn';
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
    const p = doc.createElement('p');
    p.textContent = atRoot
      ? 'Todavía no hay tests. Un CSV o un JSON TestLab v1 válido se guarda solo en este navegador.'
      : 'Esta carpeta está vacía.';
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
    emptyDiv.append(p, emptyImport, emptyFolder);
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
  article.className = 'library-row';

  const openBtn = doc.createElement('button');
  openBtn.type = 'button';
  openBtn.className = 'library-row-open';
  openBtn.dataset.action = 'open-folder';
  openBtn.dataset.kind = 'folder';
  openBtn.dataset.id = folder.id;
  openBtn.setAttribute('aria-label', `Abrir ${folder.name}`);

  const nameSpan = doc.createElement('span');
  nameSpan.className = 'library-name';
  nameSpan.textContent = folder.name;

  const metaSpan = doc.createElement('span');
  metaSpan.className = 'library-meta';
  metaSpan.textContent = `${folder.testCount} tests`;

  openBtn.append(nameSpan, metaSpan);

  const menu = doc.createElement('details');
  menu.className = 'library-menu';
  const summary = doc.createElement('summary');
  summary.setAttribute('aria-label', `Acciones de ${folder.name}`);
  summary.textContent = 'Acciones';

  const renameBtn = button(doc, 'Renombrar', 'rename-folder', 'folder', folder.id, 'nav-btn');
  renameBtn.setAttribute('aria-label', `Renombrar carpeta ${folder.name}`);

  const moveBtn = button(doc, 'Mover', 'move-folder', 'folder', folder.id, 'nav-btn');
  moveBtn.setAttribute('aria-label', `Mover carpeta ${folder.name}`);

  const upBtn = button(doc, 'Subir', 'move-up', 'folder', folder.id, 'nav-btn', movementDisabled(sort, index, total, -1));
  upBtn.setAttribute('aria-label', `Subir carpeta ${folder.name}`);

  const downBtn = button(doc, 'Bajar', 'move-down', 'folder', folder.id, 'nav-btn', movementDisabled(sort, index, total, 1));
  downBtn.setAttribute('aria-label', `Bajar carpeta ${folder.name}`);

  const deleteBtn = button(doc, 'Borrar', 'delete-folder', 'folder', folder.id, 'nav-btn');
  deleteBtn.setAttribute('aria-label', `Borrar carpeta ${folder.name}`);

  menu.append(summary, renameBtn, moveBtn, upBtn, downBtn, deleteBtn);
  article.append(openBtn, menu);
  return article;
}

function renderTest(doc, item, index, total, sort) {
  const article = doc.createElement('article');
  article.className = 'library-row';

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

  const nameSpan = doc.createElement('span');
  nameSpan.className = 'library-name';
  nameSpan.textContent = item.name;

  const metaSpan = doc.createElement('span');
  metaSpan.className = 'library-meta';
  const questions = item.questionCount ?? item.questions?.length ?? 0;
  metaSpan.textContent = `${questions} preguntas • ${item.date ?? ''}`;

  const scoreSpan = doc.createElement('span');
  scoreSpan.className = 'library-score';
  scoreSpan.textContent = item.lastScore != null ? `Nota: ${item.lastScore}/10` : 'Sin realizar';

  openBtn.append(nameSpan, metaSpan, scoreSpan);

  const menu = doc.createElement('details');
  menu.className = 'library-menu';
  const summary = doc.createElement('summary');
  summary.setAttribute('aria-label', `Acciones de ${item.name}`);
  summary.textContent = 'Acciones';

  const renameBtn = button(doc, 'Renombrar', 'rename-test', 'test', item.id, 'nav-btn');
  renameBtn.setAttribute('aria-label', `Renombrar ${item.name}`);

  const moveBtn = button(doc, 'Mover', 'move-test', 'test', item.id, 'nav-btn');
  moveBtn.setAttribute('aria-label', `Mover ${item.name}`);

  const upBtn = button(doc, 'Subir', 'move-up', 'test', item.id, 'nav-btn', movementDisabled(sort, index, total, -1));
  upBtn.setAttribute('aria-label', `Subir ${item.name}`);

  const downBtn = button(doc, 'Bajar', 'move-down', 'test', item.id, 'nav-btn', movementDisabled(sort, index, total, 1));
  downBtn.setAttribute('aria-label', `Bajar ${item.name}`);

  menu.append(summary, renameBtn, moveBtn, upBtn, downBtn);
  article.append(label, openBtn, menu);
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
