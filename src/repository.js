const HISTORY_KEY = 'testlab-history';

export function createRepository(storage, now = () => new Date().toLocaleDateString()) {
  function list() {
    return JSON.parse(storage.getItem(HISTORY_KEY) || '[]');
  }

  function write(items) {
    storage.setItem(HISTORY_KEY, JSON.stringify(items));
  }

  return {
    list,
    save(name, questions) {
      const history = list();
      const item = {
        name,
        date: now(),
        questions,
        lastScore: null
      };
      const existing = history.findIndex((entry) => entry.name === name && entry.questions.length === questions.length);
      if (existing > -1) history[existing] = item;
      else history.unshift(item);
      write(history);
    },
    rename(index, name) {
      const history = list();
      if (!history[index] || !String(name || '').trim()) return false;
      history[index].name = String(name).trim();
      write(history);
      return true;
    },
    remove(indices) {
      const history = list();
      [...indices].sort((a, b) => b - a).forEach((index) => {
        if (Number.isInteger(index)) history.splice(index, 1);
      });
      write(history);
    },
    updateScore(name, score) {
      const history = list();
      const existing = history.find((entry) => entry.name === name);
      if (!existing) return;
      existing.lastScore = score;
      write(history);
    }
  };
}
