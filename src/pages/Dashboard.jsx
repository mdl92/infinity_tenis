import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LayoutGrid, Layers } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTournament } from '../context/TournamentContext.jsx';
import { useCollection } from '../hooks/useFirestore';
import { matchState, sortMatches } from '../lib/matches';
import { computeStandings } from '../lib/tennis';
import { CourtSvg, EmptyState } from '../components/ui.jsx';
import MatchList from '../components/MatchList.jsx';
import { isBye, matchPlace } from '../lib/bracket';

export default function Dashboard() {
  const { profile, user, isAdmin } = useAuth();
  const { active } = useTournament();
  const uid = user.uid;
  const { data: myGroups } = useCollection('groups', [['playerIds', 'array-contains', uid]]);
  const { data: categories } = useCollection('categories');
  const { data: users } = useCollection('users');
  const { data: asP1 } = useCollection('matches', [['player1Id', '==', uid]]);
  const { data: asP2 } = useCollection('matches', [['player2Id', '==', uid]]);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const catsById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  // Grupo del torneo activo (si juega en varios torneos, el del que se está viendo)
  const inTournament = myGroups.filter((g) => g.tournamentId === active?.id);
  const group = inTournament[0] ?? myGroups[0];
  const category = group ? catsById[group.categoryId] : null;
  const myCategories = [...new Set(inTournament.map((g) => catsById[g.categoryId]?.name).filter(Boolean))];
  const { data: groupMatches } = useCollection('matches', [['groupId', '==', group?.id]]);
  const rows = group ? computeStandings(group.playerIds ?? [], groupMatches) : [];
  const pos = rows.findIndex((r) => r.id === uid) + 1;

  const mine = sortMatches([...asP1, ...asP2].filter((m) => !isBye(m)), uid);
  const upcoming = mine.filter((m) => m.status !== 'confirmed');
  const toConfirm = upcoming.filter((m) => matchState(m, uid).key === 'todo');
  const firstName = (profile?.name ?? '').split(' ')[0];

  const extra = (m) => [catsById[m.categoryId]?.name, matchPlace(m, myGroups)].filter(Boolean).join(' · ');

  return (
    <>
      <section className="dash" aria-label="Resumen">
        <div className="d-hello tile">
          <CourtSvg />
          <span className="ball-shape" aria-hidden="true" />
          <span className="d-label">{active?.name}</span>
          <h1><em>¡Hola,</em>{firstName}!</h1>
          <p>
            {toConfirm.length > 0
              ? `Tienes ${toConfirm.length === 1 ? 'un resultado' : `${toConfirm.length} resultados`} por confirmar.`
              : 'Tu categoría, tu grupo y tus próximos partidos.'}
          </p>
        </div>
        <Link to={category ? `/categoria/${category.id}` : '/categorias'} className="d-tile d-cat">
          <span className="d-label">Mi categoría</span>
          <span className="d-value">{myCategories.length ? myCategories.join(' · ') : category?.name ?? 'Sin asignar'}</span>
          <span className="d-row"><span className="d-sub">{category ? 'Ver sus grupos' : 'Consulta las categorías'}</span><span className="go-dot"><ArrowRight /></span></span>
        </Link>
        <Link to={group ? `/grupo/${group.id}` : '/categorias'} className="d-tile d-group">
          <span className="d-label">Mi grupo · {group?.name ?? '—'}</span>
          <span className="d-value giant">{group ? `${pos}º` : '—'}</span>
          <span className="d-sub">
            {group ? `de ${rows.length}, con ${rows[pos - 1]?.pts ?? 0} puntos${inTournament.length > 1 ? ` · y ${inTournament.length - 1} grupo más` : ''}` : 'El club te asignará uno'}
          </span>
        </Link>
        <Link to="/partidos" className="d-tile d-next">
          <span className="d-label">Próximos</span>
          <span className="d-value giant">{String(upcoming.length).padStart(2, '0')}</span>
          <span className="d-sub">{upcoming.length ? (upcoming.length === 1 ? 'partido por jugar' : 'partidos por jugar') : 'Nada pendiente'}</span>
        </Link>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Tus próximos <em>partidos</em></h2>
          <Link to="/partidos" className="btn btn-sm">Ver todos <ArrowRight /></Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="card">
            <EmptyState
              title={isAdmin && myGroups.length === 0 ? 'No juegas en ningún grupo' : 'Nada pendiente'}
              action={isAdmin && <Link className="btn btn-primary" to="/admin">Ir al panel de administración</Link>}
            >
              {isAdmin && myGroups.length === 0
                ? 'Como administrador puedes gestionar el torneo desde el panel.'
                : 'No tienes partidos por jugar ni resultados por confirmar.'}
            </EmptyState>
          </div>
        ) : (
          <MatchList matches={upcoming.slice(0, 5)} usersById={usersById} uid={uid} extra={extra} />
        )}
      </section>
    </>
  );
}
