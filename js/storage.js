const STORAGE_KEY = 'ai-company-sim-save';

export function saveGame(state) {
  try {
    const serialized = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Failed to save game', error);
  }
}

export function loadGame() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load game', error);
    return null;
  }
}

export function clearGame() {
  localStorage.removeItem(STORAGE_KEY);
}
