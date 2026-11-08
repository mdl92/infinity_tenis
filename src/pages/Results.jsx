import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTournament } from '../context/TournamentContext.jsx';
import { useCollection, useMatches } from '../hooks/useFirestore';
import { byName } from '../lib/tennis';
import { EmptyState, PageHead } from '../components/ui.jsx';
import MatchList from '../components/MatchList.jsx';
import { isBye, matchPlace } from '../lib/bracket';

/** Resultados confirmados del torneo, públicos. */
export default function Results() {
  const { user } = useAuth();
  const { active } = useTournament();
  const tid = active?.id;
  const { data: matches, loading } = useMatches([['tournamentId', '==', tid]]);
  const { data: categories } = useCollection('categories', [['tournamentId', '==', tid]]);
  const { data: groups } = useCollection('groups', [['tournamentId', '==', tid]]);
  const { data: users } = useCollection('users');
  const [cat, setCat] = useState('');

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const catsById = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);

  const shown = matches
    .filter((m) => m.status === 'confirmed' && !isBye(m) && (!cat || m.categoryId === cat))
    .sort((a, b) => (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0));

  const extra = (m) => [catsById[m.categoryId]?.name, matchPlace(m, groups)].filter(Boolean).join(' · ');

  return (
    <>
      <PageHead eyebrow={active?.name} title="Resultados" description="Todos los partidos confirmados del torneo.">
        {categories.length > 1 && (
          <div className="pills" role="group" aria-label="Filtrar por categoría">
            <button className={`pill ${cat === '' ? 'on' : ''}`} onClick={() => setCat('')}>Todas</button>
            {[...categories].sort(byName).map((c) => (
              <button key={c.id} className={`pill ${cat === c.id ? 'on' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>
            ))}
          </div>
        )}
      </PageHead>

      {loading && <p className="loading">Cargando…</p>}
      {!loading && shown.length === 0 && (
        <div className="card"><EmptyState title="Aún no hay resultados">Los partidos aparecerán aquí en cuanto se confirmen.</EmptyState></div>
      )}
      {shown.length > 0 && <MatchList matches={shown} usersById={usersById} uid={user?.uid} extra={extra} />}
    </>
  );
}
