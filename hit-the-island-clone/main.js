// Hit The Island Clone - main.js

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// Game objects
let paddle, balls, island, bonuses;
let score = 0;
let gameOver = false;
let vipUser = false;
let removeAdsPurchased = false;
let bonusPackPurchased = false;

// Constants
const PADDLE_START_WIDTH = 80;
const PADDLE_HEIGHT = 12;
const PADDLE_Y_OFFSET = 30;
const BALL_RADIUS = 8;
const ISLAND_WIDTH = 120;
const ISLAND_HEIGHT = 30;
const BONUS_SIZE = 24;
const INITIAL_BALL_SPEED = 3;
const BALL_SPEED_INCREMENT = 1.5;
const HITS_TO_SPEEDUP = 5;
const PADDLE_SHRINK_INTERVAL = 10000; // ms
const PADDLE_SHRINK_AMOUNT = 10;
const MIN_PADDLE_WIDTH = 40;
const BONUS_FALL_SPEED = 2;
const BONUS_TYPES = ['multiball', 'shield', 'shrink', 'grow'];

// Game state
let hitsOnIsland = 0;
let paddleShrinkTimer = 0;
let activeBonuses = {
  shield: false,
  multiball: false,
};
let bonusTimers = {
  shield: 0,
  multiball: 0,
};
const BONUS_DURATION = 15000; // 15 seconds

// Input state
let mouseX = WIDTH / 2;
let touchX = null;

// Utility functions
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Classes
class Paddle {
  constructor() {
    this.width = PADDLE_START_WIDTH;
    this.height = PADDLE_HEIGHT;
    this.x = (WIDTH - this.width) / 2;
    this.y = HEIGHT - PADDLE_Y_OFFSET;
  }
  update() {
    // Follow mouse or touch
    let targetX = mouseX;
    if (touchX !== null) targetX = touchX;
    this.x = clamp(targetX - this.width / 2, 0, WIDTH - this.width);
  }
  draw() {
    ctx.fillStyle = '#4f46e5'; // Indigo-600
    ctx.fillRect(this.x, this.y, this.width, this.height);
    if (activeBonuses.shield) {
      ctx.strokeStyle = '#facc15'; // Yellow-400
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width / 2 + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  shrink() {
    if (this.width > MIN_PADDLE_WIDTH) {
      this.width -= PADDLE_SHRINK_AMOUNT;
      if (this.width < MIN_PADDLE_WIDTH) this.width = MIN_PADDLE_WIDTH;
    }
  }
  grow() {
    if (this.width < PADDLE_START_WIDTH) {
      this.width += PADDLE_SHRINK_AMOUNT;
      if (this.width > PADDLE_START_WIDTH) this.width = PADDLE_START_WIDTH;
    }
  }
}

class Ball {
  constructor(x, y, speedX, speedY) {
    this.x = x;
    this.y = y;
    this.radius = BALL_RADIUS;
    this.speedX = speedX;
    this.speedY = speedY;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.x += this.speedX;
    this.y += this.speedY;

    // Bounce off walls
    if (this.x - this.radius < 0) {
      this.x = this.radius;
      this.speedX = -this.speedX;
    } else if (this.x + this.radius > WIDTH) {
      this.x = WIDTH - this.radius;
      this.speedX = -this.speedX;
    }
    if (this.y - this.radius < 0) {
      this.y = this.radius;
      this.speedY = -this.speedY;
    }

    // Bounce off paddle
    if (
      this.y + this.radius >= paddle.y &&
      this.y + this.radius <= paddle.y + paddle.height &&
      this.x >= paddle.x &&
      this.x <= paddle.x + paddle.width
    ) {
      this.y = paddle.y - this.radius;
      this.speedY = -Math.abs(this.speedY);

      // Adjust X speed based on hit position
      let hitPos = (this.x - paddle.x) / paddle.width - 0.5;
      this.speedX += hitPos * 2;
      // Clamp speedX to avoid extreme angles
      this.speedX = clamp(this.speedX, -6, 6);
    }

    // Bounce off island
    if (
      this.y - this.radius <= island.y + island.height &&
      this.y - this.radius >= island.y &&
      this.x >= island.x &&
      this.x <= island.x + island.width
    ) {
      this.y = island.y + island.height + this.radius;
      this.speedY = Math.abs(this.speedY);
      onIslandHit();
    }

    // Check if ball fell below paddle
    if (this.y - this.radius > HEIGHT) {
      if (activeBonuses.shield) {
        // Shield consumes one fall
        activeBonuses.shield = false;
      } else {
        this.active = false;
        checkGameOver();
      }
    }
  }
  draw() {
    if (!this.active) return;
    ctx.fillStyle = '#fbbf24'; // Yellow-400
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class Island {
  constructor() {
    this.width = ISLAND_WIDTH;
    this.height = ISLAND_HEIGHT;
    this.x = (WIDTH - this.width) / 2;
    this.y = 40;
  }
  draw() {
    ctx.fillStyle = '#10b981'; // Emerald-500
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = '#065f46'; // Darker emerald for text background
    ctx.font = 'bold 18px Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Dynamic Island', this.x + this.width / 2, this.y + this.height / 2);
  }
}

class Bonus {
  constructor(type, x, y) {
    this.type = type;
    this.x = x;
    this.y = y;
    this.size = BONUS_SIZE;
    this.active = true;
  }
  update() {
    if (!this.active) return;
    this.y += BONUS_FALL_SPEED;
    if (this.y > HEIGHT) {
      this.active = false;
    }
    // Check collision with paddle
    if (
      this.y + this.size >= paddle.y &&
      this.y <= paddle.y + paddle.height &&
      this.x + this.size >= paddle.x &&
      this.x <= paddle.x + paddle.width
    ) {
      this.active = false;
      applyBonus(this.type);
    }
  }
  draw() {
    if (!this.active) return;
    ctx.fillStyle = {
      multiball: '#3b82f6', // Blue-500
      shield: '#fbbf24', // Yellow-400
      shrink: '#ef4444', // Red-500
      grow: '#22c55e', // Green-500
    }[this.type] || '#9ca3af'; // Gray-400 fallback
    ctx.beginPath();
    ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1f2937'; // Gray-800 for icon
    ctx.font = 'bold 16px FontAwesome';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icons = {
      multiball: '\uf0c2', // fa-cloud
      shield: '\uf132', // fa-shield-alt
      shrink: '\uf068', // fa-minus
      grow: '\uf067', // fa-plus
    };
    ctx.fillText(icons[this.type] || '?', this.x + this.size / 2, this.y + this.size / 2);
  }
}

// Game functions
function onIslandHit() {
  score++;
  hitsOnIsland++;
  updateScore();
  if (hitsOnIsland % HITS_TO_SPEEDUP === 0) {
    increaseBallSpeed();
  }
}

function increaseBallSpeed() {
  balls.forEach(ball => {
    ball.speedX *= BALL_SPEED_INCREMENT;
    ball.speedY *= BALL_SPEED_INCREMENT;
  });
}

function applyBonus(type) {
  switch (type) {
    case 'multiball':
      if (!activeBonuses.multiball) {
        activeBonuses.multiball = true;
        bonusTimers.multiball = Date.now();
        // Add two extra balls
        for (let i = 0; i < 2; i++) {
          balls.push(new Ball(paddle.x + paddle.width / 2, paddle.y - BALL_RADIUS - 2, (Math.random() * 4 - 2), -INITIAL_BALL_SPEED));
        }
      }
      break;
    case 'shield':
      activeBonuses.shield = true;
      bonusTimers.shield = Date.now();
      break;
    case 'shrink':
      paddle.shrink();
      break;
    case 'grow':
      paddle.grow();
      break;
  }
}

function spawnBonus() {
  if (Math.random() < 0.01) { // ~1% chance per frame
    const type = BONUS_TYPES[Math.floor(Math.random() * BONUS_TYPES.length)];
    const x = Math.random() * (WIDTH - BONUS_SIZE);
    const y = -BONUS_SIZE;
    bonuses.push(new Bonus(type, x, y));
  }
}

function updateScore() {
  document.getElementById('score').textContent = `Score: ${score}`;
}

function checkGameOver() {
  if (balls.every(ball => !ball.active)) {
    gameOver = true;
    document.getElementById('gameOverScreen').classList.remove('hidden');
  }
}

function resetGame() {
  score = 0;
  hitsOnIsland = 0;
  gameOver = false;
  paddle = new Paddle();
  balls = [new Ball(WIDTH / 2, HEIGHT / 2, 2, -INITIAL_BALL_SPEED)];
  island = new Island();
  bonuses = [];
  activeBonuses = { shield: false, multiball: false };
  bonusTimers = { shield: 0, multiball: 0 };
  paddleShrinkTimer = Date.now();
  updateScore();
  document.getElementById('gameOverScreen').classList.add('hidden');
}

// Game loop
function gameLoop(timestamp) {
  if (gameOver) return;
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  paddle.update();
  paddle.draw();

  island.draw();

  balls.forEach(ball => {
    ball.update();
    ball.draw();
  });

  bonuses.forEach(bonus => {
    bonus.update();
    bonus.draw();
  });

  // Remove inactive balls and bonuses
  balls = balls.filter(ball => ball.active);
  bonuses = bonuses.filter(bonus => bonus.active);

  // Paddle shrinking over time
  if (Date.now() - paddleShrinkTimer > PADDLE_SHRINK_INTERVAL) {
    paddle.shrink();
    paddleShrinkTimer = Date.now();
  }

  // Bonus durations
  if (activeBonuses.shield && Date.now() - bonusTimers.shield > BONUS_DURATION) {
    activeBonuses.shield = false;
  }
  if (activeBonuses.multiball && Date.now() - bonusTimers.multiball > BONUS_DURATION) {
    activeBonuses.multiball = false;
    // Remove extra balls, keep only one
    balls = balls.slice(0, 1);
  }

  spawnBonus();

  requestAnimationFrame(gameLoop);
}

// Input handlers
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
});

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  if (e.touches.length > 0) {
    touchX = e.touches[0].clientX - rect.left;
  }
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  touchX = null;
}, { passive: false });

// In-App Purchase mock methods
function purchaseRemoveAds() {
  removeAdsPurchased = true;
  showPurchaseStatus('Ads removed successfully.');
}

function purchaseBonusPack(packId) {
  if (packId === 'multiball') {
    applyBonus('multiball');
    bonusPackPurchased = true;
    showPurchaseStatus('Bonus pack purchased: Multiball.');
  } else {
    showPurchaseStatus('Unknown bonus pack.');
  }
}

function isVIPUser() {
  return vipUser;
}

function restorePurchases() {
  // Mock restore: just set all to true
  removeAdsPurchased = true;
  bonusPackPurchased = true;
  vipUser = true;
  showPurchaseStatus('Purchases restored.');
}

function activateVIPMode() {
  vipUser = true;
  showPurchaseStatus('VIP mode activated.');
}

function showPurchaseStatus(message) {
  const statusEl = document.getElementById('purchaseStatus');
  statusEl.textContent = message;
  setTimeout(() => {
    statusEl.textContent = '';
  }, 4000);
}

// Button event listeners
document.getElementById('removeAdsBtn').addEventListener('click', () => {
  purchaseRemoveAds();
});
document.getElementById('buyBonusPackBtn').addEventListener('click', () => {
  purchaseBonusPack('multiball');
});
document.getElementById('vipModeBtn').addEventListener('click', () => {
  activateVIPMode();
});
document.getElementById('restorePurchasesBtn').addEventListener('click', () => {
  restorePurchases();
});
document.getElementById('restartBtn').addEventListener('click', () => {
  resetGame();
  requestAnimationFrame(gameLoop);
});

// Initialize game
resetGame();
requestAnimationFrame(gameLoop);
