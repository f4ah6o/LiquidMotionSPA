export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Canvas 2D is not supported');
    this.off = document.createElement('canvas');
    this.octx = this.off.getContext('2d');
    this.rotation = 0;
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = 0.5;
    this.off.width = Math.max(1, Math.round(w * this.scale));
    this.off.height = Math.max(1, Math.round(h * this.scale));
  }

  setRotation(angle) {
    this.rotation = angle;
  }

  render(fluid) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const background = ctx.createLinearGradient(0, 0, 0, h);
    background.addColorStop(0, '#101736');
    background.addColorStop(1, '#0a0e20');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
    glow.addColorStop(0, 'rgba(90,140,255,0.08)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(this.rotation);
    ctx.translate(-w / 2, -h / 2);

    const inset = fluid.inset;
    const medium = ctx.createLinearGradient(0, 0, 0, h);
    medium.addColorStop(0, 'rgba(120,170,200,0.10)');
    medium.addColorStop(1, 'rgba(70,110,150,0.18)');
    ctx.fillStyle = medium;
    ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);

    const sheen = ctx.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0.15, 'rgba(180,220,255,0)');
    sheen.addColorStop(0.4, 'rgba(180,220,255,0.05)');
    sheen.addColorStop(0.6, 'rgba(180,220,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);

    this.drawLiquid(fluid);
    this.drawObstacles(fluid);
    for (const wheel of fluid.wheels) this.drawWheel(wheel);
    for (const seesaw of fluid.seesaws) this.drawSeesaw(seesaw);
    for (const gate of fluid.gates) this.drawGate(gate);

    ctx.strokeStyle = 'rgba(150,190,240,0.55)';
    ctx.lineWidth = inset;
    ctx.strokeRect(inset / 2, inset / 2, w - inset, h - inset);
    ctx.strokeStyle = 'rgba(210,235,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(inset + 1, inset + 1, w - inset * 2 - 2, h - inset * 2 - 2);
    ctx.restore();
  }

  drawLiquid(fluid) {
    const offscreen = this.octx;
    const scale = this.scale;
    offscreen.setTransform(1, 0, 0, 1, 0, 0);
    offscreen.clearRect(0, 0, this.off.width, this.off.height);
    offscreen.globalCompositeOperation = 'lighter';
    const sorted = fluid.p.slice().sort((a, b) => a.z - b.z);
    const halfDepth = fluid.depth / 2;
    for (const particle of sorted) {
      const normalizedDepth = particle.z / halfDepth;
      const radius = fluid.r * 2.4 * scale * (1 + normalizedDepth * 0.35);
      const alpha = 0.65 + 0.35 * (normalizedDepth + 1) / 2;
      const x = (particle.x + particle.z * 0.06) * scale;
      const y = particle.y * scale;
      const gradient = offscreen.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `hsla(${fluid.hue}, 95%, 62%, ${0.95 * alpha})`);
      gradient.addColorStop(0.65, `hsla(${fluid.hue}, 95%, 55%, ${0.55 * alpha})`);
      gradient.addColorStop(1, `hsla(${fluid.hue}, 95%, 50%, 0)`);
      offscreen.fillStyle = gradient;
      offscreen.beginPath();
      offscreen.arc(x, y, radius, 0, Math.PI * 2);
      offscreen.fill();
    }
    offscreen.globalCompositeOperation = 'source-over';

    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.off, 0, 0, this.w, this.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = sorted.length - 1; i >= 0 && i >= sorted.length - 24; i -= 3) {
      const particle = sorted[i];
      const highlightRadius = fluid.r * 0.4 * (1 + particle.z / halfDepth * 0.35);
      ctx.beginPath();
      ctx.arc(particle.x + particle.z * 0.06 - highlightRadius, particle.y - highlightRadius, highlightRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawObstacles(fluid) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const segment of fluid.level.segments) {
      ctx.strokeStyle = 'rgba(190,215,255,0.5)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  drawWheel(wheel) {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    for (const segment of wheel.segments) {
      ctx.strokeStyle = 'rgba(255,214,120,0.75)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(segment.x1, segment.y1);
      ctx.lineTo(segment.x2, segment.y2);
      ctx.stroke();
    }
    const teeth = wheel.paddles * 2;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const angle0 = wheel.angle + (i * Math.PI * 2) / teeth;
      const angle1 = angle0 + Math.PI / teeth;
      const radius = i % 2 ? wheel.r : wheel.r * 1.12;
      ctx.lineTo(wheel.cx + Math.cos(angle0) * radius, wheel.cy + Math.sin(angle0) * radius);
      ctx.lineTo(wheel.cx + Math.cos(angle1) * radius, wheel.cy + Math.sin(angle1) * radius);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,214,120,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(wheel.cx, wheel.cy, wheel.r * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,230,170,0.9)';
    ctx.fill();
  }

  drawSeesaw(seesaw) {
    const ctx = this.ctx;
    const segment = seesaw.segments[0];
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(140,255,190,0.75)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(seesaw.cx, seesaw.cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(190,255,220,0.9)';
    ctx.fill();
  }

  drawGate(gate) {
    const ctx = this.ctx;
    const segment = gate.segments[0];
    ctx.lineCap = 'round';
    ctx.strokeStyle = gate.openAmount > 0.5 ? 'rgba(130,255,210,0.85)' : 'rgba(255,145,180,0.85)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(segment.x1, segment.y1);
    ctx.lineTo(segment.x2, segment.y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(gate.cx, gate.cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill();
  }
}
