// Dobles: torneos en los que cada participante es una pareja fija.
//
// En un torneo de dobles (tournament.modality === 'doubles'), los grupos, las eliminatorias y los partidos
// guardan IDs de pareja (colección `teams`: { tournamentId, categoryId, memberIds: [uid, uid] }) donde en
// individuales guardan IDs de jugador. Así la clasificación, el cuadro y el paso de ronda funcionan igual.
//
// Cada partido de dobles guarda además quién juega en cada lado, para saber quién puede apuntar el resultado
// y para encontrar «mis partidos»:
//   team1Ids: [uid, uid] (lado del player1Id) · team2Ids: [uid, uid] · memberIds: los cuatro
// reportedBy / confirmedBy / disputedBy siguen siendo personas (uid): cualquiera de la pareja apunta el
// resultado y cualquiera de la pareja rival lo confirma o lo rechaza.

export const MODALITIES = { singles: 'singles', doubles: 'doubles' };
export const isDoubles = (tournament) => tournament?.modality === MODALITIES.doubles;

/** Nombre corto de una persona: nombre y primer apellido («Laura Martín»). */
export const shortName = (u) => (u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name : 'Jugador eliminado');

/** Nombre de una pareja: «Ana Ruiz / Laura Martín». */
export const teamName = (team, usersById) => (team.memberIds ?? []).map((id) => shortName(usersById[id])).join(' / ');

/** Directorio de participantes: jugadores y parejas por ID, con el nombre listo para mostrar. */
export function buildDirectory(users, teams) {
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const byId = { ...usersById };
  teams.forEach((t) => { byId[t.id] = { ...t, team: true, name: teamName(t, usersById) }; });
  return byId;
}

/** ¿Este participante (jugador o pareja) es la persona `uid` o la incluye? */
export const isMe = (byId, id, uid) => Boolean(uid && id) && (id === uid || Boolean(byId[id]?.memberIds?.includes(uid)));

/**
 * Quién puede entrar en un grupo o en un cuadro de esta categoría:
 * en dobles, sus parejas; en individuales, los jugadores (sin los administradores).
 */
export function participantsOf({ doubles, categoryId, users, teams, byId }) {
  if (doubles) return teams.filter((t) => t.categoryId === categoryId).map((t) => byId[t.id] ?? t);
  return users.filter((u) => u.role !== 'admin');
}

/** Campos extra de un partido de dobles (vacío si los participantes son jugadores). */
export function teamFields(p1, p2, byId) {
  const t1 = byId[p1];
  const t2 = byId[p2];
  if (!t1?.team && !t2?.team) return {};
  const team1Ids = t1?.memberIds ?? null;
  const team2Ids = t2?.memberIds ?? null;
  return { team1Ids, team2Ids, memberIds: [...(team1Ids ?? []), ...(team2Ids ?? [])] };
}

/** Lado del partido en el que juega la persona `uid`: 'a' (player1), 'b' (player2) o null. */
export function sideOfUser(m, uid) {
  if (!uid || !m) return null;
  if (m.team1Ids || m.team2Ids) {
    if (m.team1Ids?.includes(uid)) return 'a';
    if (m.team2Ids?.includes(uid)) return 'b';
    return null;
  }
  if (m.player1Id === uid) return 'a';
  if (m.player2Id === uid) return 'b';
  return null;
}
