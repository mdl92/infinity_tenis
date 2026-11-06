import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Botones principales en círculos, en vertical y fijos arriba a la derecha.
 * Solo aparecen cuando, al hacer scroll, deja de verse la fila de botones de la cabecera (`watchRef`).
 *
 * items: [{ key, label, icon: Icono, to?, onClick?, active?, tone? }]
 */
export default function FloatingDock({ watchRef, items }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = watchRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [watchRef]);

  return (
    <nav className={`dock ${show ? 'show' : ''}`} aria-label="Accesos rápidos" aria-hidden={!show}>
      {items.map(({ key, label, icon: Icon, to, onClick, active, tone }) => {
        const cls = `dock-btn ${active ? 'on' : ''} ${tone ? `tone-${tone}` : ''}`;
        const content = <><Icon aria-hidden="true" /><span className="dock-tip">{label}</span></>;
        return to
          ? <Link key={key} to={to} className={cls} aria-label={label} tabIndex={show ? 0 : -1}>{content}</Link>
          : <button key={key} type="button" className={cls} aria-label={label} onClick={onClick} tabIndex={show ? 0 : -1}>{content}</button>;
      })}
    </nav>
  );
}
