let onPickCb = null;

export function setupSoloPicker() {
  const overlay = document.getElementById('solo-overlay');
  if (!overlay) return;

  const close = () => overlay.classList.add('hidden');
  document.getElementById('solo-close')?.addEventListener('click', close);
  document.getElementById('solo-bee')?.addEventListener('click', () => {
    close();
    onPickCb?.('bee');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!overlay.classList.contains('hidden')) close();
  });
}

export function openSoloPicker(onPick) {
  onPickCb = onPick;
  document.getElementById('solo-overlay')?.classList.remove('hidden');
}
