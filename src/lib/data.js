import {
  collection, doc, getDocs, query, serverTimestamp, where, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

export function newMatch(group, player1Id, player2Id) {
  return {
    tournamentId: group.tournamentId,
    categoryId: group.categoryId,
    groupId: group.id,
    player1Id,
    player2Id,
    status: 'pending', // pending → reported → confirmed
    sets: [],
    winnerId: null,
    reportedBy: null,
    confirmedBy: null,
    createdAt: serverTimestamp(),
  };
}

/**
 * Borra un documento y todos los que cuelgan de él (por campo de referencia).
 * Ej.: un torneo arrastra sus categorías, grupos y partidos.
 * Un batch admite 500 operaciones; de sobra para un torneo de club.
 */
export async function deleteWithChildren(rootCollection, rootId, field, childCollections) {
  const batch = writeBatch(db);
  for (const name of childCollections) {
    const snap = await getDocs(query(collection(db, name), where(field, '==', rootId)));
    snap.forEach((d) => batch.delete(d.ref));
  }
  batch.delete(doc(db, rootCollection, rootId));
  await batch.commit();
}
