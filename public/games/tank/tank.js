//Untuk tank battle v2

(function () {
  console.log("Tank Battle V2 Running");

  const gameSocket = window.socket;

  if (!gameSocket) {
    console.error("Socket global tidak ada");
    return;
  }

  const startData = window.currentGameStartData || {};
  const matchId = startData.matchId || "session-default";
  const mapId = startData.mapId || "crossfire";
  const STORAGE_KEY = `party_console_tank_v3:${matchId}:${mapId}`;

  const container = document.getElementById("gameContainer");

  if (!container) {
    console.error("gameContainer tidak ditemukan");
    return;
  }

  container.innerHTML = "";

  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1000;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  ctx.textBaseline = "middle";
  ctx.imageSmoothingEnabled = true;

  const WORLD_WIDTH = 1800;
  const WORLD_HEIGHT = 1000;
  const HUD_HEIGHT = 120;
  const MAX_HP = 10;
  const MAX_DEATHS = 3;
  const MAX_POWERUPS = 2;
  const RESPAWN_DELAY = 2500;

  const POWERUP_TYPES = [
    "shield",
    "confusing",
    "triple",
    "speed",
    "damage",
    "heal",
    "meteor",
    "cruise",
    "circle"
  ];

  const POWERUP_ICONS = {
    shield: "🛡",
    confusing: "🌀",
    triple: "🔱",
    speed: "⚡",
    damage: "💥",
    heal: "❤",
    meteor: "☄",
    cruise: "🚀",
    circle: "◉"
  };

  const POWERUP_LABELS = {
    shield: "Shield",
    confusing: "Confusing",
    triple: "Triple Bullet",
    speed: "Speed",
    damage: "Damage",
    heal: "Heal",
    meteor: "Meteor Shoot",
    cruise: "Cruise Missile",
    circle: "Circle Shoot"
  };

  const PLAYER_COLORS = [
    "#ff4d4d",
    "#4da3ff",
    "#48d46d",
    "#ffd24d"
  ];

  const BOT_COLORS = [
    "#aaaaaa",
    "#ff8c42",
    "#9b59b6",
    "#2ecc71"
  ];

  const BOT_PROFILES = [
    {
      name: "rookie",
      reactionMs: [650, 1100],
      aimError: [0.18, 0.34],
      turnRate: 0.032,
      fireCooldown: [920, 1380],
      strafeChance: 0.34,
      chaseBias: 0.52,
      retreatBias: 0.54,
      courage: 0.48
    },
    {
      name: "regular",
      reactionMs: [380, 820],
      aimError: [0.12, 0.24],
      turnRate: 0.044,
      fireCooldown: [680, 1040],
      strafeChance: 0.56,
      chaseBias: 0.66,
      retreatBias: 0.34,
      courage: 0.58
    },
    {
      name: "aggressive",
      reactionMs: [280, 600],
      aimError: [0.08, 0.17],
      turnRate: 0.052,
      fireCooldown: [560, 900],
      strafeChance: 0.68,
      chaseBias: 0.78,
      retreatBias: 0.26,
      courage: 0.70
    },
    {
      name: "tactical",
      reactionMs: [300, 680],
      aimError: [0.07, 0.14],
      turnRate: 0.05,
      fireCooldown: [620, 980],
      strafeChance: 0.82,
      chaseBias: 0.62,
      retreatBias: 0.30,
      courage: 0.64
    }
  ];

  const CURRENT_MAP = resolveMap(mapId);
  const MAP_NAME = CURRENT_MAP.name;
  const MAP_OBSTACLES = CURRENT_MAP.obstacles || [];
  const MAP_SPAWNS = CURRENT_MAP.spawns || [];

  let cleanupCalled = false;
  let running = false;
  let matchOver = false;
  let winnerInfo = null;
  let winnerEmitted = false;

  let frameId = null;
  let rosterPollTimer = null;
  let saveTimer = null;
  let nextPowerupSpawnAt = Date.now() + randomRange(6000, 10000);
  let lastFrameAt = performance.now();

  let humanTanks = new Map();
  let botTanks = new Map();
  let projectiles = [];
  let powerups = [];
  let latestInputs = new Map();

  let currentBotCount = Math.max(0, Number(startData.botCount || 0));

  //Untuk cleanup game
  window.currentGameCleanup = cleanupGame;

  //Untuk event game update dari screen
  const rosterUpdateHandler = (event) => {
    const data = event.detail;
    if (!data || data.gameId !== "tank") return;

    syncRoster(Array.isArray(data.players) ? data.players : []);
    currentBotCount = Math.max(0, Number(data.botCount || currentBotCount || 0));
  };

  //Untuk finish game dari screen
  const finishHandler = (event) => {
    const data = event.detail || {};
    if (data.matchId && data.matchId !== matchId) return;

    matchOver = true;
    winnerInfo = {
      winnerId: data.winnerId || null,
      winnerName: data.winnerName || null,
      reason: data.reason || "winner"
    };
    saveSnapshot();
  };

  //Untuk end game dari screen
  const endHandler = (event) => {
    const data = event.detail || {};
    if (data.matchId && data.matchId !== matchId) return;
    cleanupGame();
  };

  //Untuk util
  function randomRange(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function normalizeVector(x, y) {
    const len = Math.hypot(x, y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
  }

  function wrapAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function turnTowards(current, target, maxStep) {
    const diff = wrapAngle(target - current);
    const step = clamp(diff, -maxStep, maxStep);
    return current + step;
  }

  function pointInRect(x, y, rect) {
    return (
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h
    );
  }

  function circleRectCollision(cx, cy, radius, rect) {
    const closestX = clamp(cx, rect.x, rect.x + rect.w);
    const closestY = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  function orientation(ax, ay, bx, by, cx, cy) {
    const val = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
    if (Math.abs(val) < 0.00001) return 0;
    return val > 0 ? 1 : 2;
  }

  function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const o1 = orientation(ax, ay, bx, by, cx, cy);
    const o2 = orientation(ax, ay, bx, by, dx, dy);
    const o3 = orientation(cx, cy, dx, dy, ax, ay);
    const o4 = orientation(cx, cy, dx, dy, bx, by);
    return o1 !== o2 && o3 !== o4;
  }

  function lineIntersectsRect(x1, y1, x2, y2, rect) {
    if (pointInRect(x1, y1, rect) || pointInRect(x2, y2, rect)) {
      return true;
    }

    const left = rect.x;
    const right = rect.x + rect.w;
    const top = rect.y;
    const bottom = rect.y + rect.h;

    return (
      segmentsIntersect(x1, y1, x2, y2, left, top, right, top) ||
      segmentsIntersect(x1, y1, x2, y2, right, top, right, bottom) ||
      segmentsIntersect(x1, y1, x2, y2, right, bottom, left, bottom) ||
      segmentsIntersect(x1, y1, x2, y2, left, bottom, left, top)
    );
  }

  function hasLineOfSight(ax, ay, bx, by) {
    return !MAP_OBSTACLES.some((rect) => lineIntersectsRect(ax, ay, bx, by, rect));
  }

  function bulletHitsTank(projectile, tank) {
    return distance(projectile.x, projectile.y, tank.x, tank.y) <= (projectile.radius || 4) + 16;
  }

  function getAllTanks() {
    return [
      ...humanTanks.values(),
      ...botTanks.values()
    ];
  }

  function getAliveTanks() {
    return getAllTanks().filter((tank) => tank.alive && !tank.spectate);
  }

  function getContenders() {
    return getAllTanks().filter((tank) => !tank.spectate);
  }

  function findTankById(id) {
    if (humanTanks.has(id)) return humanTanks.get(id);
    if (botTanks.has(id)) return botTanks.get(id);
    return null;
  }

  function findSpawnPoint() {
    const candidates = (MAP_SPAWNS && MAP_SPAWNS.length > 0)
      ? [...MAP_SPAWNS]
      : [
          { x: 160, y: 160 },
          { x: 1640, y: 160 },
          { x: 160, y: 840 },
          { x: 1640, y: 840 },
          { x: 900, y: 160 },
          { x: 900, y: 840 }
        ];

    const shuffled = candidates.sort(() => Math.random() - 0.5);

    for (const point of shuffled) {
      const tooClose = getAliveTanks().some(
        (tank) => distance(point.x, point.y, tank.x, tank.y) < 140
      );

      const blocked = MAP_OBSTACLES.some((rect) =>
        pointInRect(point.x, point.y, rect)
      );

      if (!tooClose && !blocked) {
        return { x: point.x, y: point.y };
      }
    }

    return {
      x: randomRange(220, WORLD_WIDTH - 220),
      y: randomRange(HUD_HEIGHT + 80, WORLD_HEIGHT - 100)
    };
  }

function cloneTank(tank) {
  return {
    id: tank.id,
    name: tank.name,
    isBot: tank.isBot,
    isHost: tank.isHost,
    color: tank.color,
    x: tank.x,
    y: tank.y,
    angle: tank.angle,
    hp: tank.hp,
    deaths: tank.deaths,
    score: tank.score,
    alive: tank.alive,
    spectate: tank.spectate,
    respawnAt: tank.respawnAt,
    invulnerableUntil: tank.invulnerableUntil,
    shieldUntil: tank.shieldUntil,
    confusedUntil: tank.confusedUntil,
    speedUntil: tank.speedUntil,
    damageUntil: tank.damageUntil,
    tripleUntil: tank.tripleUntil,
    meteorUntil: tank.meteorUntil,
    cruiseUntil: tank.cruiseUntil,
    cruiseCharges: tank.cruiseCharges,
    circleUntil: tank.circleUntil,
    stunUntil: tank.stunUntil,
    lastShotAt: tank.lastShotAt,
    shootQueueSeen: tank.shootQueueSeen || 0,
    pendingShots: tank.pendingShots || 0,
    brain: tank.brain ? { ...tank.brain } : null
  };
}

  function loadSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || parsed.matchId !== matchId || parsed.mapId !== mapId) return null;

      return parsed;
    } catch (err) {
      console.warn("Snapshot rusak:", err);
      return null;
    }
  }

  function clearSnapshot() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {}
  }

  function saveSnapshot() {
    if (cleanupCalled) return;

    try {
      const snapshot = {
        gameId: "tank",
        matchId: matchId,
        mapId: mapId,
        nextPowerupSpawnAt: nextPowerupSpawnAt,
        matchOver: matchOver,
        winnerInfo: winnerInfo,
        winnerEmitted: winnerEmitted,
        currentBotCount: currentBotCount,
        tanks: {
          humans: Array.from(humanTanks.values()).map((t) => cloneTank(t)),
          bots: Array.from(botTanks.values()).map((t) => cloneTank(t))
        },
        projectiles: projectiles.map((p) => ({ ...p })),
        powerups: powerups.map((p) => ({ ...p }))
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (err) {
      console.warn("Simpan snapshot gagal:", err);
    }
  }

function createTankFromHuman(player, index, existing) {
  const spawn = existing ? { x: existing.x, y: existing.y } : findSpawnPoint();

  return {
    id: player.id,
    name: player.name,
    isBot: false,
    isHost: !!player.isHost,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    x: existing ? existing.x : spawn.x,
    y: existing ? existing.y : spawn.y,
    angle: existing ? existing.angle : Math.PI / 2,
    hp: existing ? existing.hp : MAX_HP,
    deaths: existing ? existing.deaths : 0,
    score: existing ? existing.score : 0,
    alive: existing ? existing.alive : true,
    spectate: existing ? existing.spectate : false,
    respawnAt: existing ? existing.respawnAt : 0,
    invulnerableUntil: existing ? existing.invulnerableUntil : 0,
    shieldUntil: existing ? existing.shieldUntil : 0,
    confusedUntil: existing ? existing.confusedUntil : 0,
    speedUntil: existing ? existing.speedUntil : 0,
    damageUntil: existing ? existing.damageUntil : 0,
    tripleUntil: existing ? existing.tripleUntil : 0,
    meteorUntil: existing ? existing.meteorUntil : 0,
    cruiseUntil: existing ? existing.cruiseUntil : 0,
    cruiseCharges: existing ? existing.cruiseCharges : 0,
    circleUntil: existing ? existing.circleUntil : 0,
    stunUntil: existing ? existing.stunUntil : 0,
    lastShotAt: existing ? existing.lastShotAt : 0,
    shootQueueSeen: existing ? existing.shootQueueSeen || 0 : 0,
    pendingShots: existing ? existing.pendingShots || 0 : 0,
    brain: null
  };
}

  function createBotBrain(index, existing) {
    const profileIndex = index % BOT_PROFILES.length;
    const profile = BOT_PROFILES[profileIndex];

    return {
      profileIndex,
      profileName: profile.name,
      nextThinkAt: existing?.brain?.nextThinkAt || (Date.now() + randomRange(profile.reactionMs[0], profile.reactionMs[1])),
      nextShotAt: existing?.brain?.nextShotAt || (Date.now() + randomRange(profile.fireCooldown[0], profile.fireCooldown[1])),
      targetId: existing?.brain?.targetId || null,
      moveMode: existing?.brain?.moveMode || "wander",
      aimBias: typeof existing?.brain?.aimBias === "number" ? existing.brain.aimBias : randomRange(-profile.aimError[1], profile.aimError[1]),
      strafeDir: typeof existing?.brain?.strafeDir === "number" ? existing.brain.strafeDir : (Math.random() < 0.5 ? -1 : 1),
      wanderAngle: typeof existing?.brain?.wanderAngle === "number" ? existing.brain.wanderAngle : randomRange(0, Math.PI * 2),
      patience: typeof existing?.brain?.patience === "number" ? existing.brain.patience : randomRange(0.4, 1),
      moveSeed: typeof existing?.brain?.moveSeed === "number" ? existing.brain.moveSeed : randomRange(0, 1000)
    };
  }

  function createTankFromBot(index, existing) {
  const spawn = existing ? { x: existing.x, y: existing.y } : findSpawnPoint();

  return {
    id: `bot-${index + 1}`,
    name: `Bot ${index + 1}`,
    isBot: true,
    isHost: false,
    color: BOT_COLORS[index % BOT_COLORS.length],
    x: existing ? existing.x : spawn.x,
    y: existing ? existing.y : spawn.y,
    angle: existing ? existing.angle : Math.PI / 2,
    hp: existing ? existing.hp : MAX_HP,
    deaths: existing ? existing.deaths : 0,
    score: existing ? existing.score : 0,
    alive: existing ? existing.alive : true,
    spectate: existing ? existing.spectate : false,
    respawnAt: existing ? existing.respawnAt : 0,
    invulnerableUntil: existing ? existing.invulnerableUntil : 0,
    shieldUntil: existing ? existing.shieldUntil : 0,
    confusedUntil: existing ? existing.confusedUntil : 0,
    speedUntil: existing ? existing.speedUntil : 0,
    damageUntil: existing ? existing.damageUntil : 0,
    tripleUntil: existing ? existing.tripleUntil : 0,
    meteorUntil: existing ? existing.meteorUntil : 0,
    cruiseUntil: existing ? existing.cruiseUntil : 0,
    cruiseCharges: existing ? existing.cruiseCharges : 0,
    circleUntil: existing ? existing.circleUntil : 0,
    stunUntil: existing ? existing.stunUntil : 0,
    lastShotAt: existing ? existing.lastShotAt : 0,
    shootQueueSeen: existing ? existing.shootQueueSeen || 0 : 0,
    pendingShots: existing ? existing.pendingShots || 0 : 0,
    brain: createBotBrain(index, existing)
  };
}

  function syncRoster(players) {
    const roster = Array.isArray(players) ? players.slice(0, 4) : [];
    const nextHumanIds = new Set();

    roster.forEach((player, index) => {
      nextHumanIds.add(player.id);

      const existing = humanTanks.get(player.id);
      const tank = createTankFromHuman(player, index, existing);
      humanTanks.set(player.id, tank);
    });

    for (const id of [...humanTanks.keys()]) {
      if (!nextHumanIds.has(id)) {
        humanTanks.delete(id);
        latestInputs.delete(id);
      }
    }

    const targetBotCount = Math.max(0, Number(currentBotCount || 0));

    for (const id of [...botTanks.keys()]) {
      const botIndex = Number(id.replace("bot-", "")) - 1;
      if (botIndex >= targetBotCount) {
        botTanks.delete(id);
      }
    }

    for (let i = 0; i < targetBotCount; i++) {
      const botId = `bot-${i + 1}`;
      const existing = botTanks.get(botId);
      const bot = createTankFromBot(i, existing);
      botTanks.set(botId, bot);
    }

    roster.forEach((player) => {
      const tank = humanTanks.get(player.id);
      if (tank) {
        tank.name = player.name;
        tank.isHost = !!player.isHost;
      }
    });
  }

  function restoreSnapshot(snapshot, rosterPlayers) {
    const humanList = Array.isArray(snapshot?.tanks?.humans) ? snapshot.tanks.humans : [];
    const botList = Array.isArray(snapshot?.tanks?.bots) ? snapshot.tanks.bots : [];

    humanTanks = new Map(humanList.map((t) => [t.id, { ...t }]));
    botTanks = new Map(botList.map((t) => [t.id, { ...t }]));
    projectiles = Array.isArray(snapshot.projectiles) ? snapshot.projectiles.map((p) => ({ ...p })) : [];
    powerups = Array.isArray(snapshot.powerups) ? snapshot.powerups.map((p) => ({ ...p })) : [];

    nextPowerupSpawnAt = Number(snapshot.nextPowerupSpawnAt) || (Date.now() + randomRange(6000, 10000));
    currentBotCount = Number(snapshot.currentBotCount || currentBotCount || 0);

    matchOver = !!snapshot.matchOver;
    winnerInfo = snapshot.winnerInfo || null;
    winnerEmitted = !!snapshot.winnerEmitted;

    syncRoster(rosterPlayers);

    for (const player of rosterPlayers) {
      const tank = humanTanks.get(player.id);
      if (tank) {
        tank.name = player.name;
        tank.isHost = !!player.isHost;
      }
    }
  }

  function createFreshState(rosterPlayers) {
    humanTanks = new Map();
    botTanks = new Map();
    projectiles = [];
    powerups = [];
    matchOver = false;
    winnerInfo = null;
    winnerEmitted = false;
    nextPowerupSpawnAt = Date.now() + randomRange(6000, 10000);

    syncRoster(rosterPlayers);
  }

  function getEffectIcons(tank, now) {
    const icons = [];
    if (now < tank.shieldUntil) icons.push("🛡");
    if (now < tank.confusedUntil) icons.push("🌀");
    if (now < tank.tripleUntil) icons.push("🔱");
    if (now < tank.speedUntil) icons.push("⚡");
    if (now < tank.damageUntil) icons.push("💥");
    if (now < tank.meteorUntil) icons.push("☄");
    if (now < tank.cruiseUntil) icons.push("🚀");
    if (now < tank.circleUntil) icons.push("◉");
    if (now < tank.stunUntil) icons.push("⏸");
    return icons;
  }

  function getBaseSpeed(tank, now) {
    let speed = 3.05;

    if (tank.isBot) speed *= 0.95;
    if (now < tank.speedUntil) speed *= 1.5;
    if (now < tank.circleUntil) speed *= 0.5;

    return speed;
  }

  function getBulletDamage(tank, now) {
    let damage = randomInt(1, 4);

    if (now < tank.damageUntil) {
      damage += randomInt(1, 2);
    }

    return damage;
  }

  function getFireCooldown(tank, now) {
    if (now < tank.circleUntil) return 210;
    if (now < tank.tripleUntil) return 230;
    if (now < tank.speedUntil) return 250;
    return 290;
  }

  function applyStun(tank, ms) {
    const now = Date.now();
    tank.stunUntil = Math.max(tank.stunUntil || 0, now + ms);
  }

  function applyPowerupEffect(tank, type) {
    const now = Date.now();

    if (type === "shield") {
      tank.shieldUntil = Math.max(tank.shieldUntil || 0, now + 5000);
      return;
    }

    if (type === "confusing") {
      getAllTanks().forEach((other) => {
        if (other.id === tank.id) return;
        if (other.spectate) return;
        other.confusedUntil = Math.max(other.confusedUntil || 0, now + 3000);
      });
      return;
    }

    if (type === "triple") {
      tank.tripleUntil = Math.max(tank.tripleUntil || 0, now + 5000);
      return;
    }

    if (type === "speed") {
      tank.speedUntil = Math.max(tank.speedUntil || 0, now + 6000);
      return;
    }

    if (type === "damage") {
      tank.damageUntil = Math.max(tank.damageUntil || 0, now + 6000);
      return;
    }

    if (type === "heal") {
      tank.hp = clamp((tank.hp || MAX_HP) + 3, 0, MAX_HP);
      return;
    }

    if (type === "meteor") {
      tank.meteorUntil = Math.max(tank.meteorUntil || 0, now + 3000);
      return;
    }

    if (type === "cruise") {
      tank.cruiseUntil = Math.max(tank.cruiseUntil || 0, now + 10000);
      tank.cruiseCharges = 2;
      return;
    }

    if (type === "circle") {
      tank.circleUntil = Math.max(tank.circleUntil || 0, now + 3000);
      return;
    }
  }

  function spawnPowerup() {
    if (powerups.length >= MAX_POWERUPS) return;
    if (matchOver) return;

    const now = Date.now();
    const type = POWERUP_TYPES[randomInt(0, POWERUP_TYPES.length - 1)];

    for (let i = 0; i < 24; i++) {
      const x = randomRange(120, WORLD_WIDTH - 120);
      const y = randomRange(HUD_HEIGHT + 70, WORLD_HEIGHT - 90);

      const safeFromObstacles = !MAP_OBSTACLES.some((rect) =>
        pointInRect(x, y, rect)
      );

      const safeFromTanks = getAliveTanks().every(
        (tank) => distance(x, y, tank.x, tank.y) > 120
      );

      if (safeFromObstacles && safeFromTanks) {
        powerups.push({
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: type,
          x: x,
          y: y,
          createdAt: now,
          expiresAt: now + randomRange(4000, 6000)
        });
        break;
      }
    }

    nextPowerupSpawnAt = now + randomRange(10000, 15000);
  }

  function cleanupExpiredPowerups(now) {
    powerups = powerups.filter((powerup) => powerup.expiresAt > now);
  }

  function pickupPowerups() {
    const aliveTanks = getAliveTanks();

    for (let i = powerups.length - 1; i >= 0; i--) {
      const powerup = powerups[i];

      for (const tank of aliveTanks) {
        if (distance(powerup.x, powerup.y, tank.x, tank.y) <= 28) {
          applyPowerupEffect(tank, powerup.type);
          powerups.splice(i, 1);
          break;
        }
      }
    }
  }

  function applyDamage(target, damage, attackerId, stunMs = 0) {
    if (!target || target.spectate || matchOver) return;

    const now = Date.now();

    if (now < (target.invulnerableUntil || 0)) return;
    if (now < (target.shieldUntil || 0)) return;

    target.hp -= damage;

    if (stunMs > 0) {
      applyStun(target, stunMs);
    }

    if (target.hp <= 0) {
      killTank(target, attackerId);
    }
  }

  function killTank(victim, killerId) {
    if (!victim || victim.spectate || matchOver) return;

    victim.deaths += 1;
    victim.hp = 0;
    victim.alive = false;

    if (killerId) {
      const killer = findTankById(killerId);
      if (killer && killer.id !== victim.id) {
        killer.score += 1;
      }
    }

    if (victim.deaths >= MAX_DEATHS) {
      victim.spectate = true;
      victim.respawnAt = 0;
      return;
    }

    victim.respawnAt = Date.now() + RESPAWN_DELAY;
  }

  function respawnTank(tank) {
    if (!tank || tank.spectate || matchOver) return;

    const spawn = findSpawnPoint();

    tank.x = spawn.x;
    tank.y = spawn.y;
    tank.angle = Math.PI / 2;
    tank.hp = MAX_HP;
    tank.alive = true;
    tank.respawnAt = 0;
    tank.invulnerableUntil = Date.now() + 1500;
    tank.lastShotAt = Date.now();

    if (tank.isBot && tank.brain) {
      const profile = BOT_PROFILES[tank.brain.profileIndex % BOT_PROFILES.length];
      tank.brain.nextThinkAt = Date.now() + randomRange(profile.reactionMs[0], profile.reactionMs[1]);
      tank.brain.nextShotAt = Date.now() + randomRange(profile.fireCooldown[0], profile.fireCooldown[1]);
      tank.brain.targetId = null;
    }
  }

  function fireNormalBullets(tank, now, angleBase) {
    const damage = getBulletDamage(tank, now);
    const radius = now < tank.meteorUntil ? 20 : 4;
    const speed = now < tank.circleUntil ? 14.5 : 12.0;
    const offsets = now < tank.tripleUntil ? [-0.18, 0, 0.18] : [0];

    offsets.forEach((offset) => {
      projectiles.push({
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: "bullet",
        ownerId: tank.id,
        x: tank.x + Math.cos(angleBase + offset) * 26,
        y: tank.y + Math.sin(angleBase + offset) * 26,
        angle: angleBase + offset,
        speed: speed,
        radius: radius,
        damage: damage,
        life: 0,
        expiresAt: now + 5000
      });
    });
  }

  function fireCircleBullets(tank, now) {
    const damage = getBulletDamage(tank, now);
    const speed = 14.5;
    const radius = now < tank.meteorUntil ? 20 : 4;
    const count = 12;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      projectiles.push({
        id: `c-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        type: "bullet",
        ownerId: tank.id,
        x: tank.x + Math.cos(angle) * 16,
        y: tank.y + Math.sin(angle) * 16,
        angle: angle,
        speed: speed,
        radius: radius,
        damage: damage,
        life: 0,
        expiresAt: now + 5000
      });
    }
  }

  function fireCruiseMissile(tank, now, angleBase) {
    if (tank.cruiseCharges <= 0 || now > tank.cruiseUntil) return false;

    const enemies = getAliveTanks().filter((t) => t.id !== tank.id);
    const nearest = chooseNearestTank(tank, enemies);

    tank.cruiseCharges -= 1;

    projectiles.push({
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "missile",
      ownerId: tank.id,
      x: tank.x + Math.cos(angleBase) * 24,
      y: tank.y + Math.sin(angleBase) * 24,
      angle: angleBase,
      speed: 8.4,
      radius: 11,
      damage: randomInt(5, 7),
      life: 0,
      expiresAt: now + 4000,
      targetId: nearest ? nearest.id : null,
      targetLockUntil: now + 4000,
      turnRate: 0.08,
      stunMs: 1000
    });

    return true;
  }

function fireTank(tank) {
  if (!tank || !tank.alive || tank.spectate || matchOver) return false;

  const now = Date.now();

  if (now < (tank.stunUntil || 0)) return false;

  const cooldown = getFireCooldown(tank, now);
  if (now - (tank.lastShotAt || 0) < cooldown) return false;

  const angleBase = tank.angle;

  if (now < (tank.cruiseUntil || 0) && tank.cruiseCharges > 0) {
    const usedMissile = fireCruiseMissile(tank, now, angleBase);
    if (usedMissile) {
      tank.lastShotAt = now;
      return true;
    }
  }

  if (now < (tank.circleUntil || 0)) {
    fireCircleBullets(tank, now);
    tank.lastShotAt = now;
    return true;
  }

  fireNormalBullets(tank, now, angleBase);
  tank.lastShotAt = now;
  return true;
}

  function updateProjectiles(now, dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      if (p.type === "missile") {
        const owner = findTankById(p.ownerId);

        let target = p.targetId ? findTankById(p.targetId) : null;
        if (!target || !target.alive || target.spectate) {
          const enemies = getAliveTanks().filter((t) => t.id !== p.ownerId);
          const nearest = chooseNearestTank(owner || p, enemies);
          target = nearest;
          p.targetId = target ? target.id : null;
        }

        if (target) {
          const desired = Math.atan2(target.y - p.y, target.x - p.x);
          p.angle = turnTowards(p.angle, desired, p.turnRate || 0.08);
        }

        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.life += dt;

        if (
          p.x < 0 ||
          p.x > WORLD_WIDTH ||
          p.y < HUD_HEIGHT ||
          p.y > WORLD_HEIGHT ||
          p.life > 4000
        ) {
          projectiles.splice(i, 1);
          continue;
        }

        const hitObstacle = MAP_OBSTACLES.some((rect) =>
          pointInRect(p.x, p.y, rect)
        );

        if (hitObstacle) {
          projectiles.splice(i, 1);
          continue;
        }

        let hit = false;

        for (const tank of getAllTanks()) {
          if (tank.id === p.ownerId) continue;
          if (!tank.alive || tank.spectate) continue;

          if (bulletHitsTank(p, tank)) {
            applyDamage(tank, p.damage, p.ownerId, p.stunMs || 1000);
            projectiles.splice(i, 1);
            hit = true;
            break;
          }
        }

        if (hit) continue;
        continue;
      }

      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life += dt * 16.67;

      if (
        p.x < 0 ||
        p.x > WORLD_WIDTH ||
        p.y < HUD_HEIGHT ||
        p.y > WORLD_HEIGHT ||
        p.life > 450
      ) {
        projectiles.splice(i, 1);
        continue;
      }

      const hitObstacle = MAP_OBSTACLES.some((rect) =>
        pointInRect(p.x, p.y, rect)
      );

      if (hitObstacle) {
        projectiles.splice(i, 1);
        continue;
      }

      let hit = false;

      for (const tank of getAllTanks()) {
        if (tank.id === p.ownerId) continue;
        if (!tank.alive || tank.spectate) continue;

        if (bulletHitsTank(p, tank)) {
          applyDamage(tank, p.damage, p.ownerId);
          projectiles.splice(i, 1);
          hit = true;
          break;
        }
      }

      if (hit) continue;
    }
  }

  function chooseNearestTank(source, list) {
    let best = null;
    let bestDistance = Infinity;

    for (const tank of list) {
      const d = distance(source.x, source.y, tank.x, tank.y);
      if (d < bestDistance) {
        best = tank;
        bestDistance = d;
      }
    }

    return best;
  }

  function pickBotTarget(bot) {
    const enemies = getAliveTanks().filter((t) => t.id !== bot.id);
    if (enemies.length === 0) return null;

    const scored = enemies.map((tank) => {
      const d = distance(bot.x, bot.y, tank.x, tank.y);
      const distanceScore = 1 / Math.pow(d + 160, 1.1);
      const hpBias = 0.85 + ((MAX_HP - tank.hp) / MAX_HP) * 0.42;
      const kindBias = tank.isBot ? 1.02 : 0.98;
      const losBias = hasLineOfSight(bot.x, bot.y, tank.x, tank.y) ? 1.14 : 0.8;
      const humanBias = tank.isBot ? 1.0 : 0.95;
      const randomness = randomRange(0.88, 1.18);

      return {
        item: tank,
        weight: distanceScore * hpBias * kindBias * losBias * humanBias * randomness
      };
    });

    const total = scored.reduce((a, b) => a + b.weight, 0);
    let roll = Math.random() * total;

    for (const entry of scored) {
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }

    return scored[0].item;
  }

  function findNearestPowerup(tank, type = null) {
    let best = null;
    let bestDistance = Infinity;

    for (const powerup of powerups) {
      if (type && powerup.type !== type) continue;

      const d = distance(tank.x, tank.y, powerup.x, powerup.y);
      if (d < bestDistance) {
        best = powerup;
        bestDistance = d;
      }
    }

    return best ? { powerup: best, distance: bestDistance } : null;
  }

  function getNearestIncomingProjectile(bot) {
    let best = null;
    let bestDistance = Infinity;

    for (const p of projectiles) {
      if (p.ownerId === bot.id) continue;

      const d = distance(bot.x, bot.y, p.x, p.y);
      if (d < bestDistance) {
        best = p;
        bestDistance = d;
      }
    }

    return best ? { projectile: best, distance: bestDistance } : null;
  }

  function planBot(bot, now) {
    if (!bot.brain) return;

    const profile = BOT_PROFILES[bot.brain.profileIndex % BOT_PROFILES.length];
    const target = pickBotTarget(bot);

    bot.brain.targetId = target ? target.id : null;
    bot.brain.aimBias = randomRange(-profile.aimError[1], profile.aimError[1]);
    bot.brain.strafeDir = Math.random() < 0.5 ? -1 : 1;

    const incoming = getNearestIncomingProjectile(bot);
    const heal = findNearestPowerup(bot, "heal");
    const powerup = findNearestPowerup(bot);

    if (incoming && incoming.distance < 180) {
      bot.brain.moveMode = "evade";
    } else if (bot.hp <= 5 && heal && heal.distance < 420) {
      bot.brain.moveMode = "heal";
    } else if (powerup && powerup.distance < 240 && Math.random() < 0.32) {
      bot.brain.moveMode = "powerup";
    } else if (target) {
      const d = distance(bot.x, bot.y, target.x, target.y);

      if (d > 360) bot.brain.moveMode = "chase";
      else if (d > 170) bot.brain.moveMode = "strafe";
      else bot.brain.moveMode = "retreat";
    } else {
      bot.brain.moveMode = "wander";
    }

    bot.brain.nextThinkAt = now + randomRange(profile.reactionMs[0], profile.reactionMs[1]);
  }

  function updateHumanTank(tank, input, now, dt) {
    if (!tank || !tank.alive || tank.spectate || matchOver) return;
    if (now < (tank.stunUntil || 0)) return;

    let moveX = Number(input?.x) || 0;
    let moveY = Number(input?.y) || 0;

    if (now < (tank.confusedUntil || 0)) {
      moveX = -moveX;
      moveY = -moveY;
    }

    const len = Math.hypot(moveX, moveY);

    if (len > 0.06) {
      const vec = normalizeVector(moveX, moveY);
      tank.angle = Math.atan2(vec.y, vec.x);

      const speed = getBaseSpeed(tank, now);
      moveTank(tank, vec.x * speed, vec.y * speed);
    }
  }

  function updateBotTank(bot, now, dt) {
    if (!bot || !bot.alive || bot.spectate || matchOver) return;
    if (now < (bot.stunUntil || 0)) return;

    if (!bot.brain) {
      bot.brain = createBotBrain(0, null);
    }

    const profile = BOT_PROFILES[bot.brain.profileIndex % BOT_PROFILES.length];

    if (now >= (bot.brain.nextThinkAt || 0)) {
      planBot(bot, now);
    }

    const target = bot.brain.targetId ? findTankById(bot.brain.targetId) : null;

    let desiredX = 0;
    let desiredY = 0;

    const incoming = getNearestIncomingProjectile(bot);
    const heal = findNearestPowerup(bot, "heal");
    const anyPowerup = findNearestPowerup(bot);

    if (bot.brain.moveMode === "evade" && incoming) {
      const away = normalizeVector(
        bot.x - incoming.projectile.x,
        bot.y - incoming.projectile.y
      );
      const side = { x: -away.y * bot.brain.strafeDir, y: away.x * bot.brain.strafeDir };

      desiredX = away.x * 1.2 + side.x * 0.8;
      desiredY = away.y * 1.2 + side.y * 0.8;
    } else if (bot.brain.moveMode === "heal" && heal) {
      desiredX = heal.powerup.x - bot.x;
      desiredY = heal.powerup.y - bot.y;
    } else if (bot.brain.moveMode === "powerup" && anyPowerup) {
      desiredX = anyPowerup.powerup.x - bot.x;
      desiredY = anyPowerup.powerup.y - bot.y;
    } else if (target) {
      const dx = target.x - bot.x;
      const dy = target.y - bot.y;
      const d = distance(bot.x, bot.y, target.x, target.y);
      const dir = normalizeVector(dx, dy);
      const perp = { x: -dir.y, y: dir.x };

      if (bot.brain.moveMode === "chase") {
        desiredX = dir.x * profile.chaseBias;
        desiredY = dir.y * profile.chaseBias;

        if (Math.random() < profile.strafeChance) {
          desiredX += perp.x * bot.brain.strafeDir * 0.45;
          desiredY += perp.y * bot.brain.strafeDir * 0.45;
        }
      } else if (bot.brain.moveMode === "strafe") {
        desiredX = perp.x * bot.brain.strafeDir * 0.92;
        desiredY = perp.y * bot.brain.strafeDir * 0.92;

        if (Math.random() < 0.34) {
          desiredX += dir.x * 0.22;
          desiredY += dir.y * 0.22;
        }
      } else if (bot.brain.moveMode === "retreat") {
        desiredX = -dir.x * profile.retreatBias;
        desiredY = -dir.y * profile.retreatBias;
        desiredX += perp.x * bot.brain.strafeDir * 0.5;
        desiredY += perp.y * bot.brain.strafeDir * 0.5;
      } else {
        desiredX = dir.x * 0.33;
        desiredY = dir.y * 0.33;
      }

      if (Math.random() < 0.017) {
        bot.brain.strafeDir *= -1;
      }

      const baseAim = Math.atan2(dy, dx);
      const wobble = Math.sin(now / 260 + bot.x * 0.008 + bot.y * 0.008) * 0.04;
      const desiredAim = baseAim + (bot.brain.aimBias || 0) + wobble;

      const maxTurn = profile.turnRate * Math.max(0.55, dt / 16.67);
      bot.angle = turnTowards(bot.angle, desiredAim, maxTurn);

      const angleDiff = Math.abs(wrapAngle(desiredAim - bot.angle));

      if (
        d < 760 &&
        angleDiff < 0.24 &&
        hasLineOfSight(bot.x, bot.y, target.x, target.y) &&
        now >= (bot.brain.nextShotAt || 0)
      ) {
        fireTank(bot);
        bot.brain.nextShotAt = now + randomRange(profile.fireCooldown[0], profile.fireCooldown[1]);

        if (Math.random() < 0.2) {
          bot.brain.nextShotAt -= randomRange(40, 120);
        }
      }
    } else {
      bot.brain.wanderAngle += randomRange(-0.022, 0.022);
      desiredX = Math.cos(bot.brain.wanderAngle) * 0.65;
      desiredY = Math.sin(bot.brain.wanderAngle) * 0.65;
    }

    for (const other of getAliveTanks()) {
      if (other.id === bot.id) continue;

      const d = distance(bot.x, bot.y, other.x, other.y);
      if (d < 92) {
        const away = normalizeVector(bot.x - other.x, bot.y - other.y);
        desiredX += away.x * 1.12;
        desiredY += away.y * 1.12;
      }
    }

    if (now < (bot.confusedUntil || 0)) {
      desiredX = -desiredX;
      desiredY = -desiredY;
    }

    const vec = normalizeVector(desiredX, desiredY);
    const speed = getBaseSpeed(bot, now);

    if (Math.hypot(vec.x, vec.y) > 0.03 && bot.brain.moveMode !== "evade") {
      const desiredBodyAngle = Math.atan2(vec.y, vec.x);
      bot.angle = turnTowards(bot.angle, desiredBodyAngle, profile.turnRate * 0.5 * Math.max(0.55, dt / 16.67));
    }

    const oldX = bot.x;
    const oldY = bot.y;

    moveTank(bot, vec.x * speed, vec.y * speed);

    if (bot.x === oldX && bot.y === oldY) {
      bot.brain.strafeDir *= -1;
      bot.brain.wanderAngle += Math.PI / 2;
      const retry = normalizeVector(
        Math.cos(bot.brain.wanderAngle),
        Math.sin(bot.brain.wanderAngle)
      );
      moveTank(bot, retry.x * speed * 0.8, retry.y * speed * 0.8);
    }
  }

  function moveTank(tank, dx, dy) {
    if (!tank || !tank.alive || tank.spectate || matchOver) return;

    let nextX = clamp(tank.x + dx, 16, WORLD_WIDTH - 16);
    let nextY = clamp(tank.y + dy, HUD_HEIGHT + 16, WORLD_HEIGHT - 16);

    const oldX = tank.x;
    tank.x = nextX;
    if (isTankCollidingObstacle(tank) || isTankCollidingTank(tank)) {
      tank.x = oldX;
    }

    const oldY = tank.y;
    tank.y = nextY;
    if (isTankCollidingObstacle(tank) || isTankCollidingTank(tank)) {
      tank.y = oldY;
    }
  }

  function isTankCollidingObstacle(tank) {
    return MAP_OBSTACLES.some((rect) =>
      circleRectCollision(tank.x, tank.y, 16, rect)
    );
  }

  function isTankCollidingTank(tank) {
    for (const other of getAllTanks()) {
      if (other.id === tank.id) continue;
      if (!other.alive || other.spectate) continue;

      if (distance(tank.x, tank.y, other.x, other.y) < 28) {
        return true;
      }
    }

    return false;
  }

  function updateHumans(now, dt) {
  for (const tank of humanTanks.values()) {
    const input = latestInputs.get(tank.id) || {
      x: 0,
      y: 0,
      shootQueue: 0
    };

    const currentQueue = Number(input.shootQueue || 0);
    const seenQueue = Number(tank.shootQueueSeen || 0);

    if (currentQueue > seenQueue) {
      tank.pendingShots =
        (tank.pendingShots || 0) + (currentQueue - seenQueue);
      tank.shootQueueSeen = currentQueue;
    }

    updateHumanTank(tank, input, now, dt);

    if (tank.pendingShots > 0) {
      const fired = fireTank(tank);
      if (fired) {
        tank.pendingShots--;
      }
    }
  }
}

  function updateBots(now, dt) {
    for (const bot of botTanks.values()) {
      updateBotTank(bot, now, dt);
    }
  }

  function updateRespawns(now) {
    for (const tank of getAllTanks()) {
      if (tank.spectate || tank.alive) continue;

      if (tank.respawnAt && now >= tank.respawnAt) {
        respawnTank(tank);
      }
    }
  }

  function updatePowerups(now) {
    cleanupExpiredPowerups(now);

    if (!matchOver && powerups.length < MAX_POWERUPS && now >= nextPowerupSpawnAt) {
      spawnPowerup();
    }
  }

  function updateProjectiles(now, dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];

      if (p.type === "missile") {
        let target = p.targetId ? findTankById(p.targetId) : null;

        if (!target || !target.alive || target.spectate) {
          const enemies = getAliveTanks().filter((t) => t.id !== p.ownerId);
          target = chooseNearestTank(p, enemies);
          p.targetId = target ? target.id : null;
        }

        if (target) {
          const desired = Math.atan2(target.y - p.y, target.x - p.x);
          p.angle = turnTowards(p.angle, desired, p.turnRate || 0.08);
        }

        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.life += dt;

        if (
          p.x < 0 ||
          p.x > WORLD_WIDTH ||
          p.y < HUD_HEIGHT ||
          p.y > WORLD_HEIGHT ||
          p.life > 4000
        ) {
          projectiles.splice(i, 1);
          continue;
        }

        const hitObstacle = MAP_OBSTACLES.some((rect) =>
          pointInRect(p.x, p.y, rect)
        );

        if (hitObstacle) {
          projectiles.splice(i, 1);
          continue;
        }

        let hit = false;

        for (const tank of getAllTanks()) {
          if (tank.id === p.ownerId) continue;
          if (!tank.alive || tank.spectate) continue;

          if (bulletHitsTank(p, tank)) {
            applyDamage(tank, p.damage, p.ownerId, p.stunMs || 1000);
            projectiles.splice(i, 1);
            hit = true;
            break;
          }
        }

        if (hit) continue;
        continue;
      }

      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life += 1;

      if (
        p.x < 0 ||
        p.x > WORLD_WIDTH ||
        p.y < HUD_HEIGHT ||
        p.y > WORLD_HEIGHT ||
        p.life > 500
      ) {
        projectiles.splice(i, 1);
        continue;
      }

      const hitObstacle = MAP_OBSTACLES.some((rect) =>
        pointInRect(p.x, p.y, rect)
      );

      if (hitObstacle) {
        projectiles.splice(i, 1);
        continue;
      }

      let hit = false;

      for (const tank of getAllTanks()) {
        if (tank.id === p.ownerId) continue;
        if (!tank.alive || tank.spectate) continue;

        if (bulletHitsTank(p, tank)) {
          applyDamage(tank, p.damage, p.ownerId, 0);
          projectiles.splice(i, 1);
          hit = true;
          break;
        }
      }

      if (hit) continue;
    }
  }

  function drawArena() {
    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 1;

    for (let x = 0; x <= WORLD_WIDTH; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }

    for (let y = 0; y <= WORLD_HEIGHT; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }

    MAP_OBSTACLES.forEach((rect) => {
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

      ctx.strokeStyle = "#3d3d3d";
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    });

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Arial";
    ctx.fillText(`TANK BATTLE |  ${MAP_NAME}`, 22, 30);
  }

  function drawPowerups() {
    powerups.forEach((powerup) => {
      const icon = POWERUP_ICONS[powerup.type] || "?";
      const label = POWERUP_LABELS[powerup.type] || powerup.type;

      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.arc(powerup.x, powerup.y, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "24px Arial";
      ctx.fillText(icon, powerup.x - 10, powerup.y);

      ctx.fillStyle = "#d9d9d9";
      ctx.font = "12px Arial";
      ctx.fillText(label, powerup.x - 22, powerup.y + 22);
    });
  }

  function drawProjectiles() {
    projectiles.forEach((p) => {
      if (p.type === "missile") {
        ctx.beginPath();
        ctx.fillStyle = "#ffce5c";
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = "#ffce5c";
        ctx.lineWidth = 2;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(p.angle) * 14, p.y - Math.sin(p.angle) * 14);
        ctx.stroke();
        return;
      }

      ctx.beginPath();
      ctx.fillStyle = "#f4f4f4";
      ctx.arc(p.x, p.y, p.radius || 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawTank(tank, now) {
    if (!tank.alive || tank.spectate) return;

    const size = 36;
    const x = tank.x - size / 2;
    const y = tank.y - size / 2;

    ctx.fillStyle = tank.color;
    ctx.fillRect(x, y, size, size);

    const turretLen = 24;
    const turretX = tank.x + Math.cos(tank.angle) * turretLen;
    const turretY = tank.y + Math.sin(tank.angle) * turretLen;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(tank.x, tank.y);
    ctx.lineTo(turretX, turretY);
    ctx.stroke();

    const icons = getEffectIcons(tank, now);
    if (icons.length > 0) {
      ctx.fillStyle = "#ffffff";
      ctx.font = "18px Arial";
      ctx.fillText(icons.join(" "), tank.x - 14, tank.y - 34);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "14px Arial";
    const nameWidth = ctx.measureText(tank.name).width;
    ctx.fillText(tank.name, tank.x - nameWidth / 2, tank.y + 28);
  }

  function drawHUD(now) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
    ctx.fillRect(0, 0, WORLD_WIDTH, HUD_HEIGHT);

    const tanks = getAllTanks();
    const boxWidth = Math.floor(WORLD_WIDTH / Math.max(1, tanks.length));

    tanks.forEach((tank, index) => {
      const x = index * boxWidth;
      const y = 12;
      const w = boxWidth - 16;
      const h = 88;

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(x + 8, y, w, h);

      ctx.strokeStyle = tank.isBot ? "rgba(255,255,255,0.12)" : tank.color;
      ctx.strokeRect(x + 8, y, w, h);

      ctx.fillStyle = tank.color;
      ctx.fillRect(x + 16, y + 16, 18, 18);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Arial";
      ctx.fillText(tank.name, x + 44, y + 25);

      if (tank.spectate) {
        ctx.fillStyle = "#c7c7c7";
        ctx.font = "13px Arial";
        ctx.fillText("SPECTATE", x + 44, y + 47);
      } else if (!tank.alive) {
        const secondsLeft = Math.max(0, ((tank.respawnAt - now) / 1000).toFixed(1));
        ctx.fillStyle = "#ffce5c";
        ctx.font = "13px Arial";
        ctx.fillText(`RESPAWN ${secondsLeft}s`, x + 44, y + 47);
      } else {
        ctx.fillStyle = "#ffffff";
        ctx.font = "13px Arial";
        ctx.fillText(
          `HP: ${tank.hp}   Kills: ${tank.score}   Deaths: ${tank.deaths}`,
          x + 44,
          y + 47
        );
      }

      const hpWidth = boxWidth - 34;
      const hpRatio = clamp(tank.hp / MAX_HP, 0, 1);

      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(x + 16, y + 60, hpWidth, 8);

      ctx.fillStyle = tank.spectate
        ? "#7a7a7a"
        : (hpRatio > 0.6 ? "#34d399" : hpRatio > 0.3 ? "#f59e0b" : "#ef4444");

      ctx.fillRect(x + 16, y + 60, hpWidth * hpRatio, 8);
    });
  }

  function drawWinnerOverlay() {
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 52px Arial";

    const text = winnerInfo?.winnerName
      ? `WINNER: ${winnerInfo.winnerName}`
      : "NO WINNER";

    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (WORLD_WIDTH - textWidth) / 2, WORLD_HEIGHT / 2 - 24);

    ctx.font = "22px Arial";
    const sub = "Returning to lobby...";
    const subWidth = ctx.measureText(sub).width;
    ctx.fillText(sub, (WORLD_WIDTH - subWidth) / 2, WORLD_HEIGHT / 2 + 24);
  }

  function drawLoading(text) {
    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.font = "24px Arial";
    ctx.fillText(text, 28, 50);
  }

  function draw(now) {
    drawArena();
    drawPowerups();
    drawProjectiles();

    for (const tank of getAllTanks()) {
      drawTank(tank, now);
    }

    drawHUD(now);

    if (matchOver) {
      drawWinnerOverlay();
    }
  }

  function requestFinish(winner) {
    if (matchOver) return;

    matchOver = true;
    winnerInfo = winner
      ? {
          winnerId: winner.id,
          winnerName: winner.name,
          reason: "last_man_standing"
        }
      : {
          winnerId: null,
          winnerName: null,
          reason: "no_winner"
        };

    window.currentGameFinishData = {
      winnerId: winnerInfo.winnerId,
      winnerName: winnerInfo.winnerName,
      reason: winnerInfo.reason,
      matchId: matchId
    };

    if (!winnerEmitted) {
      winnerEmitted = true;

      gameSocket.emit("game:finish", {
        winnerId: winnerInfo.winnerId,
        winnerName: winnerInfo.winnerName,
        reason: winnerInfo.reason,
        matchId: matchId
      });
    }

    saveSnapshot();
  }

  function checkWinCondition() {
    if (matchOver) return;

    const contenders = getContenders();

    if (contenders.length === 0) {
      requestFinish(null);
      return;
    }

    if (contenders.length === 1 && contenders[0].alive) {
      requestFinish(contenders[0]);
      return;
    }
  }

  function updateFrame(now, dt) {
    if (matchOver) return;

    updatePowerups(now);
    updateHumans(now, dt);
    updateBots(now, dt);
    updateProjectiles(now, dt);
    updateRespawns(now);
    pickupPowerups();
    checkWinCondition();
  }

function syncFromServer() {
  if (cleanupCalled) return;

  fetch(`/players-state?t=${Date.now()}`)
    .then((res) => res.json())
    .then((players) => {
      const now = Date.now();

      currentBotCount = Math.max(
        0,
        Number(window.currentGameStartData?.botCount || currentBotCount || 0)
      );

      const nextIds = new Set();

      players.forEach((player, index) => {
        nextIds.add(player.id);

        const existing = humanTanks.get(player.id);
        const tank = createTankFromHuman(player, index, existing);

        humanTanks.set(player.id, tank);

        latestInputs.set(player.id, {
          x: Number(player.input?.x) || 0,
          y: Number(player.input?.y) || 0,
          shootQueue: Number(player.input?.shootQueue) || 0
        });

        if (!tank.alive && tank.respawnAt === 0 && tank.deaths < MAX_DEATHS) {
          tank.respawnAt = now + 100;
        }
      });

      for (const id of [...humanTanks.keys()]) {
        if (!nextIds.has(id)) {
          humanTanks.delete(id);
          latestInputs.delete(id);
        }
      }

      syncRoster(players);
      saveSnapshot();
    })
    .catch((err) => {
      console.warn("Sync roster gagal:", err);
    });
}

  function loop() {
    if (cleanupCalled) return;

    const nowPerf = performance.now();
    const dt = nowPerf - lastFrameAt;
    lastFrameAt = nowPerf;

    const now = Date.now();

    if (!running) {
      drawLoading("Loading Tank Battle...");
      frameId = requestAnimationFrame(loop);
      return;
    }

    updateFrame(now, dt);
    draw(now);

    frameId = requestAnimationFrame(loop);
  }

  function bootstrapGame() {
    const roster = Array.isArray(window.currentGameStartData?.players)
      ? window.currentGameStartData.players
      : [];

    currentBotCount = Math.max(0, Number(window.currentGameStartData?.botCount || currentBotCount || 0));

    const snapshot = loadSnapshot();

    if (snapshot) {
      restoreSnapshot(snapshot, roster);
    } else {
      createFreshState(roster);
    }

    if (window.currentGameFinishData && window.currentGameFinishData.matchId === matchId) {
      matchOver = true;
      winnerInfo = {
        winnerId: window.currentGameFinishData.winnerId || null,
        winnerName: window.currentGameFinishData.winnerName || null,
        reason: window.currentGameFinishData.reason || "winner"
      };
    }

    running = true;

    rosterPollTimer = setInterval(syncFromServer, 120);
    saveTimer = setInterval(saveSnapshot, 350);

    window.addEventListener("party-game-update", rosterUpdateHandler);
    window.addEventListener("party-game-finish", finishHandler);
    window.addEventListener("party-game-end", endHandler);

    gameSocket.on("game:shoot", shootHandler);
    gameSocket.on("game:end", endHandler);

    frameId = requestAnimationFrame(loop);
  }

  function shootHandler(data) {
    if (!data) return;
    if (data.matchId && data.matchId !== matchId) return;

    const tank = findTankById(data.playerId);
    if (!tank || !tank.alive || tank.spectate || matchOver) return;

    fireTank(tank);
    saveSnapshot();
  }

  function chooseNearestTank(source, list) {
    let best = null;
    let bestDistance = Infinity;

    for (const tank of list) {
      const d = distance(source.x, source.y, tank.x, tank.y);
      if (d < bestDistance) {
        best = tank;
        bestDistance = d;
      }
    }

    return best;
  }

  function cleanupGame() {
    if (cleanupCalled) return;
    cleanupCalled = true;

    if (rosterPollTimer) {
      clearInterval(rosterPollTimer);
      rosterPollTimer = null;
    }

    if (saveTimer) {
      clearInterval(saveTimer);
      saveTimer = null;
    }

    if (frameId) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }

    window.removeEventListener("party-game-update", rosterUpdateHandler);
    window.removeEventListener("party-game-finish", finishHandler);
    window.removeEventListener("party-game-end", endHandler);
    gameSocket.off("game:shoot", shootHandler);
    gameSocket.off("game:end", endHandler);

    humanTanks.clear();
    botTanks.clear();
    projectiles = [];
    powerups = [];
    latestInputs.clear();

    running = false;
    matchOver = false;
    winnerInfo = null;
    winnerEmitted = false;

    clearSnapshot();
    container.innerHTML = "";
  }

  function resolveMap(requestedMapId) {
    if (window.resolveTankMapChoice) {
      const m = window.resolveTankMapChoice(requestedMapId || "random");
      return m || window.TANK_MAPS?.[0] || {
        id: "fallback",
        name: "Fallback",
        obstacles: [],
        spawns: []
      };
    }

    return {
      id: requestedMapId || "crossfire",
      name: "Tank Arena",
      obstacles: [],
      spawns: []
    };
  }

  if (!CURRENT_MAP || !CURRENT_MAP.obstacles) {
    drawLoading("Loading Tank Battle...");
    const retry = () => {
      if (cleanupCalled) return;
      if (!window.TANK_MAPS) {
        requestAnimationFrame(retry);
        return;
      }
      bootstrapGame();
    };
    requestAnimationFrame(retry);
  } else {
    bootstrapGame();
  }
})();