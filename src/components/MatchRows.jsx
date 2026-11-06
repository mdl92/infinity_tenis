import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { formatSets, matchState, sideOf } from '../lib/matches';
import { isSuper } from '../lib/tennis';
import Match from '../pages/Match.jsx';

/** Lista compacta de partidos; cada uno se despliega para ver o apuntar el resultado. */
export default function MatchRows({ matches, usersById, uid, sub, children }) {
  const [openId, setOpenId] = useState(null);
  const name = (id) => usersById[id]?.name ?? 'Jugador eliminado';

  return (
    <ul className="mrows">
      {matches.map((m) => {
        const st = matchState(m, uid);
        const sets = m.sets ?? [];
        const open = openId === m.id;
        const line = (pid) => (
          <span className={`mrow-p ${sets.length && m.winnerId === pid ? 'win' : ''} ${pid === uid ? 'me' : ''}`}>
            <i aria-hidden="true" />{name(pid)}
          </span>
        );
        const games = (side) => (
          <span className="mrow-games">
            {sets.map((s, k) => {
              const { games: mine, other, tiebreak } = sideOf(s, side);
              return (
                <b key={k} className={`${mine > other ? 'w' : ''} ${isSuper(s, k) ? 'stb' : ''}`}>
                  {mine}{tiebreak !== null && <sup>{tiebreak}</sup>}
                </b>
              );
            })}
          </span>
        );
        return (
          <li key={m.id} className={open ? 'open' : ''}>
            <button type="button" className={`mrow st-${st.tone}`} aria-expanded={open} onClick={() => setOpenId(open ? null : m.id)}
              aria-label={`${name(m.player1Id)} contra ${name(m.player2Id)}, ${st.label}`}>
              <span className="mrow-names">
                {line(m.player1Id)}
                {line(m.player2Id)}
                {sub && <small>{sub(m)}</small>}
              </span>
              <span className={`mrow-tag tag-${st.tone}`}>{st.label}</span>
              {sets.length > 0
                ? <span className="mrow-score" aria-label={formatSets(sets)}>{games('a')}{games('b')}</span>
                : <span className="mrow-go">Resultado</span>}
              <ChevronRight className="mrow-chev" aria-hidden="true" />
            </button>
            {open && <Match matchId={m.id} compact />}
          </li>
        );
      })}
      {children}
    </ul>
  );
}
