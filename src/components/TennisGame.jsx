// Easter egg: peloteo contra la máquina. Se abre al tocar el logo del pie de la portada.
import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext.jsx';
import rivalIdleSrc from '../assets/game/rival-quieto.png';
import rivalHitSrc from '../assets/game/rival-golpe.png';
import pandaIdleSrc from '../assets/game/panda-quieto.png';
import pandaHitSrc from '../assets/game/panda-golpe.png';

// ─── Dimensiones ──────────────────────────────────────────────────────────────
const W = 340;
const H = 560;
const BALL_R = 7.65; // 9 px − 15 %
const PADDLE_W = 56; // ancho de la «raqueta» con la que se devuelve: más estrecha = más difícil
const PADDLE_H = 12;
const PLAYER_Y = H - 58;
const AI_Y = 58;
const BASE_SPEED = 4.0;
const MAX_SPEED = 16;
const SPEED_PER_HIT = 0.28;

// Misma letra que la web (Schibsted Grotesk, cargada en index.html)
const FONT = "'Schibsted Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif";
const font = (weight, size) => `${weight} ${size}px ${FONT}`;
// Los titulares de la web van muy apretados (letter-spacing -.05em); el canvas lo admite en navegadores recientes
function tracking(ctx, em, size) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${em * size}px`;
}

// ─── Bote: altura simulada de la bola ─────────────────────────────────────────
// La bola sale de la raqueta a Z_HIT, sube en arco, bota en el campo de quien recibe
// (a BOUNCE_AT del recorrido) y vuelve a subir hasta la altura de golpe.
const Z_HIT = 12;
const ARC_1 = 38;   // altura extra del primer vuelo (por encima de la red)
const ARC_2 = 18;   // altura extra tras el bote
const BOUNCE_AT = 0.72;
const PLAYER_HIT_Y = PLAYER_Y - PADDLE_H - BALL_R;
const AI_HIT_Y = AI_Y + PADDLE_H + BALL_R;

function ballHeight(fromY, ballY, vy) {
  const toY = vy < 0 ? AI_HIT_Y : PLAYER_HIT_Y;
  const p = Math.max(0, (ballY - fromY) / (toY - fromY));
  if (p < BOUNCE_AT) {
    const u = p / BOUNCE_AT;
    return Z_HIT * (1 - u) + ARC_1 * 4 * u * (1 - u);
  }
  const v = (p - BOUNCE_AT) / (1 - BOUNCE_AT);
  return Math.max(0, Z_HIT * v + ARC_2 * 4 * v * (1 - v));
}
const bouncePoint = (fromY, vy) => fromY + ((vy < 0 ? AI_HIT_Y : PLAYER_HIT_Y) - fromY) * BOUNCE_AT;

// ─── Pista: proporciones reales de tenis (vertical) ───────────────────────────
// Pista real: 23.77m largo × 10.97m ancho (dobles). Individual: 8.23m → calles de 1.37m
const PT = { left: 30, right: W - 30, top: 28, bottom: H - 28 };
PT.width = PT.right - PT.left;
PT.height = PT.bottom - PT.top;

const doubleAlley = Math.round(PT.width * (1.37 / 10.97));
const PT_SGL_LEFT = PT.left + doubleAlley;
const PT_SGL_RIGHT = PT.right - doubleAlley;

// Líneas de servicio: 6.40m desde la red (de 11.885m de media pista)
const serviceRatio = 6.40 / 11.885;
const halfH = PT.height / 2;
const PT_NET = PT.top + halfH;
const PT_SRV_T = PT_NET - Math.round(halfH * serviceRatio);
const PT_SRV_B = PT_NET + Math.round(halfH * serviceRatio);

const C = {
  courtMain: '#2878B5',
  courtOuter: '#2E6DA4',
  courtBg: ['#DDE6FA', '#E7EEFB'], // azul claro de las tarjetas de la web
  line: 'rgba(255,255,255,0.88)',
  ball: '#F5E85B', // el amarillo de la pelota de la web
  skin: '#f4c08a', hair: '#3a2010',
  shirt_p: '#1565c0', shorts_p: '#0d47a1',
  shirt_ai: '#b71c1c', shorts_ai: '#7f0000',
  shoe: '#fff', racket: '#8B4513', strings: 'rgba(220,240,80,0.85)',
  white: '#fff',
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Récord ───────────────────────────────────────────────────────────────────
// Con sesión: se guarda en Firestore (peloteo/{uid}) y te sigue a cualquier dispositivo.
// Sin sesión: solo vive en memoria mientras la web está abierta; al recargar o volver a entrar, empieza de 0.
let guestBest = 0;

async function loadUserBest(uid) {
  try {
    const snap = await getDoc(doc(db, 'peloteo', uid));
    return snap.exists() ? Number(snap.data().best) || 0 : 0;
  } catch (e) {
    console.warn('No se pudo leer el récord:', e);
    return 0;
  }
}
async function saveUserBest(uid, best) {
  try {
    await setDoc(doc(db, 'peloteo', uid), { best, updatedAt: serverTimestamp() });
  } catch (e) {
    console.warn('No se pudo guardar el récord:', e);
  }
}

// ─── Dibuja tenista ───────────────────────────────────────────────────────────
function drawPlayer(ctx, x, y, shirt, shorts, facingDown, swing) {
  ctx.save();
  ctx.translate(x, y);
  const s = facingDown ? 1 : -1;

  ctx.fillStyle = 'rgba(0,0,0,0.13)';
  ctx.beginPath(); ctx.ellipse(0, s * 22, 17, 5, 0, 0, Math.PI * 2); ctx.fill();

  const bob = Math.sin(swing * Math.PI * 3) * 3;
  ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = shorts;
  ctx.beginPath(); ctx.moveTo(-5, s * 2); ctx.lineTo(-7 + bob, s * 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5, s * 2); ctx.lineTo(7 - bob, s * 20); ctx.stroke();

  ctx.lineWidth = 5; ctx.strokeStyle = C.shoe;
  ctx.beginPath(); ctx.moveTo(-7 + bob, s * 20); ctx.lineTo(-12 + bob, s * 22); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(7 - bob, s * 20); ctx.lineTo(12 - bob, s * 22); ctx.stroke();

  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.roundRect(-10, s * -22, 20, s * 20, [4]); ctx.fill();

  if (facingDown) {
    ctx.fillStyle = C.skin; ctx.fillRect(-3, s * -24, 6, s * 4);
    ctx.fillStyle = C.hair;
    ctx.beginPath(); ctx.arc(0, s * -30, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.skin;
    ctx.beginPath(); ctx.arc(0, s * -28, 8, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = C.hair;
    ctx.beginPath(); ctx.arc(0, s * -30, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.skin; ctx.fillRect(-3, s * -23, 6, s * -3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = font(800, 8); ctx.textAlign = 'center';
    ctx.fillText('1', 0, s * -9);
  }

  const baseAngle = facingDown ? Math.PI * 0.1 : -Math.PI * 0.1;
  const armAngle = baseAngle + swing * Math.PI * 0.9 * (facingDown ? 1 : -1);
  const ax = 11 + Math.cos(armAngle) * 18;
  const ay = s * -14 + Math.sin(armAngle) * 18;

  ctx.strokeStyle = C.skin; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(11, s * -14); ctx.lineTo(ax, ay); ctx.stroke();

  const hx = ax + Math.cos(armAngle) * 12;
  const hy = ay + Math.sin(armAngle) * 12;
  ctx.strokeStyle = C.racket; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke();

  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(armAngle + Math.PI / 2);
  ctx.strokeStyle = C.racket; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 0, 11, 15, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = C.strings; ctx.lineWidth = 1;
  for (let i = -8; i <= 8; i += 4) {
    ctx.beginPath(); ctx.moveTo(i, -13); ctx.lineTo(i, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9, i * 0.87); ctx.lineTo(9, i * 0.87); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

// ─── Figuras pixel art (1 = quieto, 2 = golpeando) ────────────────────────────
// Arriba el rival (de frente) y abajo el panda (de espaldas).
// Las imágenes están a 192 px de alto para que se vean nítidas en móvil; se pintan a SPRITE_H px.
// ax = centro de los pies dentro de la imagen, para que los dos fotogramas no «salten».
// hitSide = hacia qué lado golpea la imagen tal cual (1 = derecha de la pantalla, -1 = izquierda).
const SPRITE_H = 58;
const SPRITE_SCALE = SPRITE_H / 192;
const SPRITES = {
  rival: {
    idle: { img: null, src: rivalIdleSrc, ax: 125.7 },
    hit: { img: null, src: rivalHitSrc, ax: 48.7 },
    hitSide: 1,
  },
  panda: {
    // Imágenes volteadas en horizontal: el panda es zurdo
    idle: { img: null, src: pandaIdleSrc, ax: 210 - 138.1 },
    hit: { img: null, src: pandaHitSrc, ax: 243 - 64.4 },
    hitSide: -1,
  },
};
function loadSprites() {
  for (const who of Object.values(SPRITES)) {
    for (const f of [who.idle, who.hit]) {
      if (f.img) continue;
      f.img = new Image();
      f.img.src = f.src;
    }
  }
}

// feetY = dónde apoya los pies; side = lado por el que llegó la bola (-1 izquierda, 1 derecha).
// Si la bola llega por el otro lado, la pose de golpe se da la vuelta.
function drawSprite(ctx, frames, x, feetY, hitting, side, fallback) {
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.beginPath(); ctx.ellipse(x, feetY - 2, 15, 4, 0, 0, Math.PI * 2); ctx.fill();

  const f = hitting ? frames.hit : frames.idle;
  if (!f.img?.complete || !f.img.naturalWidth) { fallback(); return; } // mientras carga la imagen
  const w = f.img.naturalWidth * SPRITE_SCALE;
  const h = f.img.naturalHeight * SPRITE_SCALE;
  ctx.save();
  ctx.translate(x, feetY);
  if (hitting && side !== frames.hitSide) ctx.scale(-1, 1);
  ctx.drawImage(f.img, -f.ax * SPRITE_SCALE, -h, w, h);
  ctx.restore();
}

// ─── Dibuja pista ─────────────────────────────────────────────────────────────
function drawCourt(ctx) {
  const LW = 2.5;
  const out = ctx.createLinearGradient(0, 0, W, 0);
  out.addColorStop(0, C.courtBg[0]); out.addColorStop(1, C.courtBg[1]);
  ctx.fillStyle = out;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.courtOuter;
  ctx.fillRect(PT.left, PT.top, PT.width, PT.height);
  ctx.fillStyle = C.courtMain;
  ctx.fillRect(PT_SGL_LEFT, PT.top, PT_SGL_RIGHT - PT_SGL_LEFT, PT.height);

  ctx.fillStyle = C.line;
  const hline = (y, x1, x2) => ctx.fillRect(x1, y - LW / 2, x2 - x1, LW);
  const vline = (x, y1, y2) => ctx.fillRect(x - LW / 2, y1, LW, y2 - y1);
  hline(PT.top, PT.left, PT.right);
  hline(PT.bottom, PT.left, PT.right);
  vline(PT.left, PT.top, PT.bottom);
  vline(PT.right, PT.top, PT.bottom);
  vline(PT_SGL_LEFT, PT.top, PT.bottom);
  vline(PT_SGL_RIGHT, PT.top, PT.bottom);
  hline(PT_SRV_T, PT_SGL_LEFT, PT_SGL_RIGHT);
  hline(PT_SRV_B, PT_SGL_LEFT, PT_SGL_RIGHT);
  vline((PT_SGL_LEFT + PT_SGL_RIGHT) / 2, PT_SRV_T, PT_SRV_B);

  // Red
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(PT.left - 6, PT_NET - 2, PT.width + 12, 4);
  ctx.fillStyle = '#bbb';
  ctx.fillRect(PT.left - 8, PT_NET - 14, 6, 28);
  ctx.fillRect(PT.right + 2, PT_NET - 14, 6, 28);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 4]);
  for (let ny = PT_NET - 10; ny <= PT_NET + 10; ny += 5) {
    ctx.beginPath(); ctx.moveTo(PT.left, ny); ctx.lineTo(PT.right, ny); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawOverlay(ctx, title, sub, btn) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = C.white; ctx.font = font(900, 38); tracking(ctx, -0.04, 38);
  ctx.fillText(title, W / 2, H / 2 - (sub ? 22 : 6));
  tracking(ctx, 0, 0);
  if (sub) {
    ctx.font = font(500, 19); ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillText(sub, W / 2, H / 2 + 18);
  }
  if (btn) {
    const bw = 130, bh = 40, bx = W / 2 - bw / 2, by = H / 2 + 46;
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    g.addColorStop(0, '#DCD9F6'); g.addColorStop(1, '#E6E3FA'); // lila claro de la web
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 8); ctx.fill();
    ctx.fillStyle = '#202B68'; ctx.font = font(800, 15); tracking(ctx, 0.06, 15);
    ctx.fillText(btn, W / 2, by + 26);
    tracking(ctx, 0, 0);
  }
}

// Pelota: amarilla, con las dos costuras blancas (las mismas curvas que la pelota de la web)
// girando, y la luz fija arriba a la izquierda para que el lado contrario quede en sombra.
function drawBall(ctx, cx, cy, r, spin) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = C.ball; ctx.fill();
  ctx.clip();

  // Costuras (en unidades del radio; vienen del dibujo de 100×100 de la web)
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(spin); ctx.scale(r, r);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.15; ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 0.75, -0.67);
    ctx.bezierCurveTo(side * 0.33, -0.29, side * 0.33, 0.29, side * 0.75, 0.67);
    ctx.stroke();
  }
  ctx.restore();

  // Volumen: brillo suave arriba a la izquierda y sombra hacia abajo a la derecha
  const shade = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
  shade.addColorStop(0, 'rgba(255,255,255,0.35)');
  shade.addColorStop(0.45, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(90,70,0,0.45)');
  ctx.fillStyle = shade;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}

function drawFrame(ctx, gs, frame) {
  const { ballX, ballY, ballVY, hitY, playerX, aiX, phase, touches, countdown, swingP, swingAI, mark } = gs;
  drawCourt(ctx);

  // Marca del último bote: un aro que se abre y se desvanece
  if (mark && mark.t < 1) {
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - mark.t)})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(mark.x, mark.y, 6 + mark.t * 10, 2.5 + mark.t * 4, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // (ballX, ballY) es el punto del suelo; la bola se dibuja z píxeles por encima.
  // La sombra se queda en el suelo: al subir la bola, se hace más pequeña y más clara.
  const z = ballHeight(hitY, ballY, ballVY);
  const lift = Math.min(z / (Z_HIT + ARC_1), 1.2);
  ctx.fillStyle = `rgba(0,0,0,${0.32 - lift * 0.18})`;
  ctx.beginPath();
  ctx.ellipse(ballX + z * 0.25, ballY + 2, BALL_R * (1 - lift * 0.35), 3.5 * (1 - lift * 0.3), 0, 0, Math.PI * 2);
  ctx.fill();

  const r = BALL_R * (1 + z / 160); // un pelín más grande cuanto más alta
  const cx = ballX, cy = ballY - z;
  const spin = (frame * 10 * Math.PI) / 180;
  drawBall(ctx, cx, cy, r, spin);

  drawSprite(ctx, SPRITES.rival, aiX, AI_Y + 18, swingAI > 0.7, gs.aiSide,
    () => drawPlayer(ctx, aiX, AI_Y, C.shirt_ai, C.shorts_ai, true, swingAI));
  // El panda apoya los pies algo por debajo de su línea de golpe, para que la raqueta quede a la altura de la bola
  drawSprite(ctx, SPRITES.panda, playerX, PLAYER_Y + 13, swingP > 0.2, gs.playerSide,
    () => drawPlayer(ctx, playerX, PLAYER_Y, C.shirt_p, C.shorts_p, false, swingP));

  if (phase === 'playing') {
    ctx.textAlign = 'right';
    ctx.font = font(900, 30); tracking(ctx, -0.04, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    // ctx.fillText(touches, W - 14, 38);
    // ctx.fillStyle = C.white;
    // ctx.fillText(touches, W - 15, 37);
    // ctx.font = font(700, 9); tracking(ctx, 0.12, 9);
    // ctx.fillStyle = 'rgba(255,255,255,0.6)';
    // ctx.fillText('TOQUES', W - 15, 50);
    tracking(ctx, 0, 0);
  }

  if (phase === 'idle') {
    drawOverlay(ctx, 'Peloteo', '¿Cuántos toques aguantas?', 'JUGAR');
  } else if (phase === 'countdown') {
    drawOverlay(ctx, String(countdown), null, null);
  } else if (phase === 'gameover') {
    drawOverlay(ctx, gs.newRecord ? '¡Récord!' : '¡Fallaste!', `${touches} toques`, 'OTRA VEZ');
  }
}

function mkState(best = 0) {
  return {
    ballX: W / 2, ballY: H / 2 + 40,
    ballVX: (Math.random() * 2 - 1) * 2,
    ballVY: -BASE_SPEED,
    hitY: H / 2 + 40, mark: null, aiSide: 1, playerSide: 1,
    playerX: W / 2, aiX: W / 2,
    speed: BASE_SPEED,
    touches: 0, best, newRecord: false,
    phase: 'idle', countdown: 3,
    swingP: 0, swingAI: 0.5,
  };
}

// La trayectoria no puede salir de la pista (PT.left..PT.right)
function safeVx(fromX, distY, absVy, rawVx) {
  const margin = BALL_R + 4;
  const spaceL = fromX - (PT.left + margin);
  const spaceR = (PT.right - margin) - fromX;
  const maxV = Math.max((Math.min(spaceL, spaceR) / distY) * absVy, absVy * 0.12);
  if (spaceL < 28) return absVy * 0.28;
  if (spaceR < 28) return -absVy * 0.28;
  return clamp(rawVx, -maxV, maxV);
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function TennisGame() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const canvasRef = useRef(null);
  const gsRef = useRef(null);
  if (!gsRef.current) gsRef.current = mkState(uid ? 0 : guestBest);
  // El bucle del juego guarda el récord con esta función (siempre la de la sesión actual)
  const saveBestRef = useRef(null);
  saveBestRef.current = (best) => {
    if (uid) saveUserBest(uid, best);
    else guestBest = best;
  };
  const frameRef = useRef(0);
  const pointerXRef = useRef(W / 2);
  const cdRef = useRef(null);
  const [stats, setStats] = useState({ touches: 0, best: gsRef.current.best, speed: BASE_SPEED, phase: 'idle' });
  const [touch] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);

  const startCountdown = useCallback(() => {
    clearTimeout(cdRef.current);
    gsRef.current = { ...mkState(gsRef.current.best), phase: 'countdown', countdown: 3 };
    const tick = () => {
      const c = gsRef.current.countdown - 1;
      if (c <= 0) {
        gsRef.current = { ...gsRef.current, phase: 'playing' };
      } else {
        gsRef.current = { ...gsRef.current, countdown: c };
        cdRef.current = setTimeout(tick, 1000);
      }
    };
    cdRef.current = setTimeout(tick, 1000);
  }, []);

  // Al abrir el juego (o al cambiar de sesión) se carga el récord que toca
  useEffect(() => {
    if (!uid) {
      gsRef.current = { ...gsRef.current, best: guestBest };
      return undefined;
    }
    let alive = true;
    loadUserBest(uid).then((saved) => {
      if (!alive) return;
      const local = gsRef.current.best; // por si ya ha batido algo mientras cargaba
      gsRef.current = { ...gsRef.current, best: Math.max(saved, local) };
      if (local > saved) saveUserBest(uid, local);
    });
    return () => { alive = false; };
  }, [uid]);

  // ─── Bucle ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    loadSprites();
    // El canvas no pide fuentes por sí solo: se piden los pesos que usa
    document.fonts?.load?.(font(900, 38));
    document.fonts?.load?.(font(500, 19));

    let raf;
    let lastTs = null;
    let prev = {};

    const loop = (ts) => {
      // k = fotogramas «de 60 Hz» transcurridos: misma velocidad en pantallas de 60, 90 o 120 Hz
      const dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.05) : 1 / 60;
      lastTs = ts;
      const k = dt * 60;
      frameRef.current++;
      const s = gsRef.current;

      const follow = 1 - Math.pow(1 - 0.22, k);
      const playerX = clamp(s.playerX + (pointerXRef.current - s.playerX) * follow, PADDLE_W / 2, W - PADDLE_W / 2);

      if (s.phase === 'playing') {
        let vx = s.ballVX, vy = s.ballVY;
        let bx = s.ballX + vx * k, by = s.ballY + vy * k;
        let swingP = s.swingP * Math.pow(0.86, k);
        let swingAI = s.swingAI + (0.5 - s.swingAI) * (1 - Math.pow(0.94, k));
        let { touches, speed, hitY, aiSide, playerSide } = s;
        let mark = s.mark && s.mark.t < 1 ? { ...s.mark, t: s.mark.t + dt / 0.45 } : s.mark;
        // ¿Ha botado en este paso?
        const bY = bouncePoint(hitY, vy);
        if ((s.ballY - bY) * (by - bY) <= 0 && s.ballY !== bY) mark = { x: bx, y: bY, t: 0 };
        const distCourt = PLAYER_Y - AI_Y;

        // Golpe del jugador (abajo): cuenta si la bola cruza la raqueta en este paso
        const hitLine = PLAYER_Y - PADDLE_H;
        if (
          vy > 0 &&
          by + BALL_R >= hitLine &&
          s.ballY + BALL_R <= PLAYER_Y + 14 &&
          bx >= playerX - PADDLE_W / 2 &&
          bx <= playerX + PADDLE_W / 2
        ) {
          by = hitLine - BALL_R;
          speed = clamp(speed + SPEED_PER_HIT, BASE_SPEED, MAX_SPEED);
          vy = -speed;
          vx = safeVx(bx, distCourt, speed, ((bx - playerX) / (PADDLE_W / 2)) * 4);
          touches++; swingP = 1; hitY = by;
          playerSide = bx < playerX - 4 ? -1 : 1;
        }

        // La máquina siempre devuelve
        let aiX = clamp(s.aiX + clamp((bx - s.aiX) * 0.12 * k, -6 * k, 6 * k), PADDLE_W / 2, W - PADDLE_W / 2);
        if (vy < 0 && by - BALL_R <= AI_Y + PADDLE_H) {
          if (by < AI_Y - 20) aiX = clamp(bx, PADDLE_W / 2, W - PADDLE_W / 2);
          aiSide = bx < aiX - 4 ? -1 : 1;
          by = AI_Y + PADDLE_H + BALL_R;
          speed = clamp(speed + SPEED_PER_HIT, BASE_SPEED, MAX_SPEED);
          vy = speed;
          vx = safeVx(bx, distCourt, speed, (Math.random() - 0.5) * speed * 0.6);
          touches++; swingAI = 1; hitY = by;
        }

        if (by > H) {
          // Fin: la bola se le escapa al jugador
          const newRecord = touches > s.best;
          const best = Math.max(s.best, touches);
          if (newRecord) saveBestRef.current(best);
          gsRef.current = { ...s, ballX: bx, ballY: by, playerX, aiX, touches, best, newRecord, mark, phase: 'gameover' };
        } else {
          gsRef.current = { ...s, ballX: bx, ballY: by, ballVX: vx, ballVY: vy, hitY, mark, aiSide, playerSide, playerX, aiX, speed, touches, swingP, swingAI };
        }
      } else {
        gsRef.current = { ...s, playerX };
      }

      const gs = gsRef.current;
      drawFrame(ctx, gs, frameRef.current);

      if (gs.touches !== prev.touches || gs.phase !== prev.phase || gs.best !== prev.best || gs.speed !== prev.speed) {
        prev = { touches: gs.touches, best: gs.best, speed: gs.speed, phase: gs.phase, newRecord: gs.newRecord };
        setStats(prev);
      }
      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); clearTimeout(cdRef.current); };
  }, []);

  const aim = useCallback((clientX) => {
    const rect = canvasRef.current.getBoundingClientRect();
    pointerXRef.current = (clientX - rect.left) * (W / rect.width);
  }, []);

  const handleStart = useCallback(() => {
    const { phase } = gsRef.current;
    if (phase === 'idle' || phase === 'gameover') startCountdown();
  }, [startCountdown]);

  // Velocidad «de radar», como en los partidos: 80 km/h al empezar, 230 km/h al máximo
  const kmh = Math.round(80 + ((stats.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED)) * 150);
  const beating = stats.phase === 'playing' && stats.best > 0 && stats.touches > stats.best;
  const recordNote = beating || (stats.phase === 'gameover' && stats.newRecord)
    ? '¡Nuevo récord!'
    : stats.best > 0 ? `Tu récord: ${stats.best}` : 'Aún sin récord';

  return (
    <div className="tg">
      <canvas
        ref={canvasRef}
        className="tg-canvas"
        onMouseMove={(e) => aim(e.clientX)}
        onTouchStart={(e) => aim(e.touches[0].clientX)}
        onTouchMove={(e) => aim(e.touches[0].clientX)}
        onClick={handleStart}
        aria-label="Juego de tenis: mueve tu jugador para devolver la bola"
      />

      <aside className="tg-score" aria-live="polite">
        <p className={`tg-count ${beating ? 'is-record' : ''}`}>
          <b>{stats.touches}</b> {stats.touches === 1 ? 'toque' : 'toques'}
        </p>
        <p className="tg-meta">
          <span>{recordNote}</span>
          <span>Bola a {kmh} km/h</span>
        </p>
        <p className="tg-hint">{touch ? 'Desliza el dedo para moverte. Toca la pista para empezar.' : 'Mueve el ratón para moverte. Haz clic en la pista para empezar.'}</p>
      </aside>
    </div>
  );
}
