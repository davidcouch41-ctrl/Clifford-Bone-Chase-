const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const arenaSize = canvas.width;
const baseSpeed = 4.95;
const turnRate = 0.17;
const baseRadius = 25;
const boneRadius = 18;
const netRadius = 18;
const netSpeed = 3.4;
const bulletSpeed = 12;
const historyLimit = 420;
const explosionDuration = 40;
const levelBannerDuration = 100;
const maxLevel = 10;
const bonesPerLevel = 3;
const growthRate = 1.045;
const maxHealth = 3;

const scoreLabel = document.querySelector(".stats");
const leaderboardList = document.getElementById("leaderboard-list");
const submissionPanel = document.getElementById("submission-panel");
const submissionSummary = document.getElementById("submission-summary");
const submissionStatus = document.getElementById("submission-status");
const leaderboardForm = document.getElementById("leaderboard-form");
const leaderboardNameInput = document.getElementById("leaderboard-name");
const registerForm = document.getElementById("register-form");
const loginForm = document.getElementById("login-form");
const logoutButton = document.getElementById("logout-button");
const authViewGuest = document.getElementById("auth-view-guest");
const authViewUser = document.getElementById("auth-view-user");
const authStatus = document.getElementById("auth-status");
const currentUsername = document.getElementById("current-username");
const difficultySelect = document.getElementById("difficulty-select");
const difficultyCopy = document.getElementById("difficulty-copy");
const soundToggle = document.getElementById("sound-toggle");

const difficultyPresets = {
  rookie: {
    label: "Rookie",
    description: "Slower dinosaur pressure. Rock hits cost one of your three lives.",
    enemyRate: 0.82,
    enemySpeed: 0.9,
    bombRate: 0.88,
    playerSpeed: 1.06,
    scoreMultiplier: 0.85,
  },
  classic: {
    label: "Classic",
    description: "Balanced dinosaur pressure. Rock hits cost one of your three lives.",
    enemyRate: 1,
    enemySpeed: 1,
    bombRate: 1,
    playerSpeed: 1,
    scoreMultiplier: 1,
  },
  onslaught: {
    label: "Onslaught",
    description: "Aggressive dinosaur pressure. A rock hit resets the whole run for bigger rewards.",
    enemyRate: 1.22,
    enemySpeed: 1.2,
    bombRate: 1.18,
    playerSpeed: 0.97,
    scoreMultiplier: 1.35,
  },
};

const auth = {
  user: null,
};

const audioState = {
  enabled: true,
  context: null,
  musicGain: null,
  musicOscillators: [],
};

const dog = {
  x: arenaSize / 2,
  y: arenaSize / 2,
  angle: 0,
  radius: baseRadius,
  totalBones: 0,
  bonesThisLevel: 0,
  history: [],
};

const state = {
  level: 1,
  ammo: 0,
  gunTimer: 0,
  speedTimer: 0,
  shieldTimer: 0,
  slowTimer: 0,
  tailCooldown: 0,
  levelBannerTimer: 0,
  gameWon: false,
  isGameOver: false,
  health: maxHealth,
  bone: null,
  guards: [],
  fences: [],
  nets: [],
  bullets: [],
  enemyBullets: [],
  powerUps: [],
  bombs: [],
  bombTimer: 0,
  explosionFrame: 0,
  explosionBursts: [],
  caughtSpin: 0,
  scoreSubmitted: false,
  difficultyKey: "classic",
  bossActive: false,
  bossPulse: 0,
  lastTimestamp: 0,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
};

function updateHud() {
  const hearts = `<span class="hud-heart">${"❤".repeat(state.health)}</span>`;
  scoreLabel.innerHTML = `
    <p>Level: <span>${state.level}</span></p>
    <p>Loot: <span id="score">${dog.totalBones}</span></p>
    <p>Bag: <span id="width">${dog.bonesThisLevel}/${bonesPerLevel}</span></p>
    <p>Blaster: <span>${state.ammo > 0 ? state.ammo : "none"}</span></p>
    <p>Health: ${hearts}</p>
    <p>Armor: <span>${state.shieldTimer > 0 ? "active" : "none"}</span></p>
  `;
}

function getDifficulty() {
  return difficultyPresets[state.difficultyKey];
}

function updateDifficultyUI() {
  const difficulty = getDifficulty();
  difficultySelect.value = state.difficultyKey;
  difficultyCopy.textContent = difficulty.description;
}

function updateAuthUI() {
  const loggedIn = Boolean(auth.user);
  authViewGuest.classList.toggle("hidden", loggedIn);
  authViewUser.classList.toggle("hidden", !loggedIn);
  currentUsername.textContent = loggedIn ? auth.user.username : "";
  leaderboardNameInput.required = !loggedIn;
  leaderboardNameInput.disabled = loggedIn;
  leaderboardNameInput.placeholder = loggedIn ? "Using signed-in account" : "Only used when logged out";
}

function ensureAudioContext() {
  if (!audioState.enabled) {
    return null;
  }
  if (!audioState.context) {
    audioState.context = new AudioContext();
    audioState.musicGain = audioState.context.createGain();
    audioState.musicGain.gain.value = 0.03;
    audioState.musicGain.connect(audioState.context.destination);
  } else if (audioState.context.state === "suspended") {
    audioState.context.resume();
  }
  return audioState.context;
}

function playSound(type) {
  const context = ensureAudioContext();
  if (!context) {
    return;
  }
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type === "danger" ? "sawtooth" : "square";
  oscillator.frequency.value = {
    loot: 540,
    shot: 220,
    hit: 160,
    heal: 680,
    armor: 420,
    danger: 110,
    level: 760,
  }[type] || 300;
  gain.gain.value = type === "danger" ? 0.06 : 0.045;
  oscillator.connect(gain);
  gain.connect(context.destination);
  const now = context.currentTime;
  oscillator.start(now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "danger" ? 0.35 : 0.18));
  oscillator.stop(now + (type === "danger" ? 0.35 : 0.18));
}

function startMusic() {
  const context = ensureAudioContext();
  if (!context || audioState.musicOscillators.length) {
    return;
  }
  const notes = [110, 165, 220];
  audioState.musicOscillators = notes.map((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    oscillator.connect(audioState.musicGain);
    oscillator.start();
    return oscillator;
  });
}

function stopMusic() {
  for (const oscillator of audioState.musicOscillators) {
    oscillator.stop();
  }
  audioState.musicOscillators = [];
}

function calculateScore() {
  const baseScore = dog.totalBones * 120 + (state.level - 1) * 280 + state.health * 90 + (state.gameWon ? 700 : 0);
  return Math.round(baseScore * getDifficulty().scoreMultiplier);
}

function showSubmissionPanel(outcome) {
  submissionPanel.classList.remove("hidden");
  submissionSummary.textContent = `${outcome === "escaped" ? "Run logged" : "Caught run"}: score ${calculateScore()}, level ${state.level}, loot ${dog.totalBones}.`;
  submissionStatus.textContent = state.scoreSubmitted ? "Score submitted." : "";
}

function hideSubmissionPanel() {
  submissionPanel.classList.add("hidden");
  submissionSummary.textContent = "";
  submissionStatus.textContent = "";
  leaderboardForm.reset();
}

async function loadLeaderboard() {
  try {
    const response = await fetch("/api/leaderboard");
    const entries = await response.json();
    if (!entries.length) {
      leaderboardList.innerHTML = "<li>No scores yet. Be the first dinosaur legend.</li>";
      return;
    }
    leaderboardList.innerHTML = entries
      .map((entry) => `<li><strong>${entry.username || entry.name}</strong> - ${entry.score} pts, level ${entry.level}, loot ${entry.loot} (${entry.outcome})</li>`)
      .join("");
  } catch (_error) {
    leaderboardList.innerHTML = "<li>Leaderboard unavailable right now.</li>";
  }
}

async function submitScore(name) {
  const response = await fetch("/api/leaderboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      score: calculateScore(),
      level: state.level,
      loot: dog.totalBones,
      outcome: state.gameWon ? "escaped" : "busted",
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unable to save score." }));
    throw new Error(payload.error || "Unable to save score.");
  }

  state.scoreSubmitted = true;
  submissionStatus.textContent = "Score submitted to the leaderboard.";
  await loadLeaderboard();
}

async function fetchCurrentUser() {
  const response = await fetch("/api/me");
  const payload = await response.json();
  auth.user = payload.user;
  updateAuthUI();
}

async function registerUser(username, password) {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Registration failed.");
  }
  auth.user = payload.user;
  updateAuthUI();
}

async function loginUser(username, password) {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Login failed.");
  }
  auth.user = payload.user;
  updateAuthUI();
}

async function logoutUser() {
  await fetch("/api/logout", { method: "POST" });
  auth.user = null;
  updateAuthUI();
}

function spawnBone() {
  return {
    x: 70 + Math.random() * (arenaSize - 140),
    y: 70 + Math.random() * (arenaSize - 140),
  };
}

function createFences(level) {
  const fenceCount = Math.min(6, 1 + Math.floor(level / 2));
  const electrified = state.difficultyKey === "onslaught" || (state.difficultyKey === "classic" && level >= 6);
  return Array.from({ length: fenceCount }, (_, index) => {
    const vertical = (index + level) % 2 === 0;
    return {
      x: 110 + Math.random() * (arenaSize - 220),
      y: 110 + Math.random() * (arenaSize - 220),
      width: vertical ? 18 : 120,
      height: vertical ? 120 : 18,
      electrified,
    };
  });
}

function isBossLevel(level) {
  return level === 5 || level === 10;
}

function createGuards(level) {
  const difficulty = getDifficulty();
  const perimeterSpots = [
    { x: 95, y: 95 },
    { x: arenaSize / 2, y: 90 },
    { x: arenaSize - 95, y: 95 },
    { x: 95, y: arenaSize / 2 },
    { x: arenaSize - 95, y: arenaSize / 2 },
    { x: 95, y: arenaSize - 95 },
    { x: arenaSize / 2, y: arenaSize - 90 },
    { x: arenaSize - 95, y: arenaSize - 95 },
    { x: arenaSize / 4, y: 92 },
    { x: arenaSize * 0.75, y: arenaSize - 92 },
  ];

  const guards = perimeterSpots.slice(0, level).map((spot, index) => ({
    x: spot.x,
    y: spot.y,
    baseX: spot.x,
    baseY: spot.y,
    alive: true,
    cooldown: 25 + index * 10,
    interval: Math.max(70, 120 - level * 4 + index * 6) / difficulty.enemyRate,
    bulletCooldown: 70 + index * 8,
    bulletInterval: Math.max(50, 88 - level * 3 + index * 5) / difficulty.enemyRate,
    movePhase: Math.random() * Math.PI * 2,
    isBoss: false,
    isFlying: spot.y <= arenaSize / 2,
    chaseSpeed: 0,
  }));

  if (isBossLevel(level)) {
    guards.push({
      x: arenaSize / 2,
      y: 130,
      baseX: arenaSize / 2,
      baseY: 130,
      alive: true,
      cooldown: 18,
      interval: 52 / difficulty.enemyRate,
      bulletCooldown: 24,
      bulletInterval: 38 / difficulty.enemyRate,
      movePhase: 0,
      isBoss: true,
      radius: 22,
      chaseSpeed: 1.55 * difficulty.enemySpeed,
    });
  }

  return guards;
}

function spawnPowerUp() {
  if (state.powerUps.length > 0) {
    return;
  }

  const roll = Math.random();
  const gunChance = Math.min(0.82, 0.58 + (state.level - 1) * 0.035);
  const speedChance = Math.min(0.18, 0.22 - (state.level - 1) * 0.01);
  const armorThreshold = gunChance + speedChance + 0.13;
  let type = "gun";
  if (roll > gunChance && roll <= gunChance + speedChance) {
    type = "speed";
  } else if (roll > gunChance + speedChance && roll <= armorThreshold) {
    type = "armor";
  } else if (roll > armorThreshold) {
    type = "medkit";
  }
  state.powerUps.push({
    x: 90 + Math.random() * (arenaSize - 180),
    y: 90 + Math.random() * (arenaSize - 180),
    type,
    bob: Math.random() * Math.PI * 2,
  });
}

function buildExplosion() {
  state.explosionFrame = explosionDuration;
  state.explosionBursts = Array.from({ length: 22 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 22 + Math.random() * 0.18;
    return {
      angle,
      speed: 2 + Math.random() * 3.8,
      size: 8 + Math.random() * 18,
    };
  });
}

function triggerExplosion() {
  if (state.isGameOver || state.gameWon) {
    return;
  }

  state.isGameOver = true;
  state.nets = [];
  state.bullets = [];
  state.enemyBullets = [];
  buildExplosion();
  state.caughtSpin = Math.random() * Math.PI * 2;
  stopMusic();
  playSound("danger");
  showSubmissionPanel("busted");
}

function setupLevel(level) {
  dog.x = arenaSize / 2;
  dog.y = arenaSize / 2;
  dog.angle = 0;
  dog.history = [{ x: dog.x, y: dog.y, angle: dog.angle }];

  state.guards = createGuards(level);
  state.fences = createFences(level);
  state.nets = [];
  state.bullets = [];
  state.enemyBullets = [];
  state.powerUps = [];
  state.bombs = [];
  state.bombTimer = Math.max(90, (130 - level * 4) / getDifficulty().bombRate);
  state.bone = spawnBone();
  state.bossActive = isBossLevel(level);
  state.bossPulse = 0;
}

function restartCurrentLevel() {
  dog.totalBones -= dog.bonesThisLevel;
  dog.bonesThisLevel = 0;
  dog.radius = baseRadius * Math.pow(growthRate, dog.totalBones);
  state.levelBannerTimer = levelBannerDuration;
  state.slowTimer = 0;
  state.tailCooldown = 0;
  setupLevel(state.level);
  updateHud();
}

function handleNetCapture() {
  if (state.isGameOver || state.gameWon) {
    return;
  }

  if (state.difficultyKey === "onslaught") {
    resetGame();
    return;
  }

  takeDamage(1);
}

function resetGame() {
  dog.x = arenaSize / 2;
  dog.y = arenaSize / 2;
  dog.angle = 0;
  dog.radius = baseRadius;
  dog.totalBones = 0;
  dog.bonesThisLevel = 0;
  dog.history = [{ x: dog.x, y: dog.y, angle: dog.angle }];

  state.level = 1;
  state.ammo = 0;
  state.gunTimer = 0;
  state.speedTimer = 0;
  state.shieldTimer = 0;
  state.slowTimer = 0;
  state.tailCooldown = 0;
  state.levelBannerTimer = levelBannerDuration;
  state.gameWon = false;
  state.isGameOver = false;
  state.health = maxHealth;
  state.explosionFrame = 0;
  state.explosionBursts = [];
  state.caughtSpin = 0;
  state.scoreSubmitted = false;
  state.lastTimestamp = 0;
  setupLevel(1);
  hideSubmissionPanel();
  updateHud();
  updateDifficultyUI();
  if (audioState.enabled) {
    startMusic();
  }
}

function startNextLevel() {
  if (state.level === maxLevel) {
    state.gameWon = true;
    state.levelBannerTimer = levelBannerDuration + 30;
    state.nets = [];
    state.enemyBullets = [];
    stopMusic();
    playSound("level");
    showSubmissionPanel("escaped");
    return;
  }

  state.level += 1;
  dog.bonesThisLevel = 0;
  state.levelBannerTimer = levelBannerDuration;
  setupLevel(state.level);
  playSound("level");
  updateHud();
}

function spawnBomb() {
  const targetX = 70 + Math.random() * (arenaSize - 140);
  const targetY = 70 + Math.random() * (arenaSize - 140);
  state.bombs.push({
    targetX,
    targetY,
    height: 220 + Math.random() * 90,
    fallSpeed: 6 + Math.random() * 2.5 + state.level * 0.15,
    radius: 14,
  });
}

function getDogPose() {
  const head = dog.history[0] || dog;
  const bodyAngle = head.angle;
  const forwardX = Math.cos(bodyAngle);
  const forwardY = Math.sin(bodyAngle);
  const normalX = Math.cos(bodyAngle + Math.PI / 2);
  const normalY = Math.sin(bodyAngle + Math.PI / 2);
  const bodyRadius = dog.radius;
  const bodyOffset = bodyRadius * (1.25 + dog.totalBones * 0.18);
  const rumpOffset = bodyRadius * (2.35 + dog.totalBones * 0.42);
  const bodyPoint = {
    x: head.x - forwardX * bodyOffset,
    y: head.y - forwardY * bodyOffset,
  };
  const rumpPoint = {
    x: head.x - forwardX * rumpOffset,
    y: head.y - forwardY * rumpOffset,
  };

  return {
    headX: head.x,
    headY: head.y,
    bodyPoint,
    rumpPoint,
    bodyAngle,
    forwardX,
    forwardY,
    normalX,
    normalY,
    bodyRadius,
    headRadius: bodyRadius * 0.8,
    neckRadius: bodyRadius * 0.62,
    rumpRadius: bodyRadius * 0.66,
  };
}

function touchesOwnTail(nextX, nextY) {
  if (dog.totalBones < 3 || state.tailCooldown > 0) {
    return false;
  }

  for (let i = 52; i < dog.history.length; i += 8) {
    const point = dog.history[i];
    if (!point) {
      continue;
    }

    if (Math.hypot(nextX - point.x, nextY - point.y) <= dog.radius * 0.34) {
      return true;
    }
  }

  return false;
}

function collectBone() {
  dog.totalBones += 1;
  dog.bonesThisLevel += 1;
  dog.radius = baseRadius * Math.pow(growthRate, dog.totalBones);
  state.bone = spawnBone();
  playSound("loot");

  if (Math.random() < 0.55) {
    spawnPowerUp();
  }

  updateHud();

  if (dog.bonesThisLevel >= bonesPerLevel) {
    startNextLevel();
  }
}

function collectPowerUp(type) {
  if (type === "gun") {
    state.ammo += 10;
    state.gunTimer = 600;
  }

  if (type === "speed") {
    state.speedTimer = 300;
  }

  if (type === "armor") {
    state.shieldTimer = 420;
    playSound("armor");
  }

  if (type === "medkit") {
    state.health = Math.min(maxHealth, state.health + 1);
    playSound("heal");
  }

  if (type === "speed") {
    playSound("level");
  }

  updateHud();
}

function takeDamage(amount, isLethal = false) {
  if (state.shieldTimer > 0 && !isLethal) {
    state.shieldTimer = 0;
    updateHud();
    return false;
  }

  if (isLethal) {
    triggerExplosion();
    return true;
  }

  state.health -= amount;
  state.slowTimer = Math.max(state.slowTimer, 55);
  playSound("hit");
  if (state.health <= 0) {
    triggerExplosion();
    return true;
  }
  updateHud();
  return false;
}

function spawnNet(guard) {
  const difficulty = getDifficulty();
  const pose = getDogPose();
  const dx = pose.headX - guard.x;
  const dy = pose.headY - guard.y;
  const distance = Math.hypot(dx, dy) || 1;
  state.nets.push({
    x: guard.x,
    y: guard.y,
    vx: (dx / distance) * netSpeed * difficulty.enemySpeed * (guard.isBoss ? 1.15 : 1),
    vy: (dy / distance) * netSpeed * difficulty.enemySpeed * (guard.isBoss ? 1.15 : 1),
    radius: guard.isBoss ? netRadius * 1.35 : netRadius,
    life: guard.isBoss ? 320 : 260,
    spin: Math.random() * Math.PI * 2,
  });
}

function spawnGuardBullet(guard) {
  const difficulty = getDifficulty();
  const pose = getDogPose();
  const dx = pose.headX - guard.x;
  const dy = pose.headY - (guard.y - 8);
  const distance = Math.hypot(dx, dy) || 1;
  state.enemyBullets.push({
    x: guard.x,
    y: guard.y - 8,
    vx: (dx / distance) * (netSpeed + 2.9) * difficulty.enemySpeed,
    vy: (dy / distance) * (netSpeed + 2.9) * difficulty.enemySpeed,
    life: guard.isBoss ? 170 : 135,
  });
}

function fireBullet() {
  if (state.isGameOver || state.gameWon || state.ammo <= 0) {
    return;
  }

  const pose = getDogPose();
  state.bullets.push({
    x: pose.headX + pose.forwardX * pose.headRadius,
    y: pose.headY + pose.forwardY * pose.headRadius,
    vx: pose.forwardX * bulletSpeed,
    vy: pose.forwardY * bulletSpeed,
    life: 80,
  });
  state.ammo -= 1;
  playSound("shot");
  updateHud();
}

function updateTimers(deltaFactor) {
  if (state.gunTimer > 0) {
    state.gunTimer -= deltaFactor;
  }
  if (state.speedTimer > 0) {
    state.speedTimer -= deltaFactor;
  }
  if (state.shieldTimer > 0) {
    state.shieldTimer -= deltaFactor;
  }
  if (state.slowTimer > 0) {
    state.slowTimer -= deltaFactor;
  }
  if (state.tailCooldown > 0) {
    state.tailCooldown -= deltaFactor;
  }
  if (state.levelBannerTimer > 0) {
    state.levelBannerTimer -= deltaFactor;
  }
}

function updatePowerUps(deltaFactor) {
  const pose = getDogPose();
  state.powerUps = state.powerUps.filter((powerUp) => {
    powerUp.bob += 0.08 * deltaFactor;
    if (Math.hypot(powerUp.x - pose.headX, powerUp.y - pose.headY) <= dog.radius + 18) {
      collectPowerUp(powerUp.type);
      return false;
    }
    return true;
  });
}

function updateBullets(deltaFactor) {
  state.bullets = state.bullets.filter((bullet) => {
    bullet.x += bullet.vx * deltaFactor;
    bullet.y += bullet.vy * deltaFactor;
    bullet.life -= deltaFactor;

    if (bullet.life <= 0 || bullet.x < 0 || bullet.x > arenaSize || bullet.y < 0 || bullet.y > arenaSize) {
      return false;
    }

    for (const guard of state.guards) {
      if (!guard.alive) {
        continue;
      }

      if (Math.hypot(bullet.x - guard.x, bullet.y - (guard.y - 8)) <= 18) {
        guard.alive = false;
        return false;
      }
    }

    return true;
  });
}

function updateEnemyBullets(deltaFactor) {
  const pose = getDogPose();
  state.enemyBullets = state.enemyBullets.filter((bullet) => {
    bullet.x += bullet.vx * deltaFactor;
    bullet.y += bullet.vy * deltaFactor;
    bullet.life -= deltaFactor;

    if (bullet.life <= 0 || bullet.x < -10 || bullet.x > arenaSize + 10 || bullet.y < -10 || bullet.y > arenaSize + 10) {
      return false;
    }

    if (Math.hypot(bullet.x - pose.headX, bullet.y - pose.headY) <= pose.headRadius * 0.7 + 5) {
      takeDamage(1);
      return false;
    }

    return true;
  });
}

function updateGuardsAndNets(deltaFactor) {
  const pose = getDogPose();

  for (const guard of state.guards) {
    if (!guard.alive) {
      continue;
    }

    if (guard.isBoss) {
      state.bossPulse += 0.03 * deltaFactor;
      guard.movePhase += 0.05 * deltaFactor;
      const chaseX = pose.headX - Math.cos(guard.movePhase) * 58;
      const chaseY = pose.headY - 120 + Math.sin(guard.movePhase * 1.6) * 24;
      guard.x += (chaseX - guard.x) * 0.024 * guard.chaseSpeed * deltaFactor;
      guard.y += (chaseY - guard.y) * 0.024 * guard.chaseSpeed * deltaFactor;
      guard.x = Math.max(70, Math.min(arenaSize - 70, guard.x));
      guard.y = Math.max(85, Math.min(arenaSize - 85, guard.y));
    }

    guard.cooldown -= deltaFactor;
    if (guard.cooldown <= 0) {
      spawnNet(guard);
      guard.cooldown = guard.interval * (guard.isBoss ? 0.78 : 1);
    }

    guard.bulletCooldown -= deltaFactor;
    if (guard.bulletCooldown <= 0) {
      spawnGuardBullet(guard);
      guard.bulletCooldown = guard.bulletInterval * (guard.isBoss ? 0.72 : 1);
    }
  }

  state.nets = state.nets.filter((net) => {
    net.x += net.vx * deltaFactor;
    net.y += net.vy * deltaFactor;
    net.spin += 0.16 * deltaFactor;
    net.life -= deltaFactor;

    if (net.life <= 0 || net.x < -40 || net.x > arenaSize + 40 || net.y < -40 || net.y > arenaSize + 40) {
      return false;
    }

    if (Math.hypot(net.x - pose.headX, net.y - pose.headY) <= pose.headRadius + net.radius * 0.5) {
      handleNetCapture();
      return false;
    }

    return true;
  });
}

function updateBombs(deltaFactor) {
  const pose = getDogPose();

  state.bombTimer -= deltaFactor;
  if (state.bombTimer <= 0) {
    spawnBomb();
    state.bombTimer = Math.max(55, (130 - state.level * 7) / getDifficulty().bombRate);
  }

  state.bombs = state.bombs.filter((bomb) => {
    bomb.height -= bomb.fallSpeed * deltaFactor;

    if (bomb.height <= 0) {
      if (Math.hypot(bomb.targetX - pose.headX, bomb.targetY - pose.headY) <= pose.headRadius + bomb.radius + 4) {
        takeDamage(1, true);
      }
      return false;
    }

    return true;
  });
}

function intersectsFence(x, y, radius) {
  for (const fence of state.fences) {
    const closestX = Math.max(fence.x - fence.width / 2, Math.min(x, fence.x + fence.width / 2));
    const closestY = Math.max(fence.y - fence.height / 2, Math.min(y, fence.y + fence.height / 2));
    if (Math.hypot(x - closestX, y - closestY) <= radius) {
      return fence;
    }
  }
  return null;
}

function updateDog(deltaFactor) {
  if (state.isGameOver) {
    if (state.explosionFrame > 0) {
      state.explosionFrame -= deltaFactor;
    }
    state.caughtSpin += 0.06 * deltaFactor;
    return;
  }

  if (state.gameWon) {
    updateTimers(deltaFactor);
    return;
  }

  updateTimers(deltaFactor);

  if (input.left) {
    dog.angle -= turnRate * deltaFactor;
  }
  if (input.right) {
    dog.angle += turnRate * deltaFactor;
  }

  let moveSpeed = baseSpeed * getDifficulty().playerSpeed;
  if (input.up) {
    moveSpeed *= 1.15;
  }
  if (input.down) {
    moveSpeed *= 0.72;
  }
  if (state.speedTimer > 0) {
    moveSpeed *= 1.32;
  }
  if (state.slowTimer > 0) {
    moveSpeed *= 0.58;
  }

  const nextX = dog.x + Math.cos(dog.angle) * moveSpeed * deltaFactor;
  const nextY = dog.y + Math.sin(dog.angle) * moveSpeed * deltaFactor;

  dog.x = nextX;
  dog.y = nextY;

  if (dog.x - dog.radius <= 0 || dog.x + dog.radius >= arenaSize || dog.y - dog.radius <= 0 || dog.y + dog.radius >= arenaSize) {
    takeDamage(1, true);
    return;
  }

  if (touchesOwnTail(nextX, nextY)) {
    state.slowTimer = 140;
    state.tailCooldown = 110;
  }

  const fenceHit = intersectsFence(dog.x, dog.y, dog.radius * 0.72);
  if (fenceHit) {
    state.slowTimer = Math.max(state.slowTimer, 170);
    dog.x -= Math.cos(dog.angle) * moveSpeed * deltaFactor * 0.9;
    dog.y -= Math.sin(dog.angle) * moveSpeed * deltaFactor * 0.9;
    if (fenceHit.electrified && state.lastTimestamp % 18 < 1.2) {
      takeDamage(1);
      playSound("danger");
    }
  }

  dog.history.unshift({ x: dog.x, y: dog.y, angle: dog.angle });
  if (dog.history.length > historyLimit) {
    dog.history.length = historyLimit;
  }

  if (Math.hypot(dog.x - state.bone.x, dog.y - state.bone.y) <= dog.radius + boneRadius + 2) {
    collectBone();
  }

  updatePowerUps(deltaFactor);
  updateBullets(deltaFactor);
  updateEnemyBullets(deltaFactor);
  updateGuardsAndNets(deltaFactor);
  updateBombs(deltaFactor);
}

function drawBackground() {
  ctx.clearRect(0, 0, arenaSize, arenaSize);
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, arenaSize);
  sky.addColorStop(0, "#f2d58a");
  sky.addColorStop(0.45, "#c78645");
  sky.addColorStop(1, "#6f4f2a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, arenaSize, arenaSize);

  ctx.fillStyle = "rgba(255, 233, 171, 0.9)";
  ctx.beginPath();
  ctx.arc(130, 120, 54, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 208, 122, 0.22)";
  ctx.beginPath();
  ctx.arc(130, 120, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#82603b";
  ctx.beginPath();
  ctx.moveTo(0, 270);
  ctx.lineTo(110, 180);
  ctx.lineTo(235, 280);
  ctx.lineTo(345, 170);
  ctx.lineTo(470, 280);
  ctx.lineTo(585, 150);
  ctx.lineTo(720, 280);
  ctx.lineTo(720, 720);
  ctx.lineTo(0, 720);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 126, 68, 0.65)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(575, 145);
  ctx.lineTo(564, 172);
  ctx.lineTo(580, 194);
  ctx.lineTo(570, 218);
  ctx.stroke();

  ctx.fillStyle = "#8b6538";
  ctx.fillRect(0, 500, arenaSize, 220);

  ctx.fillStyle = "#658344";
  for (let i = 0; i < 18; i += 1) {
    const x = 18 + i * 40;
    const height = 18 + (i % 3) * 8;
    ctx.beginPath();
    ctx.moveTo(x, 510);
    ctx.lineTo(x - 12, 510 + height);
    ctx.lineTo(x + 12, 510 + height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  for (const fence of state.fences) {
    ctx.fillStyle = fence.electrified ? "#5f4027" : "#745133";
    ctx.fillRect(fence.x - fence.width / 2, fence.y - fence.height / 2, fence.width, fence.height);
    ctx.strokeStyle = fence.electrified ? "#ff8f4f" : "#d7b37a";
    ctx.lineWidth = 2;
    ctx.strokeRect(fence.x - fence.width / 2, fence.y - fence.height / 2, fence.width, fence.height);
    const posts = fence.width > fence.height ? Math.max(2, Math.floor(fence.width / 24)) : Math.max(2, Math.floor(fence.height / 24));
    for (let i = 0; i <= posts; i += 1) {
      if (fence.width > fence.height) {
        const px = fence.x - fence.width / 2 + (fence.width / posts) * i;
        ctx.beginPath();
        ctx.moveTo(px, fence.y - fence.height / 2 - 5);
        ctx.lineTo(px, fence.y + fence.height / 2 + 5);
        ctx.stroke();
      } else {
        const py = fence.y - fence.height / 2 + (fence.height / posts) * i;
        ctx.beginPath();
        ctx.moveTo(fence.x - fence.width / 2 - 5, py);
        ctx.lineTo(fence.x + fence.width / 2 + 5, py);
        ctx.stroke();
      }
    }
    if (fence.electrified) {
      ctx.strokeStyle = "rgba(255, 150, 79, 0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (fence.width > fence.height) {
        const left = fence.x - fence.width / 2;
        const right = fence.x + fence.width / 2;
        const top = fence.y - fence.height / 2 - 8;
        ctx.moveTo(left, top);
        for (let step = 1; step <= 6; step += 1) {
          const px = left + (fence.width / 6) * step;
          const py = top + (step % 2 === 0 ? -8 : 8);
          ctx.lineTo(px, py);
        }
      } else {
        const top = fence.y - fence.height / 2;
        const left = fence.x - fence.width / 2 - 8;
        ctx.moveTo(left, top);
        for (let step = 1; step <= 6; step += 1) {
          const py = top + (fence.height / 6) * step;
          const px = left + (step % 2 === 0 ? -8 : 8);
          ctx.lineTo(px, py);
        }
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBone() {
  const bone = state.bone;
  ctx.save();
  ctx.translate(bone.x, bone.y);
  ctx.rotate(Math.sin((state.lastTimestamp || 0) / 220) * 0.08);
  ctx.fillStyle = "#7a4f24";
  ctx.strokeStyle = "#d9b06a";
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.roundRect(-18, -16, 36, 32, 7);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 212, 148, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(10, -6);
  ctx.moveTo(-10, 4);
  ctx.lineTo(10, 4);
  ctx.moveTo(-4, -12);
  ctx.lineTo(-4, 12);
  ctx.moveTo(6, -12);
  ctx.lineTo(6, 12);
  ctx.stroke();

  ctx.fillStyle = "#ffd86f";
  ctx.beginPath();
  ctx.arc(-5, -1, 3, 0, Math.PI * 2);
  ctx.arc(4, 3, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBrachiosaurus(guard) {
  ctx.fillStyle = "#7ca86c";
  ctx.beginPath();
  ctx.ellipse(guard.x, guard.y + 6, 24, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7ca86c";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(guard.x + 4, guard.y - 2);
  ctx.quadraticCurveTo(guard.x + 20, guard.y - 34, guard.x + 10, guard.y - 54);
  ctx.stroke();

  ctx.fillStyle = "#8ebc7a";
  ctx.beginPath();
  ctx.arc(guard.x + 10, guard.y - 58, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#58754d";
  for (const offset of [-12, -4, 4, 12]) {
    ctx.fillRect(guard.x + offset, guard.y + 14, 5, 22);
  }

  ctx.strokeStyle = "#5f7f53";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(guard.x - 22, guard.y + 2);
  ctx.quadraticCurveTo(guard.x - 34, guard.y - 2, guard.x - 36, guard.y - 20);
  ctx.stroke();

  ctx.fillStyle = "#f6fff2";
  ctx.beginPath();
  ctx.arc(guard.x + 14, guard.y - 61, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawPterodactyl(guard) {
  const flap = Math.sin((state.lastTimestamp / 140) + guard.movePhase) * 10;
  const bodyY = guard.y - 18;

  ctx.fillStyle = "rgba(55, 40, 27, 0.18)";
  ctx.beginPath();
  ctx.ellipse(guard.x, guard.y + 26, 26, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7d5d41";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(guard.x, bodyY);
  ctx.quadraticCurveTo(guard.x - 22, bodyY - 12, guard.x - 44, bodyY + flap);
  ctx.moveTo(guard.x, bodyY);
  ctx.quadraticCurveTo(guard.x + 22, bodyY - 12, guard.x + 44, bodyY + flap);
  ctx.stroke();

  ctx.fillStyle = "#8f6c4e";
  ctx.beginPath();
  ctx.ellipse(guard.x, bodyY, 14, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8f6c4e";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(guard.x + 8, bodyY - 2);
  ctx.quadraticCurveTo(guard.x + 20, bodyY - 12, guard.x + 28, bodyY - 26);
  ctx.stroke();

  ctx.fillStyle = "#b28762";
  ctx.beginPath();
  ctx.moveTo(guard.x + 26, bodyY - 24);
  ctx.lineTo(guard.x + 44, bodyY - 20);
  ctx.lineTo(guard.x + 30, bodyY - 10);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#694d36";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(guard.x - 10, bodyY + 1);
  ctx.quadraticCurveTo(guard.x - 22, bodyY + 4, guard.x - 28, bodyY + 14);
  ctx.stroke();

  ctx.fillStyle = "#fff8ef";
  ctx.beginPath();
  ctx.arc(guard.x + 31, bodyY - 25, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawTRex(guard) {
  ctx.fillStyle = "#8a5735";
  ctx.beginPath();
  ctx.ellipse(guard.x - 6, guard.y + 10, 34, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(guard.x - 30, guard.y + 4);
  ctx.lineTo(guard.x - 72, guard.y - 18);
  ctx.lineTo(guard.x - 54, guard.y + 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#9d6641";
  ctx.beginPath();
  ctx.arc(guard.x + 28, guard.y - 22, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#8a5735";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(guard.x + 10, guard.y - 6);
  ctx.quadraticCurveTo(guard.x + 30, guard.y - 18, guard.x + 28, guard.y - 32);
  ctx.stroke();

  ctx.strokeStyle = "#71472d";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(guard.x - 4, guard.y + 24);
  ctx.lineTo(guard.x - 10, guard.y + 54);
  ctx.moveTo(guard.x + 16, guard.y + 22);
  ctx.lineTo(guard.x + 22, guard.y + 54);
  ctx.moveTo(guard.x + 8, guard.y + 2);
  ctx.lineTo(guard.x + 26, guard.y + 14);
  ctx.moveTo(guard.x + 14, guard.y + 4);
  ctx.lineTo(guard.x + 34, guard.y + 20);
  ctx.stroke();

  ctx.fillStyle = "#fff7ee";
  ctx.beginPath();
  ctx.arc(guard.x + 34, guard.y - 26, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawConnectedBody(head, bodyPoint, rumpPoint, headRadius, bodyRadius, rumpRadius) {
  const spine = [
    { point: head, radius: headRadius * 0.58 },
    { point: { x: (head.x + bodyPoint.x) / 2, y: (head.y + bodyPoint.y) / 2 }, radius: bodyRadius * 0.52 },
    { point: bodyPoint, radius: bodyRadius * 0.6 },
    { point: { x: (bodyPoint.x + rumpPoint.x) / 2, y: (bodyPoint.y + rumpPoint.y) / 2 }, radius: bodyRadius * 0.56 },
    { point: rumpPoint, radius: rumpRadius * 0.58 },
  ];
  const topSide = [];
  const bottomSide = [];

  for (let i = 0; i < spine.length; i += 1) {
    const current = spine[i];
    const previous = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    const tangentX = next.point.x - previous.point.x;
    const tangentY = next.point.y - previous.point.y;
    const length = Math.hypot(tangentX, tangentY) || 1;
    const normalX = -tangentY / length;
    const normalY = tangentX / length;

    topSide.push({ x: current.point.x + normalX * current.radius, y: current.point.y + normalY * current.radius });
    bottomSide.push({ x: current.point.x - normalX * current.radius, y: current.point.y - normalY * current.radius });
  }

  ctx.fillStyle = "#d62323";
  ctx.beginPath();
  ctx.moveTo(topSide[0].x, topSide[0].y);
  for (let i = 1; i < topSide.length; i += 1) {
    const previous = topSide[i - 1];
    const current = topSide[i];
    ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + current.x) / 2, (previous.y + current.y) / 2);
  }
  const topEnd = topSide[topSide.length - 1];
  const bottomEnd = bottomSide[bottomSide.length - 1];
  ctx.quadraticCurveTo(topEnd.x, topEnd.y, bottomEnd.x, bottomEnd.y);
  for (let i = bottomSide.length - 2; i >= 0; i -= 1) {
    const previous = bottomSide[i + 1];
    const current = bottomSide[i];
    ctx.quadraticCurveTo(previous.x, previous.y, (previous.x + current.x) / 2, (previous.y + current.y) / 2);
  }
  ctx.closePath();
  ctx.fill();
}

function drawLeg(x, y, length, angle, pawColor) {
  const footX = x + Math.cos(angle + Math.PI / 2) * length;
  const footY = y + Math.sin(angle + Math.PI / 2) * length;
  ctx.strokeStyle = "#a91919";
  ctx.lineWidth = Math.max(7, dog.radius * 0.14);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(footX, footY);
  ctx.stroke();

  ctx.fillStyle = pawColor;
  ctx.beginPath();
  ctx.ellipse(footX, footY + dog.radius * 0.03, dog.radius * 0.16, dog.radius * 0.1, angle, 0, Math.PI * 2);
  ctx.fill();
}

function drawEar(x, y, angle, size) {
  ctx.fillStyle = "#9d0b0b";
  ctx.beginPath();
  ctx.ellipse(x, y, size * 0.34, size, angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c76565";
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.06, size * 0.16, size * 0.56, angle, 0, Math.PI * 2);
  ctx.fill();
}

function drawDog() {
  const pose = getDogPose();
  const { headX, headY, bodyAngle, headRadius } = pose;

  ctx.save();

  for (let i = Math.min(dog.history.length - 1, 140); i >= 28; i -= 16) {
    const point = dog.history[i];
    if (!point) {
      continue;
    }
    const alpha = Math.max(0.12, 1 - i / 165);
    ctx.fillStyle = `rgba(122, 79, 36, ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(point.x - 11, point.y - 9, 22, 18, 4);
    ctx.fill();
    ctx.strokeStyle = `rgba(229, 192, 116, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(point.x - 8, point.y + 1);
    ctx.lineTo(point.x + 7, point.y + 1);
    ctx.stroke();
  }

  ctx.translate(headX, headY);
  ctx.rotate(bodyAngle);

  ctx.fillStyle = "#f0c6a0";
  ctx.beginPath();
  ctx.arc(0, -headRadius * 0.95, headRadius * 0.58, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#4f2f18";
  ctx.beginPath();
  ctx.arc(0, -headRadius * 1.12, headRadius * 0.62, Math.PI, 0);
  ctx.lineTo(headRadius * 0.56, -headRadius * 0.82);
  ctx.lineTo(-headRadius * 0.56, -headRadius * 0.82);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d44a31";
  ctx.beginPath();
  ctx.moveTo(-headRadius * 0.68, -headRadius * 0.45);
  ctx.lineTo(headRadius * 0.48, -headRadius * 0.5);
  ctx.lineTo(headRadius * 0.7, headRadius * 0.72);
  ctx.lineTo(-headRadius * 0.44, headRadius * 0.98);
  ctx.fill();

  ctx.fillStyle = "#7d4d2b";
  ctx.beginPath();
  ctx.moveTo(-headRadius * 0.58, -headRadius * 0.18);
  ctx.lineTo(headRadius * 0.3, -headRadius * 0.16);
  ctx.lineTo(headRadius * 0.52, headRadius * 0.56);
  ctx.lineTo(-headRadius * 0.35, headRadius * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0f0f0f";
  ctx.beginPath();
  ctx.arc(-headRadius * 0.16, -headRadius * 1, headRadius * 0.07, 0, Math.PI * 2);
  ctx.arc(headRadius * 0.13, -headRadius * 0.95, headRadius * 0.07, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#3c2414";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-headRadius * 0.14, -headRadius * 0.76);
  ctx.quadraticCurveTo(0, -headRadius * 0.64, headRadius * 0.16, -headRadius * 0.78);
  ctx.stroke();

  ctx.strokeStyle = "#8d5f2f";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-headRadius * 0.12, -headRadius * 0.28);
  ctx.lineTo(-headRadius * 0.64, headRadius * 0.2);
  ctx.moveTo(headRadius * 0.2, -headRadius * 0.18);
  ctx.lineTo(headRadius * 1.02, -headRadius * 0.82);
  ctx.moveTo(-headRadius * 0.18, headRadius * 0.98);
  ctx.lineTo(-headRadius * 0.34, headRadius * 1.72);
  ctx.moveTo(headRadius * 0.18, headRadius * 0.92);
  ctx.lineTo(headRadius * 0.34, headRadius * 1.7);
  ctx.stroke();

  ctx.fillStyle = "#f5ead5";
  ctx.beginPath();
  ctx.moveTo(headRadius * 1.02, -headRadius * 0.82);
  ctx.lineTo(headRadius * 1.28, -headRadius * 1.04);
  ctx.lineTo(headRadius * 1.16, -headRadius * 0.54);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#e8d2aa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(headRadius * 0.9, -headRadius * 0.94);
  ctx.lineTo(headRadius * 1.02, -headRadius * 0.82);
  ctx.stroke();

  ctx.restore();
}

function drawPolice() {
  for (const guard of state.guards) {
    if (!guard.alive) {
      continue;
    }

    ctx.save();
    const scale = guard.isBoss ? 1.55 + Math.sin(state.bossPulse) * 0.04 : 1;
    ctx.translate(guard.x, guard.y);
    ctx.scale(scale, scale);
    ctx.translate(-guard.x, -guard.y);
    if (guard.isBoss) {
      drawTRex(guard);
    } else if (guard.isFlying) {
      drawPterodactyl(guard);
    } else {
      drawBrachiosaurus(guard);
    }

    if (guard.isBoss) {
      ctx.fillStyle = "#ffd27d";
      ctx.font = "bold 10px Arial";
      ctx.textAlign = "center";
      ctx.fillText("T-REX", guard.x, guard.y - 52);
    }
    ctx.restore();
  }
}

function drawNet(net) {
  ctx.save();
  ctx.translate(net.x, net.y);
  ctx.rotate(net.spin);
  ctx.fillStyle = "#7d6853";
  ctx.beginPath();
  for (let i = 0; i < 9; i += 1) {
    const angle = (Math.PI * 2 * i) / 9;
    const distance = net.radius * (0.78 + (i % 2) * 0.28);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4c3f33";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 240, 219, 0.22)";
  ctx.beginPath();
  ctx.arc(-net.radius * 0.18, -net.radius * 0.2, net.radius * 0.2, 0, Math.PI * 2);
  ctx.arc(net.radius * 0.24, net.radius * 0.14, net.radius * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNets() {
  for (const net of state.nets) {
    drawNet(net);
  }
}

function drawBullets() {
  ctx.fillStyle = "#ffd27d";
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemyBullets() {
  for (const bullet of state.enemyBullets) {
    ctx.save();
    ctx.fillStyle = "#c97a3d";
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 226, 183, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bullet.x - bullet.vx * 1.2, bullet.y - bullet.vy * 1.2);
    ctx.lineTo(bullet.x, bullet.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPowerUps() {
  for (const powerUp of state.powerUps) {
    const y = powerUp.y + Math.sin(powerUp.bob) * 4;
    ctx.save();
    ctx.translate(powerUp.x, y);
    if (powerUp.type === "gun") {
      ctx.fillStyle = "#404650";
      ctx.fillRect(-12, -5, 18, 10);
      ctx.fillRect(1, 5, 6, 10);
      ctx.fillStyle = "#ffd27d";
      ctx.fillRect(6, -2, 10, 4);
    } else if (powerUp.type === "speed") {
      ctx.fillStyle = "#7df6ff";
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(7, -2);
      ctx.lineTo(2, -2);
      ctx.lineTo(10, 14);
      ctx.lineTo(-6, 2);
      ctx.lineTo(-1, 2);
      ctx.closePath();
      ctx.fill();
    } else if (powerUp.type === "armor") {
      ctx.fillStyle = "#8396ff";
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(14, -8);
      ctx.lineTo(10, 12);
      ctx.lineTo(0, 16);
      ctx.lineTo(-10, 12);
      ctx.lineTo(-14, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#eef2ff";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ff5b5b";
      ctx.fillRect(-12, -4, 24, 8);
      ctx.fillRect(-4, -12, 8, 24);
    }
    ctx.restore();
  }
}

function drawBombs() {
  for (const bomb of state.bombs) {
    const shadowScale = 1 - Math.min(0.72, bomb.height / 360);
    const shadowRadius = 10 + shadowScale * 18;
    ctx.save();
    ctx.fillStyle = "rgba(20, 20, 20, 0.24)";
    ctx.beginPath();
    ctx.ellipse(bomb.targetX, bomb.targetY, shadowRadius, shadowRadius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawY = bomb.targetY - bomb.height;
    ctx.fillStyle = "#59493b";
    ctx.beginPath();
    ctx.arc(bomb.targetX, drawY, bomb.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#7c6854";
    ctx.beginPath();
    ctx.arc(bomb.targetX - 4, drawY - 4, bomb.radius * 0.3, 0, Math.PI * 2);
    ctx.arc(bomb.targetX + 5, drawY + 2, bomb.radius * 0.22, 0, Math.PI * 2);
    ctx.arc(bomb.targetX + 1, drawY - 7, bomb.radius * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#ffbf63";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bomb.targetX + 6, drawY - 10);
    ctx.lineTo(bomb.targetX + 14, drawY - 22);
    ctx.moveTo(bomb.targetX + 10, drawY - 16);
    ctx.lineTo(bomb.targetX + 18, drawY - 28);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCaughtNet() {
  if (!state.isGameOver && state.explosionFrame <= 0) {
    return;
  }

  const progress = 1 - state.explosionFrame / explosionDuration;
  const baseSize = dog.radius * (1.8 + progress * 0.75);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.translate(dog.x, dog.y);
  ctx.rotate(state.caughtSpin);
  ctx.fillStyle = "rgba(101, 82, 61, 0.78)";
  ctx.beginPath();
  for (let i = 0; i < 11; i += 1) {
    const angle = (Math.PI * 2 * i) / 11;
    const distance = baseSize * (0.8 + (i % 2) * 0.22);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(49, 41, 33, 0.95)";
  ctx.lineWidth = Math.max(2, 6 * (1 - progress * 0.4));
  ctx.stroke();
  ctx.restore();
}

function drawLevelBanner() {
  if (state.levelBannerTimer <= 0) {
    return;
  }

  const progress = state.levelBannerTimer / levelBannerDuration;
  ctx.save();
  ctx.globalAlpha = Math.min(1, progress * 1.8);
  ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
  ctx.textAlign = "center";
  ctx.font = "bold 46px Arial";
  const bannerText = state.gameWon ? "All 10 Levels Cleared" : state.bossActive ? `T-Rex Wave ${state.level}` : `Level ${state.level}`;
  ctx.fillText(bannerText, arenaSize / 2, arenaSize / 2 - 10);
  ctx.font = "22px Arial";
  ctx.fillText(state.gameWon ? "You survived the dinosaur valley" : state.bossActive ? "A hungry T-Rex is charging into the hunt" : "Grab 3 loot drops to advance", arenaSize / 2, arenaSize / 2 + 28);
  ctx.restore();
}

function drawStatusOverlay() {
  if (state.isGameOver && state.explosionFrame <= 0) {
    ctx.save();
    ctx.fillStyle = "rgba(18, 16, 20, 0.42)";
    ctx.fillRect(0, 0, arenaSize, arenaSize);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Arial";
      ctx.fillText("The Dinosaurs Got You", arenaSize / 2, arenaSize / 2 - 18);
      ctx.font = "22px Arial";
      ctx.fillText("Press Space to Restart", arenaSize / 2, arenaSize / 2 + 26);
      ctx.restore();
  }

  if (state.gameWon && state.levelBannerTimer <= 0) {
    ctx.save();
    ctx.fillStyle = "rgba(18, 16, 20, 0.42)";
    ctx.fillRect(0, 0, arenaSize, arenaSize);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "bold 40px Arial";
      ctx.fillText("Dinosaur Attack Survived", arenaSize / 2, arenaSize / 2 - 18);
      ctx.font = "22px Arial";
      ctx.fillText("Press Space to Play Again", arenaSize / 2, arenaSize / 2 + 26);
      ctx.restore();
  }
}

leaderboardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (state.scoreSubmitted) {
    submissionStatus.textContent = "Score already submitted for this run.";
    return;
  }
  try {
    await submitScore(auth.user ? auth.user.username : leaderboardNameInput.value.trim());
  } catch (error) {
    submissionStatus.textContent = error.message;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(registerForm);
  try {
    await registerUser(form.get("username").trim(), form.get("password"));
    authStatus.textContent = "Account created and signed in.";
    registerForm.reset();
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  try {
    await loginUser(form.get("username").trim(), form.get("password"));
    authStatus.textContent = "Logged in.";
    loginForm.reset();
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  await logoutUser();
  authStatus.textContent = "Logged out.";
});

difficultySelect.addEventListener("change", () => {
  state.difficultyKey = difficultySelect.value;
  updateDifficultyUI();
  resetGame();
});

soundToggle.addEventListener("click", () => {
  audioState.enabled = !audioState.enabled;
  soundToggle.textContent = `Sound: ${audioState.enabled ? "On" : "Off"}`;
  if (!audioState.enabled) {
    stopMusic();
  } else {
    startMusic();
  }
});

function loop(timestamp = 0) {
  const deltaMs = state.lastTimestamp === 0 ? 16.67 : Math.min(25, timestamp - state.lastTimestamp);
  state.lastTimestamp = timestamp;
  const deltaFactor = deltaMs / 16.67;

  updateDog(deltaFactor);
  drawBackground();
  drawPolice();
  drawBone();
  drawPowerUps();
  drawBombs();
  drawNets();
  drawBullets();
  drawEnemyBullets();
  drawDog();
  drawCaughtNet();
  drawLevelBanner();
  drawStatusOverlay();
  requestAnimationFrame(loop);
}

function setKeyState(event, isPressed) {
  const key = event.key.toLowerCase();
  if (key === " " && isPressed && (state.isGameOver || state.gameWon)) {
    resetGame();
    return;
  }
  if ((key === "x" || key === "enter") && isPressed) {
    fireBullet();
    return;
  }
  if (key === "arrowleft" || key === "a") {
    input.left = isPressed;
  }
  if (key === "arrowright" || key === "d") {
    input.right = isPressed;
  }
  if (key === "arrowup" || key === "w") {
    input.up = isPressed;
  }
  if (key === "arrowdown" || key === "s") {
    input.down = isPressed;
  }
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(event.key)) {
    event.preventDefault();
  }
  if (audioState.enabled) {
    ensureAudioContext();
    startMusic();
  }
  setKeyState(event, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event, false);
});

resetGame();
updateAuthUI();
updateDifficultyUI();
fetchCurrentUser();
loadLeaderboard();
requestAnimationFrame(loop);
