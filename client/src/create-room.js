import {
  DEFAULT_MAX_PLAYERS,
  DEFAULT_MAX_POINTS,
  DEFAULT_MODE,
  MAX_PLAYERS_OPTIONS,
  MAX_POINTS_OPTIONS,
  MODES,
} from '@boxfury/shared';
import { t } from './i18n.js';

let onSubmitCb = null;
let pickedMaxPlayers = DEFAULT_MAX_PLAYERS;
let pickedMaxPoints = DEFAULT_MAX_POINTS;
let pickedMode = DEFAULT_MODE;

export function setupCreateRoom({ onSubmit } = {}) {
  onSubmitCb = onSubmit ?? null;
  const overlay = document.getElementById('create-overlay');
  const closeBtn = document.getElementById('create-close');
  const cancelBtn = document.getElementById('create-cancel');
  const submitBtn = document.getElementById('create-submit');
  const nameInput = document.getElementById('create-name');

  const close = () => overlay.classList.add('hidden');

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  submitBtn.addEventListener('click', () => {
    close();
    onSubmitCb?.({
      roomName: nameInput.value.trim().slice(0, 24),
      mode: pickedMode,
      maxPlayers: pickedMaxPlayers,
      maxPoints: pickedMaxPoints,
    });
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!overlay.classList.contains('hidden')) close();
  });
}

export function openCreateRoom() {
  pickedMaxPlayers = DEFAULT_MAX_PLAYERS;
  pickedMaxPoints = DEFAULT_MAX_POINTS;
  pickedMode = DEFAULT_MODE;
  document.getElementById('create-name').value = '';
  renderModes();
  renderPlayers();
  renderPoints();
  document.getElementById('create-overlay').classList.remove('hidden');
  document.getElementById('create-name').focus();
}

function renderModes() {
  const root = document.getElementById('create-mode');
  root.innerHTML = '';
  for (const m of MODES) {
    root.appendChild(makeChip(t(`mode.${m}`), m === pickedMode, () => {
      pickedMode = m;
      renderModes();
    }));
  }
  const placeholder = makeChip(t('createRoom.modeComingSoon'), false, null, true);
  root.appendChild(placeholder);
}

function renderPlayers() {
  const root = document.getElementById('create-max-players');
  root.innerHTML = '';
  for (const n of MAX_PLAYERS_OPTIONS) {
    root.appendChild(makeChip(String(n), n === pickedMaxPlayers, () => {
      pickedMaxPlayers = n;
      renderPlayers();
    }));
  }
}

function renderPoints() {
  const root = document.getElementById('create-max-points');
  root.innerHTML = '';
  for (const n of MAX_POINTS_OPTIONS) {
    root.appendChild(makeChip(String(n), n === pickedMaxPoints, () => {
      pickedMaxPoints = n;
      renderPoints();
    }));
  }
}

function makeChip(label, selected, onClick, disabled = false) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip' + (selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '');
  btn.textContent = label;
  if (disabled) btn.disabled = true;
  else if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
