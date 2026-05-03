import { applyLocale, getLocale, setLocale } from './i18n.js';
import { getUsername, setUsername } from './username.js';

export function setupSettings() {
  const overlay = document.getElementById('settings-overlay');
  const openBtn = document.getElementById('btn-settings');
  const closeBtn = document.getElementById('settings-close');
  const cancelBtn = document.getElementById('settings-cancel');
  const saveBtn = document.getElementById('settings-save');
  const usernameInput = document.getElementById('settings-username');

  const open = () => {
    overlay.classList.remove('hidden');
    usernameInput.value = getUsername();
    const currentLocale = getLocale();
    document.querySelectorAll('input[name="settings-lang"]').forEach((r) => {
      r.checked = r.value === currentLocale;
    });
    usernameInput.focus();
  };
  const close = () => overlay.classList.add('hidden');

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  saveBtn.addEventListener('click', () => {
    setUsername(usernameInput.value);
    const lang = document.querySelector('input[name="settings-lang"]:checked')?.value;
    if (lang) setLocale(lang);
    applyLocale();
    close();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) close();
  });
}
