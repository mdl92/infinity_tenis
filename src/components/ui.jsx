// Piezas visuales compartidas: marca Infinity, pelota, pista, avatar, modal y cabeceras.
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import club from '../assets/render_club.png';
import infinityLogo from '../assets/infinity-yellow.svg';

/** Pelota de tenis ilustrada (amarilla, con costuras blancas). */
export function TennisBall({ className = '', style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="#F5E85B" />
      <circle cx="50" cy="50" r="48" fill="none" stroke="#E6D63A" strokeWidth="3" />
      <path d="M14 18c20 18 20 46 0 64M86 18C66 36 66 64 86 82" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="34" cy="30" rx="12" ry="7" fill="#fff" opacity=".35" transform="rotate(-30 34 30)" />
    </svg>
  );
}

/** Pelota en trazo, con el mismo estilo que los iconos de Lucide. */
export function BallIcon({ className, strokeWidth = 1.8 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" />
      <path d="M5.3 5.3c3.4 3.4 3.4 10 0 13.4" />
      <path d="M18.7 5.3c-3.4 3.4-3.4 10 0 13.4" />
    </svg>
  );
}

/**
 * Pista de tenis vista desde arriba (líneas blancas), para fondos de color.
 * vertical: la red va en horizontal (pista "de pie"), útil en columnas estrechas.
 */
export function CourtSvg({ vertical = false, className = '' }) {
  const lines = (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="40" y="40" width="1120" height="520" />
      <line x1="40" y1="105" x2="1160" y2="105" />
      <line x1="40" y1="495" x2="1160" y2="495" />
      <line x1="300" y1="105" x2="300" y2="495" />
      <line x1="900" y1="105" x2="900" y2="495" />
      <line x1="300" y1="300" x2="900" y2="300" />
      <line x1="40" y1="300" x2="58" y2="300" />
      <line x1="1142" y1="300" x2="1160" y2="300" />
      <line x1="600" y1="20" x2="600" y2="580" />
    </g>
  );
  return vertical ? (
    <svg className={`court-svg ${className}`} viewBox="0 0 600 1200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g transform="translate(600 0) rotate(90)">{lines}</g>
    </svg>
  ) : (
    <svg className={`court-svg ${className}`} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{lines}</svg>
  );
}

/** Estela de velocidad que sigue a la pelota. */
export function BallStreak({ className = '' }) {
  return (
    <svg className={`ball-streak ${className}`} viewBox="0 0 200 60" aria-hidden="true">
      <g stroke="#F5E85B" strokeLinecap="round">
        <line x1="10" y1="12" x2="190" y2="12" strokeWidth="5" opacity=".35" />
        <line x1="50" y1="30" x2="196" y2="30" strokeWidth="7" opacity=".7" />
        <line x1="30" y1="48" x2="186" y2="48" strokeWidth="4" opacity=".45" />
      </g>
    </svg>
  );
}

/**
 * Logotipo de Infinity: el símbolo del infinito en su amarillo original.
 * Sobre fondos claros va dentro de un cuadrado azul marino para que se lea; con `light`, directo sobre fondos oscuros.
 */
export function Logo({ to = '/', light = false, word = true }) {
  return (
    <Link to={to} className={`logo ${light ? 'logo-light' : ''}`} aria-label="Infinity, inicio">
      <span className="logo-mark"><img src={infinityLogo} alt="" /></span>
      {word && <span className="logo-word">Infinity</span>}
    </Link>
  );
}

/** El símbolo solo, en grande (para el cartel). */
export function InfinityMark({ className = '' }) {
  return <img className={`infinity-mark ${className}`} src={infinityLogo} alt="" aria-hidden="true" />;
}

/**
 * Logo de Infinity centrado debajo de la tarjeta principal de cada página.
 * `onPhoto`: en blanco, sobre la foto del club; si no, en azul marino sobre el fondo claro.
 * (Se pinta con una máscara del logo para poder darle cualquier color.)
 */
export function FooterLogo({ onPhoto = false }) {
  return (
    <footer className={`foot-logo ${onPhoto ? 'on-photo' : ''}`}>
      <span role="img" aria-label="Infinity" style={{ '--logo': `url(${infinityLogo})` }} />
    </footer>
  );
}

/** Recortes distintos de la foto del club para dar variedad a las tarjetas. */
const CROPS = ['48% 62%', '30% 30%', '62% 78%', '45% 12%', '20% 70%', '70% 40%'];
export const photoStyle = (i = 0) => ({
  backgroundImage: `url(${club})`,
  backgroundPosition: CROPS[i % CROPS.length],
});
export const clubPhoto = club;

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Color estable por persona, para que cada avatar tenga siempre el mismo tono
const tone = (name = '') => `c${([...name].reduce((n, ch) => n + ch.charCodeAt(0), 0) % 4) + 1}`;

export function Avatar({ name, me = false, size = '' }) {
  return (
    <span className={`avatar ${tone(name)} ${me ? 'avatar-me' : ''} ${size ? `avatar-${size}` : ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Person({ name, me, size }) {
  return (
    <span className="person">
      <Avatar name={name} me={me} size={size} />
      <span className="person-name">{name}</span>
    </span>
  );
}

/** Modal nativo (<dialog>): gestiona el foco, Escape y el fondo oscurecido. */
export function Modal({ title, description, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.open && dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}
    >
      <div className="modal-inner">
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><X /></button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function PageHead({ eyebrow, title, description, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
