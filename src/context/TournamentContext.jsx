import { createContext, useContext, useMemo, useState } from 'react';
import { useCollection } from '../hooks/useFirestore';
import { useAuth } from './AuthContext.jsx';
import Select from '../components/Select.jsx';

const TournamentContext = createContext(null);
const KEY = 'torneo-activo';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Hoy en formato AAAA-MM-DD (hora local), como se guardan las fechas del torneo. */
const todayIso = () => iso(new Date());

/** Meses que un torneo terminado se sigue viendo, para consultar resultados y clasificaciones. */
export const MONTHS_AFTER_END = 1;

/** Último día en que se ve un torneo: su fecha de fin + MONTHS_AFTER_END (el 31 de enero → el 28/29 de febrero). */
export function visibleUntil(endDate) {
  if (!endDate) return null;
  const [y, m, d] = endDate.split('-').map(Number);
  const lastDay = new Date(y, m - 1 + MONTHS_AFTER_END + 1, 0).getDate(); // último día del mes de destino
  return iso(new Date(y, m - 1 + MONTHS_AFTER_END, Math.min(d, lastDay)));
}

/**
 * ¿Lo ven los jugadores hoy? Desde el día de inicio hasta un mes después del día de fin, ambos incluidos.
 * Sin fecha de inicio no hay límite por delante, y sin fecha de fin no lo hay por detrás.
 */
export function isInDates(t, today = todayIso()) {
  if (t?.startDate && today < t.startDate) return false;
  const until = visibleUntil(t?.endDate);
  if (until && today > until) return false;
  return true;
}

/**
 * Torneo con el que se está trabajando: el elegido o, si no, el más reciente.
 * Los jugadores y visitantes solo ven los torneos que están en fechas; los administradores, todos.
 */
export function TournamentProvider({ children }) {
  const { data, loading: loadingTournaments } = useCollection('tournaments');
  const { isAdmin, loading: loadingAuth } = useAuth();
  const tournaments = useMemo(
    () => [...data]
      .filter((t) => isAdmin || isInDates(t))
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
    [data, isAdmin]
  );
  // Mientras se sabe si es administrador, no se muestra nada (evita enseñar un torneo y cambiarlo al momento)
  const loading = loadingTournaments || loadingAuth;
  const [chosen, setChosen] = useState(() => {
    try { return localStorage.getItem(KEY); } catch { return null; }
  });

  const active = loading ? null : tournaments.find((t) => t.id === chosen) ?? tournaments[0] ?? null;
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
