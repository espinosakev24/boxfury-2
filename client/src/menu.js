import { NetworkManager } from './network/NetworkManager.js';

export function setupMenu({ onJoin, onCreate }) {
  const menu = document.getElementById('menu');
  const findBtn = document.getElementById('btn-find');
  const createBtn = document.getElementById('btn-create');

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
    const isFull = room.clients >= room.maxClients;
    const age = ageLabel(meta.createdAt);

    const card = document.createElement('div');
    card.className = `room ${isFull ? 'room--full' : ''}`;
    card.innerHTML = `
      <div class="room__header">
        <span class="room__name">${escapeHtml(name)}</span>
        <span class="room__meta">${room.clients}/${room.maxClients}${spectators.length ? ' · ' + spectators.length + ' watching' : ''} · #${escapeHtml(room.roomId.slice(0, 6))}${age ? ' · ' + escapeHtml(age) : ''}</span>
      </div>
      <div class="room__teams">
        <div class="room__team room__team--p1">
          <div class="room__team-head"><span>JADE</span><span>${team1.length}</span></div>
          <div class="room__team-members">${formatMembers(team1)}</div>
        </div>
        <div class="room__team room__team--p2">
          <div class="room__team-head"><span>CRIMSON</span><span>${team2.length}</span></div>
          <div class="room__team-members">${formatMembers(team2)}</div>
        </div>
      </div>
    `;

    if (!isFull) {
      card.addEventListener('click', () => {
        closeLobby();
        menu.classList.add('hidden');
        onJoin(room.roomId);
      });
    }

    return card;
  };

  const create = () => {
    closeLobby();
    menu.classList.add('hidden');
    onCreate();
  };

  findBtn.addEventListener('click', openLobby);
  createBtn.addEventListener('click', create);
  lobbyClose.addEventListener('click', closeLobby);
  lobbyRefresh.addEventListener('click', refreshRooms);
  lobbySearch.addEventListener('input', (e) => {
    filter = e.target.value;
    renderRooms();
  });

  window.addEventListener('keydown', (e) => {
    if (!menu.classList.contains('hidden') && lobby.classList.contains('hidden')) {
      if (e.key === 'Enter') openLobby();
      else if (e.key === 'c' || e.key === 'C') create();
    } else if (!lobby.classList.contains('hidden') && e.key === 'Escape') {
      closeLobby();
    }
  });
}

function formatMembers(members) {
  if (!members || members.length === 0) return '<span style="opacity:0.5">—</span>';
  return members.map((m) => escapeHtml(m.name ?? '?')).join(', ');
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
