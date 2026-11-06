import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTournament } from '../context/TournamentContext.jsx';
import { useCollection } from '../hooks/useFirestore';
import { byName } from '../lib/tennis';
import { EmptyState, PageHead } from '../components/ui.jsx';
import CategoryCards from '../components/CategoryCards.jsx';

export default function Categories() {
  const { isAdmin } = useAuth();
  const { active, loading } = useTournament();
  const tid = active?.id;
  const { data: categories, loading: loadingCats } = useCollection('categories', [['tournamentId', '==', tid]]);
  const { data: groups } = useCollection('groups', [['tournamentId', '==', tid]]);

  return (
    <>
      <PageHead eyebrow={active?.name} title="Categorías" description="Elige una categoría para ver sus grupos, partidos y clasificación." />
      {(loading || loadingCats) && <p className="loading">Cargando…</p>}
      {!loading && !loadingCats && categories.length === 0 && (
        <div className="card">
          <EmptyState
            title="Aún no hay categorías"
            action={isAdmin && <Link className="btn btn-primary" to="/admin">Crear categoría</Link>}
          >
            En cuanto el club publique las categorías del torneo, aparecerán aquí.
          </EmptyState>
        </div>
      )}
      <CategoryCards categories={[...categories].sort(byName)} groups={groups} />
    </>
  );
}
