/* ============================================================
   SAFE IMAGE LOADER
   ============================================================ */

function loadImg(src, fallbackColor, name) {
  const img = new Image();
  img.src = src;

  img.onerror = () => {
    console.error("❌ FAILED TO LOAD:", name, "→", src);

    const c = document.createElement("canvas");
    c.width = 80;
    c.height = 140;
    const ctx2 = c.getContext("2d");
    ctx2.fillStyle = fallbackColor;
    ctx2.fillRect(0, 0, 80, 140);

    img.src = c.toDataURL();
  };

  img.onload = () => {
    console.log("✅ LOADED:", name);
  };

  return img;
}

/* ============================================================
   LOAD IMAGES
   ============================================================ */

const carSportImg  = loadImg("assets/car-sport.png",  "#ff5b6b", "Sport Car");
const carMuscleImg = loadImg("assets/car-muscle.png", "#4b8bff", "Muscle Car");
const carJeepImg   = loadImg("assets/car-jeep.png",   "#52ff8b", "Offroad Jeep");

const policeImg    = loadImg("assets/police.png",     "#ffffff", "Police");

const brokenCarImg = loadImg("assets/broken-car.png", "#888", "Broken Car");
const spikeImg     = loadImg("assets/spike.png",      "#555", "Spike");

/* ============================================================
   DOM ELEMENTS
   ============================================================ */

const menuScreen = document.getElementById("menu-screen");
const gameScreen = document.getElementById("game-screen");
const startBtn = document.getElementById("start-btn");
const carButtons = document.querySelectorAll(".car-option");

const pauseBtn = document.getElementById("pause-btn");
const scoreEl = document.getElementById("score");
const cashEl = document.getElementById("cash");

const gameOverOverlay = document.getElementById("game-over");
const finalScoreEl = document.getElementById("final-score");
const restartBtn = document.getElementById("restart-btn");
const backMenuBtn = document.getElementById("back-menu-btn");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

/* ============================================================
   GAME STATE
   ============================================================ */

let selectedCarType = null;
let gameRunning = false;
let gamePaused = false;

let player, police;
let obstacles = [];

let score = 0;
let cash = 0;
let lastTime = 0;

const road = {
  laneCount: 3,
  laneWidth: canvas.width / 3,
  scrollY: 0,
  scrollSpeed: 230
};

/* ============================================================
   CAR CLASS
   ============================================================ */

class Car {
  constructor(lane, y, img, w = 80, h = 140) {
    this.img = img;
    this.width = w;
    this.height = h;
    this.y = y;

    this.targetLane = lane;
    this.updateLanePositions();
    this.x = this.laneXOffsets[this.targetLane];
  }

  updateLanePositions() {
    this.laneXOffsets = [
      road.laneWidth * 0.5 - this.width / 2,
      road.laneWidth * 1.5 - this.width / 2,
      road.laneWidth * 2.5 - this.width / 2
    ];
  }

  setLane(lane) {
    this.targetLane = lane;
  }

  update(dt) {
    this.updateLanePositions();
    const targetX = this.laneXOffsets[this.targetLane];
    this.x += (targetX - this.x) * (8 * dt);
  }

  draw(ctx) {
    ctx.save();
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 20;
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    ctx.restore();
  }

  getBounds() {
    return {
      x: this.x + 10,
      y: this.y + 30,
      width: this.width - 20,
      height: this.height - 40
    };
  }
}

/* ============================================================
   OBSTACLES
   ============================================================ */

class BrokenCar {
  constructor(lane, y) {
    this.width = 90;
    this.height = 150;
    this.img = brokenCarImg;

    this.x = road.laneWidth * (lane + 0.5) - this.width / 2;
    this.y = y;
  }

  update(dt) {}

  draw(ctx) {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}

class SpikeObstacle {
  constructor(lane, y) {
    this.width = 100;
    this.height = 40;

    this.img = spikeImg;

    this.x = road.laneWidth * (lane + 0.5) - this.width / 2;
    this.y = y;
  }

  update(dt) {}

  draw(ctx) {
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }
}

/* ============================================================
   PLAYER + POLICE CREATION
   ============================================================ */

function createPlayer() {
  let img = carSportImg;
  if (selectedCarType === "muscle") img = carMuscleImg;
  if (selectedCarType === "jeep") img = carJeepImg;

  return new Car(1, canvas.height - 180, img);
}

function createPolice() {
  return new Car(1, canvas.height - 350, policeImg);
}

/* ============================================================
   POLICE BEHIND PLAYER — FINAL FIXED LOGIC
   ============================================================ */

function updatePolice(dt) {
  police.updateLanePositions();

  // police always in middle lane
  police.targetLane = 1;

  // smooth X follow
  const targetX = police.laneXOffsets[1];
  police.x += (targetX - police.x) * (5 * dt);

  // --- FINAL FIX ---
  // police should be BELOW player (behind in top view)
  let targetY = player.y + player.height + 40;

  // but must not go outside screen
  const maxY = canvas.height - police.height - 10;
  targetY = Math.min(targetY, maxY);

  police.y += (targetY - police.y) * (6 * dt);
}

/* ============================================================
   ROAD
   ============================================================ */

function drawRoad(ctx, dt) {
  road.scrollY += road.scrollSpeed * dt;
  if (road.scrollY > 40) road.scrollY = 0;

  ctx.fillStyle = "#171c2b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#eeeeff33";
  ctx.lineWidth = 4;

  const dash = 24, gap = 24;

  for (let l = 1; l < 3; l++) {
    let x = l * road.laneWidth;

    for (let y = -dash; y < canvas.height + dash; y += dash + gap) {
      ctx.beginPath();
      ctx.moveTo(x, y + road.scrollY);
      ctx.lineTo(x, y + dash + road.scrollY);
      ctx.stroke();
    }
  }
}

/* ============================================================
   SPAWNING
   ============================================================ */

let obstacleTimer = 0;

function spawnObstacle() {
  const lane = Math.floor(Math.random() * 3);
  const y = -200;
  const r = Math.random();

  if (r < 0.55) obstacles.push(new BrokenCar(lane, y));
  else obstacles.push(new SpikeObstacle(lane, y));
}

/* ============================================================
   UPDATE LOOP
   ============================================================ */

function resetGame() {
  score = 0;
  cash = 0;
  obstacles = [];

  player = createPlayer();
  police = createPolice();
}

function update(dt) {
  drawRoad(ctx, dt);

  player.update(dt);
  updatePolice(dt);

  // spawn obstacles
  obstacleTimer += dt;
  if (obstacleTimer > 1.2) {
    obstacleTimer = 0;
    spawnObstacle();
  }

  // draw & check obstacle collision
  for (let o of obstacles) {
    o.update(dt);
    o.draw(ctx);

    if (rectOverlap(player.getBounds(), o.getBounds())) {
      endGame();
      return;
    }
  }

  // DRAW ORDER (IMPORTANT!)
  police.draw(ctx);  // police below
  player.draw(ctx);  // player on top

  // score update
  score += dt * 10;
  scoreEl.textContent = Math.floor(score);
}

function rectOverlap(a, b) {
  return !(a.x + a.width < b.x ||
           a.x > b.x + b.width ||
           a.y + a.height < b.y ||
           a.y > b.y + b.height);
}

/* ============================================================
   GAME LOOP
   ============================================================ */

function gameLoop(t) {
  if (!gameRunning) return;

  let dt = (t - lastTime) / 1000 || 0;
  lastTime = t;

  if (!gamePaused) update(dt);

  requestAnimationFrame(gameLoop);
}

/* ============================================================
   UI EVENTS
   ============================================================ */

startBtn.onclick = () => {
  menuScreen.classList.remove("active");
  gameScreen.classList.add("active");

  resetGame();
  gameRunning = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
};

carButtons.forEach(btn => {
  btn.onclick = () => {
    carButtons.forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");

    selectedCarType = btn.dataset.car;
    startBtn.disabled = false;
  };
});

// movement
document.addEventListener("keydown", e => {
  if (!player) return;

  if (e.key === "ArrowLeft" || e.key === "a")
    player.setLane(Math.max(0, player.targetLane - 1));

  if (e.key === "ArrowRight" || e.key === "d")
    player.setLane(Math.min(2, player.targetLane + 1));
});

// pause
pauseBtn.onclick = () => {
  if (!gameRunning) return;
  gamePaused = !gamePaused;
  pauseBtn.textContent = gamePaused ? "▶️" : "⏸";
};

// end game
function endGame() {
  gameRunning = false;
  finalScoreEl.textContent = scoreEl.textContent;
  gameOverOverlay.classList.remove("hidden");
}

restartBtn.onclick = () => location.reload();
backMenuBtn.onclick = () => location.reload();
