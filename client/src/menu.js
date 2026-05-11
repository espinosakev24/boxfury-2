import { NetworkManager } from './network/NetworkManager.js';

export function setupMenu({ onJoin, onCreate, onTest, onSolo }) {
  const menu = document.getElementById('menu');
  const findBtn = document.getElementById('btn-find');
  const createBtn = document.getElementById('btn-create');
  const testBtn = document.getElementById('btn-test');
  const soloBtn = document.getElementById('btn-solo');

  const lobby = document.getElementById('lobby-overlay');
  const lobbyClose = document.getElementById('lobby-close');
  const lobbyRefresh = document.getElementById('lobby-refresh');
  const lobbyList = document.getElementById('lobby-list');
  const lobbySearch = document.getElementById('lobby-search');

  let rooms = [];
  let filter = '';
  let pollTimer = null;

  const openLobby = () => {
    lobby.classList.remove('hidden');
    lobbySearch.value = '';
    filter = '';
    refreshRooms();
    lobbySearch.focus();
    pollTimer = setInterval(refreshRooms, 3000);
  };

  const closeLobby = () => {
    lobby.classList.add('hidden');
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const refreshRooms = async () => {
    if (rooms.length === 0) {
      lobbyList.innerHTML = '<div class="lobby__empty">Loading…</div>';
    }
    try {
      rooms = await NetworkManager.listRooms();
    } catch (err) {
      lobbyList.innerHTML = `<div class="lobby__empty">Failed to load rooms — ${escapeHtml(err.message)}</div>`;
      return;
    }
    renderRooms();
  };

  const renderRooms = () => {
    const f = filter.trim().toLowerCase();
    const filtered = !f
      ? rooms
      : rooms.filter((r) => {
          const name = r.metadata?.name ?? r.roomId;
          return String(name).toLowerCase().includes(f);
        });

    if (filtered.length === 0) {
      lobbyList.innerHTML = '<div class="lobby__empty">No rooms found</div>';
      return;
    }

    lobbyList.innerHTML = '';
    for (const room of filtered) lobbyList.appendChild(roomCard(room));
  };

  const roomCard = (room) => {
    const meta = room.metadata ?? {};
    const name = meta.name ?? room.roomId.slice(0, 8);
    const team1 = meta.team1 ?? [];
    const team2 = meta.team2 ?? [];
    const spectators = meta.spectators ?? [];
    const playerCap = meta.maxPlayers ?? 8;
    const players = team1.length + team2.length;
    const playersFull = players >= playerCap;
    const age = ageLabel(meta.createdAt);
    const target = meta.scoreTarget;
    const rosterTooltip = [
      team1.length ? `JADE: ${team1.map((m) => m.name ?? '?').join(', ')}` : '',
      team2.length ? `CRIMSON: ${team2.map((m) => m.name ?? '?').join(', ')}` : '',
      spectators.length ? `WATCHING: ${spectators.map((m) => m.name ?? '?').join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const card = document.createElement('div');
    card.className = 'room';
    if (rosterTooltip) card.title = rosterTooltip;
    card.innerHTML = `
      <span class="room__name">${escapeHtml(name)}</span>
      <span class="room__meta">
        <span class="room__dot room__dot--p1">${team1.length}</span>
        <span class="room__dot room__dot--p2">${team2.length}</span>
        <span class="room__stat">${players}/${playerCap}${playersFull ? ' · spectate' : ''}</span>
        <span class="room__stat" title="spectators">◐ ${spectators.length}</span>
        ${target ? `<span class="room__stat">${target}p</span>` : ''}
        <span class="room__sub">#${escapeHtml(room.roomId.slice(0, 6))}${age ? ' · ' + escapeHtml(age) : ''}</span>
      </span>
    `;

    card.addEventListener('click', () => {
      closeLobby();
      onJoin(room.roomId);
    });

    return card;
  };

  const create = () => {
    closeLobby();
    onCreate();
  };

  findBtn.addEventListener('click', openLobby);
  createBtn.addEventListener('click', create);
  soloBtn?.addEventListener('click', () => {
    closeLobby();
    onSolo?.();
  });
  testBtn?.addEventListener('click', () => {
    closeLobby();
    onTest?.();
  });
  lobbyClose.addEventListener('click', closeLobby);
  lobbyRefresh.addEventListener('click', refreshRooms);
  lobbySearch.addEventListener('input', (e) => {
    filter = e.target.value;
    renderRooms();
  });

  window.addEventListener('keydown', (e) => {
    const createOverlay = document.getElementById('create-overlay');
    const createOpen = createOverlay && !createOverlay.classList.contains('hidden');
    if (!menu.classList.contains('hidden') && lobby.classList.contains('hidden') && !createOpen) {
      if (e.key === 'Enter') openLobby();
      else if (e.key === 'c' || e.key === 'C') create();
      else if (e.key === 'p' || e.key === 'P') {
        closeLobby();
        onSolo?.();
      }
      else if (e.key === 't' || e.key === 'T') {
        closeLobby();
        onTest?.();
      }
    } else if (!lobby.classList.contains('hidden') && e.key === 'Escape') {
      closeLobby();
    }
  });
}

function ageLabel(createdAt) {
  if (!createdAt) return '';
  const secs = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
