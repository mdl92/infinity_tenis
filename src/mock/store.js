// Almacén local para el MODO DEMO (sin Firebase). Guarda todo en localStorage.
// Para empezar de cero: en la consola del navegador, localStorage.removeItem('demo-db-v7') y recarga.

import { authPassword, emailFor, initialPassword, usernameOf } from '../lib/access.js';

const KEY = 'demo-db-v7';

const now = () => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 });


function seed() {
  const t = now();
  // [nombre, primer apellido, rol] — entran con «nombre apellido» y la contraseña automática (Laura Martín → lmartin)
  const people = {
    admin: ['Admin', 'Demo', 'admin'],
    laura: ['Laura', 'Martín'],
    marta: ['Marta', 'Gil'],
    lucia: ['Lucía', 'Romero'],
    paula: ['Paula', 'Navarro'],
    elena: ['Elena', 'Torres'],
    sara: ['Sara', 'Vidal'],
    nuria: ['Nuria', 'Prieto'],
    carlos: ['Carlos', 'Ruiz'],
    javier: ['Javier', 'Soto'],
    pablo: ['Pablo', 'Herrera'],
    diego: ['Diego', 'Molina'],
    irene: ['Irene', 'Campos'],
    marcos: ['Marcos', 'Vela'],
  };
  const users = Object.fromEntries(Object.entries(people).map(([id, [firstName, lastName, role = 'player']]) =>
    [id, { name: `${firstName} ${lastName}`, firstName, lastName, secondLastName: '', username: usernameOf(firstName, lastName), role, createdAt: t }]));

  const G = (categoryId, name, playerIds) => ({ tournamentId: 't1', categoryId, name, playerIds, createdAt: t });
  const groups = {
    a1: G('cA', 'Grupo A1', ['marta', 'laura', 'paula', 'lucia']),
    a2: G('cA', 'Grupo A2', ['elena', 'nuria', 'sara']),
    ap1: G('cAp', 'Grupo A+1', ['carlos', 'javier', 'pablo', 'diego']),
    b1: G('cB', 'Grupo B1', ['irene', 'marcos', 'laura', 'carlos']),
    b2: G('cB', 'Grupo B2', ['marta', 'lucia', 'diego', 'pablo']),
    c1: G('cC', 'Grupo C1', ['javier', 'paula', 'elena', 'nuria']),
    c2: G('cC', 'Grupo C2', ['sara', 'irene', 'marcos', 'diego']),
  };

  // [juegos1, juegos2] · [7, 6, tb1, tb2] con tie-break · el tercero es el súper tie-break
  const S = (...pairs) => pairs.map(([a, b, ta, tb], i) => (i === 2 ? { a, b, super: true } : ta !== undefined ? { a, b, ta, tb } : { a, b }));
  // Resultados de ejemplo; el resto de cruces de cada grupo quedan pendientes
  const results = {
    'a1:marta:paula': { disputedBy: 'paula', disputedSets: S([6, 2], [6, 1]) },
    'a1:laura:marta': { status: 'confirmed', sets: S([6, 4], [3, 6], [10, 7]), winnerId: 'laura', reportedBy: 'laura', confirmedBy: 'marta' },
    'a1:laura:lucia': { status: 'confirmed', sets: S([6, 3], [6, 4]), winnerId: 'laura', reportedBy: 'laura', confirmedBy: 'lucia' },
    'a1:marta:lucia': { status: 'confirmed', sets: S([7, 5], [6, 2]), winnerId: 'marta', reportedBy: 'marta', confirmedBy: 'lucia' },
    'a2:elena:sara': { status: 'confirmed', sets: S([4, 6], [6, 3], [10, 8]), winnerId: 'elena', reportedBy: 'sara', confirmedBy: 'elena' },
    'ap1:carlos:javier': { status: 'confirmed', sets: S([6, 1], [6, 2]), winnerId: 'carlos', reportedBy: 'carlos', confirmedBy: 'javier' },
    'ap1:carlos:pablo': { status: 'reported', sets: S([6, 7, 5, 7], [4, 6]), winnerId: 'pablo', reportedBy: 'pablo' },
    'ap1:javier:pablo': { status: 'confirmed', sets: S([6, 4], [2, 6], [11, 9]), winnerId: 'javier', reportedBy: 'javier', confirmedBy: 'pablo' },
    'b1:irene:marcos': { status: 'confirmed', sets: S([6, 2], [7, 6, 7, 4]), winnerId: 'irene', reportedBy: 'irene', confirmedBy: 'marcos' },
    'b1:laura:carlos': { status: 'reported', sets: S([3, 6], [4, 6]), winnerId: 'carlos', reportedBy: 'carlos' },
    'b2:marta:lucia': { status: 'confirmed', sets: S([6, 3], [6, 3]), winnerId: 'marta', reportedBy: 'marta', confirmedBy: 'lucia' },
    'c1:javier:paula': { status: 'confirmed', sets: S([6, 4], [6, 4]), winnerId: 'javier', reportedBy: 'paula', confirmedBy: 'javier' },
    'c2:sara:irene': { status: 'reported', sets: S([6, 2], [6, 4]), winnerId: 'sara', reportedBy: 'sara' },
  };
  const list = [];
  for (const [g, { playerIds }] of Object.entries(groups)) {
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const [p1, p2] = [playerIds[i], playerIds[j]];
        const direct = results[`${g}:${p1}:${p2}`];
        const flipped = results[`${g}:${p2}:${p1}`];
        // Si el ejemplo está escrito al revés, se le da la vuelta al marcador
        const swap = (sets) => sets?.map(({ a, b, ta, tb, ...rest }) => ({ ...rest, a: b, b: a, ...(ta !== undefined ? { ta: tb, tb: ta } : {}) }));
        const extra = direct ?? (flipped ? { ...flipped, sets: swap(flipped.sets), disputedSets: swap(flipped.disputedSets) } : {});
        list.push([g, p1, p2, Object.fromEntries(Object.entries(extra).filter(([, v]) => v !== undefined))]);
      }
    }
  }
  const matches = Object.fromEntries(list.map(([g, p1, p2, extra], i) => [`m${i + 1}`, {
    tournamentId: 't1', categoryId: groups[g].categoryId, groupId: g, player1Id: p1, player2Id: p2,
    status: 'pending', sets: [], winnerId: null, reportedBy: null, confirmedBy: null,
    createdAt: { seconds: t.seconds + i, nanoseconds: 0 }, updatedAt: { seconds: t.seconds - i * 3600, nanoseconds: 0 },
    ...extra,
  }]));

  return {
    auth: Object.fromEntries(Object.entries(users).map(([uid, u]) =>
      [emailFor(u.username), { uid, password: authPassword(initialPassword(u.firstName, u.lastName)) }])),
    session: null,
    collections: {
      users,
      tournaments: { t1: { name: 'Torneo de Otoño 2026', startDate: '2026-10-12', endDate: '2026-10-26', venue: 'Club Infinity', createdAt: t } },
      categories: {
        cAp: { tournamentId: 't1', name: 'A+', createdAt: t },
        cA: { tournamentId: 't1', name: 'A', createdAt: t },
        cB: { tournamentId: 't1', name: 'B', createdAt: t },
        cC: { tournamentId: 't1', name: 'C', createdAt: t },
      },
      groups,
      matches,
    },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* sin almacenamiento: usamos memoria */ }
  return seed();
}

export const state = load();

const listeners = new Set();

export function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignorar */ }
  // Notificar de forma asíncrona, como haría Firestore
  queueMicrotask(() => listeners.forEach((fn) => fn()));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function newId() {
  return Math.random().toString(36).slice(2, 12);
}

export { now };
