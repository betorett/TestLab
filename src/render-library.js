export function renderLibrary(container, view) {
  const doc = container.ownerDocument;
  container.replaceChildren();
  const breadcrumbs = view.breadcrumbs || [];
  const atRoot = breadcrumbs.at(-1)?.id == null;

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
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'back-btn';
      button.dataset.action = 'open-folder';
      button.dataset.id = crumb.id ?? '';
      button.textContent = crumb.name;
      item.append(button);
    }
    list.append(item);
  });
  nav.append(list);
  container.append(nav);

  const folders = view.folders || [];
  const tests = view.tests || [];
  if (!folders.length && !tests.length) {
    const empty = doc.createElement('p');
    empty.textContent = atRoot ? 'Repositorio vacío.' : 'Esta carpeta está vacía.';
    container.append(empty);
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
  article.className = 'history-item';
  const body = doc.createElement('div');
  body.className = 'history-body';

  const title = doc.createElement('div');
  title.className = 'history-title';
  const name = doc.createElement('span');
  name.className = 'history-title-text';
  name.textContent = folder.name;
  title.append(name);

  const meta = doc.createElement('p');
  meta.className = 'history-meta';
  const count = doc.createElement('span');
  count.textContent = `${folder.testCount} tests`;
  meta.append(count);

  const actions = doc.createElement('div');
  actions.className = 'history-actions';
  actions.append(
    button(doc, `Abrir ${folder.name}`, 'open-folder', 'folder', folder.id, 'nav-btn primary'),
    button(doc, `Renombrar carpeta ${folder.name}`, 'rename-folder', 'folder', folder.id),
    button(doc, `Mover carpeta ${folder.name}`, 'move-folder', 'folder', folder.id),
    button(doc, `Subir carpeta ${folder.name}`, 'move-up', 'folder', folder.id, 'back-btn', movementDisabled(sort, index, total, -1)),
    button(doc, `Bajar carpeta ${folder.name}`, 'move-down', 'folder', folder.id, 'back-btn', movementDisabled(sort, index, total, 1)),
    button(doc, `Borrar carpeta ${folder.name}`, 'delete-folder', 'folder', folder.id)
  );
  body.append(title, meta, actions);
  article.append(body);
  return article;
}

function renderTest(doc, item, index, total, sort) {
  const article = doc.createElement('article');
  article.className = 'history-item';
  const row = doc.createElement('div');
  row.className = 'history-row';

  const checkbox = doc.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'repo-checkbox';
  checkbox.dataset.id = item.id;
  checkbox.setAttribute('aria-label', `Seleccionar ${item.name}`);

  const body = doc.createElement('div');
  body.className = 'history-body';
  const title = doc.createElement('div');
  title.className = 'history-title';
  const name = doc.createElement('span');
  name.className = 'history-title-text';
  name.textContent = item.name;
  const rename = button(doc, 'Renombrar', 'rename-test', 'test', item.id);
  rename.setAttribute('aria-label', `Renombrar ${item.name}`);
  title.append(name, rename);

  const meta = doc.createElement('p');
  meta.className = 'history-meta';
  const count = doc.createElement('span');
  const questions = item.questionCount ?? item.questions?.length ?? 0;
  count.textContent = `${questions} preguntas • ${item.date ?? ''}`;
  const score = doc.createElement('span');
  score.textContent = item.lastScore != null ? `Nota: ${item.lastScore}/10` : 'Sin realizar';
  meta.append(count, score);

  const start = button(doc, 'Empezar examen', 'start', 'test', item.id, 'nav-btn primary');
  const actions = doc.createElement('div');
  actions.className = 'history-actions';
  const move = button(doc, 'Mover', 'move-test', 'test', item.id);
  move.setAttribute('aria-label', `Mover ${item.name}`);
  const up = button(doc, 'Subir', 'move-up', 'test', item.id, 'back-btn', movementDisabled(sort, index, total, -1));
  up.setAttribute('aria-label', `Subir ${item.name}`);
  const down = button(doc, 'Bajar', 'move-down', 'test', item.id, 'back-btn', movementDisabled(sort, index, total, 1));
  down.setAttribute('aria-label', `Bajar ${item.name}`);
  actions.append(move, up, down);
  body.append(title, meta, start, actions);
  row.append(checkbox, body);
  article.append(row);
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
