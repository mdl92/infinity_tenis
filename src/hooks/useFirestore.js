import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

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
 * Partidos, sin los que ya no tienen a ninguno de sus dos jugadores (ambos dados de baja).
 * Mientras se cargan los usuarios no se oculta nada, para no hacer parpadear las listas.
 */
export function useMatches(filters = []) {
  const res = useCollection('matches', filters);
  const { data: users, loading: loadingUsers } = useCollection('users');
  const data = useMemo(() => {
    if (loadingUsers || users.length === 0) return res.data;
    const ids = new Set(users.map((u) => u.id));
    return res.data.filter((m) => ids.has(m.player1Id) || ids.has(m.player2Id));
  }, [res.data, users, loadingUsers]);
  return { ...res, data };
}
