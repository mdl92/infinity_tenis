import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarCheck, CalendarDays, ChevronRight, Info, LogOut, MapPin, Settings, Trophy, User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { TournamentSelect, useTournament } from '../context/TournamentContext.jsx';
import { useCollection, useMatches } from '../hooks/useFirestore';
import { matchState, sortMatches } from '../lib/matches';
import { byCategory, byName, computeStandings } from '../lib/tennis';
import { Avatar, clubPhoto, Modal } from '../components/ui.jsx';
import LoginForm from '../components/LoginBanner.jsx';
import MatchRows from '../components/MatchRows.jsx';
import FloatingDock from '../components/FloatingDock.jsx';

const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const day = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return dayFmt.format(new Date(y, m - 1, d)).replace('.', '');
};
const catTitle = (c) => (/^categor/i.test(c.name) ? c.name : `Categoría ${c.name}`);

/** Pelota dibujada a línea (decoración y icono de categoría). */
function BallLine({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="24" cy="24" r="21" />
      <path d="M10.2 8.2C15.8 12 18.6 17.3 18.6 24S15.8 36 10.2 39.8M37.8 8.2C32.2 12 29.4 17.3 29.4 24s2.8 12 8.4 15.8" />
    </svg>
  );
}

export default function Home() {
  const { user, profile, isAdmin, logout } = useAuth();
  const uid = user?.uid;
  const { active } = useTournament();
  const tid = active?.id;
  const { data: categories } = useCollection('categories', [['tournamentId', '==', tid]]);
  const { data: groups } = useCollection('groups', [['tournamentId', '==', tid]]);
  const { data: matches } = useMatches([['tournamentId', '==', tid]]);
  const { data: users } = useCollection('users');
  const [chosen, setChosen] = useState(null);
  const [modal, setModal] = useState(null); // login | mine | results | how
  const accountRef = useRef(null);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const cats = [...categories].sort(byCategory);
  const myCat = cats.find((c) => groups.some((g) => g.categoryId === c.id && g.playerIds?.includes(uid)));
  const current = cats.find((c) => c.id === chosen) ?? myCat ?? cats[0];
  const groupsOf = (c) => groups.filter((g) => g.categoryId === c.id).sort(byName);
  const playersOf = (c) => new Set(groupsOf(c).flatMap((g) => g.playerIds ?? [])).size;

  const mine = uid ? sortMatches(matches.filter((m) => m.player1Id === uid || m.player2Id === uid), uid) : [];
  const toConfirm = mine.filter((m) => matchState(m, uid).key === 'todo').length;
  const confirmed = matches.filter((m) => m.status === 'confirmed')
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));
  const groupName = (m) => groups.find((g) => g.id === m.groupId)?.name;


  const firstName = (profile?.name ?? '').split(' ')[0];
  const dates = [day(active?.startDate) && `Inicio: ${day(active.startDate)}`, day(active?.endDate) && `Fin: ${day(active.endDate)}`].filter(Boolean).join(' – ');

  return (
    <div className="hm" style={{ '--club': `url(${clubPhoto})` }}>
      {/* Cabecera (la foto del club queda de fondo de toda la página) */}
      <header className="hm-hero">
        <div className="hm-hero-inner">
          <div className="hm-account" ref={accountRef}>
            {user ? (
              <>
                <span className="hm-hello"><Avatar name={profile?.name} me size="sm" /> Hola, {firstName}</span>
                {isAdmin && <Link to="/admin" className="hm-acc-btn"><Settings /> <span>Administración</span></Link>}
                <button type="button" className="hm-acc-btn" onClick={logout} aria-label="Cerrar sesión"><LogOut /> <span>Salir</span></button>
              </>
            ) : (
              <button type="button" className="hm-acc-btn hm-login" onClick={() => setModal('login')}><User /> Identifícate</button>
            )}
          </div>

          <h1>{active?.name ?? 'Infinity'}</h1>
          <p className="hm-sub">
            Fase de grupos{cats.length > 0 && <> · {cats.length === 1 ? 'Categoría' : 'Categorías'} {cats.map((c) => c.name).join(', ')}</>}
          </p>
          {(dates || active?.venue) && (
            <p className="hm-chip">
              {dates && <span><CalendarDays aria-hidden="true" /> {dates}</span>}
              {dates && active?.venue && <i aria-hidden="true" />}
              {active?.venue && <span><MapPin aria-hidden="true" /> {active.venue}</span>}
            </p>
          )}
          <TournamentSelect className="hm-tsel" />
        </div>
      </header>

      <FloatingDock watchRef={accountRef} items={user
        ? [
          ...(isAdmin ? [{ key: 'admin', label: 'Administración', icon: Settings, to: '/admin' }] : []),
          { key: 'out', label: 'Salir', icon: LogOut, onClick: logout },
        ]
        : [{ key: 'login', label: 'Identifícate', icon: User, onClick: () => setModal('login'), tone: 'primary' }]} />

      <main className="hm-sheet">
        {/* Pestañas de categoría y accesos */}
        <div className="hm-bar">
          <nav className="hm-tabs" aria-label="Categorías">
            {cats.map((c) => (
              <button key={c.id} type="button" className={c.id === current?.id ? 'on' : ''} aria-pressed={c.id === current?.id} onClick={() => setChosen(c.id)}>
                {c.name}
              </button>
            ))}
          </nav>
          <div className="hm-tools">
            {user && (
              <button type="button" className="hm-tool" onClick={() => setModal('mine')}>
                <CalendarCheck aria-hidden="true" /> Mis partidos
                {toConfirm > 0 && <b className="hm-badge" aria-label={`${toConfirm} por confirmar`}>{toConfirm}</b>}
              </button>
            )}
            <button type="button" className="hm-tool" onClick={() => setModal('results')}><Trophy aria-hidden="true" /> Resultados</button>
            <button type="button" className="hm-tool" onClick={() => setModal('how')}><Info aria-hidden="true" /> Cómo funciona</button>
          </div>
        </div>

        {user && toConfirm > 0 && (
          <button type="button" className="hm-alert" onClick={() => setModal('mine')}>
            Tienes {toConfirm === 1 ? 'un resultado' : `${toConfirm} resultados`} por confirmar <ChevronRight aria-hidden="true" />
          </button>
        )}

        {cats.length === 0 && <p className="hm-empty">En cuanto el club publique las categorías del torneo, aparecerán aquí.</p>}

        {/* Categoría abierta */}
        {current && (
          <section className="hm-cat" id="categoria" aria-labelledby="cat-title">
            <div className="hm-cat-head">
              <h2 id="cat-title">{catTitle(current)}</h2>
              <span className="hm-meta">{groupsOf(current).length} {groupsOf(current).length === 1 ? 'grupo' : 'grupos'} · {playersOf(current)} jugadores</span>
              <BallLine className="hm-cat-ball" />
            </div>
            <div className="hm-groups">
              {groupsOf(current).length === 0 && <p className="hm-empty">Todavía no hay grupos en esta categoría.</p>}
              {groupsOf(current).map((g) => (
                <GroupRow key={g.id} group={g} matches={matches.filter((m) => m.groupId === g.id)} usersById={usersById} uid={uid} />
              ))}
            </div>
          </section>
        )}

      </main>

      {modal === 'login' && (
        <Modal title="Identifícate" description="Para ver tus partidos y apuntar resultados." onClose={() => setModal(null)}>
          <LoginForm onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === 'mine' && (
        <Modal title="Mis partidos" description="Apunta el resultado cuando juegues y confirma el de tu rival." onClose={() => setModal(null)}>
          {mine.length === 0
            ? <p className="modal-lead">Todavía no tienes partidos.</p>
            : <MatchRows matches={mine} usersById={usersById} uid={uid} sub={groupName} />}
        </Modal>
      )}
      {modal === 'results' && (
        <Modal title="Resultados" description="Partidos confirmados, los últimos primero." onClose={() => setModal(null)}>
          {confirmed.length === 0
            ? <p className="modal-lead">Todavía no hay resultados confirmados.</p>
            : <MatchRows matches={confirmed} usersById={usersById} uid={uid} sub={(m) => {
                const c = categories.find((x) => x.id === m.categoryId);
                return [c && catTitle(c), groupName(m)].filter(Boolean).join(' · ');
              }} />}
        </Modal>
      )}
      {modal === 'how' && (
        <Modal title="Cómo funciona" onClose={() => setModal(null)}>
          <ol className="hm-how">
            <li><b>Categorías.</b> Cada jugador compite en su categoría, repartida en grupos.</li>
            <li><b>Fase de grupos.</b> Todos contra todos dentro del grupo. Gana la clasificación quien más partidos gana; si empatan, cuenta la diferencia de sets y luego la de juegos.</li>
            <li><b>Resultados.</b> Al terminar, uno de los dos apunta el marcador y el rival lo confirma. Solo cuentan los partidos confirmados.</li>
            <li><b>Si no estáis de acuerdo,</b> el rival puede rechazarlo y el partido queda en discrepancia hasta que lo apuntéis bien o lo corrija la organización.</li>
          </ol>
        </Modal>
      )}
    </div>
  );
}

/** Un grupo: clasificación a la izquierda y sus partidos a la derecha. */
function GroupRow({ group, matches, usersById, uid }) {
  const ids = group.playerIds ?? [];
  const rows = computeStandings(ids, matches);
  const played = matches.filter((m) => m.status === 'confirmed').length;
  const name = (id) => usersById[id]?.name ?? 'Jugador eliminado';

  return (
    <div className="hm-group">
      <section className="hm-card" aria-label={`Clasificación ${group.name}`}>
        <h3>{group.name} <span className="hm-meta">{ids.length} jugadores · {played} {played === 1 ? 'jugado' : 'jugados'}</span></h3>
        {rows.length === 0 ? <p className="hm-empty">Todavía no hay jugadores en este grupo.</p> : (
          <div className="hm-table-wrap">
            <table className="hm-table">
              <thead>
                <tr><th className="c">#</th><th>Jugador/a</th><th className="c" title="Partidos jugados">PJ</th><th className="c" title="Partidos ganados">PG</th><th className="c" title="Partidos perdidos">PP</th><th className="c" title="Sets ganados y perdidos">Sets</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={r.id === uid ? 'me' : undefined}>
                    <td className="c"><span className={`hm-pos p${i + 1}`}>{i + 1}</span></td>
                    <td><span className="hm-person"><Avatar name={name(r.id)} me={r.id === uid} size="sm" /><span>{name(r.id)}</span></span></td>
                    <td className="c">{r.pj}</td>
                    <td className="c">{r.pg}</td>
                    <td className="c">{r.pp}</td>
                    <td className="c">{r.sg}-{r.sp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="hm-legend"><Info aria-hidden="true" /> PJ: partidos | PG: ganados | PP: perdidos. Solo cuentan los partidos confirmados.</p>
      </section>

      <section className="hm-card" aria-label={`Partidos ${group.name}`}>
        <h3>Partidos – {group.name}</h3>
        {matches.length === 0
          ? <p className="hm-empty">Todavía no hay partidos en este grupo.</p>
          : <MatchRows matches={sortMatches(matches, uid)} usersById={usersById} uid={uid} />}
      </section>
    </div>
  );
}
