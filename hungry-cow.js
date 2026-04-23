const ROWS = 12;
const COLS = 9;
const WALL_TOTAL = 11;
const START_SECONDS = 100;
const JOINT_MOVE_MS = 3000;
const WALL_MOVE_MS = 10000;
const DIFFICULTIES = {
  soft: { label: "soft", type: "blink", phaseMs: 10000 },
  semi: { label: "semi", type: "move",  moveMs: 10000 },
  hard: { label: "hard", type: "move",  moveMs: 5000  },
};
const TILE = {
  grass: "🌱",
  cow: "🐄",
  wall: "🧱",
  joint: "🚬",
  steak: "🥩",
};

const arenaEl = document.getElementById("arena");
const scoreEl = document.getElementById("score");
const highScoreEl = document.getElementById("highScore");
const timeEl = document.getElementById("time");
const statusEl = document.getElementById("status");

const upBtn = document.getElementById("upBtn");
const downBtn = document.getElementById("downBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const startBtn = document.getElementById("startBtn");
const difficultyModalEl = document.getElementById("difficultyModal");
const diffSoftBtn = document.getElementById("diffSoftBtn");
const diffSemiBtn = document.getElementById("diffSemiBtn");
const diffHardBtn = document.getElementById("diffHardBtn");
const diffCancelBtn = document.getElementById("diffCancelBtn");

let timerLoop = null;
let jointLoop = null;
let bombLoop = null;
let softBombLoop = null;
let wallLoop = null;
let score = 0;
let timeLeft = START_SECONDS;
let highScore = Number(localStorage.getItem("hungry-cow-highscore") || "0");
let dead = true;
let jointMultiplier = 1;
let smokedTooMuchShown = false;
let selectedDifficultyKey = "semi";
let currentDifficulty = DIFFICULTIES[selectedDifficultyKey];

const state = {
  cow: { row: 1, col: 0 },
  walls: [],
  joint: { row: 0, col: 0, active: false },
  bombs: [],
};

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function randomCol() {
  return randomInt(COLS);
}

function updateHud() {
  scoreEl.textContent = String(score);
  highScoreEl.textContent = String(highScore);
  timeEl.textContent = `${timeLeft}s`;
}

function setStatus(text, isDead) {
  statusEl.textContent = text;
  statusEl.classList.toggle("dead", Boolean(isDead));
  statusEl.classList.toggle("live", !isDead);
}

function clearLoops() {
  if (timerLoop) {
    window.clearInterval(timerLoop);
    timerLoop = null;
  }
  if (jointLoop) {
    window.clearInterval(jointLoop);
    jointLoop = null;
  }
  if (bombLoop) {
    window.clearInterval(bombLoop);
    bombLoop = null;
  }
  if (softBombLoop) {
    window.clearInterval(softBombLoop);
    softBombLoop = null;
  }
  if (wallLoop) {
    window.clearInterval(wallLoop);
    wallLoop = null;
  }
}

function sameCell(a, b) {
  return a.row === b.row && a.col === b.col;
}

function wallAt(row, col) {
  return state.walls.find((wall) => wall.row === row && wall.col === col);
}

function isCellFree(row, col) {

  if (state.cow.row === row && state.cow.col === col) {
    return false;
  }

  const hasWall = state.walls.some((wall) => wall.row === row && wall.col === col);

  if (hasWall) {
    return false;
  }

  if (state.joint.active && state.joint.row === row && state.joint.col === col) {
    return false;
  }

  const hasBomb = state.bombs.some((bomb) => bomb.visible && bomb.row === row && bomb.col === col);
  if (hasBomb) {
    return false;
  }

  return true;
}

function randomEmptyCell() {
  for (let i = 0; i < 600; i += 1) {
    const candidate = { row: randomInt(ROWS), col: randomCol() };
    if (isCellFree(candidate.row, candidate.col)) {
      return candidate;
    }
  }

  return null;
}

function createWalls() {
  state.walls = [];
  while (state.walls.length < WALL_TOTAL) {
    const next = randomEmptyCell();
    if (!next) {
      break;
    }
    state.walls.push(next);
  }
}

function createBombs() {
  state.bombs = [];
  const next = randomEmptyCell();
  if (next) {
    state.bombs.push({ row: next.row, col: next.col, visible: true });
  }
}

function repositionBomb(bomb) {
  bomb.visible = false;
  const next = randomEmptyCell();
  if (!next) {
    return;
  }
  bomb.row = next.row;
  bomb.col = next.col;
  bomb.visible = true;
}

function drawGrid() {
  arenaEl.style.gridTemplateColumns = `repeat(${COLS}, minmax(34px, 1fr))`;

  const grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => TILE.grass));

  for (const wall of state.walls) {
    grid[wall.row][wall.col] = TILE.wall;
  }

  if (state.joint.active) {
    grid[state.joint.row][state.joint.col] = TILE.joint;
  }

  grid[state.cow.row][state.cow.col] = dead ? TILE.steak : TILE.cow;

  arenaEl.innerHTML = "";
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = grid[r][c];
      arenaEl.appendChild(cell);
    }
  }
}

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("hungry-cow-highscore", String(highScore));
  }
}

function gameOver(reason) {
  dead = true;
  clearLoops();
  saveHighScore();
  updateHud();
  drawGrid();
  setStatus(`Game over: ${reason}`, true);
  window.alert("BOOM ! You are dead !");
}

function checkBombCollision() {
  for (const bomb of state.bombs) {
    if (bomb.visible && sameCell(state.cow, bomb)) {
      gameOver("bomb hit");
      return true;
    }
  }

  return false;
}

function checkJointPickup() {
  if (!state.joint.active) {
    return;
  }

  if (sameCell(state.cow, state.joint)) {
    state.joint.active = false;
    jointMultiplier = 2;
    setStatus("You found a joint, you are high now.", false);
    window.alert("You found a joint, you are high now !");
  }
}

function moveJoint() {
  if (dead) {
    return;
  }

  if (!state.joint.active) {
    return;
  }

  const next = randomEmptyCell();
  if (next) {
    state.joint.row = next.row;
    state.joint.col = next.col;
  }

  drawGrid();
}

function moveBombs() {
  if (dead) {
    return;
  }

  for (const bomb of state.bombs) {
    repositionBomb(bomb);
  }

  if (checkBombCollision()) {
    return;
  }

  drawGrid();
}

function moveRandomWall() {
  if (dead || state.walls.length === 0) {
    return;
  }

  const movingIndex = randomInt(state.walls.length);
  const oldWall = state.walls[movingIndex];

  state.walls.splice(movingIndex, 1);
  const next = randomEmptyCell();

  if (next) {
    state.walls.splice(movingIndex, 0, next);
  } else {
    state.walls.splice(movingIndex, 0, oldWall);
  }

  if (checkBombCollision()) {
    return;
  }

  drawGrid();
}

function moveCow(dir) {
  if (dead) {
    return;
  }

  const next = { row: state.cow.row, col: state.cow.col };

  if (dir === "up") {
    next.row = Math.max(0, state.cow.row - 1);
  }

  if (dir === "down") {
    next.row = Math.min(ROWS - 1, state.cow.row + 1);
  }

  if (dir === "left") {
    next.col = Math.max(0, state.cow.col - 1);
  }

  if (dir === "right") {
    next.col = Math.min(COLS - 1, state.cow.col + 1);
  }

  if (sameCell(next, state.cow)) {
    return;
  }

  if (wallAt(next.row, next.col)) {
    setStatus("Blocked by wall.", false);
    return;
  }

  state.cow = next;

  if (checkBombCollision()) {
    return;
  }

  checkJointPickup();
  score += jointMultiplier;

  if (!smokedTooMuchShown && score >= 420) {
    smokedTooMuchShown = true;
    window.alert("You smoked too much grass");
  }

  if (score > highScore) {
    highScore = score;
    localStorage.setItem("hungry-cow-highscore", String(highScore));
  }

  updateHud();
  drawGrid();
}

function chooseDifficultyWithButtons() {
  return new Promise((resolve) => {
    difficultyModalEl.classList.remove("hidden");
    difficultyModalEl.setAttribute("aria-hidden", "false");

    const close = (value) => {
      difficultyModalEl.classList.add("hidden");
      difficultyModalEl.setAttribute("aria-hidden", "true");
      diffSoftBtn.removeEventListener("click", onSoft);
      diffSemiBtn.removeEventListener("click", onSemi);
      diffHardBtn.removeEventListener("click", onHard);
      diffCancelBtn.removeEventListener("click", onCancel);
      resolve(value);
    };

    const onSoft = () => close("soft");
    const onSemi = () => close("semi");
    const onHard = () => close("hard");
    const onCancel = () => close(null);

    diffSoftBtn.addEventListener("click", onSoft);
    diffSemiBtn.addEventListener("click", onSemi);
    diffHardBtn.addEventListener("click", onHard);
    diffCancelBtn.addEventListener("click", onCancel);
  });
}

async function startGame() {
  const chosenDifficulty = await chooseDifficultyWithButtons();
  if (!chosenDifficulty) {
    setStatus("Start cancelled. Press Start / Reset and choose Soft, Semi, or Hard.", false);
    return;
  }

  selectedDifficultyKey = chosenDifficulty;
  currentDifficulty = DIFFICULTIES[selectedDifficultyKey];

  clearLoops();
  score = 0;
  timeLeft = START_SECONDS;
  dead = false;
  jointMultiplier = 1;
  smokedTooMuchShown = false;
  state.cow = { row: 1, col: 0 };
  state.joint.active = true;
  state.joint.row = 0;
  state.joint.col = 0;
  createWalls();
  createBombs();
  moveJoint();

  updateHud();
  drawGrid();
  setStatus(`Game started on ${currentDifficulty.label}. Move and survive.`, false);

  timerLoop = window.setInterval(() => {
    if (dead) {
      return;
    }

    timeLeft -= 1;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      gameOver("time is up");
      return;
    }

    updateHud();
  }, 1000);

  jointLoop = window.setInterval(moveJoint, JOINT_MOVE_MS);

  if (currentDifficulty.type === "blink") {
    // soft: visible 10s → hidden 10s → respawn 10s, looping
    let softPhase = "visible";
    softBombLoop = window.setInterval(() => {
      if (dead) {
        return;
      }
      if (softPhase === "visible") {
        softPhase = "hidden";
        for (const bomb of state.bombs) {
          bomb.visible = false;
        }
        drawGrid();
      } else {
        softPhase = "visible";
        for (const bomb of state.bombs) {
          repositionBomb(bomb);
        }
        checkBombCollision();
        drawGrid();
      }
    }, currentDifficulty.phaseMs);
  } else {
    bombLoop = window.setInterval(moveBombs, currentDifficulty.moveMs);
  }

  wallLoop = window.setInterval(moveRandomWall, WALL_MOVE_MS);
}

upBtn.addEventListener("click", () => moveCow("up"));
downBtn.addEventListener("click", () => moveCow("down"));
leftBtn.addEventListener("click", () => moveCow("left"));
rightBtn.addEventListener("click", () => moveCow("right"));
startBtn.addEventListener("click", startGame);

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    moveCow("up");
  }
  if (event.key === "ArrowDown") {
    moveCow("down");
  }
  if (event.key === "ArrowLeft") {
    moveCow("left");
  }
  if (event.key === "ArrowRight") {
    moveCow("right");
  }
  if (event.key === "Enter" || event.key.toLowerCase() === "r") {
    startGame();
  }
});

updateHud();
drawGrid();
