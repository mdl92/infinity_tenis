import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useMemo } from 'react';
import { useCollection, useDoc, useMatches } from '../hooks/useFirestore';
import { isKnockout } from '../lib/bracket';
import Bracket from '../components/Bracket.jsx';
import { byName } from '../lib/tennis';
import { EmptyState, PageHead } from '../components/ui.jsx';

/** Una categoría abre directamente su primer grupo (las pestañas permiten cambiar). */
export default function Category() {
  const { categoryId } = useParams();
  const { isAdmin } = useAuth();
  const { data: category, loading } = useDoc('categories', categoryId);
  const { data: groups, loading: loadingGroups } = useCollection('groups', [['categoryId', '==', categoryId]]);
  const { data: matches } = useMatches([['categoryId', '==', categoryId]]);
  const { data: users } = useCollection('users');
  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);

  if (loading || loadingGroups) return <p className="loading">Cargando…</p>;
  if (!category) {
    return <EmptyState title="Categoría no encontrada" action={<Link className="btn" to="/categorias">Volver a categorías</Link>} />;
  }

  if (isKnockout(category)) {
    return (
      <>
        <Link className="link-back" to="/categorias"><ArrowLeft /> Volver a categorías</Link>
        <PageHead eyebrow="Eliminatoria" title={category.name} />
        <div className="card card-pad">
          <Bracket category={category} matches={matches} usersById={usersById} />
        </div>
      </>
    );
  }

  const first = [...groups].sort(byName)[0];
  if (first) return <Navigate to={`/grupo/${first.id}`} replace />;

  return (
    <>
      <Link className="link-back" to="/categorias"><ArrowLeft /> Volver a categorías</Link>
      <PageHead eyebrow="Categoría" title={category.name} />
      <div className="card">
        <EmptyState
          title="Sin grupos todavía"
          action={isAdmin && <Link className="btn btn-primary" to="/admin">Crear grupo</Link>}
        >
          Los grupos de esta categoría aparecerán aquí en cuanto se formen.
        </EmptyState>
      </div>
    </>
  );
}
