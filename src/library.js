const HISTORY_KEY = 'testlab-history';
const LIBRARY_KEY = 'testlab-library';
const SORT_KEY = 'testlab-library-sort';
const SORTS = new Set(['manual', 'name', 'imported', 'score']);

export function createLibrary(storage, now = () => new Date(), ids = defaultIds()) {
  function readHistory() {
    const raw = storage.getItem(HISTORY_KEY);
    if (raw == null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('testlab-history no es un array');
    return parsed;
  }

  function loadIndex() {
    const raw = storage.getItem(LIBRARY_KEY);
    if (raw == null) return { state: 'ok', model: emptyModel() };
    const parsed = JSON.parse(raw);
    if (!isObject(parsed)) return { state: 'blocked' };
    if (parsed.version !== undefined && parsed.version !== 1) return { state: 'blocked' };
    if (parsed.folders !== undefined && !Array.isArray(parsed.folders)) return { state: 'blocked' };
    const folders = [];
    for (const folder of parsed.folders || []) {
      if (!isObject(folder) || typeof folder.id !== 'string' || folder.id.trim() === '' || typeof folder.name !== 'string') {
        return { state: 'blocked' };
      }
      if (!(folder.parentId == null || typeof folder.parentId === 'string')) return { state: 'blocked' };
      folders.push({ ...folder, id: folder.id.trim(), parentId: folder.parentId ?? null });
    }
    return {
      state: 'ok',
      model: {
        folders,
        placement: clonePlacement(parsed.placement),
        order: cloneOrder(parsed.order)
      }
    };
  }

  function prepareMutation() {
    const loaded = loadIndex();
    if (loaded.state === 'blocked') return { ok: false, error: 'unsupported-version' };
    return { ok: true, model: loaded.model };
  }

  function writeModel(model) {
    storage.setItem(LIBRARY_KEY, JSON.stringify({
      version: 1,
      folders: model.folders,
      placement: model.placement,
      order: model.order
    }));
  }

  function writeHistory(entries) {
    storage.setItem(HISTORY_KEY, JSON.stringify(entries));
  }

  function view(folderId = null) {
    const history = readHistory();
    const identified = assignIds(history).filter((item) => !item.skip);
    const loaded = loadIndex();
    const sort = getSort();
    if (loaded.state === 'blocked') {
      if (folderId != null) return { ok: false, error: 'missing' };
      return {
        ok: true,
        breadcrumbs: [{ id: null, name: 'Repositorio' }],
        folders: [],
        tests: sortItems(identified.map(toTest), sort, 'test'),
        sort
      };
    }
    const model = loaded.model;
    if (folderId != null && !model.folders.some((folder) => folder.id === folderId)) {
      return { ok: false, error: 'missing' };
    }
    const parentId = folderId ?? null;
    const folders = sortItems(arrange(
      foldersUnder(model, parentId).map((folder) => ({
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId ?? null,
        createdAt: folder.createdAt,
        testCount: countTests(model, folder.id, identified)
      })),
      manualIds(model, parentId, 'folder')
    ), sort, 'folder');
    const tests = sortItems(arrange(
      testsUnder(identified, model, parentId),
      manualIds(model, parentId, 'test')
    ), sort, 'test');
    return {
      ok: true,
      breadcrumbs: breadcrumbTrail(model, folderId),
      folders,
      tests,
      sort
    };
  }

  function descendantFolderIds(id) {
    const loaded = loadIndex();
    if (loaded.state !== 'ok') return [];
    if (!loaded.model.folders.some((folder) => folder.id === id)) return [];
    return descendantIds(loaded.model.folders, id);
  }

  function listFolders() {
    const loaded = loadIndex();
    if (loaded.state !== 'ok') return [];
    const sort = getSort();
    const out = [];
    const walk = (parentId, prefix) => {
      const folders = sortItems(arrange(
        foldersUnder(loaded.model, parentId),
        manualIds(loaded.model, parentId, 'folder')
      ), sort, 'folder');
      for (const folder of folders) {
        const path = prefix ? `${prefix} / ${folder.name}` : folder.name;
        out.push({ id: folder.id, name: folder.name, path });
        walk(folder.id, path);
      }
    };
    walk(null, '');
    return out;
  }

  function createFolder(parentId, name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return { ok: false, error: 'empty-name' };
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const model = prepared.model;
    if (parentId != null && !model.folders.some((folder) => folder.id === parentId)) {
      return { ok: false, error: 'missing' };
    }
    const id = ids('f_');
    model.folders.push({
      id,
      name: trimmed,
      parentId: parentId ?? null,
      createdAt: stampOf(now).createdAt
    });
    bucket(model, parentId).folders.push(id);
    bucket(model, id);
    writeModel(model);
    return { ok: true, id };
  }

  function renameFolder(id, name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return { ok: false, error: 'empty-name' };
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const folder = prepared.model.folders.find((item) => item.id === id);
    if (!folder) return { ok: false, error: 'missing' };
    folder.name = trimmed;
    writeModel(prepared.model);
    return { ok: true };
  }

  function moveFolder(id, parentId) {
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const model = prepared.model;
    const folder = model.folders.find((item) => item.id === id);
    if (!folder) return { ok: false, error: 'missing' };
    if (parentId != null && !model.folders.some((item) => item.id === parentId)) {
      return { ok: false, error: 'missing' };
    }
    if (parentId != null && descendantIds(model.folders, id).includes(parentId)) {
      return { ok: false, error: 'cycle' };
    }
    removeFromOrders(model, new Set([id]), ['folders']);
    folder.parentId = parentId ?? null;
    bucket(model, parentId).folders.push(id);
    writeModel(model);
    return { ok: true };
  }

  function saveTest(name, questions, folderId = null) {
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const model = prepared.model;
    if (folderId != null && !model.folders.some((folder) => folder.id === folderId)) {
      return { ok: false, error: 'missing' };
    }
    const history = readHistory();
    const assigned = assignIds(history);
    const target = folderId ?? null;
    const questionCount = Array.isArray(questions) ? questions.length : -1;
    const match = assigned.find((item) => {
      if (item.skip) return false;
      const count = Array.isArray(item.entry.questions) ? item.entry.questions.length : -2;
      return item.entry.name === name && count === questionCount && resolvedFolderId(model, item.id) === target;
    });
    const stamp = stampOf(now);
    const pinned = applyPins(history, assigned);
    if (match) {
      const index = assigned.indexOf(match);
      const next = {
        ...pinned.entries[index],
        id: match.id,
        name,
        date: stamp.date,
        questions,
        lastScore: null
      };
      if (stamp.importedAt) next.importedAt = stamp.importedAt;
      else delete next.importedAt;
      pinned.entries[index] = next;
      writeHistory(pinned.entries);
      return { ok: true, id: match.id };
    }
    const id = ids('t_');
    const created = { id, name, date: stamp.date, questions, lastScore: null };
    if (stamp.importedAt) created.importedAt = stamp.importedAt;
    pinned.entries.unshift(created);
    if (target) model.placement[id] = target;
    bucket(model, target).tests.unshift(id);
    writeHistory(pinned.entries);
    writeModel(model);
    return { ok: true, id };
  }

  function renameTest(id, name) {
    const trimmed = String(name ?? '').trim();
    if (!trimmed) return { ok: false, error: 'empty-name' };
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const history = readHistory();
    const assigned = assignIds(history);
    const match = assigned.find((item) => item.id === id);
    if (!match || match.skip) return { ok: false, error: 'missing' };
    const pinned = applyPins(history, assigned);
    const index = assigned.indexOf(match);
    pinned.entries[index] = { ...pinned.entries[index], id, name: trimmed };
    writeHistory(pinned.entries);
    return { ok: true };
  }

  function moveTest(id, folderId) {
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const model = prepared.model;
    if (folderId != null && !model.folders.some((folder) => folder.id === folderId)) {
      return { ok: false, error: 'missing' };
    }
    const history = readHistory();
    const assigned = assignIds(history);
    const found = assigned.find((item) => item.id === id);
    if (!found || found.skip) return { ok: false, error: 'missing' };
    const pinned = applyPins(history, assigned);
    const target = folderId ?? null;
    if (resolvedFolderId(model, id) !== target) {
      removeFromOrders(model, new Set([id]), ['tests']);
      delete model.placement[id];
      if (target) model.placement[id] = target;
      bucket(model, target).tests.push(id);
      writeModel(model);
    }
    if (pinned.changed) writeHistory(pinned.entries);
    return { ok: true };
  }

  function deleteTests(selected) {
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const model = prepared.model;
    const remove = new Set(selected);
    const history = readHistory();
    const assigned = assignIds(history);
    const pinned = applyPins(history, assigned);
    const next = [];
    const removed = [];
    assigned.forEach((item, index) => {
      if (!item.skip && remove.has(item.id)) {
        removed.push(item.id);
        return;
      }
      next.push(pinned.entries[index]);
    });
    removeFromOrders(model, new Set(removed), ['tests']);
    for (const id of removed) delete model.placement[id];
    writeHistory(next);
    writeModel(model);
    return { ok: true, removed: removed.length };
  }

  function updateScore(id, score) {
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const history = readHistory();
    const assigned = assignIds(history);
    const match = assigned.find((item) => item.id === id);
    if (!match || match.skip) return { ok: false, error: 'missing' };
    const pinned = applyPins(history, assigned);
    const index = assigned.indexOf(match);
    pinned.entries[index] = { ...pinned.entries[index], id, lastScore: score };
    writeHistory(pinned.entries);
    return { ok: true };
  }

  function removalPreview(id) {
    const history = readHistory();
    const loaded = loadIndex();
    if (loaded.state !== 'ok') return { ok: false, error: 'missing' };
    if (!loaded.model.folders.some((folder) => folder.id === id)) return { ok: false, error: 'missing' };
    const identified = assignIds(history).filter((item) => !item.skip);
    const folderIds = descendantIds(loaded.model.folders, id);
    const tests = identified.filter((item) => folderIds.includes(resolvedFolderId(loaded.model, item.id))).length;
    return { ok: true, folders: folderIds.length, tests };
  }

  function deleteFolder(id) {
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const model = prepared.model;
    if (!model.folders.some((folder) => folder.id === id)) return { ok: false, error: 'missing' };
    const folderIds = new Set(descendantIds(model.folders, id));
    const history = readHistory();
    const assigned = assignIds(history);
    const removed = assigned
      .filter((item) => !item.skip && folderIds.has(resolvedFolderId(model, item.id)))
      .map((item) => item.id);
    const removedSet = new Set(removed);
    const pinned = applyPins(history, assigned);
    const next = [];
    assigned.forEach((item, index) => {
      if (!item.skip && removedSet.has(item.id)) return;
      next.push(pinned.entries[index]);
    });
    model.folders = model.folders.filter((folder) => !folderIds.has(folder.id));
    deleteOrderKeys(model, folderIds);
    removeFromOrders(model, folderIds, ['folders']);
    removeFromOrders(model, removedSet, ['tests']);
    for (const testId of removedSet) delete model.placement[testId];
    writeHistory(next);
    writeModel(model);
    return { ok: true, folders: folderIds.size, tests: removed.length };
  }

  function moveInOrder(kind, id, direction) {
    if ((kind !== 'folder' && kind !== 'test') || (direction !== -1 && direction !== 1)) {
      return { ok: false, error: 'missing' };
    }
    const prepared = prepareMutation();
    if (!prepared.ok) return prepared;
    const model = prepared.model;
    const identified = assignIds(readHistory()).filter((item) => !item.skip);
    let parentId = null;
    if (kind === 'folder') {
      const folder = model.folders.find((item) => item.id === id);
      if (!folder) return { ok: false, error: 'missing' };
      parentId = displayParentId(folder, indexFolders(model));
    } else if (!identified.some((item) => item.id === id)) {
      return { ok: false, error: 'missing' };
    } else {
      parentId = resolvedFolderId(model, id);
    }
    const items = kind === 'folder' ? foldersUnder(model, parentId) : testsUnder(identified, model, parentId);
    const ordered = arrange(items, manualIds(model, parentId, kind));
    const index = ordered.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, error: 'missing' };
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return { ok: false, error: 'limit' };
    const nextIds = ordered.map((item) => item.id);
    const [moved] = nextIds.splice(index, 1);
    nextIds.splice(target, 0, moved);
    bucket(model, parentId)[kind === 'folder' ? 'folders' : 'tests'] = nextIds;
    writeModel(model);
    return { ok: true };
  }

  function getSort() {
    const value = storage.getItem(SORT_KEY);
    return SORTS.has(value) ? value : 'manual';
  }

  function setSort(mode) {
    if (!SORTS.has(mode)) return { ok: false, error: 'missing' };
    storage.setItem(SORT_KEY, mode);
    return { ok: true };
  }

  function getTest(id) {
    const found = assignIds(readHistory()).find((item) => item.id === id);
    if (!found || found.skip) return null;
    return found.pinned ? found.entry : { ...found.entry, id: found.id };
  }

  return {
    view,
    listFolders,
    descendantFolderIds,
    createFolder,
    renameFolder,
    moveFolder,
    saveTest,
    renameTest,
    moveTest,
    deleteTests,
    updateScore,
    removalPreview,
    deleteFolder,
    moveInOrder,
    getSort,
    setSort,
    getTest
  };
}

function defaultIds() {
  return (prefix) => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return `${prefix}${uuid}`;
    return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  };
}

function emptyModel() {
  return { folders: [], placement: {}, order: {} };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clonePlacement(placement) {
  const next = {};
  if (!isObject(placement)) return next;
  for (const [key, value] of Object.entries(placement)) {
    if (typeof value === 'string' && value) next[key] = value;
  }
  return next;
}

function cloneOrder(order) {
  const next = {};
  if (!isObject(order)) return next;
  for (const [key, entry] of Object.entries(order)) {
    if (!isObject(entry)) continue;
    next[key] = {
      folders: Array.isArray(entry.folders) ? entry.folders.filter((id) => typeof id === 'string') : [],
      tests: Array.isArray(entry.tests) ? entry.tests.filter((id) => typeof id === 'string') : []
    };
  }
  return next;
}

function bucket(model, parentId) {
  const key = parentId ?? 'root';
  if (!isObject(model.order[key])) model.order[key] = { folders: [], tests: [] };
  if (!Array.isArray(model.order[key].folders)) model.order[key].folders = [];
  if (!Array.isArray(model.order[key].tests)) model.order[key].tests = [];
  return model.order[key];
}

function removeFromOrders(model, ids, kinds) {
  for (const entry of Object.values(model.order)) {
    if (!entry) continue;
    for (const kind of kinds) {
      if (Array.isArray(entry[kind])) entry[kind] = entry[kind].filter((id) => !ids.has(id));
    }
  }
}

function deleteOrderKeys(model, ids) {
  for (const id of ids) delete model.order[id];
}

function assignIds(entries) {
  const counts = new Map();
  return entries.map((entry) => {
    if (!isObject(entry)) return { entry, id: null, skip: true, pinned: false };
    if (typeof entry.id === 'string' && entry.id.trim()) {
      return { entry, id: entry.id.trim(), skip: false, pinned: true };
    }
    const fingerprint = JSON.stringify({ name: entry.name, date: entry.date, questions: entry.questions });
    const occurrence = counts.get(fingerprint) || 0;
    counts.set(fingerprint, occurrence + 1);
    return {
      entry,
      id: `legacy:${fnv1a(fingerprint)}:${occurrence}`,
      skip: false,
      pinned: false
    };
  });
}

function applyPins(entries, assigned) {
  let changed = false;
  const next = entries.map((entry, index) => {
    const item = assigned[index];
    if (!item || item.skip || item.pinned) return entry;
    changed = true;
    return { ...entry, id: item.id };
  });
  return { entries: next, changed };
}

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stampOf(now) {
  const value = now();
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString();
    return { date: value.toLocaleDateString(), importedAt: iso, createdAt: iso };
  }
  return { date: String(value), importedAt: null, createdAt: new Date().toISOString() };
}

function toTest(item) {
  const questions = Array.isArray(item.entry.questions) ? item.entry.questions : [];
  return {
    id: item.id,
    name: item.entry.name,
    date: item.entry.date,
    importedAt: typeof item.entry.importedAt === 'string' ? item.entry.importedAt : null,
    lastScore: item.entry.lastScore ?? null,
    questions,
    questionCount: questions.length
  };
}

function indexFolders(model) {
  return new Map(model.folders.map((folder) => [folder.id, folder]));
}

function chainOk(folder, byId) {
  const seen = new Set();
  let current = folder;
  while (current) {
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    if (current.parentId == null) return true;
    const parent = byId.get(current.parentId);
    if (!parent) return false;
    current = parent;
  }
  return false;
}

function displayParentId(folder, byId) {
  if (!chainOk(folder, byId)) return null;
  return folder.parentId ?? null;
}

function descendantIds(folders, rootId) {
  const children = new Map();
  for (const folder of folders) {
    const parent = folder.parentId ?? null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(folder.id);
  }
  const out = [];
  const seen = new Set();
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const child of children.get(id) || []) stack.push(child);
  }
  return out;
}

function resolvedFolderId(model, testId) {
  const assigned = model.placement[testId];
  if (typeof assigned !== 'string') return null;
  return model.folders.some((folder) => folder.id === assigned) ? assigned : null;
}

function foldersUnder(model, parentId) {
  const byId = indexFolders(model);
  return model.folders.filter((folder) => displayParentId(folder, byId) === parentId);
}

function testsUnder(identified, model, parentId) {
  return identified.filter((item) => resolvedFolderId(model, item.id) === parentId).map(toTest);
}

function countTests(model, folderId, identified) {
  const ids = new Set(descendantIds(model.folders, folderId));
  return identified.filter((item) => ids.has(resolvedFolderId(model, item.id))).length;
}

function manualIds(model, parentId, kind) {
  const entry = model.order[parentId ?? 'root'];
  if (!entry) return [];
  const list = kind === 'folder' ? entry.folders : entry.tests;
  return Array.isArray(list) ? list : [];
}

function arrange(items, ids) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const result = [];
  for (const id of ids) {
    if (!byId.has(id)) continue;
    result.push(byId.get(id));
    byId.delete(id);
  }
  for (const item of items) {
    if (byId.has(item.id)) result.push(item);
  }
  return result;
}

function breadcrumbTrail(model, folderId) {
  const root = { id: null, name: 'Repositorio' };
  if (folderId == null) return [root];
  const byId = indexFolders(model);
  const folder = byId.get(folderId);
  if (!folder) return [root];
  if (!chainOk(folder, byId)) return [root, { id: folder.id, name: folder.name }];
  const crumbs = [];
  let current = folder;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    crumbs.push({ id: current.id, name: current.name });
    if (current.parentId == null) break;
    current = byId.get(current.parentId);
  }
  crumbs.reverse();
  return [root, ...crumbs];
}

function sortItems(items, mode, kind) {
  if (mode === 'manual') return items.slice();
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => compareItems(a.item, b.item, mode, kind) || a.index - b.index)
    .map((row) => row.item);
}

function compareItems(a, b, mode, kind) {
  if (mode === 'name') {
    return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es', {
      sensitivity: 'base',
      numeric: true
    });
  }
  if (mode === 'imported') return comparePresent(sortableTime(a), sortableTime(b));
  if (mode === 'score') {
    if (kind === 'folder') return 0;
    return comparePresent(numericScore(a.lastScore), numericScore(b.lastScore));
  }
  return 0;
}

function comparePresent(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

function sortableTime(entry) {
  return parseIso(entry.importedAt)
    ?? parseIso(entry.createdAt)
    ?? parseIso(entry.date)
    ?? parseUnambiguousDayMonth(entry.date);
}

function parseIso(value) {
  if (typeof value !== 'string') return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return utcDate(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function parseUnambiguousDayMonth(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (day <= 12) return null;
  return utcDate(year, month, day);
}

function utcDate(year, month, day) {
  if (month < 1 || month > 12) return null;
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return time;
}

function numericScore(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const score = Number(normalized);
  return Number.isFinite(score) ? score : null;
}
