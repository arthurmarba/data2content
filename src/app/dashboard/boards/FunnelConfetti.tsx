"use client";

import { useEffect, useRef } from "react";

const COLORS_BY_VARIANT = {
  aha: ["#67e8f9", "#60a5fa", "#c084fc", "#f9a8d4", "#fde68a"],
  success: ["#f59e0b", "#fb7185", "#34d399", "#facc15", "#38bdf8", "#ec4899", "#6366f1"],
} as const;

const REWARD_LABELS_BY_VARIANT = {
  aha: ["+10 XP", "IDEIA", "MATCH", "BOOST"],
  success: ["+50 XP", "COMBO", "LEVEL UP", "PERFECT"],
} as const;

type FunnelConfettiProps = {
  burstKey?: string | number;
  variant?: "aha" | "success";
  originSelector?: string;
};

type ConfettiOrigin = {
  x: number;
  y: number;
};

type ConfettiShape = "rect" | "ribbon" | "spark" | "star" | "coin" | "diamond" | "bolt";

function pickFrom<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)] || items[0];
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

class BurstParticle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number = 1;
  gravity: number;
  friction: number;
  delay: number;
  age: number = 0;
  life: number;
  shape: ConfettiShape;
  strokeColor: string;

  constructor(
    origin: ConfettiOrigin,
    palette: readonly string[],
    options: {
      delay: number;
      isMobile: boolean;
      isSecondaryWave?: boolean;
      variant: "aha" | "success";
    }
  ) {
    this.x = origin.x + (Math.random() - 0.5) * (options.isMobile ? 22 : 34);
    this.y = origin.y + (Math.random() - 0.5) * (options.isMobile ? 18 : 28);

    const roll = Math.random();
    if (options.variant === "success") {
      this.shape =
        roll > 0.9
          ? "coin"
          : roll > 0.78
            ? "star"
            : roll > 0.66
              ? "bolt"
              : roll > 0.5
                ? "ribbon"
                : roll > 0.32
                  ? "spark"
                  : "rect";
    } else {
      this.shape =
        roll > 0.9
          ? "diamond"
          : roll > 0.76
            ? "star"
            : roll > 0.58
              ? "spark"
              : roll > 0.42
                ? "ribbon"
                : "rect";
    }

    this.w =
      this.shape === "spark"
        ? Math.random() * 8 + 8
        : this.shape === "ribbon"
          ? Math.random() * 4 + 3
          : this.shape === "coin"
            ? Math.random() * 8 + 14
            : this.shape === "bolt"
              ? Math.random() * 7 + 12
              : Math.random() * 10 + 7;
    this.h =
      this.shape === "spark"
        ? Math.random() * 2 + 1
        : this.shape === "ribbon"
          ? Math.random() * 22 + 18
          : this.shape === "coin"
            ? this.w
            : this.shape === "bolt"
              ? this.w * 1.25
              : Math.random() * 9 + 6;

    const fullSpread = this.shape === "spark" || Math.random() > 0.82;
    const angle = fullSpread ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
    const basePower = options.isMobile ? 7.5 : 10;
    const power =
      basePower +
      Math.random() * (options.isMobile ? 9.5 : 14) +
      (options.isSecondaryWave ? 1.8 : 0) +
      (this.shape === "spark" ? 3.5 : 0) +
      (this.shape === "coin" || this.shape === "bolt" ? 2 : 0);

    this.vx = Math.cos(angle) * power;
    this.vy = Math.sin(angle) * power;
    this.color = pickFrom(palette) || "#f59e0b";
    this.strokeColor = options.variant === "success" ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.58)";
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * (this.shape === "ribbon" ? 18 : this.shape === "coin" ? 12 : 24);
    this.gravity = options.isMobile ? 0.2 : 0.18;
    this.friction = this.shape === "spark" ? 0.965 : this.shape === "coin" ? 0.976 : 0.982;
    this.delay = options.delay;
    this.life = options.isSecondaryWave ? 1500 + Math.random() * 550 : 1850 + Math.random() * 700;
  }

  get isAlive() {
    return this.age < this.delay + this.life && this.opacity > 0.01;
  }

  update(deltaMs: number) {
    this.age += deltaMs;
    if (this.age < this.delay) return;

    const step = deltaMs / 16.67;
    const progress = Math.min(1, (this.age - this.delay) / this.life);

    this.vx *= Math.pow(this.friction, step);
    this.vy *= Math.pow(this.friction, step);
    this.vy += this.gravity * step;
    this.x += this.vx * step;
    this.y += this.vy * step;
    this.rotation += this.rotationSpeed * step;
    this.opacity = progress < 0.54 ? 1 : Math.max(0, 1 - (progress - 0.54) / 0.46);
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.age < this.delay || this.opacity <= 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * (Math.PI / 180));
    ctx.globalAlpha = this.opacity;
    ctx.fillStyle = this.color;

    if (this.shape === "spark") {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.h;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-this.w / 2, 0);
      ctx.lineTo(this.w / 2, 0);
      ctx.stroke();
    } else if (this.shape === "star") {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const radius = i % 2 === 0 ? this.w / 2 : this.w / 5;
        const angle = (i * Math.PI) / 4;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    } else if (this.shape === "coin") {
      const radius = this.w / 2;
      const shineOffset = Math.sin(this.rotation * (Math.PI / 180)) * radius * 0.35;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.strokeColor;
      ctx.stroke();
      ctx.globalAlpha = this.opacity * 0.65;
      ctx.beginPath();
      ctx.arc(shineOffset, -radius * 0.12, radius * 0.46, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.62)";
      ctx.stroke();
    } else if (this.shape === "diamond") {
      ctx.beginPath();
      ctx.moveTo(0, -this.h / 2);
      ctx.lineTo(this.w / 2, 0);
      ctx.lineTo(0, this.h / 2);
      ctx.lineTo(-this.w / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.strokeColor;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    } else if (this.shape === "bolt") {
      ctx.beginPath();
      ctx.moveTo(-this.w * 0.1, -this.h / 2);
      ctx.lineTo(this.w * 0.42, -this.h * 0.08);
      ctx.lineTo(this.w * 0.08, -this.h * 0.02);
      ctx.lineTo(this.w * 0.24, this.h / 2);
      ctx.lineTo(-this.w * 0.42, this.h * 0.02);
      ctx.lineTo(-this.w * 0.08, -this.h * 0.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.strokeColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    } else if (this.shape === "ribbon") {
      ctx.beginPath();
      ctx.moveTo(-this.w / 2, -this.h / 2);
      ctx.quadraticCurveTo(this.w, 0, -this.w / 2, this.h / 2);
      ctx.lineWidth = this.w;
      ctx.strokeStyle = this.color;
      ctx.stroke();
    } else {
      ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    }
    
    if (Math.sin(this.rotation * 0.2) > 0.7) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      if (this.shape === "ribbon" || this.shape === "spark") {
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.stroke();
      } else if (this.shape === "rect") {
        ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, Math.min(this.w, this.h) * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    ctx.restore();
  }
}

class RewardToken {
  x: number;
  y: number;
  label: string;
  color: string;
  vx: number;
  vy: number;
  age = 0;
  delay: number;
  life: number;
  scale: number;
  rotation: number;

  constructor(
    origin: ConfettiOrigin,
    labels: readonly string[],
    palette: readonly string[],
    options: { delay: number; isMobile: boolean; index: number }
  ) {
    const direction = options.index % 2 === 0 ? -1 : 1;
    this.x = origin.x + direction * (28 + Math.random() * (options.isMobile ? 42 : 72));
    this.y = origin.y - 12 + (Math.random() - 0.5) * 28;
    this.label = pickFrom(labels) || "+10 XP";
    this.color = pickFrom(palette) || "#f59e0b";
    this.vx = direction * (0.15 + Math.random() * 0.18);
    this.vy = -(0.52 + Math.random() * 0.34);
    this.delay = options.delay;
    this.life = 1180 + Math.random() * 460;
    this.scale = options.isMobile ? 0.82 : 1;
    this.rotation = direction * (Math.random() * 5 + 1);
  }

  get isAlive() {
    return this.age < this.delay + this.life;
  }

  update(deltaMs: number) {
    this.age += deltaMs;
    if (this.age < this.delay) return;

    const step = deltaMs / 16.67;
    this.x += this.vx * step;
    this.y += this.vy * step;
    this.vy += 0.012 * step;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (this.age < this.delay) return;

    const progress = Math.min(1, (this.age - this.delay) / this.life);
    const entrance = Math.min(1, progress / 0.18);
    const exit = progress > 0.72 ? Math.max(0, 1 - (progress - 0.72) / 0.28) : 1;
    const opacity = entrance * exit;
    const width = Math.max(64, this.label.length * 8.6 + 28) * this.scale;
    const height = 28 * this.scale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation * (Math.PI / 180));
    ctx.scale(0.92 + entrance * 0.12, 0.92 + entrance * 0.12);
    ctx.globalAlpha = opacity;

    roundedRectPath(ctx, -width / 2, -height / 2, width, height, height / 2);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = this.color;
    ctx.stroke();

    ctx.fillStyle = this.color;
    ctx.font = `${Math.round(12 * this.scale)}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.label, 0, 0.5);

    ctx.restore();
  }
}

function resolveOrigin(selector: string | undefined, viewportWidth: number, viewportHeight: number): ConfettiOrigin {
  if (selector) {
    const target = document.querySelector(selector);
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + Math.min(rect.height * 0.45, 64),
        };
      }
    }
  }

  return {
    x: viewportWidth / 2,
    y: Math.min(viewportHeight * 0.34, 320),
  };
}

function drawImpactRing(
  ctx: CanvasRenderingContext2D,
  origin: ConfettiOrigin,
  elapsedMs: number,
  viewportWidth: number,
  variant: "aha" | "success"
) {
  if (elapsedMs > 720) return;

  const progress = elapsedMs / 720;
  const palette = COLORS_BY_VARIANT[variant];
  const radius = 18 + progress * (viewportWidth < 768 ? 92 : 132);
  const alpha = Math.max(0, 1 - progress);
  const glowRadius = radius * 1.15;

  ctx.save();
  const gradient = ctx.createRadialGradient(origin.x, origin.y, 4, origin.x, origin.y, glowRadius);
  gradient.addColorStop(0, `rgba(255,255,255,${0.38 * alpha})`);
  gradient.addColorStop(0.28, variant === "success" ? `rgba(245,158,11,${0.28 * alpha})` : `rgba(56,189,248,${0.25 * alpha})`);
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, glowRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = alpha * 0.72;
  ctx.strokeStyle =
    palette[Math.floor(progress * palette.length) % palette.length] || palette[0] || "#f59e0b";
  ctx.lineWidth = viewportWidth < 768 ? 2 : 2.5;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawComboPulse(
  ctx: CanvasRenderingContext2D,
  origin: ConfettiOrigin,
  elapsedMs: number,
  viewportWidth: number,
  variant: "aha" | "success"
) {
  if (elapsedMs > 1050) return;

  const progress = elapsedMs / 1050;
  const alpha = Math.max(0, 1 - progress);
  const label = variant === "success" ? "COMBO" : "BOOST";
  const radius = 34 + Math.sin(progress * Math.PI) * (viewportWidth < 768 ? 8 : 12);
  const tickCount = variant === "success" ? 16 : 12;

  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.globalAlpha = alpha;

  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * Math.PI * 2 + progress * Math.PI * 0.7;
    const inner = radius + 16;
    const outer = radius + (i % 2 === 0 ? 30 : 24);
    ctx.strokeStyle = variant === "success" ? "rgba(245,158,11,0.75)" : "rgba(56,189,248,0.68)";
    ctx.lineWidth = i % 2 === 0 ? 2.4 : 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.globalAlpha = alpha * 0.92;
  const width = variant === "success" ? 82 : 72;
  const height = 30;
  roundedRectPath(ctx, -width / 2, -height / 2, width, height, 15);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.strokeStyle = variant === "success" ? "rgba(245,158,11,0.92)" : "rgba(56,189,248,0.86)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = variant === "success" ? "#b45309" : "#0369a1";
  ctx.font = "700 11px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 0.5);
  ctx.restore();
}

export default function FunnelConfetti({
  burstKey = "default",
  variant = "aha",
  originSelector,
}: FunnelConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    let origin = resolveOrigin(originSelector, viewport.width, viewport.height);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewport.width = window.innerWidth;
      viewport.height = window.innerHeight;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      origin = resolveOrigin(originSelector, viewport.width, viewport.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const palette = COLORS_BY_VARIANT[variant];
    const rewardLabels = REWARD_LABELS_BY_VARIANT[variant];
    const particles: BurstParticle[] = [];
    const rewardTokens: RewardToken[] = [];
    const isMobile = viewport.width < 768;
    const primaryCount = variant === "success" ? (isMobile ? 150 : 260) : isMobile ? 118 : 205;
    const secondaryCount = variant === "success" ? (isMobile ? 64 : 112) : isMobile ? 46 : 84;
    const rewardTokenCount = variant === "success" ? (isMobile ? 4 : 6) : isMobile ? 3 : 4;

    for (let i = 0; i < primaryCount; i++) {
      particles.push(new BurstParticle(origin, palette, { delay: Math.random() * 90, isMobile, variant }));
    }

    for (let i = 0; i < secondaryCount; i++) {
      particles.push(
        new BurstParticle(
          {
            x: origin.x + (Math.random() - 0.5) * (isMobile ? 18 : 28),
            y: origin.y - (isMobile ? 10 : 16),
          },
          palette,
          { delay: 230 + Math.random() * 210, isMobile, isSecondaryWave: true, variant }
        )
      );
    }

    for (let i = 0; i < rewardTokenCount; i++) {
      rewardTokens.push(
        new RewardToken(origin, rewardLabels, palette, {
          delay: 120 + i * 92 + Math.random() * 90,
          isMobile,
          index: i,
        })
      );
    }

    let animationFrame: number;
    const startedAt = performance.now();
    let lastFrame = startedAt;

    const render = (now: number) => {
      const deltaMs = Math.min(34, Math.max(8, now - lastFrame));
      const elapsedMs = now - startedAt;
      lastFrame = now;

      ctx.clearRect(0, 0, viewport.width, viewport.height);
      drawImpactRing(ctx, origin, elapsedMs, viewport.width, variant);
      drawComboPulse(ctx, origin, elapsedMs, viewport.width, variant);

      let allDead = true;
      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];
        if (!particle) continue;
        if (particle.isAlive) {
          particle.update(deltaMs);
          particle.draw(ctx);
          allDead = false;
        }
      }

      for (let i = 0; i < rewardTokens.length; i++) {
        const token = rewardTokens[i];
        if (!token) continue;
        if (token.isAlive) {
          token.update(deltaMs);
          token.draw(ctx);
          allDead = false;
        }
      }

      if (!allDead || elapsedMs < 1050) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrame);
    };
  }, [burstKey, variant, originSelector]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999]"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
