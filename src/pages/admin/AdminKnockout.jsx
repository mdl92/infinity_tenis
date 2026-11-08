import { useState } from 'react';
import {
  arrayRemove, arrayUnion, collection, doc, getDocs, query, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { ArrowDown, ArrowUp, RotateCcw, Shuffle, X } from 'lucide-react';
import { db } from '../../firebase';
import { createDraw, drawSizeFor, isBye, roundName, shuffle } from '../../lib/bracket';
import { byName } from '../../lib/tennis';
import { Avatar } from '../../components/ui.jsx';
import Bracket from '../../components/Bracket.jsx';
import Select, { Segmented } from '../../components/Select.jsx';

const MODES = { random: 'random', seeded: 'seeded' };

/** Categoría por eliminatoria: antes del sorteo, elegir jugadores; después, el cuadro. */
export default function AdminKnockout({ category, users, usersById, matches }) {
  const [mode, setMode] = useState(MODES.random);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = category.playerIds ?? [];
  const name = (id) => usersById[id]?.name ?? 'Jugador eliminado';
  const available = users.filter((u) => u.role !== 'admin' && !ids.includes(u.id)).sort(byName);
  const ref = doc(db, 'categories', category.id);

  const size = drawSizeFor(ids.length);
  const byes = ids.length >= 2 ? size - ids.length : 0;
  const played = matches.filter((m) => !isBye(m) && m.sets?.length).length;

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError('No se ha podido guardar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  const add = (id) => id && run(() => updateDoc(ref, { playerIds: arrayUnion(id) }));
  const remove = (id) => run(() => updateDoc(ref, { playerIds: arrayRemove(id) }));
  const move = (i, d) => {
    const next = [...ids];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    run(() => updateDoc(ref, { playerIds: next }));
  };

  function draw() {
    const seeded = mode === MODES.random ? shuffle(ids) : ids;
    const how = mode === MODES.random ? 'al azar' : 'por el orden de la lista (el 1.º es el primer cabeza de serie)';
    if (!window.confirm(`Se sorteará un cuadro de ${size} con ${ids.length} jugadores, ${how}.${byes ? ` ${byes} pasarán directos a la segunda ronda.` : ''} ¿Continuar?`)) return;
    run(() => createDraw(category, seeded));
  }

  function redo() {
    const warn = played
      ? `Se borrará el cuadro con ${played} ${played === 1 ? 'resultado' : 'resultados'} ya apuntados.`
      : 'Se borrará el cuadro actual (aún no hay resultados).';
    if (!window.confirm(`${warn} Los jugadores se mantienen para volver a sortear. ¿Continuar?`)) return;
    run(async () => {
      const snap = await getDocs(query(collection(db, 'matches'), where('categoryId', '==', category.id)));
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      batch.update(ref, { drawn: false, drawSize: null, rounds: null });
      await batch.commit();
    });
  }

  if (category.drawn) {
    return (
      <div className="hm-card ko-admin">
        <div className="ko-admin-head">
          <h3>Cuadro <span className="hm-meta">{ids.length} jugadores · {roundName(0, category.rounds)} · {played} {played === 1 ? 'jugado' : 'jugados'}</span></h3>
          <button type="button" className="hm-tool danger" onClick={redo} disabled={busy}><RotateCcw aria-hidden="true" /> Rehacer sorteo</button>
        </div>
        <Bracket category={category} matches={matches} usersById={usersById} />
        <p className="hm-legend">Pulsa un partido para ver, apuntar o corregir su resultado. Al confirmarse, el ganador pasa solo a la siguiente ronda.</p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  return (
    <div className="hm-card ko-admin">
      <h3>Jugadores <span className="hm-meta">{ids.length} {ids.length === 1 ? 'apuntado' : 'apuntados'}{ids.length >= 2 && <> · cuadro de {size}{byes ? ` · ${byes} ${byes === 1 ? 'pasa' : 'pasan'} directo` : ''}</>}</span></h3>

      {ids.length === 0 ? <p className="hm-empty">Añade los jugadores que participan en esta eliminatoria.</p> : (
        <ol className="ko-list">
          {ids.map((id, i) => (
            <li key={id}>
              <span className="ko-seed">{i + 1}</span>
              <span className="hm-person"><Avatar name={name(id)} size="sm" /><span>{name(id)}</span></span>
              <span className="ko-actions">
                {mode === MODES.seeded && (
                  <>
                    <button type="button" className="icon-btn" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={`Subir a ${name(id)}`} title="Subir"><ArrowUp /></button>
                    <button type="button" className="icon-btn" disabled={busy || i === ids.length - 1} onClick={() => move(i, 1)} aria-label={`Bajar a ${name(id)}`} title="Bajar"><ArrowDown /></button>
                  </>
                )}
                <button type="button" className="icon-btn danger" disabled={busy} onClick={() => remove(id)} aria-label={`Quitar a ${name(id)}`} title="Quitar"><X /></button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="adm2-add">
        <Select label={`Añadir jugador a ${category.name}`} value="" onChange={add} size="sm"
          placeholder={available.length ? '+ Añadir jugador/a…' : 'No queda nadie por añadir'} disabled={!available.length || busy}
          options={available.map((u) => ({ value: u.id, label: u.name }))} />
      </div>

      <div className="ko-draw">
        <div className="field">
          <span>Sorteo</span>
          <Segmented label="Tipo de sorteo" value={mode} onChange={setMode}
            options={[{ value: MODES.random, label: 'Al azar' }, { value: MODES.seeded, label: 'Cabezas de serie' }]} />
          <span className="field-hint">
            {mode === MODES.random
              ? 'Las posiciones del cuadro se reparten al azar.'
              : 'Ordena la lista de mejor a peor: el 1.º y el 2.º solo pueden cruzarse en la final, y quienes pasan directo son los primeros.'}
          </span>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || ids.length < 2} onClick={draw}>
          <Shuffle aria-hidden="true" /> Sortear cuadro
        </button>
        {ids.length < 2 && <p className="field-hint">Hacen falta al menos dos jugadores.</p>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
