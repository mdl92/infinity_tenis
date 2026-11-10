import { useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { Plus, X } from 'lucide-react';
import { db } from '../../firebase';
import { byName } from '../../lib/tennis';
import { shortName } from '../../lib/teams';
import { Avatar } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';

/**
 * Parejas de una categoría (torneo de dobles). Cada jugador puede estar en una sola pareja por categoría.
 * Una pareja solo se puede deshacer mientras no esté en un grupo o en el cuadro.
 */
export default function AdminTeams({ category, users, teams, usersById, usedIds }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const own = teams.filter((t) => t.categoryId === category.id)
    .map((t) => usersById[t.id] ?? t)
    .sort(byName);
  const paired = new Set(own.flatMap((t) => t.memberIds ?? []));
  const free = users.filter((u) => u.role !== 'admin' && !paired.has(u.id)).sort(byName);
  const options = (except) => free.filter((u) => u.id !== except).map((u) => ({ value: u.id, label: u.name }));

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      console.error(e);
      setError(e?.code === 'permission-denied'
        ? 'Firebase no ha dado permiso para guardar. Comprueba que las reglas de firestore.rules están publicadas en Firestore › Reglas.'
        : 'No se ha podido guardar. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  function create() {
    if (!a || !b || a === b) return;
    run(async () => {
      await addDoc(collection(db, 'teams'), {
        tournamentId: category.tournamentId, categoryId: category.id, memberIds: [a, b], createdAt: serverTimestamp(),
      });
      setA('');
      setB('');
    });
  }

  function remove(t) {
    if (usedIds.has(t.id)) {
      window.alert(`«${t.name}» ya está en un grupo o en el cuadro. Quítala de ahí antes de deshacer la pareja.`);
      return;
    }
    if (!window.confirm(`¿Deshacer la pareja «${t.name}»?`)) return;
    run(() => deleteDoc(doc(db, 'teams', t.id)));
  }

  return (
    <div className="hm-card teams-admin">
      <h3>Parejas <span className="hm-meta">{own.length} {own.length === 1 ? 'pareja' : 'parejas'} · {free.length} {free.length === 1 ? 'jugador' : 'jugadores'} sin pareja</span></h3>

      {own.length === 0 ? <p className="hm-empty">Forma las parejas de esta categoría eligiendo a sus dos jugadores.</p> : (
        <ul className="ko-list">
          {own.map((t) => (
            <li key={t.id}>
              <span className="team-avatars" aria-hidden="true">
                {(t.memberIds ?? []).map((id) => <Avatar key={id} name={usersById[id]?.name} size="sm" />)}
              </span>
              <span className="team-name">{(t.memberIds ?? []).map((id) => shortName(usersById[id])).join(' / ')}</span>
              {!usedIds.has(t.id) && <span className="tag tag-yellow">Sin colocar</span>}
              <span className="ko-actions">
                <button type="button" className="icon-btn danger" disabled={busy} onClick={() => remove(t)}
                  aria-label={`Deshacer la pareja ${t.name}`} title="Deshacer pareja"><X /></button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="team-form">
        <Select label="Primer jugador de la pareja" value={a} onChange={setA} size="sm" placeholder="Jugador 1…"
          options={options(b)} disabled={busy || free.length < 2} />
        <span className="team-plus" aria-hidden="true">+</span>
        <Select label="Segundo jugador de la pareja" value={b} onChange={setB} size="sm" placeholder="Jugador 2…"
          options={options(a)} disabled={busy || free.length < 2} />
        <button type="button" className="btn btn-primary btn-sm" disabled={busy || !a || !b} onClick={create}>
          <Plus aria-hidden="true" /> Formar pareja
        </button>
      </div>
      {free.length < 2 && <p className="field-hint">{free.length === 0 ? 'Todos los jugadores tienen pareja en esta categoría.' : 'Solo queda un jugador sin pareja.'}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
