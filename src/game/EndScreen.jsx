import React, { useEffect, useMemo, useRef } from 'react';
import { celebrationHeroes, fireworkPictures } from './endScreen.js';
import { defaultPicture } from '../assets/defaultLooks.js';
import { GAME_LOOKS } from '../config/components.js';

// The end of a game (SPEC §11). A victory: the hero played with and three other
// drawn heroes jump along the title, and the kids' projectiles fly up from its
// letters as fireworks. A defeat: a sad, drooping "Game over" under a rain
// cloud, the hero grey and sitting. `children` = the round reached and buttons.

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const GRAVITY = 260; // px/s² for the rockets
const COLORS = ['#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#facc15'];

/** The title as one span per letter (for the animations); read as a whole. */
function Letters({ text, className }) {
  return (
    <h1 className={className} aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={i} className="end-letter" aria-hidden="true" style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </h1>
  );
}

/** Projectiles shot up from random letters of the title, bursting into sparks. */
function Fireworks({ titleRef, pictures }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion()) return undefined;
    const images = pictures.map((src) => { const im = new Image(); im.src = src; return im; });
    const g = canvas.getContext('2d');
    const rockets = [], sparks = [];
    let raf = 0, last = performance.now(), nextLaunch = 0, alive = true;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const launch = () => {
      const letters = titleRef.current?.querySelectorAll('.end-letter');
      if (!letters?.length) return;
      const letter = letters[Math.floor(Math.random() * letters.length)];
      const box = canvas.getBoundingClientRect(), r = letter.getBoundingClientRect();
      const x = r.left + r.width / 2 - box.left, y = r.top - box.top;
      // fast enough to stop 90–220 px above the letter (never above the screen) and burst there
      const height = Math.min(y - 20, 90 + Math.random() * 130);
      const up = Math.sqrt(2 * GRAVITY * Math.max(40, height));
      rockets.push({ x, y, vx: (Math.random() - 0.5) * 120, vy: -up, img: images[Math.floor(Math.random() * images.length)], color: COLORS[Math.floor(Math.random() * COLORS.length)] });
      letter.classList.remove('fire');
      void letter.offsetWidth; // restart the letter's little jump
      letter.classList.add('fire');
    };
    const burst = (r) => {
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.2, v = 80 + Math.random() * 110;
        sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color: Math.random() < 0.7 ? r.color : COLORS[i % COLORS.length] });
      }
    };
    const frame = (now) => {
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (now >= nextLaunch) { launch(); nextLaunch = now + 280 + Math.random() * 420; }
      g.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.vy += GRAVITY * dt; // gravity slows it down
        r.x += r.vx * dt; r.y += r.vy * dt;
        if (r.vy > -30 || r.y < 10) { burst(r); rockets.splice(i, 1); continue; }
        // the picture is drawn pointing right: turn it to where it flies
        g.save();
        g.translate(r.x, r.y);
        g.rotate(Math.atan2(r.vy, r.vx));
        if (r.img?.complete && r.img.naturalWidth) g.drawImage(r.img, -20, -20, 40, 40);
        else { g.fillStyle = r.color; g.fillRect(-10, -3, 20, 6); }
        g.restore();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vy += 120 * dt; s.vx *= 0.98;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.life -= dt * 0.9;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        g.globalAlpha = Math.max(0, s.life);
        g.fillStyle = s.color;
        g.beginPath(); g.arc(s.x, s.y, 2.5 + s.life * 1.5, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [titleRef, pictures]);
  return <canvas ref={canvasRef} className="end-fireworks" aria-hidden="true" data-testid="fireworks" />;
}

function HeroPic({ src, className, style }) {
  return src
    ? <img src={src} alt="" className={className} style={style} draggable={false} />
    : <span className={`${className} end-hero-standin`} style={style} aria-hidden="true">🧙</span>;
}

export default function EndScreen({ won, title, reason, hero, assets = [], children }) {
  const titleRef = useRef(null);
  const heroes = useMemo(() => celebrationHeroes(hero, assets.filter((a) => a.category === 'hero')), [hero, assets]);
  const pictures = useMemo(() => fireworkPictures(
    assets.filter((a) => a.category === 'projectile'),
    Object.keys(GAME_LOOKS).map((id) => [id, defaultPicture(id)]),
  ), [assets]);

  if (won) {
    return (
      <div className="game-over end-won" data-testid="end-won">
        <Fireworks titleRef={titleRef} pictures={pictures} />
        <div className="sketch-card end-card">
          <div ref={titleRef}><Letters text={title} className="end-title" /></div>
          <div className="end-heroes" aria-hidden="true">
            {heroes.map((h, i) => (
              <HeroPic key={h.id} src={h.src} className={`end-hero ${h.played ? 'played' : ''}`} style={{ '--i': i }} />
            ))}
          </div>
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="game-over end-lost" data-testid="end-lost">
      <div className="sketch-card end-card">
        <div className="end-cloud" aria-hidden="true">
          <span className="cloud">☁️</span>
          {[0, 1, 2, 3, 4].map((i) => <span key={i} className="drop" style={{ '--i': i }} />)}
        </div>
        <Letters text={title} className="end-title sad" />
        <p className="end-reason">{reason}</p>
        <div className="end-sad-hero" aria-hidden="true">
          <HeroPic src={heroes.find((h) => h.played)?.src} className="end-hero sad" />
          <span className="tear" />
        </div>
        {children}
      </div>
    </div>
  );
}
