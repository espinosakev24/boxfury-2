const STORAGE_KEY = 'boxfury:locale';

const TRANSLATIONS = {
  en: {
    'menu.eyebrow': '◣ A minimal arena brawler',
    'menu.tagline': 'Up to four boxes. One line. Last shape standing wins.',
    'menu.findGame': 'Find game',
    'menu.createGame': 'Create game',
    'rotate.title': 'Rotate your device',
    'rotate.sub': 'Boxfury is best in landscape.',
    'menu.settings': 'Settings',
    'menu.solo': 'Single player',
    'menu.test': 'Quick test (jade)',
    'solo.eyebrow': '◣ Single player',
    'solo.title': 'CHOOSE A MODE',
    'solo.story': 'Story',
    'solo.lockedSoon': 'Coming soon',
    'solo.bee': 'Bee Wars',
    'solo.beeSub': 'Defend against the swarm',
    'menu.howToPlay': '◣ How to play',
    'menu.arenaCaption': 'Capture the flag · up to 8 players',
    'controls.shootShort': 'Hold to charge, release to shoot',
    'controls.crouch': 'Crouch',
    'controls.aim': 'Aim (the bow follows the cursor)',
    'menu.arena': 'Arena · 1440 × 900',
    'menu.maxPlayers': '4 players max',

    'settings.eyebrow': '◣ Settings',
    'settings.title': 'SETTINGS',
    'settings.username': 'Username',
    'settings.usernamePlaceholder': 'Pick a name…',
    'settings.language': 'Language',
    'settings.movement': 'Movement keys',
    'keys.arrows': 'Arrows',
    'keys.wasd': 'WASD',
    'keys.both': 'Both',
    'settings.aim': 'Aim (touch)',
    'aim.pullBack': 'Pull-back',
    'aim.direct': 'Direct',
    'settings.quality': 'Visual quality',
    'quality.auto': 'Auto',
    'quality.high': 'High',
    'quality.medium': 'Medium',
    'quality.low': 'Low',
    'tutorial.eyebrow': '◣ How to play',
    'tutorial.title': 'QUICK START',
    'tutorial.desktop': 'Desktop',
    'tutorial.mobile': 'Mobile',
    'tutorial.dMove': 'Move',
    'tutorial.dJump': 'Jump',
    'tutorial.dAim': 'Aim — the bow follows the cursor.',
    'tutorial.dShoot': 'Hold to charge, release to shoot. The longer you hold, the farther the arrow flies.',
    'tutorial.dFlag': 'Pick up or drop the flag.',
    'tutorial.mMove': 'Left joystick: move. Push up to jump.',
    'tutorial.mAim': 'Right joystick: aim and charge. The bow follows where you push. Hold to charge — release to shoot.',
    'tutorial.mFlag': 'Flag button: pick up or drop.',
    'tutorial.tip': 'Tip: in Settings you can switch the aim to <strong>Pull-back</strong> — drag the joystick away from where you want to shoot, like drawing a bowstring.',
    'tutorial.gotIt': 'Got it',
    'tutorial.never': "Don't show again",
    'settings.skin': 'Face',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',
    'settings.close': 'CLOSE',

    'skin.smile': 'Smile',
    'skin.neutral': 'Neutral',
    'skin.sad': 'Sad',
    'skin.surprised': 'Surprised',
    'skin.cool': 'Cool',
    'skin.angry': 'Angry',

    'skinPicker.eyebrow': '◣ Face',
    'skinPicker.title': 'CHOOSE A FACE',

    'createRoom.eyebrow': '◣ Create room',
    'createRoom.title': 'CREATE ROOM',
    'createRoom.name': 'Room name',
    'createRoom.namePlaceholder': 'Optional…',
    'createRoom.mode': 'Mode',
    'createRoom.modeComingSoon': 'More soon',
    'createRoom.map': 'Map',
    'createRoom.maxPlayers': 'Max players',
    'createRoom.maxPoints': 'Points to win',
    'createRoom.submit': 'Create room',

    'mode.ctf': 'Capture the flag',
    'mode.dm': 'Deathmatch',

    'map.default': 'Classic',
    'map.open': 'Open arena',
    'map.stacks': 'Stacks',
    'map.twinRaise': 'Twin Raise',
    'map.tunnels': 'Tunnels',
    'map.ravine': 'Bridge Ravine',
    'map.islands': 'Sky Islands',

    'mapPicker.eyebrow': '◣ Map',
    'mapPicker.title': 'CHOOSE A MAP',
    'mapPicker.back': 'Back',

    'matchEnd.mapPick': '◣ Map',

    'log.join': 'joined the room',
    'log.leave': 'left the room',
    'log.joinTeam': 'joined',
    'log.capture': 'captured the flag',
    'log.matchWins': 'wins the match',
    'log.matchTie': 'Match ended in a tie',
    'log.mapChanged': 'changed map to',

    'capture.banner': 'captured the flag',

    'chat.placeholder': 'Press Enter to send · Esc to cancel',
    'log.matchReset': 'New match starting',

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
    'matchEnd.rematch': '◣ Play again',
    'matchEnd.rematchHint': 'Pick a team and press Play to jump back in',
    'matchEnd.leave': 'Leave room',
    'matchEnd.play': 'Play',

    'death.title': 'YOU DIED',
    'death.respawnIn': 'Respawning in',

    'reconnect.title': 'RECONNECTING',
    'reconnect.sub': 'Hold tight — restoring connection…',

    'hud.watching': 'watching',
    'hud.noSpectators': 'no spectators',
  },
  es: {
    'menu.eyebrow': '◣ Un brawler de arena minimalista',
    'menu.tagline': 'Hasta cuatro cajas. Una línea. La última en pie gana.',
    'menu.findGame': 'Buscar partida',
    'menu.createGame': 'Crear partida',
    'rotate.title': 'Gira tu dispositivo',
    'rotate.sub': 'Boxfury se juega mejor en horizontal.',
    'menu.settings': 'Ajustes',
    'menu.solo': 'Un jugador',
    'menu.test': 'Prueba rápida (jade)',
    'solo.eyebrow': '◣ Un jugador',
    'solo.title': 'ELIGE UN MODO',
    'solo.story': 'Historia',
    'solo.lockedSoon': 'Próximamente',
    'solo.bee': 'Bee Wars',
    'solo.beeSub': 'Defiende del enjambre',
    'menu.howToPlay': '◣ Cómo jugar',
    'menu.arenaCaption': 'Captura la bandera · hasta 8 jugadores',
    'controls.shootShort': 'Mantén para cargar, suelta para disparar',
    'controls.crouch': 'Agacharse',
    'controls.aim': 'Apuntar (el arco sigue al cursor)',
    'menu.arena': 'Arena · 1440 × 900',
    'menu.maxPlayers': 'Máx 4 jugadores',

    'settings.eyebrow': '◣ Ajustes',
    'settings.title': 'AJUSTES',
    'settings.username': 'Nombre',
    'settings.usernamePlaceholder': 'Elige un nombre…',
    'settings.language': 'Idioma',
    'settings.movement': 'Teclas de movimiento',
    'keys.arrows': 'Flechas',
    'keys.wasd': 'WASD',
    'keys.both': 'Ambas',
    'settings.aim': 'Apuntado (táctil)',
    'aim.pullBack': 'Tirar atrás',
    'aim.direct': 'Directo',
    'settings.quality': 'Calidad visual',
    'quality.auto': 'Auto',
    'quality.high': 'Alta',
    'quality.medium': 'Media',
    'quality.low': 'Baja',
    'tutorial.eyebrow': '◣ Cómo jugar',
    'tutorial.title': 'INICIO RÁPIDO',
    'tutorial.desktop': 'Escritorio',
    'tutorial.mobile': 'Móvil',
    'tutorial.dMove': 'Moverse',
    'tutorial.dJump': 'Saltar',
    'tutorial.dAim': 'Apuntar — el arco sigue al cursor.',
    'tutorial.dShoot': 'Mantén para cargar, suelta para disparar. Cuanto más mantengas, más lejos llega la flecha.',
    'tutorial.dFlag': 'Recoger o soltar la bandera.',
    'tutorial.mMove': 'Joystick izquierdo: moverse. Empújalo hacia arriba para saltar.',
    'tutorial.mAim': 'Joystick derecho: apuntar y cargar. El arco sigue hacia donde empujes. Mantén para cargar — suelta para disparar.',
    'tutorial.mFlag': 'Botón de bandera: recoger o soltar.',
    'tutorial.tip': 'Tip: en Ajustes puedes cambiar el apuntado a <strong>Tirar atrás</strong> — arrastra el joystick en sentido contrario al que quieres disparar, como tensar una cuerda.',
    'tutorial.gotIt': 'Entendido',
    'tutorial.never': 'No mostrar más',
    'settings.skin': 'Cara',
    'settings.save': 'Guardar',
    'settings.cancel': 'Cancelar',
    'settings.close': 'CERRAR',

    'skin.smile': 'Sonrisa',
    'skin.neutral': 'Neutra',
    'skin.sad': 'Triste',
    'skin.surprised': 'Sorpresa',
    'skin.cool': 'Cool',
    'skin.angry': 'Enojo',

    'skinPicker.eyebrow': '◣ Cara',
    'skinPicker.title': 'ELIGE UNA CARA',

    'createRoom.eyebrow': '◣ Crear sala',
    'createRoom.title': 'CREAR SALA',
    'createRoom.name': 'Nombre de sala',
    'createRoom.namePlaceholder': 'Opcional…',
    'createRoom.mode': 'Modo',
    'createRoom.modeComingSoon': 'Más pronto',
    'createRoom.map': 'Mapa',
    'createRoom.maxPlayers': 'Jugadores máx.',
    'createRoom.maxPoints': 'Puntos para ganar',
    'createRoom.submit': 'Crear sala',

    'mode.ctf': 'Captura la bandera',
    'mode.dm': 'Combate a muerte',

    'map.default': 'Clásico',
    'map.open': 'Arena abierta',
    'map.stacks': 'Plataformas',
    'map.twinRaise': 'Cumbre gemela',
    'map.tunnels': 'Túneles',
    'map.ravine': 'Puentes',
    'map.islands': 'Islas flotantes',

    'mapPicker.eyebrow': '◣ Mapa',
    'mapPicker.title': 'ELIGE UN MAPA',
    'mapPicker.back': 'Volver',

    'matchEnd.mapPick': '◣ Mapa',

    'log.join': 'entró a la sala',
    'log.leave': 'salió de la sala',
    'log.joinTeam': 'se unió a',
    'log.capture': 'capturó la bandera',
    'log.matchWins': 'gana la partida',
    'log.matchTie': 'La partida terminó en empate',
    'log.mapChanged': 'cambió el mapa a',

    'capture.banner': 'capturó la bandera',

    'chat.placeholder': 'Enter para enviar · Esc para cancelar',
    'log.matchReset': 'Nueva partida iniciando',

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
    'matchEnd.rematch': '◣ Jugar de nuevo',
    'matchEnd.rematchHint': 'Elige un equipo y presiona Jugar para volver a entrar',
    'matchEnd.leave': 'Salir de la sala',
    'matchEnd.play': 'Jugar',

    'death.title': 'HAS MUERTO',
    'death.respawnIn': 'Reapareciendo en',

    'reconnect.title': 'RECONECTANDO',
    'reconnect.sub': 'Un momento — restaurando conexión…',

    'hud.watching': 'mirando',
    'hud.noSpectators': 'sin espectadores',
  },
};

export function getLocale() {
  const v = localStorage.getItem(STORAGE_KEY);
  return TRANSLATIONS[v] ? v : 'es';
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
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (key) el.innerHTML = t(key);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute('placeholder', t(key));
  });
}
