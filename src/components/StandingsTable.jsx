import { computeStandings, POINTS_PER_WIN } from '../lib/tennis';
import { Person } from './ui.jsx';

export default function StandingsTable({ playerIds, matches, usersById, myId }) {
  const rows = computeStandings(playerIds, matches);
  if (rows.length === 0) {
    return <div className="card"><p className="empty-state">Aún no hay jugadores en este grupo.</p></div>;
  }

  return (
    <div className="card table-card">
      <div className="table-scroll">
        <table className="table standings">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Jugador/a</th>
              <th className="num" title="Partidos jugados">PJ</th>
              <th className="num" title="Partidos ganados">PG</th>
              <th className="num hide-sm" title="Partidos perdidos">PP</th>
              <th className="num hide-sm" title="Sets ganados - perdidos">Sets</th>
              <th className="num">Puntos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={r.id === myId ? 'me' : undefined}>
                <td className="pos"><span className="pos-badge">{i + 1}</span></td>
                <td><Person name={usersById[r.id]?.name ?? 'Jugador eliminado'} me={r.id === myId} /></td>
                <td className="num">{r.pj}</td>
                <td className="num">{r.pg}</td>
                <td className="num hide-sm">{r.pp}</td>
                <td className="num hide-sm">{r.sg}-{r.sp}</td>
                <td className="num pts">{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="table-foot">
        PJ jugados · PG ganados · PP perdidos. Solo cuentan los partidos confirmados: {POINTS_PER_WIN} puntos por victoria; desempate por diferencia de sets y de juegos.
      </p>
    </div>
  );
}
