import { LOG_EVENTS } from '@boxfury/shared';
import { t } from './i18n.js';

const MAX_ENTRIES = 6;
const ENTRY_LIFETIME_MS = 7000;

let root = null;
let entries = [];
let nextId = 1;
let purgeTimer = null;

export function setupEventLog() {
  root = document.getElementById('event-log');
  if (!root) return;
  root.innerHTML = '';
  entries = [];
  if (purgeTimer) clearInterval(purgeTimer);
  purgeTimer = setInterval(purge, 500);
}

export function teardownEventLog() {
  if (purgeTimer) {
    clearInterval(purgeTimer);
    purgeTimer = null;
  }
  if (root) root.innerHTML = '';
  entries = [];
  root = null;
}

export function pushEvent(event) {
  if (!root) return;
  const html = formatEvent(event);
  if (!html) return;
  const id = nextId++;
  const expireAt = performance.now() + ENTRY_LIFETIME_MS;
  entries.push({ id, html, expireAt });
  while (entries.length > MAX_ENTRIES) entries.shift();
  render();
}

function formatEvent(e) {
  switch (e.type) {
    case LOG_EVENTS.JOIN:
      return `${nameSpan(e.name)} ${plain(t('log.join'))}`;
    case LOG_EVENTS.LEAVE:
      return `${nameSpan(e.name)} ${plain(t('log.leave'))}`;
    case LOG_EVENTS.JOIN_TEAM:
      return `${nameSpan(e.name, e.team)} ${plain(t('log.joinTeam'))} ${teamSpan(e.team)}`;
    case LOG_EVENTS.KILL:
      return `${nameSpan(e.shooter, e.shooterTeam)} <span class="event-log__sep">→</span> ${nameSpan(e.victim, e.victimTeam)}`;
    case LOG_EVENTS.CAPTURE:
      return `${nameSpan(e.name, e.team)} ${plain(t('log.capture'))}`;
    case LOG_EVENTS.MATCH_END:
      if (!e.winnerTeam) return plain(t('log.matchTie'));
      return `${teamSpan(e.winnerTeam)} ${plain(t('log.matchWins'))}`;
    default:
      return null;
  }
}

function nameSpan(name, team = 0) {
  const cls = team === 1 ? 'event-log__name--p1' : team === 2 ? 'event-log__name--p2' : 'event-log__name';
  return `<span class="${cls}">${esc(name ?? '?')}</span>`;
}

function teamSpan(team) {
  if (team === 1) return `<span class="event-log__team--p1">JADE</span>`;
  if (team === 2) return `<span class="event-log__team--p2">CRIMSON</span>`;
  return '';
}

function plain(text) {
  return esc(text);
}

function purge() {
  if (!root) return;
  const now = performance.now();
  const before = entries.length;
  entries = entries.filter((e) => e.expireAt > now);
  if (entries.length !== before) render();
}

function render() {
  if (!root) return;
  root.innerHTML = entries
    .map((e) => `<div class="event-log__entry" data-id="${e.id}">${e.html}</div>`)
    .join('');
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
