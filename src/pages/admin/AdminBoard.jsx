import { useEffect, useMemo, useState } from 'react';
import {
  addDoc, arrayRemove, arrayUnion, collection, doc, updateDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTournament } from '../../context/TournamentContext.jsx';
import { useCollection, useMatches } from '../../hooks/useFirestore';
import { deleteWithChildren, newMatch } from '../../lib/data';
import { confirmResult, formatSets, permissionMessage, sortMatches } from '../../lib/matches';
import { byCategory, byName, computeStandings, pairKey, roundRobinPairs } from '../../lib/tennis';
import { ChevronRight, CircleCheck, Pencil, Plus, Shuffle, Trash2, X } from 'lucide-react';
import { Avatar, Modal } from '../../components/ui.jsx';
import MatchRows from '../../components/MatchRows.jsx';
import Select from '../../components/Select.jsx';
import Match from '../Match.jsx';
import { CategoryModal, GroupModal, TournamentModal } from './AdminModals.jsx';

const toReview = (m) => m.status === 'reported' || (m.status === 'pending' && m.disputedBy);
const catTitle = (c) => (/^categor/i.test(c.name) ? c.name : `Categoría ${c.name}`);

/** Cuadros: lo pendiente arriba y, por categoría, cada grupo como hoja de todos contra todos. */
export default function AdminBoard() {
  const { active, choose, loading } = useTournament();
  const tid = active?.id;
  const { data: categories } = useCollection('categories', [['tournamentId', '==', tid]]);
  const { data: groups } = useCollection('groups', [['tournamentId', '==', tid]]);
  const { data: matches } = useMatches([['tournamentId', '==', tid]]);
  const { data: users } = useCollection('users');
  const [catId, setCatId] = useState(null);
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  // Partidos cuyos dos jugadores ya no existen (dados de baja): se borran
  const { data: allMatches } = useCollection('matches', [['tournamentId', '==', tid]]);
  useEffect(() => {
    if (users.length === 0) return;
    const orphans = allMatches.filter((m) => !usersById[m.player1Id] && !usersById[m.player2Id]);
    if (orphans.length === 0) return;
    const batch = writeBatch(db);
    orphans.forEach((m) => batch.delete(doc(db, 'matches', m.id)));
    batch.commit().catch((e) => console.error(e));
  }, [allMatches, users, usersById]);
  const name = (id) => usersById[id]?.name ?? 'Jugador eliminado';
  const cats = [...categories].sort(byCategory);
  const cat = cats.find((c) => c.id === catId) ?? cats[0];
  const catGroups = groups.filter((g) => g.categoryId === cat?.id).sort(byName);

  // Lo pendiente
  const review = matches.filter(toReview);
  const placed = new Set(groups.flatMap((g) => g.playerIds ?? []));
  const loose = users.filter((u) => u.role !== 'admin' && !placed.has(u.id)).sort(byName);
  const groupLabel = (g) => `${categories.find((c) => c.id === g.categoryId)?.name ?? ''} · ${g.name}`;

  if (!loading && !active) {
    return (
      <div className="adm2-empty">
        <h2>Empieza creando el torneo</h2>
        <p>Después añadirás las categorías, los grupos y los jugadores.</p>
        <button className="btn btn-primary" onClick={() => setModal({ kind: 'tournament' })}><Plus /> Crear torneo</button>
        {modal && <TournamentModal tournament={null} onClose={close} onCreated={choose} />}
      </div>
    );
  }

  async function removeCategory(c) {
    if (!window.confirm(`Se eliminará «${c.name}» con sus grupos y partidos. ¿Continuar?`)) return;
    await deleteWithChildren('categories', c.id, 'categoryId', ['groups', 'matches']);
    setCatId(null);
  }
  const playersIn = (c) => new Set(groups.filter((g) => g.categoryId === c.id).flatMap((g) => g.playerIds ?? [])).size;

  return (
    <>
      {/* Lo pendiente */}
      {(review.length > 0 || loose.length > 0) ? (
        <div className="adm2-todo">
          {review.length > 0 && (
            <button type="button" className="hm-alert" onClick={() => setModal({ kind: 'review' })}>
              <b>{review.length}</b> {review.length === 1 ? 'resultado por revisar' : 'resultados por revisar'}
              <span>Revisar</span><ChevronRight aria-hidden="true" />
            </button>
          )}
          {loose.length > 0 && (
            <button type="button" className="hm-alert lav" onClick={() => setModal({ kind: 'loose' })}>
              <b>{loose.length}</b> {loose.length === 1 ? 'jugador sin grupo' : 'jugadores sin grupo'}
              <span>Colocar</span><ChevronRight aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        <p className="adm2-ok"><CircleCheck aria-hidden="true" /> Todo al día: no hay resultados por revisar ni jugadores sin grupo.</p>
      )}

      {/* Pestañas de categoría */}
      <div className="hm-bar">
        <nav className="hm-tabs" aria-label="Categorías">
          {cats.map((c) => (
            <button key={c.id} type="button" className={c.id === cat?.id ? 'on' : ''} aria-pressed={c.id === cat?.id} onClick={() => setCatId(c.id)}>
              {c.name}
            </button>
          ))}
          <button type="button" className="adm2-tab-add" onClick={() => setModal({ kind: 'category' })} aria-label="Añadir categoría"><Plus /> Categoría</button>
        </nav>
        {cat && (
          <div className="hm-tools">
            <button type="button" className="hm-tool" onClick={() => setModal({ kind: 'category', item: cat })}><Pencil aria-hidden="true" /> Renombrar</button>
            <button type="button" className="hm-tool danger" onClick={() => removeCategory(cat)}><Trash2 aria-hidden="true" /> Eliminar</button>
          </div>
        )}
      </div>

      {!cat ? (
        <div className="adm2-empty">
          <h2>Crea la primera categoría</h2>
          <p>Por ejemplo A+, A, B y C.</p>
          <button className="btn btn-primary" onClick={() => setModal({ kind: 'category' })}><Plus /> Añadir categoría</button>
        </div>
      ) : (
        <section className="hm-cat" aria-labelledby="adm-cat-title">
          <div className="hm-cat-head">
            <h2 id="adm-cat-title">{catTitle(cat)}</h2>
            <span className="hm-meta">{catGroups.length} {catGroups.length === 1 ? 'grupo' : 'grupos'} · {playersIn(cat)} jugadores</span>
            <button type="button" className="hm-tool adm2-head-btn" onClick={() => setModal({ kind: 'group', categoryId: cat.id })}><Plus aria-hidden="true" /> Nuevo grupo</button>
          </div>
          <div className="hm-groups">
            {catGroups.length === 0 && <p className="hm-empty">Esta categoría aún no tiene grupos. Crea el primero con «Nuevo grupo».</p>}
            {catGroups.map((g) => (
              <AdminGroup key={g.id} group={g} siblings={catGroups} users={users} usersById={usersById}
                matches={matches.filter((m) => m.groupId === g.id)}
                onCreate={(pair) => setModal({ kind: 'cell', group: g, pair })}
                onRename={() => setModal({ kind: 'group', item: g })} />
            ))}
          </div>
        </section>
      )}

      {modal?.kind === 'tournament' && <TournamentModal tournament={null} onClose={close} onCreated={choose} />}
      {modal?.kind === 'category' && (
        <CategoryModal tournamentId={tid} category={modal.item ?? null} onClose={close} />
      )}
      {modal?.kind === 'group' && (
        <GroupModal tournamentId={tid} categories={cats} group={modal.item ?? null} defaultCategoryId={modal.categoryId} onClose={close} />
      )}
      {modal?.kind === 'cell' && (
        <CellModal group={modal.group} pair={modal.pair} name={name}
          match={matches.find((m) => m.id === modal.matchId)} onClose={close}
          onCreated={(id) => setModal({ ...modal, matchId: id })} />
      )}
      {modal?.kind === 'review' && (
        <ReviewModal list={review} name={name} groupLabel={(m) => groupLabel(groups.find((g) => g.id === m.groupId) ?? {})}
          onOpen={(m) => setModal({ kind: 'cell', group: groups.find((g) => g.id === m.groupId), pair: [m.player1Id, m.player2Id], matchId: m.id })}
          onClose={close} />
      )}
      {modal?.kind === 'loose' && (
        <LooseModal players={loose} groups={[...groups].sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), 'es'))} groupLabel={groupLabel} onClose={close} />
      )}
    </>
  );
}

/** Un grupo: clasificación y jugadores a la izquierda, partidos a la derecha (como en la portada). */
function AdminGroup({ group, siblings, users, usersById, matches, onCreate, onRename }) {
  const [adding, setAdding] = useState('');
  const ids = group.playerIds ?? [];
  const rows = computeStandings(ids, matches);
  const name = (id) => usersById[id]?.name ?? 'Jugador eliminado';
  const played = matches.filter((m) => m.status === 'confirmed').length;
  const byPair = new Set(matches.map((m) => pairKey(m.player1Id, m.player2Id)));
  const missing = roundRobinPairs(ids).filter(([a, b]) => !byPair.has(pairKey(a, b)));
  const taken = new Set(siblings.flatMap((g) => g.playerIds ?? []));
  const available = users.filter((u) => u.role !== 'admin' && !taken.has(u.id)).sort(byName);

  async function add(id) {
    setAdding('');
    if (id) await updateDoc(doc(db, 'groups', group.id), { playerIds: arrayUnion(id) });
  }
  async function removePlayer(id) {
    const n = matches.filter((m) => m.player1Id === id || m.player2Id === id).length;
    if (!window.confirm(`¿Quitar a ${name(id)} de ${group.name}?${n ? ` Sus ${n} partido(s) dejarán de contar.` : ''}`)) return;
    await updateDoc(doc(db, 'groups', group.id), { playerIds: arrayRemove(id) });
  }
  async function createMissing() {
    if (!window.confirm(`Se crearán los ${missing.length} partidos que faltan. ¿Continuar?`)) return;
    const batch = writeBatch(db);
    missing.forEach(([a, b]) => batch.set(doc(collection(db, 'matches')), newMatch(group, a, b)));
    await batch.commit();
  }
  async function remove() {
    if (!window.confirm(`Se eliminará «${group.name}» y todos sus partidos. ¿Continuar?`)) return;
    await deleteWithChildren('groups', group.id, 'groupId', ['matches']);
  }

  return (
    <div className="hm-group">
      <section className="hm-card" aria-label={`Clasificación ${group.name}`}>
        <h3>
          {group.name} <span className="hm-meta">{ids.length} jugadores · {played} {played === 1 ? 'jugado' : 'jugados'}</span>
          <span className="adm2-card-actions">
            <button type="button" className="icon-btn" onClick={onRename} aria-label={`Renombrar ${group.name}`} title="Renombrar"><Pencil /></button>
            <button type="button" className="icon-btn danger" onClick={remove} aria-label={`Eliminar ${group.name}`} title="Eliminar grupo"><Trash2 /></button>
          </span>
        </h3>
        {rows.length === 0 ? <p className="hm-empty">Añade jugadores a este grupo.</p> : (
          <div className="hm-table-wrap">
            <table className="hm-table">
              <thead>
                <tr><th className="c">#</th><th>Jugador/a</th><th className="c" title="Partidos jugados">PJ</th><th className="c" title="Partidos ganados">PG</th><th className="c" title="Partidos perdidos">PP</th><th className="c" title="Sets ganados y perdidos">Sets</th><th className="c" title="Puntos">Pts</th><th className="c" aria-label="Quitar" /></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td className="c"><span className={`hm-pos p${i + 1}`}>{i + 1}</span></td>
                    <td><span className="hm-person"><Avatar name={name(r.id)} size="sm" /><span>{name(r.id)}</span></span></td>
                    <td className="c">{r.pj}</td>
                    <td className="c">{r.pg}</td>
                    <td className="c">{r.pp}</td>
                    <td className="c">{r.sg}-{r.sp}</td>
                    <td className="c"><b>{r.pts}</b></td>
                    <td className="c"><button type="button" className="icon-btn danger adm2-x" onClick={() => removePlayer(r.id)} aria-label={`Quitar a ${name(r.id)} del grupo`} title="Quitar del grupo"><X /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="adm2-add">
          <Select label={`Añadir jugador a ${group.name}`} value={adding} onChange={add} size="sm"
            placeholder={available.length ? '+ Añadir jugador/a…' : 'No queda nadie libre en esta categoría'} disabled={!available.length}
            options={available.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
      </section>

      <section className="hm-card" aria-label={`Partidos ${group.name}`}>
        <h3>Partidos – {group.name}</h3>
        {matches.length === 0 && missing.length === 0 && <p className="hm-empty">Hacen falta al menos dos jugadores para crear partidos.</p>}
        <MatchRows matches={sortMatches(matches, null)} usersById={usersById} uid={null}>
          {missing.map(([a, b]) => (
            <li key={pairKey(a, b)}>
              <button type="button" className="mrow mrow-new" onClick={() => onCreate([a, b])}>
                <span className="mrow-names"><span className="mrow-p"><i aria-hidden="true" />{name(a)}</span><span className="mrow-p"><i aria-hidden="true" />{name(b)}</span></span>
                <span className="mrow-tag">Sin crear</span>
                <span className="mrow-go"><Plus aria-hidden="true" /> Crear</span>
                <span />
              </button>
            </li>
          ))}
        </MatchRows>
        {missing.length > 1 && (
          <button type="button" className="btn btn-primary btn-sm adm2-create-all" onClick={createMissing}><Shuffle /> Crear los {missing.length} partidos que faltan</button>
        )}
      </section>
    </div>
  );
}

/** Al pulsar una casilla: crear el partido o ver/apuntar el resultado. */
function CellModal({ group, pair, match, name, onClose, onCreated }) {
  const title = `${name(pair[0])} – ${name(pair[1])}`;

  async function create(e) {
    e.preventDefault();
    const ref = await addDoc(collection(db, 'matches'), newMatch(group, pair[0], pair[1]));
    onCreated(ref.id);
  }

  return (
    <Modal title={title} description={group?.name} onClose={onClose}>
      {!match ? (
        <form onSubmit={create}>
          <p className="serif modal-lead">Este partido todavía no existe.</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-soft" onClick={onClose}>Cancelar</button>
            <button className="btn btn-primary">Crear partido</button>
          </div>
        </form>
      ) : (
        <>
          <Match matchId={match.id} compact onDeleted={onClose} />
        </>
      )}
    </Modal>
  );
}

function ReviewModal({ list, name, groupLabel, onOpen, onClose }) {
  const { user } = useAuth();
  const [error, setError] = useState('');
  async function validate(m) {
    setError('');
    try { await confirmResult(m, user.uid); } catch (e) { setError(permissionMessage(e)); }
  }
  return (
    <Modal title="Resultados por revisar" description="Sin confirmar por el rival o en discrepancia." onClose={onClose}>
      {list.length === 0 && <p className="serif modal-lead">Todo al día.</p>}
      <ul className="plain-list">
        {list.map((m) => (
          <li key={m.id}>
            <span>
              <b>{name(m.player1Id)} – {name(m.player2Id)}</b>
              <small>{groupLabel(m)} · {m.status === 'reported' ? `${formatSets(m.sets)} · lo envió ${name(m.reportedBy)}` : `discrepancia de ${name(m.disputedBy)}`}</small>
            </span>
            <span className="inline-form">
              {m.status === 'reported' && <button className="btn btn-sm btn-primary" onClick={() => validate(m)}>Validar</button>}
              <button className="btn btn-sm" onClick={() => onOpen(m)}>{m.status === 'reported' ? 'Ver' : 'Corregir'}</button>
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="error" role="alert">{error}</p>}
    </Modal>
  );
}

function LooseModal({ players, groups, groupLabel, onClose }) {
  const categoryName = (g) => groupLabel(g).split(' · ')[0];
  const [choice, setChoice] = useState({});
  async function place(p) {
    const gid = choice[p.id];
    if (!gid) return;
    await updateDoc(doc(db, 'groups', gid), { playerIds: arrayUnion(p.id) });
  }
  return (
    <Modal title="Jugadores sin grupo" description="Elige su grupo y pulsa Colocar." onClose={onClose}>
      {players.length === 0 && <p className="serif modal-lead">Todos están colocados.</p>}
      {groups.length === 0 && players.length > 0 && <p className="serif modal-lead">Primero crea un grupo en Cuadros.</p>}
      <ul className="plain-list">
        {players.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <span className="inline-form">
              <Select label={`Grupo para ${p.name}`} value={choice[p.id] ?? ''} size="sm" className="grow"
                onChange={(v) => setChoice((c) => ({ ...c, [p.id]: v }))} placeholder="Elige grupo…"
                options={groups.map((g) => ({ value: g.id, label: g.name, group: categoryName(g) }))} />
              <button className="btn btn-sm btn-primary" disabled={!choice[p.id]} onClick={() => place(p)}>Colocar</button>
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
