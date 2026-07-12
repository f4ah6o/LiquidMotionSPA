// Rendering: container background, frosted obstacle bars, rotors, and the
// liquid as soft metaball-style blobs (low-res offscreen + radial gradients,
// upscaled with smoothing — portable across Safari/Chrome, no ctx.filter needed).

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.off = document.createElement('canvas');
    this.octx = this.off.getContext('2d');
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = 0.5; // liquid layer at half resolution for softness + speed
    this.off.width = Math.max(1, Math.round(w * this.scale));
    this.off.height = Math.max(1, Math.round(h * this.scale));
  }

  render(fluid) {
    const ctx = this.ctx, w = this.w, h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#101736');
    bg.addColorStop(1, '#0a0e20');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // container inner glow
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    glow.addColorStop(0, 'rgba(90,140,255,0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    this.drawLiquid(fluid);

    this.drawObstacles(fluid);
    this.drawWheel(fluid.wheel);
    this.drawSeesaw(fluid.seesaw);

    // glass frame
    ctx.strokeStyle = 'rgba(160,200,255,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  drawLiquid(fluid) {
    const o = this.octx, s = this.scale;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, this.off.width, this.off.height);
    o.globalCompositeOperation = 'lighter';
    const R = fluid.r * 2.4 * s;
    for (const p of fluid.p) {
      const x = p.x * s, y = p.y * s;
      const g = o.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `hsla(${p.hue}, 95%, 62%, 0.95)`);
      g.addColorStop(0.65, `hsla(${p.hue}, 95%, 55%, 0.55)`);
      g.addColorStop(1, `hsla(${p.hue}, 95%, 50%, 0)`);
      o.fillStyle = g;
      o.beginPath();
      o.arc(x, y, R, 0, Math.PI * 2);
      o.fill();
    }
    o.globalCompositeOperation = 'source-over';

    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, 0, 0, this.w, this.h);
    // specular highlights on droplet cores
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    const hr = fluid.r * 0.4;
    for (let i = 0; i < fluid.p.length; i += 7) {
      const p = fluid.p[i];
      ctx.beginPath();
      ctx.arc(p.x - hr, p.y - hr, hr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawObstacles(fluid) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const s of fluid.level.segments) {
      ctx.strokeStyle = 'rgba(190,215,255,0.5)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawWheel(wheel) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const s of wheel.segments) {
      ctx.strokeStyle = 'rgba(255,214,120,0.75)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    // toothed gear rim so the rotation reads clearly
    const teeth = wheel.paddles * 2;
    const r0 = wheel.r * 1.0, r1 = wheel.r * 1.12;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = wheel.angle + (i * Math.PI * 2) / teeth;
      const a1 = a0 + Math.PI / teeth;
      const rr = i % 2 ? r0 : r1;
      ctx.lineTo(wheel.cx + Math.cos(a0) * rr, wheel.cy + Math.sin(a0) * rr);
      ctx.lineTo(wheel.cx + Math.cos(a1) * rr, wheel.cy + Math.sin(a1) * rr);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,214,120,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // hub + rotating marker dot
    ctx.beginPath();
    ctx.arc(wheel.cx, wheel.cy, wheel.r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,230,170,0.9)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      wheel.cx + Math.cos(wheel.angle) * wheel.r * 0.45,
      wheel.cy + Math.sin(wheel.angle) * wheel.r * 0.45,
      3, 0, Math.PI * 2,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  }

  drawSeesaw(seesaw) {
    const ctx = this.ctx;
    const s = seesaw.segments[0];
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(140,255,190,0.75)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(seesaw.cx, seesaw.cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190,255,220,0.9)';
    ctx.fill();
  }
}
