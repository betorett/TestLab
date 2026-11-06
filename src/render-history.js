export function renderHistoryList(container, items) {
  const doc = container.ownerDocument;
  container.replaceChildren();
  if (!items.length) {
    const empty = doc.createElement('p');
    empty.textContent = 'Repositorio vacío.';
    container.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const article = doc.createElement('article');
    article.className = 'history-item';

    const row = doc.createElement('div');
    row.className = 'history-row';

    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'repo-checkbox';
    checkbox.dataset.index = String(index);

    const body = doc.createElement('div');
    body.className = 'history-body';

    const titleRow = doc.createElement('div');
    titleRow.className = 'history-title';
    const title = doc.createElement('span');
    title.className = 'history-title-text';
    title.textContent = item.name;
    const rename = doc.createElement('button');
    rename.type = 'button';
    rename.className = 'back-btn';
    rename.dataset.action = 'rename';
    rename.dataset.index = String(index);
    rename.setAttribute('aria-label', `Renombrar ${item.name}`);
    rename.textContent = 'Renombrar';
    titleRow.append(title, rename);

    const meta = doc.createElement('p');
    meta.className = 'history-meta';
    const count = doc.createElement('span');
    count.textContent = `${item.questions.length} preguntas • ${item.date}`;
    const score = doc.createElement('span');
    score.textContent = item.lastScore != null ? `Nota: ${item.lastScore}/10` : 'Sin realizar';
    meta.append(count, score);

    const start = doc.createElement('button');
    start.type = 'button';
    start.className = 'nav-btn primary';
    start.dataset.action = 'start';
    start.dataset.index = String(index);
    start.textContent = 'Empezar examen';

    body.append(titleRow, meta, start);
    row.append(checkbox, body);
    article.append(row);
    container.append(article);
  });
}
