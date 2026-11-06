import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

const norm = (t = '') => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Desplegable propio: botón + lista flotante con marca de selección,
 * buscador cuando hay muchas opciones y manejo completo con teclado.
 *
 * options: [{ value, label, hint?, group? }]  ·  onChange(value)
 */
export default function Select({
  value, onChange, options, placeholder = 'Elige…', label, disabled = false,
  searchable, size, className = '', emptyText = 'Sin opciones', id,
}) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const withSearch = searchable ?? options.length > 7;
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(
    () => (query ? options.filter((o) => norm(`${o.label} ${o.hint ?? ''} ${o.group ?? ''}`).includes(norm(query))) : options),
    [options, query],
  );

  // Posición: debajo del botón o, si no cabe, encima. Se pinta dentro del <dialog> si lo hay.
  const place = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 280 && r.top > below;
    const maxH = Math.max(160, Math.min(340, (up ? r.top : below) - 16));
    setPos({ left: r.left, width: Math.max(r.width, 220), top: up ? undefined : r.bottom + 6, bottom: up ? window.innerHeight - r.top + 6 : undefined, maxH });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!popRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) setOpen(false);
    };
    const onMove = () => place();
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open]);

  function openList() {
    if (disabled) return;
    setQuery('');
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
    requestAnimationFrame(() => (withSearch ? searchRef.current?.focus() : popRef.current?.focus()));
  }
  function choose(o) {
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKey(e) {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[active]); }
    else if (e.key === 'Tab') setOpen(false);
  }

  useEffect(() => {
    popRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const host = triggerRef.current?.closest('dialog') ?? document.body;
  let lastGroup = null;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`select ${size === 'sm' ? 'select-sm' : ''} ${open ? 'is-open' : ''} ${selected ? '' : 'is-empty'} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label ? `${label}: ${selected?.label ?? placeholder}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
      >
        <span className="select-value">
          {selected ? selected.label : placeholder}
          {selected?.hint && <small>{selected.hint}</small>}
        </span>
        <ChevronDown className="select-chevron" aria-hidden="true" />
      </button>

      {open && pos && createPortal(
        <div
          ref={popRef}
          className="select-pop"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH }}
          tabIndex={-1}
          onKeyDown={onKey}
        >
          {withSearch && (
            <div className="select-search">
              <Search aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                placeholder="Buscar…"
                aria-label="Buscar"
                aria-controls={listId}
                aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
              />
            </div>
          )}
          <ul id={listId} role="listbox" className="select-list" aria-label={label}>
            {shown.length === 0 && <li className="select-empty">{query ? 'Nada coincide' : emptyText}</li>}
            {shown.map((o, i) => {
              const head = o.group && o.group !== lastGroup ? o.group : null;
              lastGroup = o.group ?? lastGroup;
              return (
                <li key={o.value} role="presentation">
                  {head && <p className="select-group" aria-hidden="true">{head}</p>}
                  <div
                    id={`${listId}-${i}`}
                    data-i={i}
                    role="option"
                    aria-selected={o.value === value}
                    aria-disabled={o.disabled || undefined}
                    className={`select-option ${i === active ? 'is-active' : ''} ${o.value === value ? 'is-selected' : ''}`}
                    onPointerEnter={() => setActive(i)}
                    onClick={() => choose(o)}
                  >
                    <span>{o.label}{o.hint && <small>{o.hint}</small>}</span>
                    {o.value === value && <Check aria-hidden="true" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>,
        host,
      )}
    </>
  );
}

/** Interruptor de pocas opciones (p. ej. el rol). */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
