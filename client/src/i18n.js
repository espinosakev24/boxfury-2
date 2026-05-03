const STORAGE_KEY = 'boxfury:locale';

const TRANSLATIONS = {
  en: {
    'menu.eyebrow': '◣ A minimal arena brawler',
    'menu.tagline': 'Up to four boxes. One line. Last shape standing wins.',
    'menu.findGame': 'Find game',
    'menu.createGame': 'Create game',
    'menu.settings': 'Settings',
    'menu.arena': 'Arena · 1440 × 900',
    'menu.maxPlayers': '4 players max',

    'settings.eyebrow': '◣ Settings',
    'settings.title': 'SETTINGS',
    'settings.username': 'Username',
    'settings.usernamePlaceholder': 'Pick a name…',
    'settings.language': 'Language',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.close': 'CLOSE',

    'pause.eyebrow': '◣ Paused',
    'pause.escResume': 'ESC to resume',
    'pause.title': 'MENU',
    'pause.resume': 'Resume',
    'pause.controls': 'Controls',
    'pause.joinTeam': 'Join team',
    'pause.mute': 'Mute audio',
    'pause.unmute': 'Unmute audio',
    'pause.fullscreen': 'Fullscreen',
    'pause.leave': 'Leave room',

    'controls.eyebrow': '◣ Controls',
    'controls.close': 'CLOSE',
    'controls.move': 'Move',
    'controls.jump': 'Jump',
    'controls.shoot': 'Hold to charge bow, release to shoot',
    'controls.menu': 'Open the in-game menu',
    'controls.lockFacing': 'Hold to lock facing',
    'controls.flag': 'Pick / drop flag',
    'controls.scoreboard': 'Hold to show scoreboard',

    'lobby.eyebrow': '◣ Find game',
    'lobby.title': 'ROOMS',
    'lobby.searchPlaceholder': 'Search rooms…',
    'lobby.refresh': 'REFRESH',
    'lobby.close': 'CLOSE',
    'lobby.loading': 'Loading…',
    'lobby.empty': 'No rooms found',
    'lobby.noSpectators': 'no spectators',

    'team.eyebrow': '◣ Choose your team',
    'team.title': 'PICK SIDE',
    'team.spectate': 'JUST SPECTATE',
    'team.full': 'FULL',
    'team.players': 'players',
    'team.player': 'player',

    'scoreboard.eyebrow': '◣ Scoreboard',
    'scoreboard.holdTab': 'Hold TAB',
    'scoreboard.watching': 'Watching',
    'scoreboard.colName': 'NAME',
    'scoreboard.colKills': 'KILLS',
    'scoreboard.colCaps': 'CAPS',
    'scoreboard.colDeaths': 'DEATHS',

    'matchEnd.eyebrow': '◣ Match ended',
    'matchEnd.tie': 'TIE',
    'matchEnd.wins': 'WINS',
    'matchEnd.back': 'Back to lobby',

    'death.title': 'YOU DIED',
    'death.respawnIn': 'Respawning in',

    'hud.watching': 'watching',
    'hud.noSpectators': 'no spectators',
  },
  es: {
    'menu.eyebrow': '◣ Un brawler de arena minimalista',
    'menu.tagline': 'Hasta cuatro cajas. Una línea. La última en pie gana.',
    'menu.findGame': 'Buscar partida',
    'menu.createGame': 'Crear partida',
    'menu.settings': 'Ajustes',
    'menu.arena': 'Arena · 1440 × 900',
    'menu.maxPlayers': 'Máx 4 jugadores',

    'settings.eyebrow': '◣ Ajustes',
    'settings.title': 'AJUSTES',
    'settings.username': 'Nombre',
    'settings.usernamePlaceholder': 'Elige un nombre…',
    'settings.language': 'Idioma',
    'settings.save': 'Guardar',
    'settings.cancel': 'Cancelar',
    'settings.close': 'CERRAR',

    'pause.eyebrow': '◣ Pausa',
    'pause.escResume': 'ESC para reanudar',
    'pause.title': 'MENÚ',
    'pause.resume': 'Reanudar',
    'pause.controls': 'Controles',
    'pause.joinTeam': 'Unirse a equipo',
    'pause.mute': 'Silenciar audio',
    'pause.unmute': 'Activar audio',
    'pause.fullscreen': 'Pantalla completa',
    'pause.leave': 'Salir de la sala',

    'controls.eyebrow': '◣ Controles',
    'controls.close': 'CERRAR',
    'controls.move': 'Mover',
    'controls.jump': 'Saltar',
    'controls.shoot': 'Mantén para cargar el arco, suelta para disparar',
    'controls.menu': 'Abrir menú de pausa',
    'controls.lockFacing': 'Mantén para bloquear el giro',
    'controls.flag': 'Tomar / soltar bandera',
    'controls.scoreboard': 'Mantén para ver el marcador',

    'lobby.eyebrow': '◣ Buscar partida',
    'lobby.title': 'SALAS',
    'lobby.searchPlaceholder': 'Buscar salas…',
    'lobby.refresh': 'ACTUALIZAR',
    'lobby.close': 'CERRAR',
    'lobby.loading': 'Cargando…',
    'lobby.empty': 'No hay salas',
    'lobby.noSpectators': 'sin espectadores',

    'team.eyebrow': '◣ Elige tu equipo',
    'team.title': 'ELIGE LADO',
    'team.spectate': 'SOLO MIRAR',
    'team.full': 'LLENO',
    'team.players': 'jugadores',
    'team.player': 'jugador',

    'scoreboard.eyebrow': '◣ Marcador',
    'scoreboard.holdTab': 'Mantén TAB',
    'scoreboard.watching': 'Mirando',
    'scoreboard.colName': 'NOMBRE',
    'scoreboard.colKills': 'KILLS',
    'scoreboard.colCaps': 'CAPS',
    'scoreboard.colDeaths': 'MUERTES',

    'matchEnd.eyebrow': '◣ Partida finalizada',
    'matchEnd.tie': 'EMPATE',
    'matchEnd.wins': 'GANA',
    'matchEnd.back': 'Volver al lobby',

    'death.title': 'HAS MUERTO',
    'death.respawnIn': 'Reapareciendo en',

    'hud.watching': 'mirando',
    'hud.noSpectators': 'sin espectadores',
  },
};

export function getLocale() {
  const v = localStorage.getItem(STORAGE_KEY);
  return TRANSLATIONS[v] ? v : 'en';
}

export function setLocale(locale) {
  if (!TRANSLATIONS[locale]) return;
  localStorage.setItem(STORAGE_KEY, locale);
  applyLocale();
}

export function t(key) {
  const locale = getLocale();
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

export function applyLocale() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute('placeholder', t(key));
  });
}
