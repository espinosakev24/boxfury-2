export function setupMenu(onFindGame) {
  const menu = document.getElementById('menu');
  const findBtn = document.getElementById('btn-find');

  const start = () => {
    menu.classList.add('hidden');
    onFindGame();
  };

  findBtn.addEventListener('click', start);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !menu.classList.contains('hidden')) start();
  });
}
