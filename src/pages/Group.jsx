import { useMemo, useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { arrayRemove, arrayUnion, collection, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { ArrowLeft, ListOrdered, Plus, Shuffle, Swords, X } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext.jsx';
import { useCollection, useMatches, useDoc } from '../hooks/useFirestore';
import { newMatch } from '../lib/data';
import { isParticipant, sortMatches } from '../lib/matches';
import { byName, computeStandings, pairKey, roundRobinPairs } from '../lib/tennis';
import { CourtSvg, EmptyState, Person } from '../components/ui.jsx';
import StandingsTable from '../components/StandingsTable.jsx';
import MatchList from '../components/MatchList.jsx';
import Select from '../components/Select.jsx';

export default function Group() {
  const { groupId } = useParams();
  const { user, isAdmin } = useAuth();
  const uid = user?.uid;

  const { data: group, loading } = useDoc('groups', groupId);
  const { data: category } = useDoc('categories', group?.categoryId);
  const { data: users } = useCollection('users');
  const { data: matches } = useMatches([['groupId', '==', groupId]]);
  const { data: siblingGroups } = useCollection('groups', [['categoryId', '==', group?.categoryId]]);
  const [tab, setTab] = useState('matches');
  const [onlyMine, setOnlyMine] = useState(false);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  if (loading) return <p className="loading">Cargando…</p>;
  if (!group) {
    return <EmptyState title="Grupo no encontrado" action={<Link className="btn" to="/categorias">Volver a categorías</Link>} />;
  }

  const playerIds = group.playerIds ?? [];
  const standings = computeStandings(playerIds, matches);
  const pointsById = Object.fromEntries(standings.map((r, i) => [r.id, { pos: i + 1, pts: r.pts }]));
  // En la alineación, ordenados por su posición en la clasificación
  const players = playerIds.map((id) => usersById[id] ?? { id, name: 'Jugador eliminado' })
    .sort((a, b) => (pointsById[a.id]?.pos ?? 99) - (pointsById[b.id]?.pos ?? 99) || byName(a, b));
  const inGroup = playerIds.includes(uid);
  const visible = sortMatches(matches, uid).filter((m) => !onlyMine || isParticipant(m, uid));
  const played = matches.filter((m) => m.status === 'confirmed').length;

  async function generateAll() {
    const existing = new Set(matches.map((m) => pairKey(m.player1Id, m.player2Id)));
    const pairs = roundRobinPairs(playerIds).filter(([a, b]) => !existing.has(pairKey(a, b)));
    if (pairs.length === 0) {
      window.alert('Ya existen todos los cruces de este grupo.');
      return;
    }
    if (!window.confirm(`Se crearán ${pairs.length} partido(s) que faltan para el todos contra todos. ¿Continuar?`)) return;
    const batch = writeBatch(db);
    pairs.forEach(([a, b]) => batch.set(doc(collection(db, 'matches')), newMatch(group, a, b)));
    await batch.commit();
  }

  return (
    <>
      <Link className="link-back" to={category ? `/categorias` : '/'}><ArrowLeft /> Volver a categorías</Link>

      <div className="group-split">
        {/* Zona izquierda: categoría, grupo y jugadores */}
        <aside className="group-side tile">
          <CourtSvg vertical />
          <span className="ball-shape" aria-hidden="true" />
          <p className="group-cat">{category?.name ?? 'Categoría'}</p>
          <h1 className="group-name">{group.name}</h1>
          <p className="group-count">{players.length} jugadores · {played}/{matches.length} partidos jugados</p>

          {siblingGroups.length > 1 && (
            <nav className="group-tabs" aria-label="Grupos de la categoría">
              {[...siblingGroups].sort(byName).map((g) => (
                <NavLink key={g.id} to={`/grupo/${g.id}`} className={({ isActive }) => (isActive ? 'active' : '')}>{g.name}</NavLink>
              ))}
            </nav>
          )}

          {players.length === 0 && <p className="small" style={{ color: '#3F2F9E' }}>Todavía no hay jugadores en este grupo.</p>}
          <ul className="player-list">
            {players.map((p) => (
              <li key={p.id} className="player-item">
                <span className="player-num" aria-label={`Posición ${pointsById[p.id]?.pos}`}>{pointsById[p.id]?.pos}</span>
                <Person name={p.name} me={p.id === uid} size="sm" />
                <span className="pts">{pointsById[p.id]?.pts ?? 0}<small>PTS</small></span>
                {isAdmin && <RemovePlayer group={group} player={p} matches={matches} />}
              </li>
            ))}
          </ul>

          {isAdmin && <AddPlayer group={group} users={users} siblingGroups={siblingGroups} />}
        </aside>

        {/* Zona derecha: partidos y clasificación */}
        <section className="group-main">
          <div className="section-head">
            <div className="pills" role="tablist" aria-label="Vista del grupo">
              <button role="tab" aria-selected={tab === 'matches'} className={`pill ${tab === 'matches' ? 'on' : ''}`} onClick={() => setTab('matches')}>
                <Swords aria-hidden="true" /> Partidos
              </button>
              <button role="tab" aria-selected={tab === 'table'} className={`pill ${tab === 'table' ? 'on' : ''}`} onClick={() => setTab('table')}>
                <ListOrdered aria-hidden="true" /> Clasificación
              </button>
            </div>
            {tab === 'matches' && (
              <div className="inline-form">
                {inGroup && (
                  <button className={`btn btn-sm ${onlyMine ? 'btn-soft' : 'btn-ghost'}`} onClick={() => setOnlyMine((v) => !v)}>
                    {onlyMine ? 'Ver todos' : 'Solo los míos'}
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button className="btn btn-sm btn-soft" onClick={generateAll} disabled={playerIds.length < 2} title="Crea los cruces que faltan">
                      <Shuffle /> Todos contra todos
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <h2 className="section-title" style={{ marginBottom: '1rem' }}>{tab === 'matches' ? 'Partidos' : 'Clasificación'}</h2>

          {tab === 'matches' ? (
            visible.length === 0
              ? <div className="card"><EmptyState title="Sin partidos">Todavía no hay partidos en este grupo.</EmptyState></div>
              : <MatchList matches={visible} usersById={usersById} uid={uid} />
          ) : (
            <StandingsTable playerIds={playerIds} matches={matches} usersById={usersById} myId={uid} />
          )}
        </section>
      </div>

    </>
  );
}

export function RemovePlayer({ group, player, matches }) {
  async function remove() {
    const count = matches.filter((m) => m.player1Id === player.id || m.player2Id === player.id).length;
    const warning = count ? ` Tiene ${count} partido(s) en este grupo, que se quedarán sin contar en la clasificación.` : '';
    if (!window.confirm(`¿Quitar a ${player.name} del grupo?${warning}`)) return;
    await updateDoc(doc(db, 'groups', group.id), { playerIds: arrayRemove(player.id) });
  }
  return <button className="icon-btn danger" aria-label={`Quitar a ${player.name}`} onClick={remove}><X /></button>;
}

export function AddPlayer({ group, users, siblingGroups }) {
  const [selected, setSelected] = useState('');
  // Un jugador solo puede estar en un grupo por categoría
  const taken = new Set(siblingGroups.flatMap((g) => g.playerIds ?? []));
  const available = users.filter((u) => !taken.has(u.id)).sort(byName);

  async function add() {
    if (!selected) return;
    await updateDoc(doc(db, 'groups', group.id), { playerIds: arrayUnion(selected) });
    setSelected('');
  }

  return (
    <div className="group-admin">
      <p>Añadir jugador/a</p>
      <div className="inline-form">
        <Select label="Jugador a añadir" value={selected} onChange={setSelected} size="sm"
          placeholder={available.length ? 'Elige un jugador…' : 'No quedan jugadores libres'} disabled={!available.length}
          options={available.map((u) => ({ value: u.id, label: u.name }))} />
        <button className="btn btn-primary btn-sm" disabled={!selected} onClick={add}><Plus /> Añadir</button>
      </div>
    </div>
  );
}
