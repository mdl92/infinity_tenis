import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { matchState, sideOf } from '../lib/matches';
import { isSuper } from '../lib/tennis';
import { isMe } from '../lib/teams';
import { Avatar } from './ui.jsx';
import Match from '../pages/Match.jsx';

/** Una línea del marcador: pelota de saque (ganador), jugador y juegos de cada set. */
function Line({ name, me, side, match }) {
  const sets = match.sets ?? [];
  const win = sets.length > 0 && match.winnerId === (side === 'a' ? match.player1Id : match.player2Id);
  return (
    <div className={`sr-line ${win ? 'win' : ''}`}>
      <span className="sr-player">
        <span className="sr-serve" aria-label={win ? 'Ganador' : undefined} />
        <Avatar name={name} me={me} size="sm" />
        <span className="sr-name">{name}</span>
      </span>
      <span className="sr-sets">
        {[0, 1, 2].map((i) => {
          const s = sets[i];
          if (!s) return <b key={i} />;
          const { games: mine, other, tiebreak } = sideOf(s, side);
          return <b key={i} className={`${mine > other ? 'w' : ''} ${isSuper(s) ? 'stb' : ''}`}>{mine}{tiebreak !== null && <sup>{tiebreak}</sup>}</b>;
        })}
      </span>
    </div>
  );
}

/**
 * Partidos como marcadores: franja de estado · dos líneas (la red en medio) · estado.
 * Con `expandable`, cada partido se despliega ahí mismo para ver o apuntar el resultado.
 */
export default function MatchList({ matches, usersById, uid, extra, expandable = false }) {
  const [openId, setOpenId] = useState(null);

  return (
    <div className="score-rows">
      {matches.map((m) => {
        const state = matchState(m, uid);
        const p1 = usersById[m.player1Id]?.name ?? 'Jugador eliminado';
        const p2 = usersById[m.player2Id]?.name ?? 'Jugador eliminado';
        const sub = extra?.(m);
        const open = openId === m.id;
        const body = (
          <>
            <span className="sr-flag" aria-hidden="true" />
            <div className="sr-board">
              <Line name={p1} me={isMe(usersById, m.player1Id, uid)} side="a" match={m} />
              <Line name={p2} me={isMe(usersById, m.player2Id, uid)} side="b" match={m} />
            </div>
            <div className="sr-side">
              <span className={`tag tag-${state.tone}`}>{state.label}</span>
              {sub && <span className="sr-extra">{sub}</span>}
              <span className="sr-go">
                {expandable
                  ? <>{open ? 'Cerrar' : 'Resultado'} <ChevronDown aria-hidden="true" className={open ? 'flip' : ''} /></>
                  : <>Detalle <ChevronRight aria-hidden="true" /></>}
              </span>
            </div>
          </>
        );

        if (!expandable) {
          return (
            <Link key={m.id} to={`/partido/${m.id}`} className={`score-row st-${state.tone}`} aria-label={`${p1} contra ${p2}, ${state.label}`}>
              {body}
            </Link>
          );
        }
        return (
          <Fragment key={m.id}>
            <button
              type="button"
              className={`score-row st-${state.tone} ${open ? 'is-open' : ''}`}
              aria-expanded={open}
              aria-label={`${p1} contra ${p2}, ${state.label}`}
              onClick={() => setOpenId(open ? null : m.id)}
            >
              {body}
            </button>
            {open && <Match matchId={m.id} compact />}
          </Fragment>
        );
      })}
    </div>
  );
}
