// ============================================================
// ANGRY BRAINROTS - a slingshot physics game
// ============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Logical render size; we scale to fit window
const W = 1280;
const H = 720;

function resizeCanvas() {
  const ratio = W / H;
  const ww = window.innerWidth;
  const wh = window.innerHeight - document.getElementById("hud").offsetHeight;
  let cw = ww, ch = ww / ratio;
  if (ch > wh) { ch = wh; cw = wh * ratio; }
  canvas.style.width = cw + "px";
  canvas.style.height = ch + "px";
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ============================================================
// BRAINROT DEFINITIONS
// Each brainrot is a meme-inspired absurd creature with a quirk.
// ============================================================
const BRAINROTS = {
  tralalero: {
    name: "Tralalero",
    emoji: "🦈",
    color: "#4ea8de",
    radius: 22,
    mass: 1,
    description: "Three-sneakered shark. Basic projectile.",
    onSpecial: null,
  },
  bombardiro: {
    name: "Bombardiro",
    emoji: "🐊",
    color: "#3d8b37",
    radius: 24,
    mass: 1.4,
    description: "Crocodile bomber. Explodes on tap.",
    onSpecial: (b, world) => {
      explode(world, b.x, b.y, 130, 9);
      b.dead = true;
    },
  },
  tungtung: {
    name: "Tung Tung",
    emoji: "🪵",
    color: "#9b6b3e",
    radius: 26,
    mass: 2.2,
    description: "Heavy wooden noggin. Hits like a truck.",
    onSpecial: (b) => {
      // Drop straight down hard
      b.vx *= 0.4;
      b.vy = Math.max(b.vy, 0) + 16;
    },
  },
  patapim: {
    name: "Patapim",
    emoji: "🐇",
    color: "#d6a4ff",
    radius: 20,
    mass: 0.8,
    description: "Tree-rabbit. Splits into three on tap.",
    onSpecial: (b, world) => {
      for (let i = -1; i <= 1; i++) {
        if (i === 0) continue;
        const clone = new Brainrot(b.x, b.y, "tralalero");
        clone.vx = b.vx + i * 4;
        clone.vy = b.vy - 2 + Math.abs(i) * 1.5;
        clone.color = "#c98cff";
        clone.emoji = "🐇";
        clone.specialUsed = true;
        world.brainrots.push(clone);
      }
      b.specialUsed = true;
    },
  },
  lirili: {
    name: "Lirili",
    emoji: "🌵",
    color: "#f0a35e",
    radius: 22,
    mass: 0.9,
    description: "Cactus-elephant. Dash forward on tap.",
    onSpecial: (b) => {
      const sp = Math.hypot(b.vx, b.vy) || 1;
      b.vx = (b.vx / sp) * 22;
      b.vy = (b.vy / sp) * 22;
    },
  },
};

// ============================================================
// LEVELS - layout of blocks, pigs (here: TVs / scroll-brain enemies), terrain
// ============================================================
const LEVELS = [
  {
    name: "Tutorial Brainrot",
    queue: ["tralalero", "tralalero", "bombardiro"],
    ground: 600,
    objects: [
      block(900, 540, 30, 120),
      block(1050, 540, 30, 120),
      block(975, 470, 180, 20),
      enemy(975, 440, 22),
    ],
  },
  {
    name: "Tower of Skibidi",
    queue: ["tralalero", "tungtung", "bombardiro", "tralalero"],
    ground: 600,
    objects: [
      block(880, 540, 30, 120),
      block(1000, 540, 30, 120),
      block(940, 470, 180, 20),
      block(880, 400, 30, 60),
      block(1000, 400, 30, 60),
      block(940, 360, 180, 20),
      enemy(880, 530, 18),
      enemy(1000, 530, 18),
      enemy(940, 340, 22),
    ],
  },
  {
    name: "Patapim Forest",
    queue: ["tralalero", "patapim", "bombardiro", "tungtung"],
    ground: 600,
    objects: [
      block(820, 540, 30, 120),
      block(940, 540, 30, 120),
      block(1060, 540, 30, 120),
      block(880, 470, 180, 20),
      block(1000, 470, 180, 20),
      enemy(820, 530, 16),
      enemy(940, 530, 16),
      enemy(1060, 530, 16),
      enemy(880, 450, 20),
      enemy(1000, 450, 20),
    ],
  },
  {
    name: "Lirili Larila Mesa",
    queue: ["lirili", "tralalero", "bombardiro", "patapim", "tungtung"],
    ground: 600,
    objects: [
      block(780, 540, 30, 120),
      block(880, 540, 30, 120),
      block(830, 470, 130, 20),
      block(1000, 540, 30, 120),
      block(1100, 540, 30, 120),
      block(1050, 470, 130, 20),
      block(940, 380, 200, 20),
      enemy(830, 450, 18),
      enemy(1050, 450, 18),
      enemy(940, 360, 24),
      enemy(780, 530, 14),
      enemy(1100, 530, 14),
    ],
  },
];

function block(x, y, w, h) {
  return { type: "block", x, y, w, h, vx: 0, vy: 0, hp: 30, angle: 0, av: 0 };
}
function enemy(x, y, r) {
  return { type: "enemy", x, y, r, vx: 0, vy: 0, hp: 20, dead: false };
}

// ============================================================
// PHYSICS HELPERS
// ============================================================
const GRAVITY = 0.45;
const FRICTION = 0.985;
const GROUND_FRICTION = 0.86;

function explode(world, x, y, radius, force) {
  spawnParticles(world, x, y, 36, "#ffb347", 6);
  for (const o of world.objects) {
    if (o.type === "block") {
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
      const dx = cx - x, dy = cy - y;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        const f = (1 - d / radius) * force;
        o.vx += (dx / (d || 1)) * f;
        o.vy += (dy / (d || 1)) * f - 1;
        o.av += (Math.random() - 0.5) * 0.4;
        o.hp -= 25;
      }
    } else if (o.type === "enemy") {
      const dx = o.x - x, dy = o.y - y;
      const d = Math.hypot(dx, dy);
      if (d < radius) {
        const f = (1 - d / radius) * force;
        o.vx += (dx / (d || 1)) * f;
        o.vy += (dy / (d || 1)) * f - 1;
        o.hp -= 30;
      }
    }
  }
  for (const b of world.brainrots) {
    const dx = b.x - x, dy = b.y - y;
    const d = Math.hypot(dx, dy);
    if (d < radius && d > 1) {
      const f = (1 - d / radius) * force * 0.6;
      b.vx += (dx / d) * f;
      b.vy += (dy / d) * f;
    }
  }
}

function spawnParticles(world, x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed + 1;
    world.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 30 + Math.random() * 30,
      color,
      r: Math.random() * 3 + 1,
    });
  }
}

// ============================================================
// BRAINROT (projectile) CLASS
// ============================================================
class Brainrot {
  constructor(x, y, kind) {
    const def = BRAINROTS[kind];
    this.kind = kind;
    this.def = def;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.r = def.radius;
    this.mass = def.mass;
    this.color = def.color;
    this.emoji = def.emoji;
    this.launched = false;
    this.specialUsed = false;
    this.dead = false;
    this.angle = 0;
    this.av = 0;
    this.rest = 0;
    this.trail = [];
  }
  triggerSpecial(world) {
    if (this.specialUsed || !this.launched || this.dead) return;
    if (!this.def.onSpecial) return;
    this.specialUsed = true;
    this.def.onSpecial(this, world);
  }
  step(world) {
    if (!this.launched) return;
    this.vy += GRAVITY;
    this.vx *= FRICTION;
    this.vy *= FRICTION;
    this.x += this.vx;
    this.y += this.vy;
    this.av = this.vx * 0.05;
    this.angle += this.av;

    // Trail
    if (this.trail.length === 0 || dist(this.trail[this.trail.length - 1], this) > 8) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > 60) this.trail.shift();
    }

    // Ground
    if (this.y + this.r > world.ground) {
      this.y = world.ground - this.r;
      this.vy *= -0.45;
      this.vx *= GROUND_FRICTION;
      if (Math.abs(this.vy) < 1) { this.vy = 0; this.rest++; }
    } else {
      this.rest = 0;
    }

    // Walls
    if (this.x < this.r) { this.x = this.r; this.vx *= -0.5; }
    if (this.x > W - this.r) { this.x = W - this.r; this.vx *= -0.5; }

    // Collide with blocks
    for (const o of world.objects) {
      if (o.type === "block") collideCircleRect(this, o, world);
      else if (o.type === "enemy" && !o.dead) collideCircleCircle(this, o, world);
    }
  }
  draw(ctx) {
    // Trail
    ctx.save();
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const a = (i / this.trail.length) * 0.4;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(0, 0, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.stroke();
    // Eyes
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-this.r * 0.3, -this.r * 0.2, this.r * 0.25, 0, Math.PI * 2);
    ctx.arc(this.r * 0.3, -this.r * 0.2, this.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(-this.r * 0.25, -this.r * 0.15, this.r * 0.1, 0, Math.PI * 2);
    ctx.arc(this.r * 0.35, -this.r * 0.15, this.r * 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Emoji badge
    ctx.font = `${this.r * 0.9}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, 0, this.r * 0.5);
    ctx.restore();
  }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ============================================================
// COLLISIONS
// ============================================================
function collideCircleRect(c, r, world) {
  // Find closest point on rotated rectangle (we treat rect as AABB for simplicity)
  const left = r.x, right = r.x + r.w;
  const top = r.y, bot = r.y + r.h;
  const cx = clamp(c.x, left, right);
  const cy = clamp(c.y, top, bot);
  const dx = c.x - cx, dy = c.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 < c.r * c.r) {
    const d = Math.sqrt(d2) || 0.0001;
    const nx = dx / d, ny = dy / d;
    const overlap = c.r - d;
    c.x += nx * overlap;
    c.y += ny * overlap;
    // Reflect velocity
    const vn = c.vx * nx + c.vy * ny;
    if (vn < 0) {
      c.vx -= 1.4 * vn * nx;
      c.vy -= 1.4 * vn * ny;
      c.vx *= 0.75;
      c.vy *= 0.75;
      // Damage and push block
      const speed = Math.hypot(c.vx, c.vy);
      const impact = Math.abs(vn) * c.mass;
      if (impact > 2) {
        r.vx += -nx * impact * 0.4;
        r.vy += -ny * impact * 0.4 - 0.3;
        r.av += (Math.random() - 0.5) * 0.1;
        r.hp -= impact * 1.6;
        world.score += Math.floor(impact * 3);
        spawnParticles(world, c.x, c.y, 6, "#fff", 3);
      }
    }
  }
}

function collideCircleCircle(a, e, world) {
  const dx = a.x - e.x, dy = a.y - e.y;
  const d = Math.hypot(dx, dy);
  const min = a.r + e.r;
  if (d < min) {
    const nx = dx / (d || 1), ny = dy / (d || 1);
    const overlap = min - d;
    a.x += nx * overlap * 0.5;
    a.y += ny * overlap * 0.5;
    e.x -= nx * overlap * 0.5;
    e.y -= ny * overlap * 0.5;
    const vn = a.vx * nx + a.vy * ny;
    const impact = Math.abs(vn) * a.mass + 4;
    e.vx -= nx * impact * 0.4;
    e.vy -= ny * impact * 0.4 - 0.4;
    a.vx *= 0.55; a.vy *= 0.55;
    e.hp -= impact * 2.5;
    world.score += Math.floor(impact * 8);
    spawnParticles(world, e.x, e.y, 10, "#ffd23f", 4);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      world.score += 500;
      spawnParticles(world, e.x, e.y, 30, "#ff5d73", 6);
    }
  }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ============================================================
// WORLD STATE
// ============================================================
const state = {
  levelIndex: 0,
  world: null,
  slingshot: { x: 220, y: 520 },
  loaded: null,        // current brainrot loaded in slingshot
  queueIdx: 0,
  dragging: false,
  dragX: 0,
  dragY: 0,
  totalScore: 0,
};

function loadLevel(idx) {
  state.levelIndex = idx;
  const lv = LEVELS[idx];
  state.world = {
    ground: lv.ground,
    objects: lv.objects.map(o => ({ ...o })),
    brainrots: [],
    particles: [],
    score: 0,
    finished: false,
    awaitingResult: false,
  };
  state.queueIdx = 0;
  loadNextBrainrot();
  updateHUD();
  hideOverlay();
}

function loadNextBrainrot() {
  const lv = LEVELS[state.levelIndex];
  if (state.queueIdx >= lv.queue.length) {
    state.loaded = null;
    state.world.awaitingResult = true;
    return;
  }
  const kind = lv.queue[state.queueIdx];
  state.loaded = new Brainrot(state.slingshot.x, state.slingshot.y - 20, kind);
  updateHUD();
}

function updateHUD() {
  document.getElementById("levelLabel").textContent = `Level ${state.levelIndex + 1}: ${LEVELS[state.levelIndex].name}`;
  document.getElementById("scoreLabel").textContent = `Score: ${state.world.score + state.totalScore}`;

  const q = document.getElementById("brainrotQueue");
  q.innerHTML = "";
  const lv = LEVELS[state.levelIndex];
  for (let i = 0; i < lv.queue.length; i++) {
    const def = BRAINROTS[lv.queue[i]];
    const chip = document.createElement("div");
    chip.className = "queue-chip" + (i === state.queueIdx ? " active" : "");
    if (i < state.queueIdx) chip.style.opacity = "0.3";
    chip.style.background = def.color;
    chip.innerHTML = `<span>${def.emoji}</span><span class="name">${def.name}</span>`;
    chip.title = `${def.name} - ${def.description}`;
    q.appendChild(chip);
  }
}

// ============================================================
// INPUT
// ============================================================
function canvasPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) * (W / rect.width);
  const y = (evt.clientY - rect.top) * (H / rect.height);
  return { x, y };
}

canvas.addEventListener("pointerdown", e => {
  if (!state.loaded || state.loaded.launched) return;
  const p = canvasPos(e);
  if (Math.hypot(p.x - state.slingshot.x, p.y - state.slingshot.y + 20) < 80) {
    state.dragging = true;
    state.dragX = p.x; state.dragY = p.y;
    canvas.style.cursor = "grabbing";
  }
});

canvas.addEventListener("pointermove", e => {
  if (!state.dragging) return;
  const p = canvasPos(e);
  const dx = p.x - state.slingshot.x;
  const dy = p.y - state.slingshot.y;
  const maxR = 120;
  const d = Math.hypot(dx, dy);
  const k = d > maxR ? maxR / d : 1;
  state.dragX = state.slingshot.x + dx * k;
  state.dragY = state.slingshot.y + dy * k;
  state.loaded.x = state.dragX;
  state.loaded.y = state.dragY;
});

canvas.addEventListener("pointerup", () => {
  if (!state.dragging) return;
  state.dragging = false;
  canvas.style.cursor = "grab";
  if (!state.loaded) return;
  const dx = state.slingshot.x - state.loaded.x;
  const dy = state.slingshot.y - 20 - state.loaded.y;
  const power = 0.22;
  state.loaded.vx = dx * power;
  state.loaded.vy = dy * power;
  state.loaded.launched = true;
  state.world.brainrots.push(state.loaded);
  const flying = state.loaded;
  state.loaded = null;
  // Wait until it comes to rest or flies off, then load next
  watchAndAdvance(flying);
});

function triggerLatestSpecial() {
  const list = state.world.brainrots;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (b.launched && !b.specialUsed && !b.dead && b.rest < 10) {
      b.triggerSpecial(state.world);
      return true;
    }
  }
  return false;
}

window.addEventListener("keydown", e => {
  if (e.code === "Space") {
    e.preventDefault();
    triggerLatestSpecial();
  }
  if (e.key.toLowerCase() === "r") {
    loadLevel(state.levelIndex);
  }
});

const actionBtn = document.getElementById("actionBtn");
if (actionBtn) {
  const handleAction = (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerLatestSpecial();
  };
  actionBtn.addEventListener("pointerdown", handleAction);
  actionBtn.addEventListener("touchstart", handleAction, { passive: false });
  // Stop touch events on the button from bubbling into the canvas drag handler
  actionBtn.addEventListener("pointerup", e => e.stopPropagation());
  actionBtn.addEventListener("pointermove", e => e.stopPropagation());
}

function updateActionButtonState() {
  if (!actionBtn || !state.world) return;
  const list = state.world.brainrots;
  let ready = false;
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (b.launched && !b.specialUsed && !b.dead && b.rest < 10 && b.def.onSpecial) {
      ready = true;
      break;
    }
  }
  actionBtn.classList.toggle("ready", ready);
  actionBtn.classList.toggle("disabled", !ready);
}

document.getElementById("restartBtn").addEventListener("click", () => loadLevel(state.levelIndex));

function watchAndAdvance(b) {
  const myWorld = state.world;
  let frames = 0;
  const check = () => {
    if (state.world !== myWorld || myWorld.finished) return; // stale, stop
    frames++;
    const offscreen = b.x < -50 || b.x > W + 50 || b.y > H + 50;
    const resting = b.rest > 25 || b.dead;
    if (offscreen || resting || frames > 60 * 12) {
      const allDead = myWorld.objects.filter(o => o.type === "enemy").every(o => o.dead);
      if (allDead) {
        finishLevel(true);
        return;
      }
      state.queueIdx++;
      if (state.queueIdx >= LEVELS[state.levelIndex].queue.length) {
        setTimeout(() => {
          if (state.world !== myWorld || myWorld.finished) return;
          const stillAllDead = myWorld.objects.filter(o => o.type === "enemy").every(o => o.dead);
          finishLevel(stillAllDead);
        }, 800);
        return;
      }
      loadNextBrainrot();
      return;
    }
    requestAnimationFrame(check);
  };
  check();
}

function finishLevel(won) {
  if (state.world.finished) return;
  state.world.finished = true;
  state.totalScore += state.world.score;
  const overlay = document.getElementById("overlay");
  const title = document.getElementById("overlayTitle");
  const sub = document.getElementById("overlaySub");
  const stars = document.getElementById("stars");
  const nextBtn = document.getElementById("nextBtn");

  if (won) {
    const used = state.queueIdx + 1;
    const total = LEVELS[state.levelIndex].queue.length;
    const remaining = Math.max(0, total - used);
    const starCount = Math.min(3, 1 + remaining);
    title.textContent = "Level Complete!";
    sub.textContent = `Score this level: ${state.world.score}`;
    stars.innerHTML = "";
    for (let i = 0; i < 3; i++) {
      const s = document.createElement("span");
      s.textContent = "★";
      if (i < starCount) s.className = "on";
      stars.appendChild(s);
    }
    nextBtn.style.display = state.levelIndex + 1 < LEVELS.length ? "" : "none";
  } else {
    title.textContent = "Out of Brainrots!";
    sub.textContent = "Some enemies survived. Try again?";
    stars.innerHTML = `<span>☆</span><span>☆</span><span>☆</span>`;
    nextBtn.style.display = "none";
  }
  overlay.classList.remove("hidden");
}

function hideOverlay() { document.getElementById("overlay").classList.add("hidden"); }

document.getElementById("nextBtn").addEventListener("click", () => {
  if (state.levelIndex + 1 < LEVELS.length) loadLevel(state.levelIndex + 1);
});
document.getElementById("retryBtn").addEventListener("click", () => loadLevel(state.levelIndex));

// ============================================================
// RENDER
// ============================================================
function drawBackground() {
  // Sky gradient already on canvas via CSS; draw clouds & hills
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  for (let i = 0; i < 5; i++) {
    const x = (i * 280 + (performance.now() * 0.01) % 280);
    const y = 80 + (i % 2) * 30;
    drawCloud(x, y);
  }
  // Far hills
  ctx.fillStyle = "#b07338";
  ctx.beginPath();
  ctx.moveTo(0, 550);
  for (let x = 0; x <= W; x += 40) {
    ctx.lineTo(x, 540 + Math.sin(x * 0.01) * 14);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // Ground
  const g = state.world.ground;
  const grd = ctx.createLinearGradient(0, g, 0, H);
  grd.addColorStop(0, "#7c5025");
  grd.addColorStop(1, "#3a2410");
  ctx.fillStyle = grd;
  ctx.fillRect(0, g, W, H - g);
  // Grass strip
  ctx.fillStyle = "#5fa84a";
  ctx.fillRect(0, g - 6, W, 6);
}

function drawCloud(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.arc(x + 24, y - 8, 18, 0, Math.PI * 2);
  ctx.arc(x + 48, y, 22, 0, Math.PI * 2);
  ctx.arc(x + 24, y + 10, 22, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlingshot() {
  const { x, y } = state.slingshot;
  // Posts
  ctx.fillStyle = "#5b2f15";
  ctx.fillRect(x - 8, y, 16, 90);
  // Y arms
  ctx.beginPath();
  ctx.moveTo(x - 8, y);
  ctx.quadraticCurveTo(x - 30, y - 30, x - 24, y - 50);
  ctx.lineTo(x - 14, y - 50);
  ctx.quadraticCurveTo(x - 16, y - 26, x + 0, y - 6);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x + 8, y);
  ctx.quadraticCurveTo(x + 30, y - 30, x + 24, y - 50);
  ctx.lineTo(x + 14, y - 50);
  ctx.quadraticCurveTo(x + 16, y - 26, x - 0, y - 6);
  ctx.fill();

  // Rubber bands
  if (state.loaded && !state.loaded.launched) {
    const bx = state.loaded.x, by = state.loaded.y;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 44);
    ctx.lineTo(bx - state.loaded.r * 0.3, by);
    ctx.moveTo(x + 18, y - 44);
    ctx.lineTo(bx + state.loaded.r * 0.3, by);
    ctx.stroke();
  }
}

function drawTrajectoryPreview() {
  if (!state.dragging || !state.loaded) return;
  const dx = state.slingshot.x - state.loaded.x;
  const dy = state.slingshot.y - 20 - state.loaded.y;
  const vx = dx * 0.22, vy = dy * 0.22;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  let x = state.loaded.x, y = state.loaded.y;
  let svx = vx, svy = vy;
  for (let i = 0; i < 40; i++) {
    svy += GRAVITY;
    svx *= FRICTION;
    svy *= FRICTION;
    x += svx; y += svy;
    if (y > state.world.ground) break;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBlock(o) {
  ctx.save();
  ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
  ctx.rotate(o.angle);
  const dmg = clamp(1 - o.hp / 30, 0, 1);
  // Wood gradient
  const grd = ctx.createLinearGradient(-o.w / 2, -o.h / 2, o.w / 2, o.h / 2);
  grd.addColorStop(0, `rgb(${160 - dmg * 60}, ${110 - dmg * 50}, 60)`);
  grd.addColorStop(1, `rgb(${110 - dmg * 50}, ${70 - dmg * 30}, 30)`);
  ctx.fillStyle = grd;
  ctx.fillRect(-o.w / 2, -o.h / 2, o.w, o.h);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-o.w / 2, -o.h / 2, o.w, o.h);
  // Cracks
  if (dmg > 0.4) {
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-o.w / 2 + 4, -o.h / 2 + 4);
    ctx.lineTo(o.w / 2 - 6, o.h / 2 - 10);
    ctx.moveTo(-o.w / 4, o.h / 2);
    ctx.lineTo(o.w / 4, -o.h / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(e) {
  if (e.dead) return;
  ctx.save();
  ctx.translate(e.x, e.y);
  // shadow body - TV/skibidi style brainrot
  ctx.fillStyle = "#9e3b6b";
  ctx.beginPath();
  ctx.arc(0, 0, e.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Eyes (chaotic spinning)
  const t = performance.now() * 0.005;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(-e.r * 0.35, -e.r * 0.1, e.r * 0.3, 0, Math.PI * 2);
  ctx.arc(e.r * 0.35, -e.r * 0.1, e.r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(-e.r * 0.35 + Math.cos(t) * e.r * 0.1, -e.r * 0.1 + Math.sin(t) * e.r * 0.1, e.r * 0.12, 0, Math.PI * 2);
  ctx.arc(e.r * 0.35 + Math.cos(-t) * e.r * 0.1, -e.r * 0.1 + Math.sin(-t) * e.r * 0.1, e.r * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Frown / mouth
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, e.r * 0.3, e.r * 0.4, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of state.world.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = clamp(p.life / 60, 0, 1);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ============================================================
// PHYSICS STEP for non-brainrot objects
// ============================================================
function stepWorld() {
  const w = state.world;
  for (const o of w.objects) {
    if (o.type === "block") {
      o.vy += GRAVITY * 0.6;
      o.vx *= FRICTION;
      o.vy *= FRICTION;
      o.x += o.vx;
      o.y += o.vy;
      o.angle += o.av;
      o.av *= 0.95;
      // Ground
      if (o.y + o.h > w.ground) {
        o.y = w.ground - o.h;
        o.vy *= -0.3;
        o.vx *= GROUND_FRICTION;
        if (Math.abs(o.vy) < 0.5) o.vy = 0;
      }
      // Walls
      if (o.x < 0) { o.x = 0; o.vx *= -0.4; }
      if (o.x + o.w > W) { o.x = W - o.w; o.vx *= -0.4; }
    } else if (o.type === "enemy" && !o.dead) {
      o.vy += GRAVITY * 0.7;
      o.vx *= FRICTION;
      o.vy *= FRICTION;
      o.x += o.vx;
      o.y += o.vy;
      if (o.y + o.r > w.ground) {
        o.y = w.ground - o.r;
        o.vy *= -0.4;
        o.vx *= GROUND_FRICTION;
      }
      if (o.x - o.r < 0) { o.x = o.r; o.vx *= -0.5; }
      if (o.x + o.r > W) { o.x = W - o.r; o.vx *= -0.5; }
      // Fatal fall speed
      if (Math.abs(o.vy) > 12) {
        o.hp -= Math.abs(o.vy) * 2;
        if (o.hp <= 0) {
          o.dead = true;
          w.score += 500;
          spawnParticles(w, o.x, o.y, 30, "#ff5d73", 6);
        }
      }
    }
  }
  // Inter-block collisions (simple, prevents stacks from sinking)
  for (let i = 0; i < w.objects.length; i++) {
    for (let j = i + 1; j < w.objects.length; j++) {
      const a = w.objects[i], b = w.objects[j];
      if (a.type === "block" && b.type === "block") resolveBlockBlock(a, b);
      else if (a.type === "block" && b.type === "enemy" && !b.dead) resolveBlockEnemy(a, b);
      else if (b.type === "block" && a.type === "enemy" && !a.dead) resolveBlockEnemy(b, a);
    }
  }
  // Destroyed blocks
  for (const o of w.objects) {
    if (o.type === "block" && o.hp <= 0 && !o.shattered) {
      o.shattered = true;
      spawnParticles(w, o.x + o.w / 2, o.y + o.h / 2, 20, "#a06b3c", 5);
    }
  }
  w.objects = w.objects.filter(o => !(o.type === "block" && o.hp <= 0));

  // Brainrots
  for (const b of w.brainrots) b.step(w);

  // Particles
  for (const p of w.particles) {
    p.vy += GRAVITY * 0.3;
    p.x += p.vx;
    p.y += p.vy;
    p.life -= 1;
  }
  w.particles = w.particles.filter(p => p.life > 0);
}

function resolveBlockBlock(a, b) {
  if (a.x + a.w < b.x || b.x + b.w < a.x) return;
  if (a.y + a.h < b.y || b.y + b.h < a.y) return;
  const overlapX = Math.min(a.x + a.w - b.x, b.x + b.w - a.x);
  const overlapY = Math.min(a.y + a.h - b.y, b.y + b.h - a.y);
  if (overlapX < overlapY) {
    if (a.x < b.x) { a.x -= overlapX / 2; b.x += overlapX / 2; }
    else { a.x += overlapX / 2; b.x -= overlapX / 2; }
    const tmp = a.vx; a.vx = b.vx * 0.5; b.vx = tmp * 0.5;
  } else {
    if (a.y < b.y) { a.y -= overlapY / 2; b.y += overlapY / 2; }
    else { a.y += overlapY / 2; b.y -= overlapY / 2; }
    const tmp = a.vy; a.vy = b.vy * 0.5; b.vy = tmp * 0.5;
  }
}

function resolveBlockEnemy(blk, e) {
  const cx = clamp(e.x, blk.x, blk.x + blk.w);
  const cy = clamp(e.y, blk.y, blk.y + blk.h);
  const dx = e.x - cx, dy = e.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 < e.r * e.r) {
    const d = Math.sqrt(d2) || 0.0001;
    const nx = dx / d, ny = dy / d;
    const overlap = e.r - d;
    e.x += nx * overlap;
    e.y += ny * overlap;
    const vn = (e.vx - blk.vx) * nx + (e.vy - blk.vy) * ny;
    if (vn < 0) {
      e.vx -= vn * nx;
      e.vy -= vn * ny;
      const impact = Math.abs(vn);
      if (impact > 4) e.hp -= impact * 1.5;
    }
  }
}

// ============================================================
// MAIN LOOP
// ============================================================
function frame() {
  stepWorld();
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  for (const o of state.world.objects) {
    if (o.type === "block") drawBlock(o);
  }
  for (const o of state.world.objects) {
    if (o.type === "enemy") drawEnemy(o);
  }
  drawSlingshot();
  drawTrajectoryPreview();
  for (const b of state.world.brainrots) b.draw(ctx);
  if (state.loaded && !state.loaded.launched) state.loaded.draw(ctx);
  drawParticles();

  // Update score continuously
  document.getElementById("scoreLabel").textContent = `Score: ${state.world.score + state.totalScore}`;
  updateActionButtonState();

  requestAnimationFrame(frame);
}

loadLevel(0);
frame();
