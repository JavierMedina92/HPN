// app.js

// Utilidades de color y número
class Color {
  static randomVivid(alpha = 1) {
    const h = Math.random() * 360; // tono
    const s = 80 + Math.random() * 20; // saturación 80-100
    const l = 50 + Math.random() * 10; // luminosidad 50-60
    return `hsla(${h.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%, ${alpha})`;
  }

  static mix(c1, c2, t = 0.5) {
    // Mezcla sencilla entre dos hsla: solo alpha y un blend rápido en h
    return `hsla(${t * 360}, 90%, 60%, ${t})`;
  }
}

class RNG {
  static rand( min, max ) { return min + Math.random() * (max - min); }
  static randint( min, max ) { return Math.floor(RNG.rand(min, max + 1)); }
  static pick( arr ) { return arr[Math.floor(Math.random() * arr.length)]; }
}

// Clase base con herencia: cualquier entidad renderizable
class Entity {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.dead = false;
  }
  update(dt) {}
  draw(ctx) {}
}

// Partícula: hereda de Entity
class Particle extends Entity {
  constructor(x, y, vx, vy, life, color, size = 2) {
    super(x, y);
    this.vx = vx;
    this.vy = vy;
    this.life = life;      // tiempo de vida total
    this.age = 0;          // tiempo transcurrido
    this.color = color;
    this.size = size;
    this.gravity = 80;     // px/s^2
    this.drag = 0.995;     // factor de rozamiento
    this.twinkle = Math.random() < 0.5; // parpadeo aleatorio
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.life) { this.dead = true; return; }

    // Física simple
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.vy += this.gravity * dt;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    const t = this.age / this.life;
    const alpha = Math.max(0, 1 - t);
    const a = this.twinkle ? alpha * (0.6 + 0.4 * Math.sin(this.age * 20)) : alpha;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = this.color.replace(/[\d.]+\)$/g, `${a})`);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (1 + 0.5 * (1 - t)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Cohete que explota en partículas: hereda de Entity
class Firework extends Entity {
  constructor(x, groundY, targetY, color) {
    super(x, groundY);
    this.vy = -RNG.rand(320, 520); // velocidad de ascenso
    this.vx = RNG.rand(-30, 30);   // leve desviación
    this.color = color || Color.randomVivid(1);
    this.exploded = false;
    this.targetY = targetY;
    this.sparkle = []; // partículas generadas tras explotar
  }

  update(dt) {
    if (!this.exploded) {
      // Subida del cohete
      this.vy += 20 * dt; // pierde potencia
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // cola del cohete (chispas ascendentes)
      if (Math.random() < 0.6) {
        const p = new Particle(
          this.x,
          this.y + 6,
          RNG.rand(-30, 30),
          RNG.rand(20, 60),
          RNG.rand(0.25, 0.45),
          this.color,
          RNG.rand(1.2, 2.2)
        );
        this.sparkle.push(p);
      }

      // Condición de explosión
      if (this.y <= this.targetY || this.vy >= -60) {
        this.explode();
      }
    } else {
      // Actualiza las partículas
      this.sparkle.forEach(p => p.update(dt));
      this.sparkle = this.sparkle.filter(p => !p.dead);
      if (this.sparkle.length === 0) {
        this.dead = true;
      }
    }
  }

  explode() {
    this.exploded = true;
    const count = RNG.randint(60, 120);
    const palette = [
      this.color,
      Color.randomVivid(1),
      Color.randomVivid(1),
      Color.randomVivid(1)
    ];

    for (let i = 0; i < count; i++) {
      const angle = RNG.rand(0, Math.PI * 2);
      const speed = RNG.rand(120, 360);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const life = RNG.rand(0.8, 1.8);
      const size = RNG.rand(1.2, 3.2);
      const color = RNG.pick(palette).replace(/[\d.]+\)$/g, "1)");

      const p = new Particle(this.x, this.y, vx, vy, life, color, size);
      p.drag = RNG.rand(0.985, 0.998);
      p.gravity = RNG.rand(60, 140);
      this.sparkle.push(p);
    }
  }

  draw(ctx) {
    if (!this.exploded) {
      // Dibuja el cohete
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Dibuja partículas (cola y explosión)
    this.sparkle.forEach(p => p.draw(ctx));
  }
}

// Administrador del show de pirotecnia
class FireworksShow {
  constructor(canvas, messageEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.messageEl = messageEl;

    this.entities = []; // mezcla de Fireworks
    this.running = false;
    this._lastTime = 0;
    this._messageTimer = 0;
    this._messageDelay = 200; // ms antes de mostrar el mensaje

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    // Escala para alta densidad de píxeles
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  launchBurst(times = 6) {
    this.messageEl.classList.remove("show");
    this._messageTimer = 0;
    this.running = true;

    const { width, height } = this.canvas;
    const groundY = height - 30;

    for (let i = 0; i < times; i++) {
      const x = RNG.rand(60, width - 60);
      const targetY = RNG.rand(height * 0.22, height * 0.48);
      const fw = new Firework(x, groundY, targetY, Color.randomVivid(1));
      this.entities.push(fw);
    }

    if (!this._raf) this._raf = requestAnimationFrame(this._loop.bind(this));
  }

  _loop(ts) {
    if (!this._lastTime) this._lastTime = ts;
    const dt = Math.min((ts - this._lastTime) / 1000, 0.033);
    this._lastTime = ts;

    this._update(dt);
    this._draw();

    if (this.running) {
      this._raf = requestAnimationFrame(this._loop.bind(this));
    } else {
      cancelAnimationFrame(this._raf);
      this._raf = null;
      this.messageEl.classList.add("show");
    }
  }

  _update(dt) {
    // Limpieza de fondo
    this.ctx.fillStyle = "rgba(4, 8, 16, 0.45)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Actualiza todas las entidades
    this.entities.forEach(e => e.update(dt));
    this.entities = this.entities.filter(e => !e.dead);

    // Mostrar mensaje cuando todo termina
    if (this.entities.length === 0) {
      this._messageTimer += dt * 1000;
      if (this._messageTimer >= this._messageDelay) {
        this.running = false;
      }
    }
  }

  _draw() {
    // Resplandor ambiental sutil
    const g = this.ctx.createRadialGradient(
      this.canvas.width * 0.5, this.canvas.height * 0.8, 10,
      this.canvas.width * 0.5, this.canvas.height * 0.8, Math.min(this.canvas.width, this.canvas.height) * 0.8
    );
    g.addColorStop(0, "rgba(255, 255, 255, 0.02)");
    g.addColorStop(1, "rgba(255, 255, 255, 0.0)");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Dibuja todas las entidades
    this.entities.forEach(e => e.draw(this.ctx));
  }
}

// Inicialización y eventos
(function init() {
  const canvas = document.getElementById("canvas");
  const messageEl = document.getElementById("finalMessage");
  const btn = document.getElementById("btnFire");

  const show = new FireworksShow(canvas, messageEl);

  btn.addEventListener("click", () => {
    show.launchBurst(RNG.randint(6, 10));
  });

  // Lanzamiento inicial opcional
  // show.launchBurst(8);
})();