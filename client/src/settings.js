import { getAimInvert, setAimInvert } from './aim-mode.js';
import { applyLocale, getLocale, setLocale, t } from './i18n.js';
import { KEY_SCHEMES, getKeyScheme, setKeyScheme } from './keyscheme.js';
import { currentSkinLabel, openSkinPicker, setupSkinPicker } from './skin-picker.js';
import { getUsername, setUsername } from './username.js';

export function setupSettings() {
  const overlay = document.getElementById('settings-overlay');
  const openBtn = document.getElementById('btn-settings');
  const closeBtn = document.getElementById('settings-close');
  const cancelBtn = document.getElementById('settings-cancel');
  const saveBtn = document.getElementById('settings-save');
  const usernameInput = document.getElementById('settings-username');
  const skinOpenBtn = document.getElementById('settings-skin-open');
  const skinLabel = document.getElementById('settings-skin-current');
  const keysRoot = document.getElementById('settings-keys');
  const aimRoot = document.getElementById('settings-aim');

  let pickedKeys = getKeyScheme();
  let pickedAimInvert = getAimInvert();

  const refreshSkinLabel = () => {
    if (skinLabel) skinLabel.textContent = currentSkinLabel();
  };

  const renderKeys = () => {
    if (!keysRoot) return;
    keysRoot.innerHTML = '';
    for (const id of KEY_SCHEMES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (id === pickedKeys ? ' is-selected' : '');
      btn.textContent = t(`keys.${id}`);
      btn.addEventListener('click', () => {
        pickedKeys = id;
        renderKeys();
      });
      keysRoot.appendChild(btn);
    }
  };

  const renderAim = () => {
    if (!aimRoot) return;
    aimRoot.innerHTML = '';
    const options = [
      { value: true, key: 'aim.pullBack' },
      { value: false, key: 'aim.direct' },
    ];
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip' + (opt.value === pickedAimInvert ? ' is-selected' : '');
      btn.textContent = t(opt.key);
      btn.addEventListener('click', () => {
        pickedAimInvert = opt.value;
        renderAim();
      });
      aimRoot.appendChild(btn);
    }
  };

  setupSkinPicker({ onSaved: refreshSkinLabel });

  skinOpenBtn?.addEventListener('click', openSkinPicker);

  const open = () => {
    overlay.classList.remove('hidden');
    usernameInput.value = getUsername();
    pickedKeys = getKeyScheme();
    pickedAimInvert = getAimInvert();
    renderKeys();
    renderAim();
    refreshSkinLabel();
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
    setKeyScheme(pickedKeys);
    setAimInvert(pickedAimInvert);
    const lang = document.querySelector('input[name="settings-lang"]:checked')?.value;
    if (lang) setLocale(lang);
    applyLocale();
    refreshSkinLabel();
    close();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const skinOverlay = document.getElementById('skin-overlay');
    if (skinOverlay && !skinOverlay.classList.contains('hidden')) return;
    if (!overlay.classList.contains('hidden')) close();
  });

  refreshSkinLabel();
}
