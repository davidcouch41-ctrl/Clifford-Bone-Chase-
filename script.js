const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const arenaSize = canvas.width;
const baseSpeed = 5.4;
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

const scoreLabel = document.querySelector(".stats");

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
  slowTimer: 0,
  tailCooldown: 0,
  levelBannerTimer: 0,
  gameWon: false,
  isGameOver: false,
  bone: null,
  guards: [],
  nets: [],
  bullets: [],
  powerUps: [],
  bombs: [],
  bombTimer: 0,
  explosionFrame: 0,
  explosionBursts: [],
  lastTimestamp: 0,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
};

function updateHud() {
  scoreLabel.innerHTML = `
    <p>Level: <span>${state.level}</span></p>
    <p>Bones: <span id="score">${dog.totalBones}</span></p>
    <p>Goal: <span id="width">${dog.bonesThisLevel}/${bonesPerLevel}</span></p>
    <p>Gun: <span>${state.ammo > 0 ? state.ammo : "none"}</span></p>
  `;
}

function spawnBone() {
  return {
    x: 70 + Math.random() * (arenaSize - 140),
    y: 70 + Math.random() * (arenaSize - 140),
  };
}

function createGuards(level) {
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

  return perimeterSpots.slice(0, level).map((spot, index) => ({
    x: spot.x,
    y: spot.y,
    alive: true,
    cooldown: 25 + index * 10,
    interval: Math.max(70, 120 - level * 4 + index * 6),
  }));
}

function spawnPowerUp() {
  if (state.powerUps.length > 0) {
    return;
  }

  const type = Math.random() < 0.55 ? "gun" : "speed";
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
  buildExplosion();
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
  state.slowTimer = 0;
  state.tailCooldown = 0;
  state.levelBannerTimer = levelBannerDuration;
  state.gameWon = false;
  state.isGameOver = false;
  state.bone = spawnBone();
  state.guards = createGuards(1);
  state.nets = [];
  state.bullets = [];
  state.powerUps = [];
  state.bombs = [];
  state.bombTimer = 120;
  state.explosionFrame = 0;
  state.explosionBursts = [];
  state.lastTimestamp = 0;
  updateHud();
}

function startNextLevel() {
  if (state.level === maxLevel) {
    state.gameWon = true;
    state.levelBannerTimer = levelBannerDuration + 30;
    state.nets = [];
    return;
  }

  state.level += 1;
  dog.bonesThisLevel = 0;
  state.guards = createGuards(state.level);
  state.nets = [];
  state.bullets = [];
  state.powerUps = [];
  state.bombs = [];
  state.bombTimer = Math.max(90, 130 - state.level * 4);
  state.bone = spawnBone();
  state.levelBannerTimer = levelBannerDuration;
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
    state.ammo += 6;
    state.gunTimer = 600;
  }

  if (type === "speed") {
    state.speedTimer = 300;
  }

  updateHud();
}

function spawnNet(guard) {
  const pose = getDogPose();
  const dx = pose.headX - guard.x;
  const dy = pose.headY - guard.y;
  const distance = Math.hypot(dx, dy) || 1;
  state.nets.push({
    x: guard.x,
    y: guard.y,
    vx: (dx / distance) * netSpeed,
    vy: (dy / distance) * netSpeed,
    radius: netRadius,
    life: 260,
    spin: Math.random() * Math.PI * 2,
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
  updateHud();
}

function updateTimers(deltaFactor) {
  if (state.gunTimer > 0) {
    state.gunTimer -= deltaFactor;
  }
  if (state.speedTimer > 0) {
    state.speedTimer -= deltaFactor;
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

function updateGuardsAndNets(deltaFactor) {
  const pose = getDogPose();

  for (const guard of state.guards) {
    if (!guard.alive) {
      continue;
    }

    guard.cooldown -= deltaFactor;
    if (guard.cooldown <= 0) {
      spawnNet(guard);
      guard.cooldown = guard.interval;
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
      triggerExplosion();
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
    state.bombTimer = Math.max(55, 130 - state.level * 7);
  }

  state.bombs = state.bombs.filter((bomb) => {
    bomb.height -= bomb.fallSpeed * deltaFactor;

    if (bomb.height <= 0) {
      if (Math.hypot(bomb.targetX - pose.headX, bomb.targetY - pose.headY) <= pose.headRadius + bomb.radius + 4) {
        triggerExplosion();
      }
      return false;
    }

    return true;
  });
}

function updateDog(deltaFactor) {
  if (state.isGameOver) {
    if (state.explosionFrame > 0) {
      state.explosionFrame -= deltaFactor;
    }
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

  let moveSpeed = baseSpeed;
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
    triggerExplosion();
    return;
  }

  if (touchesOwnTail(nextX, nextY)) {
    state.slowTimer = 140;
    state.tailCooldown = 110;
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
  updateGuardsAndNets(deltaFactor);
  updateBombs(deltaFactor);
}

function drawBackground() {
  ctx.clearRect(0, 0, arenaSize, arenaSize);
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 60; i < arenaSize; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, arenaSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(arenaSize, i);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBone() {
  const bone = state.bone;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(bone.x - 14, bone.y - 10, 9, 0, Math.PI * 2);
  ctx.arc(bone.x - 14, bone.y + 10, 9, 0, Math.PI * 2);
  ctx.arc(bone.x + 14, bone.y - 10, 9, 0, Math.PI * 2);
  ctx.arc(bone.x + 14, bone.y + 10, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(bone.x - 11, bone.y - 6);
  ctx.lineTo(bone.x + 11, bone.y - 6);
  ctx.arc(bone.x + 11, bone.y, 6, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(bone.x - 11, bone.y + 6);
  ctx.arc(bone.x - 11, bone.y, 6, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e7f1f5";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(bone.x - 12, bone.y - 2);
  ctx.lineTo(bone.x + 12, bone.y - 2);
  ctx.moveTo(bone.x - 12, bone.y + 2);
  ctx.lineTo(bone.x + 12, bone.y + 2);
  ctx.stroke();
  ctx.restore();
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
  const { headX, headY, bodyPoint, rumpPoint, bodyAngle, forwardX, forwardY, normalX, normalY, bodyRadius, headRadius, neckRadius, rumpRadius } = pose;
  const backX = -forwardX;
  const backY = -forwardY;
  const chestX = headX - forwardX * dog.radius * 0.42;
  const chestY = headY - forwardY * dog.radius * 0.42;
  const bellyX = (bodyPoint.x + rumpPoint.x) / 2 + normalX * bodyRadius * 0.28;
  const bellyY = (bodyPoint.y + rumpPoint.y) / 2 + normalY * bodyRadius * 0.28;

  ctx.save();

  const tailBaseX = rumpPoint.x + backX * bodyRadius * 0.18;
  const tailBaseY = rumpPoint.y + backY * bodyRadius * 0.18;
  const tailTipX = tailBaseX + backX * bodyRadius * 0.65 - normalX * bodyRadius * 0.38;
  const tailTipY = tailBaseY + backY * bodyRadius * 0.65 - normalY * bodyRadius * 0.38;
  ctx.strokeStyle = "#bc1212";
  ctx.lineWidth = Math.max(7, dog.radius * 0.16);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(tailBaseX, tailBaseY);
  ctx.lineTo(tailTipX, tailTipY);
  ctx.stroke();
  ctx.fillStyle = "#c41f1f";
  ctx.beginPath();
  ctx.arc(tailTipX, tailTipY, dog.radius * 0.1, 0, Math.PI * 2);
  ctx.fill();

  drawConnectedBody(
    { x: headX - forwardX * bodyRadius * 0.24, y: headY - forwardY * bodyRadius * 0.24 },
    bodyPoint,
    rumpPoint,
    headRadius,
    bodyRadius,
    rumpRadius,
  );

  ctx.fillStyle = "#f6d7bf";
  ctx.beginPath();
  ctx.ellipse(
    bellyX,
    bellyY,
    bodyRadius * 0.92,
    bodyRadius * 0.3,
    bodyAngle,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.fillStyle = "#ef5757";
  ctx.beginPath();
  ctx.ellipse(bodyPoint.x - normalX * bodyRadius * 0.14, bodyPoint.y - normalY * bodyRadius * 0.14, bodyRadius * 0.42, bodyRadius * 0.18, bodyAngle - 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c91d1d";
  ctx.beginPath();
  ctx.ellipse(rumpPoint.x - normalX * bodyRadius * 0.06, rumpPoint.y - normalY * bodyRadius * 0.05, bodyRadius * 0.5, bodyRadius * 0.42, bodyAngle, 0, Math.PI * 2);
  ctx.fill();

  const legSpread = dog.radius * 0.24;
  drawLeg(bodyPoint.x + backX * dog.radius * 0.28 + normalX * legSpread, bodyPoint.y + backY * dog.radius * 0.28 + normalY * legSpread, dog.radius * 0.8, bodyAngle, "#f7d9ca");
  drawLeg(bodyPoint.x + backX * dog.radius * 0.28 - normalX * legSpread, bodyPoint.y + backY * dog.radius * 0.28 - normalY * legSpread, dog.radius * 0.8, bodyAngle, "#f7d9ca");
  drawLeg(rumpPoint.x - backX * dog.radius * 0.12 + normalX * legSpread, rumpPoint.y - backY * dog.radius * 0.12 + normalY * legSpread, dog.radius * 0.78, bodyAngle, "#f7d9ca");
  drawLeg(rumpPoint.x - backX * dog.radius * 0.12 - normalX * legSpread, rumpPoint.y - backY * dog.radius * 0.12 - normalY * legSpread, dog.radius * 0.78, bodyAngle, "#f7d9ca");

  ctx.fillStyle = "#cf1f1f";
  ctx.beginPath();
  ctx.ellipse(chestX, chestY, neckRadius, neckRadius * 0.72, bodyAngle, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6d7bf";
  ctx.beginPath();
  ctx.ellipse(chestX + normalX * dog.radius * 0.2, chestY + normalY * dog.radius * 0.18, neckRadius * 0.42, neckRadius * 0.28, bodyAngle, 0, Math.PI * 2);
  ctx.fill();

  const leftEarX = headX - forwardX * headRadius * 0.18 + Math.cos(bodyAngle - 1.7) * headRadius * 0.72;
  const leftEarY = headY - forwardY * headRadius * 0.18 + Math.sin(bodyAngle - 1.7) * headRadius * 0.72;
  const rightEarX = headX - forwardX * headRadius * 0.18 + Math.cos(bodyAngle + 1.7) * headRadius * 0.72;
  const rightEarY = headY - forwardY * headRadius * 0.18 + Math.sin(bodyAngle + 1.7) * headRadius * 0.72;
  drawEar(leftEarX, leftEarY, bodyAngle - 0.28, headRadius * 0.9);
  drawEar(rightEarX, rightEarY, bodyAngle + 0.28, headRadius * 0.9);

  ctx.fillStyle = "#c21d1d";
  ctx.beginPath();
  ctx.ellipse(
    headX - forwardX * headRadius * 0.08,
    headY - forwardY * headRadius * 0.02,
    headRadius * 0.96,
    headRadius * 0.84,
    bodyAngle,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "#d62323";
  ctx.beginPath();
  ctx.arc(headX, headY, headRadius * 0.9, 0, Math.PI * 2);
  ctx.fill();

  const muzzleX = headX + forwardX * headRadius * 0.8;
  const muzzleY = headY + forwardY * headRadius * 0.72;
  ctx.fillStyle = "#f1d6c7";
  ctx.beginPath();
  ctx.ellipse(muzzleX, muzzleY, headRadius * 0.7, headRadius * 0.46, bodyAngle, 0, Math.PI * 2);
  ctx.fill();

  const leftEyeX = headX + Math.cos(bodyAngle - 0.46) * headRadius * 0.26;
  const leftEyeY = headY + Math.sin(bodyAngle - 0.46) * headRadius * 0.18 - headRadius * 0.03;
  const rightEyeX = headX + Math.cos(bodyAngle + 0.46) * headRadius * 0.26;
  const rightEyeY = headY + Math.sin(bodyAngle + 0.46) * headRadius * 0.18 - headRadius * 0.03;
  ctx.fillStyle = "#1f1515";
  ctx.beginPath();
  ctx.arc(leftEyeX, leftEyeY, headRadius * 0.095, 0, Math.PI * 2);
  ctx.arc(rightEyeX, rightEyeY, headRadius * 0.095, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(leftEyeX - headRadius * 0.025, leftEyeY - headRadius * 0.03, headRadius * 0.03, 0, Math.PI * 2);
  ctx.arc(rightEyeX - headRadius * 0.025, rightEyeY - headRadius * 0.03, headRadius * 0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f1515";
  ctx.beginPath();
  ctx.ellipse(
    muzzleX + forwardX * headRadius * 0.12,
    muzzleY - forwardY * headRadius * 0.02,
    headRadius * 0.16,
    headRadius * 0.12,
    bodyAngle,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.strokeStyle = "#6f1111";
  ctx.lineWidth = Math.max(2, headRadius * 0.05);
  ctx.beginPath();
  ctx.arc(
    muzzleX,
    muzzleY + headRadius * 0.06,
    headRadius * 0.24,
    0.28,
    Math.PI - 0.28,
  );
  ctx.stroke();

  ctx.fillStyle = "#ffb0bb";
  ctx.beginPath();
  ctx.arc(headX + Math.cos(bodyAngle - 1.92) * headRadius * 0.38, headY + Math.sin(bodyAngle - 1.92) * headRadius * 0.38 + headRadius * 0.08, headRadius * 0.08, 0, Math.PI * 2);
  ctx.arc(headX + Math.cos(bodyAngle + 1.92) * headRadius * 0.38, headY + Math.sin(bodyAngle + 1.92) * headRadius * 0.38 + headRadius * 0.08, headRadius * 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(bellyX + backX * bodyRadius * 0.1, bellyY + backY * bodyRadius * 0.04, bodyRadius * 0.18, bodyRadius * 0.06, bodyAngle, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPolice() {
  for (const guard of state.guards) {
    if (!guard.alive) {
      continue;
    }

    ctx.save();
    ctx.strokeStyle = "#4c84ff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";

    ctx.fillStyle = "#f6d7bf";
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 22, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#163b8f";
    ctx.fillRect(guard.x - 11, guard.y - 31, 22, 7);
    ctx.fillStyle = "#2f5fd7";
    ctx.fillRect(guard.x - 10, guard.y - 12, 20, 27);

    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y - 12);
    ctx.lineTo(guard.x, guard.y + 16);
    ctx.moveTo(guard.x - 12, guard.y - 2);
    ctx.lineTo(guard.x + 14, guard.y + 6);
    ctx.moveTo(guard.x, guard.y + 16);
    ctx.lineTo(guard.x - 10, guard.y + 34);
    ctx.moveTo(guard.x, guard.y + 16);
    ctx.lineTo(guard.x + 10, guard.y + 34);
    ctx.stroke();
    ctx.restore();
  }
}

function drawNet(net) {
  ctx.save();
  ctx.translate(net.x, net.y);
  ctx.rotate(net.spin);
  ctx.strokeStyle = "rgba(235, 244, 255, 0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * net.radius, Math.sin(angle) * net.radius);
  }
  ctx.stroke();
  for (let ring = 0.35; ring <= 1; ring += 0.3) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      const x = Math.cos(angle) * net.radius * ring;
      const y = Math.sin(angle) * net.radius * ring;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
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
    } else {
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
    ctx.fillStyle = "#2b2b2b";
    ctx.beginPath();
    ctx.arc(bomb.targetX, drawY, bomb.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#454545";
    ctx.beginPath();
    ctx.arc(bomb.targetX - 4, drawY - 4, bomb.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3a933";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(bomb.targetX + 4, drawY - 10);
    ctx.lineTo(bomb.targetX + 10, drawY - 18);
    ctx.stroke();
    ctx.restore();
  }
}

function drawExplosion() {
  if (!state.isGameOver && state.explosionFrame <= 0) {
    return;
  }

  const progress = 1 - state.explosionFrame / explosionDuration;
  const baseSize = dog.radius + progress * 80;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = Math.max(2, 8 * (1 - progress));
  ctx.beginPath();
  ctx.arc(dog.x, dog.y, baseSize * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(dog.x, dog.y, baseSize, 0, Math.PI * 2);
  ctx.stroke();
  for (const burst of state.explosionBursts) {
    const distance = progress * 95 * burst.speed;
    const x = dog.x + Math.cos(burst.angle) * distance;
    const y = dog.y + Math.sin(burst.angle) * distance;
    const size = burst.size * (1 - progress * 0.55);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.beginPath();
  ctx.arc(dog.x, dog.y, baseSize * 0.38, 0, Math.PI * 2);
  ctx.fill();
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
  const bannerText = state.gameWon ? "All 10 Levels Cleared" : `Level ${state.level}`;
  ctx.fillText(bannerText, arenaSize / 2, arenaSize / 2 - 10);
  ctx.font = "22px Arial";
  ctx.fillText(state.gameWon ? "Clifford Escaped the Guards" : "Collect 3 bones to advance", arenaSize / 2, arenaSize / 2 + 28);
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
    ctx.fillText("Clifford Exploded", arenaSize / 2, arenaSize / 2 - 18);
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
    ctx.fillText("Clifford Wins", arenaSize / 2, arenaSize / 2 - 18);
    ctx.font = "22px Arial";
    ctx.fillText("Press Space to Play Again", arenaSize / 2, arenaSize / 2 + 26);
    ctx.restore();
  }
}

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
  if (!state.isGameOver) {
    drawDog();
  }
  drawExplosion();
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
  setKeyState(event, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event, false);
});

resetGame();
requestAnimationFrame(loop);
