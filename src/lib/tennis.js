// Lógica de tenis: validación de marcadores, ganador, clasificación y cruces.
// Formato de un set: { a: juegos del jugador 1, b: juegos del jugador 2 }

export const byName = (x, y) =>
  (x?.name ?? '').localeCompare(y?.name ?? '', 'es', { numeric: true, sensitivity: 'base' });

/*
 * Formato del partido: 2 sets. Si quedan 1-1, se juega un súper tie-break en lugar del tercer set.
 * Un set que acaba 7-6 lleva además los puntos de su tie-break.
 *
 *   set normal:      { a, b }                 p. ej. 6-3
 *   set con tie-break:{ a, b, ta, tb }         p. ej. 7-6 (7-4) → { a: 7, b: 6, ta: 7, tb: 4 }
 *   súper tie-break: { a, b, super: true }    p. ej. 10-8
 *
 * (a = jugador 1, b = jugador 2)
 */

/** ¿Este set necesita los puntos del tie-break? (7-6 o 6-7) */
export const needsTiebreak = (a, b) => (Number(a) === 7 && Number(b) === 6) || (Number(a) === 6 && Number(b) === 7);

/** ¿Hace falta súper tie-break? (cada uno ha ganado un set) */
export function needsSuper(rawSets) {
  const [s1, s2] = rawSets;
  if ([s1?.a, s1?.b, s2?.a, s2?.b].some((v) => v === '' || v === undefined)) return false;
  return (Number(s1.a) > Number(s1.b)) !== (Number(s2.a) > Number(s2.b));
}

const isInt = (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0;

/** Comprueba un set normal: 6-0…6-4, 7-5 o 7-6 (con su tie-break). */
function checkSet(s, n) {
  if (s.a === '' || s.b === '') return `Completa los juegos de los dos jugadores en el set ${n}.`;
  if (!isInt(s.a) || !isInt(s.b)) return `Los juegos del set ${n} deben ser números enteros.`;
  const [hi, lo] = [Math.max(s.a, s.b), Math.min(s.a, s.b)].map(Number);
  const ok = (hi === 6 && lo <= 4) || (hi === 7 && (lo === 5 || lo === 6));
  if (!ok) return `El set ${n} no es un resultado posible (vale de 6-0 a 6-4, 7-5 o 7-6).`;
  if (hi === 7 && lo === 6) {
    if (s.ta === '' || s.tb === '' || s.ta === undefined || s.tb === undefined) return `Pon los puntos del tie-break del set ${n}.`;
    if (!isInt(s.ta) || !isInt(s.tb)) return `Los puntos del tie-break del set ${n} deben ser números enteros.`;
    const [ta, tb] = [Number(s.ta), Number(s.tb)];
    if (Math.max(ta, tb) < 7 || Math.abs(ta - tb) < 2) return `El tie-break del set ${n} se gana a 7 puntos con 2 de diferencia (p. ej. 7-4 o 9-7).`;
    if (Math.max(ta, tb) > 7 && Math.abs(ta - tb) !== 2) return `Si el tie-break del set ${n} pasa de 7, se gana por 2 justos (p. ej. 9-7).`;
    if ((ta > tb) !== (Number(s.a) > Number(s.b))) return `En el set ${n}, el tie-break lo tiene que ganar quien gana el set 7-6.`;
  }
  return null;
}

/** Devuelve un mensaje de error o null si el marcador es válido. */
export function validateSets(rawSets) {
  const [s1, s2, st] = rawSets;
  const e1 = checkSet(s1, 1);
  if (e1) return e1;
  const e2 = checkSet(s2, 2);
  if (e2) return e2;
  const filled = st && (st.a !== '' || st.b !== '');
  if (!needsSuper(rawSets)) {
    return filled ? 'No hace falta súper tie-break: el mismo jugador ha ganado los dos sets.' : null;
  }
  if (!filled || st.a === '' || st.b === '') return 'Habéis ganado un set cada uno: pon el resultado del súper tie-break.';
  if (!isInt(st.a) || !isInt(st.b)) return 'Los puntos del súper tie-break deben ser números enteros.';
  const [a, b] = [Number(st.a), Number(st.b)];
  if (Math.max(a, b) < 10 || Math.abs(a - b) < 2) return 'El súper tie-break se gana a 10 puntos con 2 de diferencia (p. ej. 10-7 o 12-10).';
  if (Math.max(a, b) > 10 && Math.abs(a - b) !== 2) return 'Si el súper tie-break pasa de 10, se gana por 2 justos (p. ej. 12-10).';
  return null;
}

/** Convierte el formulario en sets numéricos (ya validados). */
export function cleanSets(rawSets) {
  const [s1, s2, st] = rawSets;
  const set = (s) => (needsTiebreak(s.a, s.b)
    ? { a: Number(s.a), b: Number(s.b), ta: Number(s.ta), tb: Number(s.tb) }
    : { a: Number(s.a), b: Number(s.b) });
  const out = [set(s1), set(s2)];
  if (needsSuper(rawSets)) out.push({ a: Number(st.a), b: Number(st.b), super: true });
  return out;
}

/** Sets en formato de formulario (texto), para editar un resultado ya guardado. */
export function formSets(sets = []) {
  const str = (v) => (v === undefined || v === null ? '' : String(v));
  const normal = sets.filter((s, i) => !isSuper(s, i));
  const sup = sets.find((s, i) => isSuper(s, i));
  const row = (s) => ({ a: str(s?.a), b: str(s?.b), ta: str(s?.ta), tb: str(s?.tb) });
  return [row(normal[0]), row(normal[1]), { a: str(sup?.a), b: str(sup?.b) }];
}

/** El tercer elemento siempre es el súper tie-break (también en datos antiguos sin la marca). */
export const isSuper = (s, i) => Boolean(s?.super) || i === 2;

export function winnerOf(match, sets) {
  const wonA = sets.filter((s) => s.a > s.b).length;
  const wonB = sets.length - wonA;
  return wonA > wonB ? match.player1Id : match.player2Id;
}

/** Puntos de la clasificación por cada partido ganado. */
export const POINTS_PER_WIN = 3;

/** Clasificación de un grupo a partir de los partidos CONFIRMADOS. */
export function computeStandings(playerIds, matches) {
  const rows = Object.fromEntries(
    playerIds.map((id) => [id, { id, pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, jg: 0, jp: 0 }])
  );

  for (const m of matches) {
    if (m.status !== 'confirmed') continue;
    const r1 = rows[m.player1Id];
    const r2 = rows[m.player2Id];
    if (!r1 || !r2) continue;

    (m.sets ?? []).forEach((set, i) => {
      const { a, b } = set;
      if (!isSuper(set, i)) {
        r1.jg += a; r1.jp += b;
        r2.jg += b; r2.jp += a;
      }
      if (a > b) { r1.sg++; r2.sp++; } else { r2.sg++; r1.sp++; }
    });
    r1.pj++; r2.pj++;
    if (m.winnerId === m.player1Id) { r1.pg++; r2.pp++; } else { r2.pg++; r1.pp++; }
  }

  for (const r of Object.values(rows)) r.pts = r.pg * POINTS_PER_WIN;

  // Desempate: victorias → diferencia de sets → diferencia de juegos
  return Object.values(rows).sort(
    (x, y) => y.pg - x.pg || (y.sg - y.sp) - (x.sg - x.sp) || (y.jg - y.jp) - (x.jg - x.jp)
  );
}

export const pairKey = (a, b) => [a, b].sort().join('__');

/** Todos los cruces posibles (todos contra todos, a una vuelta). */
export function roundRobinPairs(ids) {
  const pairs = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j]]);
  }
  return pairs;
}

/** Orden de categorías: alfabético, y con «+» delante de la letra sola (A+, A, B, C). */
export const byCategory = (x, y) => {
  const nx = x?.name ?? '';
  const ny = y?.name ?? '';
  const base = nx.replace(/\+/g, '').localeCompare(ny.replace(/\+/g, ''), 'es', { sensitivity: 'base' });
  if (base) return base;
  return (ny.match(/\+/g)?.length ?? 0) - (nx.match(/\+/g)?.length ?? 0);
};
