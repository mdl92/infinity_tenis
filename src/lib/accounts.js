// Cambio de cuenta de acceso de una persona (p. ej. al corregir su nombre o primer apellido).
//
// Desde la web no se puede cambiar el email ni la contraseña de la cuenta de Firebase de otra persona,
// así que se le crea una cuenta nueva (con el usuario y la contraseña que salen de su nombre nuevo) y se
// trasladan todos sus datos del identificador antiguo al nuevo. La cuenta antigua se queda sin perfil:
// si alguien entra con ella, no puede hacer nada. Se puede borrar a mano en Firebase › Authentication.
import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

/** Campos de un partido que guardan el identificador de una persona. */
const MATCH_FIELDS = ['player1Id', 'player2Id', 'winnerId', 'reportedBy', 'confirmedBy', 'disputedBy'];

const swap = (list, oldId, newId) => (list ?? []).map((id) => (id === oldId ? newId : id));

/**
 * Pasa todo lo de `oldId` a `newId` en una sola operación (o se hace todo, o nada):
 * perfil, grupos, eliminatorias (manteniendo su orden de cabeza de serie) y partidos.
 */
export async function moveUserData(oldId, newId, profile) {
  const batch = writeBatch(db);

  const groups = await getDocs(query(collection(db, 'groups'), where('playerIds', 'array-contains', oldId)));
  groups.forEach((g) => batch.update(g.ref, { playerIds: swap(g.data().playerIds, oldId, newId) }));

  const knockouts = await getDocs(query(collection(db, 'categories'), where('playerIds', 'array-contains', oldId)));
  knockouts.forEach((c) => batch.update(c.ref, { playerIds: swap(c.data().playerIds, oldId, newId) }));

  // Quien aparece como ganador, quien envió o confirmó el resultado… siempre es uno de los dos jugadores
  const seen = new Set();
  for (const field of ['player1Id', 'player2Id']) {
    const snap = await getDocs(query(collection(db, 'matches'), where(field, '==', oldId)));
    snap.forEach((m) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      const data = m.data();
      const changes = Object.fromEntries(MATCH_FIELDS.filter((f) => data[f] === oldId).map((f) => [f, newId]));
      batch.update(m.ref, changes);
    });
  }

  batch.set(doc(db, 'users', newId), profile);
  batch.delete(doc(db, 'users', oldId));
  await batch.commit();
  return { groups: groups.size, knockouts: knockouts.size, matches: seen.size };
}
