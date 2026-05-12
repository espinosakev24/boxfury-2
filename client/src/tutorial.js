const KEY = 'boxfury.tutorialDismissed';

function isDismissed() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function persistDismissed() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {}
}

let wired = false;

function wire() {
  if (wired) return;
  wired = true;
  const overlay = document.getElementById('tutorial-overlay');
  if (!overlay) return;
  const close = () => overlay.classList.add('hidden');
  document.getElementById('tutorial-got-it')?.addEventListener('click', close);
  document.getElementById('tutorial-never')?.addEventListener('click', () => {
    persistDismissed();
    close();
  });
}

export function showTutorialIfNeeded() {
  if (isDismissed()) return;
  const overlay = document.getElementById('tutorial-overlay');
  if (!overlay) return;
  wire();
  overlay.classList.remove('hidden');
}
