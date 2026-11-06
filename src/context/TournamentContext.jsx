import { createContext, useContext, useMemo, useState } from 'react';
import { useCollection } from '../hooks/useFirestore';
import Select from '../components/Select.jsx';

const TournamentContext = createContext(null);
const KEY = 'torneo-activo';

/** Torneo con el que se está trabajando: el elegido o, si no, el más reciente. */
export function TournamentProvider({ children }) {
  const { data, loading } = useCollection('tournaments');
  const tournaments = useMemo(
    () => [...data].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    [data]
  );
  const [chosen, setChosen] = useState(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });

  const active = tournaments.find((t) => t.id === chosen) ?? tournaments[0] ?? null;
  const choose = (id) => {
    setChosen(id);
    try { localStorage.setItem(KEY, id); } catch { /* sin almacenamiento */ }
  };

  return (
    <TournamentContext.Provider value={{ tournaments, active, choose, loading }}>
      {children}
    </TournamentContext.Provider>
  );
}

export const useTournament = () => useContext(TournamentContext);

/** Selector de torneo; solo aparece cuando hay más de uno. */
export function TournamentSelect({ className = 'side-select', label = 'Torneo' }) {
  const { tournaments, active, choose } = useTournament();
  if (tournaments.length < 2) return null;
  return (
    <div className={className}>
      <Select label={label} value={active?.id ?? ''} onChange={choose} size="sm"
        options={tournaments.map((t) => ({ value: t.id, label: t.name }))} />
    </div>
  );
}
