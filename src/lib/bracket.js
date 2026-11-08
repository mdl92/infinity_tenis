// Torneo por eliminatoria: cuadro, sorteo y paso de ronda.
//
// Cada partido del cuadro tiene un ID fijo «ko_<categoría>_<ronda>_<posición>» y los campos
//   round  (0 = primera ronda) · slot (posición dentro de la ronda) · rounds (rondas totales)
// El ganador de (ronda r, posición s) juega en (r + 1, s / 2): si s es par, como jugador 1; si es impar, como jugador 2.
// Un jugador sin rival en primera ronda «pasa directo»: partido con bye: true, ya confirmado y con él como ganador.
//
// Cuando un partido se confirma, quien lo confirma crea el de la ronda siguiente si el otro ya está decidido.
// Las reglas de Firestore comprueban que los dos jugadores del partido nuevo son de verdad los ganadores.
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

export const FORMATS = { groups: 'groups', knockout: 'knockout' };
export const isKnockout = (category) => category?.format === FORMATS.knockout;

export const koId = (categoryId, round, slot) => `ko_${categoryId}_${round}_${slot}`;
export const isBye = (m) => Boolean(m?.bye);
export const isKoMatch = (m) => Number.isInteger(m?.round);

/** Nombre de una ronda contando desde el final: Final, Semifinales, Cuartos… */
export function roundName(round, rounds) {
  const left = rounds - round; // 1 = final
  if (left === 1) return 'Final';
  if (left === 2) return 'Semifinales';
  if (left === 3) return 'Cuartos de final';
  if (left === 4) return 'Octavos de final';
  if (left === 5) return 'Dieciseisavos';
  return `Ronda ${round + 1}`;
}

/** Dónde se juega un partido: su grupo o su ronda del cuadro. */
export function matchPlace(m, groups = []) {
  if (isKoMatch(m)) return roundName(m.round, m.rounds);
  return groups.find((g) => g.id === m.groupId)?.name;
}

/** Tamaño del cuadro: la potencia de 2 que da cabida a todos (mínimo 2). */
export const drawSizeFor = (n) => Math.max(2, 2 ** Math.ceil(Math.log2(Math.max(n, 2))));

/**
 * Orden clásico de cabezas de serie en el cuadro (para 8: 1-8, 4-5, 2-7, 3-6):
 * el 1 y el 2 solo se cruzan en la final, y los huecos (pasa directo) tocan a los mejores.
 */
export function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((x) => [x, n + 1 - x]);
  }
  return order;
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const base = (category, round, slot, rounds) => ({
  tournamentId: category.tournamentId,
  categoryId: category.id,
  groupId: null,
  round,
  slot,
  rounds,
});

const emptyResult = () => ({
  status: 'pending', sets: [], winnerId: null, reportedBy: null, confirmedBy: null, createdAt: serverTimestamp(),
});

/** Partidos de primera ronda a partir de los jugadores ordenados por cabeza de serie. */
export function firstRound(category, seededIds) {
  const size = drawSizeFor(seededIds.length);
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const out = [];
  for (let slot = 0; slot < size / 2; slot++) {
    const p1 = seededIds[order[slot * 2] - 1] ?? null;
    const p2 = seededIds[order[slot * 2 + 1] - 1] ?? null;
    const data = { ...base(category, 0, slot, rounds), ...emptyResult(), player1Id: p1, player2Id: p2 };
    if (!p1 || !p2) Object.assign(data, { player1Id: p1 ?? p2, player2Id: null, bye: true, status: 'confirmed', winnerId: p1 ?? p2 });
    out.push({ id: koId(category.id, 0, slot), data });
  }
  return { size, rounds, matches: out };
}

/** Crea el cuadro (primera ronda) y hace pasar de ronda a quienes pasan directo. */
export async function createDraw(category, seededIds) {
  const { size, rounds, matches } = firstRound(category, seededIds);
  const batch = writeBatch(db);
  matches.forEach((m) => batch.set(doc(db, 'matches', m.id), m.data));
  batch.update(doc(db, 'categories', category.id), { playerIds: seededIds, drawSize: size, rounds, drawn: true });
  await batch.commit();
  for (const m of matches) {
    if (m.data.bye) await advance({ id: m.id, ...m.data }, { asAdmin: true });
  }
}

/** Partido de la ronda siguiente al que va el ganador de `m`, y en qué lado. */
export function nextOf(m) {
  if (!isKoMatch(m) || m.round >= m.rounds - 1) return null;
  return { id: koId(m.categoryId, m.round + 1, Math.floor(m.slot / 2)), side: m.slot % 2 === 0 ? 'player1Id' : 'player2Id' };
}

/**
 * Tras confirmarse `m` (con su winnerId), crea el partido de la ronda siguiente si el otro ya está decidido.
 * Si ya existe y aún no tiene resultado, un admin puede corregir el jugador (p. ej. si cambió el ganador).
 */
export async function advance(m, { asAdmin = false } = {}) {
  const next = nextOf(m);
  if (!next || m.status !== 'confirmed' || !m.winnerId) return;
  const nextRef = doc(db, 'matches', next.id);
  const nextSnap = await getDoc(nextRef);
  if (nextSnap.exists()) {
    const n = nextSnap.data();
    if (asAdmin && n[next.side] !== m.winnerId && !(n.sets?.length)) await updateDoc(nextRef, { [next.side]: m.winnerId });
    return;
  }
  const sibling = await getDoc(doc(db, 'matches', koId(m.categoryId, m.round, m.slot ^ 1)));
  if (!sibling.exists() || sibling.data().status !== 'confirmed') return;
  const s = sibling.data();
  const [p1, p2] = m.slot % 2 === 0 ? [m.winnerId, s.winnerId] : [s.winnerId, m.winnerId];
  const round = m.round + 1;
  const slot = Math.floor(m.slot / 2);
  await setDoc(nextRef, {
    ...base({ id: m.categoryId, tournamentId: m.tournamentId }, round, slot, m.rounds),
    ...emptyResult(),
    player1Id: p1,
    player2Id: p2,
  });
}

/**
 * Antes de que un admin cambie el ganador de un partido del cuadro: si el siguiente ya tiene resultado,
 * no se puede (habría que corregir antes esa ronda). Devuelve un mensaje de error o null.
 */
export async function checkWinnerChange(m, newWinnerId) {
  const next = nextOf(m);
  if (!next || m.winnerId === newWinnerId || !m.winnerId) return null;
  const snap = await getDoc(doc(db, 'matches', next.id));
  if (snap.exists() && snap.data().sets?.length) {
    return 'Este cambio cambia el ganador, pero el partido de la ronda siguiente ya tiene resultado. Corrige o borra antes ese resultado.';
  }
  return null;
}

/**
 * El cuadro completo para dibujarlo: rondas → posiciones, con el partido (si existe) o los jugadores
 * que ya se conocen (ganadores de la ronda anterior).
 */
export function buildBracket(category, matches) {
  const rounds = category.rounds ?? 0;
  const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
  const out = [];
  for (let r = 0; r < rounds; r++) {
    const slots = [];
    const count = 2 ** (rounds - r - 1);
    for (let s = 0; s < count; s++) {
      const match = byId[koId(category.id, r, s)] ?? null;
      let p1 = match?.player1Id ?? null;
      let p2 = match?.player2Id ?? null;
      if (!match && r > 0) {
        const f1 = byId[koId(category.id, r - 1, s * 2)];
        const f2 = byId[koId(category.id, r - 1, s * 2 + 1)];
        p1 = f1?.status === 'confirmed' ? f1.winnerId : null;
        p2 = f2?.status === 'confirmed' ? f2.winnerId : null;
      }
      slots.push({ round: r, slot: s, match, p1, p2, ready: !match && r > 0 && Boolean(p1 && p2) });
    }
    out.push({ round: r, name: roundName(r, rounds), slots });
  }
  return out;
}

/** Campeón: el ganador de la final confirmada. */
export function championOf(category, matches) {
  if (!category.rounds) return null;
  const final = matches.find((m) => m.id === koId(category.id, category.rounds - 1, 0));
  return final?.status === 'confirmed' ? final.winnerId : null;
}
