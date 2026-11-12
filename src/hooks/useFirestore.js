import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { buildDirectory } from '../lib/teams';

/**
 * Escucha una colección en tiempo real.
 * filters: [['campo', '==', valor], ...]. Si algún valor es undefined, no consulta.
 * No usamos orderBy para no necesitar índices compuestos: se ordena en cliente.
 */
export function useCollection(name, filters = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(filters);

  useEffect(() => {
    if (filters.some((f) => f[2] === undefined || f[2] === null)) {
      setData([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(collection(db, name), ...filters.map(([f, op, v]) => where(f, op, v)));
    return onSnapshot(
      q,
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error(`Error leyendo ${name}:`, err);
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, key]);

  return { data, loading };
}

/** Escucha un documento concreto en tiempo real. */
export function useDoc(name, id) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(
      doc(db, name, id),
      (snap) => {
        setData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error(`Error leyendo ${name}/${id}:`, err);
        setLoading(false);
      }
    );
  }, [name, id]);

  return { data, loading };
}

/**
 * Participantes: jugadores y parejas de dobles juntos, por ID, con el nombre listo para mostrar.
 * `byId[id].name` sirve igual para una persona que para una pareja («Ana Ruiz / Laura Martín»).
 */
const PeopleContext = createContext(null);

/**
 * Carga jugadores y parejas UNA sola vez para toda la web (en main.jsx) y los comparte con todas las
 * pantallas. Antes cada pantalla, lista y partido desplegado abría sus propias conexiones a Firebase.
 */
export function PeopleProvider({ children }) {
  const { data: users, loading: loadingUsers } = useCollection('users');
  const { data: teams, loading: loadingTeams } = useCollection('teams');
  const loading = loadingUsers || loadingTeams;
  const value = useMemo(
    () => ({ users, teams, byId: buildDirectory(users, teams), loading }),
    [users, teams, loading]
  );
  return createElement(PeopleContext.Provider, { value }, children);
}

export function usePeople() {
  const people = useContext(PeopleContext);
  if (!people) throw new Error('usePeople necesita <PeopleProvider> (está en main.jsx)');
  return people;
}

/** Partidos que juega una persona: individuales (como jugador 1 o 2) y dobles (en cualquiera de las parejas). */
export function useMyMatches(uid) {
  const a = useCollection('matches', [['player1Id', '==', uid]]);
  const b = useCollection('matches', [['player2Id', '==', uid]]);
  const c = useCollection('matches', [['memberIds', 'array-contains', uid]]);
  const data = useMemo(() => {
    const byId = new Map();
    [...a.data, ...b.data, ...c.data].forEach((m) => byId.set(m.id, m));
    return [...byId.values()];
  }, [a.data, b.data, c.data]);
  return { data, loading: a.loading || b.loading || c.loading };
}

/**
 * Partidos, sin los que ya no tienen a ninguno de sus dos participantes (dados de baja).
 * Mientras se cargan los participantes no se oculta nada, para no hacer parpadear las listas.
 */
export function useMatches(filters = []) {
  const res = useCollection('matches', filters);
  const { users, byId, loading } = usePeople();
  const data = useMemo(() => {
    if (loading || users.length === 0) return res.data;
    return res.data.filter((m) => byId[m.player1Id] || byId[m.player2Id]);
  }, [res.data, users, byId, loading]);
  return { ...res, data };
}
