(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const context = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");
  const scoreEl = document.getElementById("score");
  const bestScoreEl = document.getElementById("bestScore");

  const gridCellCount = 20; // 20x20 board
  const drawScale = Math.floor(canvas.width / gridCellCount);
  const boardSizePx = drawScale * gridCellCount; // ensure perfect fit

  // Ensure sharp rendering on high-DPI screens
  const dpi = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.width = boardSizePx * dpi;
  canvas.height = boardSizePx * dpi;
  canvas.style.width = boardSizePx + "px";
  canvas.style.height = boardSizePx + "px";
  context.setTransform(dpi, 0, 0, dpi, 0, 0);

  const initialSnakeLength = 4;
  const stepMsInitial = 120; // lower = faster
  const minStepMs = 60;
  const speedupEveryFood = 5; // speed up every N foods
  const speedupDelta = 6; // ms faster each time

  /** @typedef {{x:number, y:number}} Point */

  /**
   * Game state singleton
   */
  const gameState = {
    snake: /** @type {Point[]} */ ([]),
    direction: /** @type {Point} */ ({ x: 1, y: 0 }),
    nextDirection: /** @type {Point} */ ({ x: 1, y: 0 }),
    food: /** @type {Point} */ ({ x: 10, y: 10 }),
    score: 0,
    bestScore: Number(localStorage.getItem("snake_best") || 0),
    stepMs: stepMsInitial,
    foodEatenCount: 0,
    paused: false,
    gameOver: false,
  };

  bestScoreEl.textContent = String(gameState.bestScore);

  /** Utility functions */
  function equalPoints(a, b) { return a.x === b.x && a.y === b.y; }
  function inBounds(p) { return p.x >= 0 && p.x < gridCellCount && p.y >= 0 && p.y < gridCellCount; }
  function randomInt(maxExclusive) { return Math.floor(Math.random() * maxExclusive); }

  function placeFood() {
    while (true) {
      const p = { x: randomInt(gridCellCount), y: randomInt(gridCellCount) };
      if (!gameState.snake.some(s => equalPoints(s, p))) {
        gameState.food = p;
        return;
      }
    }
  }

  function resetGame() {
    gameState.snake = [];
    const startX = Math.floor(gridCellCount / 3);
    const startY = Math.floor(gridCellCount / 2);
    for (let i = initialSnakeLength - 1; i >= 0; i -= 1) {
      gameState.snake.push({ x: startX - i, y: startY });
    }
    gameState.direction = { x: 1, y: 0 };
    gameState.nextDirection = { x: 1, y: 0 };
    gameState.score = 0;
    gameState.foodEatenCount = 0;
    gameState.stepMs = stepMsInitial;
    gameState.paused = false;
    gameState.gameOver = false;
    scoreEl.textContent = "0";
    overlay.classList.add("hidden");
    placeFood();
  }

  function setDirection(newDir) {
    // Prevent 180-degree turns
    const curr = gameState.direction;
    if ((curr.x + newDir.x === 0) && (curr.y + newDir.y === 0)) return;
    gameState.nextDirection = newDir;
  }

  // Input: keyboard
  window.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault(); setDirection({ x: 0, y: -1 }); break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault(); setDirection({ x: 0, y: 1 }); break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault(); setDirection({ x: -1, y: 0 }); break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault(); setDirection({ x: 1, y: 0 }); break;
      case " ": // Space
      case "p":
      case "P":
        e.preventDefault(); togglePause(); break;
      case "Enter":
        if (gameState.gameOver) { resetGame(); }
        break;
    }
  });

  // Input: on-screen buttons
  document.getElementById("btnUp").addEventListener("click", () => setDirection({ x: 0, y: -1 }));
  document.getElementById("btnDown").addEventListener("click", () => setDirection({ x: 0, y: 1 }));
  document.getElementById("btnLeft").addEventListener("click", () => setDirection({ x: -1, y: 0 }));
  document.getElementById("btnRight").addEventListener("click", () => setDirection({ x: 1, y: 0 }));
  document.getElementById("btnPause").addEventListener("click", () => togglePause());
  document.getElementById("btnRestart").addEventListener("click", () => resetGame());

  function togglePause() {
    if (gameState.gameOver) return;
    gameState.paused = !gameState.paused;
    if (gameState.paused) {
      showOverlay("Paused — press Space to resume");
    } else {
      hideOverlay();
    }
  }

  function showOverlay(message) {
    overlay.textContent = message;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  function gameStep() {
    if (gameState.paused || gameState.gameOver) return;

    // apply queued direction once per tick
    gameState.direction = gameState.nextDirection;

    const head = gameState.snake[gameState.snake.length - 1];
    const nextHead = { x: head.x + gameState.direction.x, y: head.y + gameState.direction.y };

    // collision with walls
    if (!inBounds(nextHead)) {
      return gameLose();
    }

    // collision with self
    if (gameState.snake.some(s => equalPoints(s, nextHead))) {
      return gameLose();
    }

    // move snake
    gameState.snake.push(nextHead);

    // check food
    if (equalPoints(nextHead, gameState.food)) {
      gameState.score += 1;
      scoreEl.textContent = String(gameState.score);
      gameState.foodEatenCount += 1;
      if (gameState.foodEatenCount % speedupEveryFood === 0) {
        gameState.stepMs = Math.max(minStepMs, gameState.stepMs - speedupDelta);
        restartTimer();
      }
      placeFood();
    } else {
      // remove tail if not growing
      gameState.snake.shift();
    }

    draw();
  }

  function gameLose() {
    gameState.gameOver = true;
    if (gameState.score > gameState.bestScore) {
      gameState.bestScore = gameState.score;
      localStorage.setItem("snake_best", String(gameState.bestScore));
      bestScoreEl.textContent = String(gameState.bestScore);
    }
    showOverlay("Game Over — press Enter or Restart");
  }

  function drawGrid() {
    context.save();
    context.strokeStyle = "#14203d";
    context.lineWidth = 1;
    for (let i = 1; i < gridCellCount; i += 1) {
      // vertical
      context.beginPath();
      context.moveTo(i * drawScale + 0.5, 0);
      context.lineTo(i * drawScale + 0.5, boardSizePx);
      context.stroke();
      // horizontal
      context.beginPath();
      context.moveTo(0, i * drawScale + 0.5);
      context.lineTo(boardSizePx, i * drawScale + 0.5);
      context.stroke();
    }
    context.restore();
  }

  function drawRoundedRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
    context.fill();
  }

  function draw() {
    // clear
    context.fillStyle = "#0a1020";
    context.fillRect(0, 0, boardSizePx, boardSizePx);

    // grid
    drawGrid();

    // food
    context.fillStyle = "#ef4444"; // red
    const fx = gameState.food.x * drawScale;
    const fy = gameState.food.y * drawScale;
    const fr = Math.floor(drawScale / 3);
    context.beginPath();
    context.arc(fx + drawScale / 2, fy + drawScale / 2, fr, 0, Math.PI * 2);
    context.fill();

    // snake
    for (let i = 0; i < gameState.snake.length; i += 1) {
      const part = gameState.snake[i];
      const x = part.x * drawScale;
      const y = part.y * drawScale;
      const isHead = i === gameState.snake.length - 1;
      context.fillStyle = isHead ? "#22c55e" : "#16a34a"; // green shades
      drawRoundedRect(x + 1, y + 1, drawScale - 2, drawScale - 2, Math.min(6, Math.floor(drawScale / 3)));
    }
  }

  // fixed-step timer management
  let stepTimer = null;
  function startTimer() {
    if (stepTimer) clearInterval(stepTimer);
    stepTimer = setInterval(gameStep, gameState.stepMs);
  }
  function restartTimer() {
    startTimer();
  }

  // Initialize
  resetGame();
  draw();
  startTimer();
})();
