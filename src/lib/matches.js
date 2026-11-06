// Estados de un partido y acciones sobre el resultado.
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isSuper, winnerOf } from './tennis';

export const isParticipant = (m, uid) => Boolean(uid) && (uid === m.player1Id || uid === m.player2Id);

/**
 * Estado del partido visto por una persona concreta (uid puede ser null: visitante).
 * key: entry (pendiente) · todo (le toca confirmar a esta persona) · waiting (esperando al rival)
 *      review (sin confirmar, visto por terceros) · confirmed · dispute (discrepancia)
 * Las etiquetas son las mismas para todos: Pendiente · Sin confirmar · Confirmado · Discrepancia.
 */
export function matchState(m, uid) {
  if (m.status === 'confirmed') return { key: 'confirmed', label: 'Confirmado', tone: 'green' };
  if (m.status === 'reported') {
    if (uid && isParticipant(m, uid) && m.reportedBy !== uid) return { key: 'todo', label: 'Sin confirmar', tone: 'lavender' };
    if (uid && m.reportedBy === uid) return { key: 'waiting', label: 'Sin confirmar', tone: 'lavender' };
    return { key: 'review', label: 'Sin confirmar', tone: 'lavender' };
  }
  if (m.disputedBy) return { key: 'dispute', label: 'Discrepancia', tone: 'coral' };
  return { key: 'entry', label: 'Pendiente', tone: 'yellow' };
}

/** Orden útil para listas: primero lo que pide acción. */
export const STATE_ORDER = { todo: 0, dispute: 1, entry: 2, waiting: 3, review: 4, confirmed: 5 };

export function sortMatches(list, uid) {
  return [...list].sort((a, b) =>
    STATE_ORDER[matchState(a, uid).key] - STATE_ORDER[matchState(b, uid).key]
    || (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
}

/** Marcador en texto: «7-6 (7-4) · 3-6 · STB 10-8». `flip` lo da visto desde el jugador 2. */
export function formatSets(sets = [], flip = false) {
  return sets.map((s, i) => {
    const [x, y] = flip ? [s.b, s.a] : [s.a, s.b];
    if (isSuper(s)) return `STB ${x}-${y}`;
    const tb = s.ta !== undefined && s.tb !== undefined ? ` (${flip ? s.tb : s.ta}-${flip ? s.ta : s.tb})` : '';
    return `${x}-${y}${tb}`;
  }).join(' · ');
}

/** Juegos de un lado en un set, con los puntos de su tie-break si lo hubo. */
export const sideOf = (s, side) => ({
  games: side === 'a' ? s.a : s.b,
  other: side === 'a' ? s.b : s.a,
  tiebreak: s.ta !== undefined && s.tb !== undefined ? (side === 'a' ? s.ta : s.tb) : null,
});

// ---- Acciones (las reglas de Firestore validan cada una en el servidor) ----

const ref = (m) => doc(db, 'matches', m.id);

/** Un jugador envía el resultado (queda pendiente del rival); un admin lo deja confirmado. */
export function saveResult(m, sets, uid, asAdmin) {
  const winnerId = winnerOf(m, sets);
  const base = { sets, winnerId, disputedBy: null, disputedSets: null, updatedAt: serverTimestamp() };
  return updateDoc(ref(m), asAdmin
    ? { ...base, status: 'confirmed', reportedBy: m.reportedBy ?? uid, confirmedBy: uid }
    : { ...base, status: 'reported', reportedBy: uid });
}

export const confirmResult = (m, uid) =>
  updateDoc(ref(m), { status: 'confirmed', confirmedBy: uid, updatedAt: serverTimestamp() });

/** El rival no está de acuerdo: se borra el marcador y queda constancia de la discrepancia. */
export const rejectResult = (m, uid) =>
  updateDoc(ref(m), {
    status: 'pending', sets: [], winnerId: null, reportedBy: null,
    disputedBy: uid, disputedSets: m.sets ?? [], updatedAt: serverTimestamp(),
  });

export const permissionMessage = (e) => (e?.code === 'permission-denied'
  ? 'No tienes permiso para este cambio. Puede que el partido se haya actualizado: recarga la página.'
  : 'No se ha podido guardar. Revisa tu conexión e inténtalo de nuevo.');
