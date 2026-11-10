import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCollection, useMyMatches, usePeople } from '../hooks/useFirestore';
import { sortMatches } from '../lib/matches';
import { EmptyState, PageHead } from '../components/ui.jsx';
import MatchList from '../components/MatchList.jsx';
import { isBye, matchPlace } from '../lib/bracket';

export default function MyMatches() {
  const { user } = useAuth();
  const { data: myMatches, loading } = useMyMatches(user.uid);
  const { byId: usersById } = usePeople();
  const { data: groups } = useCollection('groups');
  const [tab, setTab] = useState('open');


  const all = sortMatches(myMatches.filter((m) => !isBye(m)), user.uid);
  const open = all.filter((m) => m.status !== 'confirmed');
  const done = all.filter((m) => m.status === 'confirmed');
  const shown = tab === 'open' ? open : done;

  const extra = (m) => matchPlace(m, groups);

  return (
    <>
      <PageHead title="Mis partidos" description="Introduce el resultado cuando juegues y confirma el que envíe tu rival.">
        <div className="pills" role="group" aria-label="Filtrar partidos">
          <button className={`pill ${tab === 'open' ? 'on' : ''}`} onClick={() => setTab('open')}>Pendientes ({open.length})</button>
          <button className={`pill ${tab === 'done' ? 'on' : ''}`} onClick={() => setTab('done')}>Jugados ({done.length})</button>
        </div>
      </PageHead>

      {loading && <p className="loading">Cargando…</p>}
      {!loading && shown.length === 0 && (
        <div className="card">
          <EmptyState title={tab === 'open' ? 'Nada pendiente' : 'Aún no has jugado'}>
            {tab === 'open'
              ? 'No tienes partidos por jugar ni resultados por confirmar.'
              : 'Tus partidos confirmados aparecerán aquí.'}
          </EmptyState>
        </div>
      )}
      {shown.length > 0 && <MatchList matches={shown} usersById={usersById} uid={user.uid} extra={extra} />}
    </>
  );
}
