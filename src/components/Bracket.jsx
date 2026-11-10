import { useEffect, useMemo, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { advance, buildBracket, championOf, koId } from '../lib/bracket';
import { formatSets, matchState, sideOf } from '../lib/matches';
import { isSuper } from '../lib/tennis';
import { isMe } from '../lib/teams';
import { Modal } from './ui.jsx';
import Match from '../pages/Match.jsx';

/** Juegos de un lado, set a set (con el tie-break en pequeño). */
function Games({ match, side }) {
  return (
    <span className="bk-games">
      {(match.sets ?? []).map((s, k) => {
        const { games, other, tiebreak } = sideOf(s, side);
        return (
          <b key={k} className={`${games > other ? 'w' : ''} ${isSuper(s) ? 'stb' : ''}`}>
            {games}{tiebreak !== null && <sup>{tiebreak}</sup>}
          </b>
        );
      })}
    </span>
  );
}

function Slot({ slot, name, uid, mine, onOpen }) {
  const { match, p1, p2 } = slot;
  const decided = match?.status === 'confirmed' && !match.bye;
  const line = (pid, side) => {
    const win = match?.status === 'confirmed' && match.winnerId === pid && pid;
    return (
      <span className={`bk-line ${win ? 'win' : ''} ${mine(pid) ? 'me' : ''} ${pid ? '' : 'tbd'}`}>
        <span className="bk-name">{pid ? name(pid) : (match?.bye ? '—' : 'Por decidir')}</span>
        {decided && <Games match={match} side={side} />}
      </span>
    );
  };

  if (match?.bye) {
    return (
      <div className="bk-match bye">
        {line(match.player1Id, 'a')}
        <span className="bk-line tbd"><span className="bk-name">Pasa directo</span></span>
      </div>
    );
  }
  if (!match) {
    return <div className="bk-match empty">{line(p1, 'a')}{line(p2, 'b')}</div>;
  }
  const st = matchState(match, uid);
  return (
    <button type="button" className={`bk-match st-${st.tone}`} onClick={() => onOpen(match)}
      aria-label={`${name(match.player1Id)} contra ${name(match.player2Id)}, ${st.label}${decided ? `, ${formatSets(match.sets)}` : ''}`}>
      {line(match.player1Id, 'a')}
      {line(match.player2Id, 'b')}
      {!decided && <span className={`bk-tag tag-${st.tone}`}>{st.label}</span>}
    </button>
  );
}

/**
 * Cuadro de eliminatoria: una columna por ronda, deslizable en el móvil.
 * Al pulsar un partido se abre para ver o apuntar el resultado.
 */
export default function Bracket({ category, matches, usersById }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [openId, setOpenId] = useState(null);
  const name = (id) => usersById[id]?.name ?? 'Jugador eliminado';
  const rounds = useMemo(() => buildBracket(category, matches), [category, matches]);
  const champion = championOf(category, matches);
  const open = matches.find((m) => m.id === openId);

  // Si los dos jugadores de un partido ya se conocen pero el partido no se llegó a crear
  // (p. ej. se cortó la conexión al confirmar), lo crea quien tenga sesión iniciada
  const pending = rounds.flatMap((r) => r.slots).filter((s) => s.ready);
  const pendingKey = pending.map((s) => `${s.round}_${s.slot}`).join(',');
  useEffect(() => {
    if (!uid || pending.length === 0) return;
    const byId = Object.fromEntries(matches.map((m) => [m.id, m]));
    pending.forEach((s) => {
      const feeder = byId[koId(category.id, s.round - 1, s.slot * 2)];
      if (feeder) advance(feeder).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pendingKey]);

  if (!category.drawn) {
    return <p className="hm-empty">El cuadro de esta categoría todavía no se ha sorteado.</p>;
  }

  return (
    <>
      {champion && (
        <p className="bk-champion"><Trophy aria-hidden="true" /> Campeón/a: <b>{name(champion)}</b></p>
      )}
      <div className="bk-scroll">
        <div className="bk" style={{ '--rounds': rounds.length }}>
          {rounds.map((r) => (
            <section key={r.round} className="bk-round" aria-label={r.name}>
              <h4>{r.name}</h4>
              <div className="bk-slots">
                {r.slots.map((s) => (
                  <div key={s.slot} className="bk-cell">
                    <Slot slot={s} name={name} uid={uid} mine={(pid) => isMe(usersById, pid, uid)} onOpen={(m) => setOpenId(m.id)} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      {open && (
        <Modal title={`${name(open.player1Id)} – ${name(open.player2Id)}`} description={rounds[open.round]?.name} onClose={() => setOpenId(null)}>
          <Match matchId={open.id} compact onDeleted={() => setOpenId(null)} />
        </Modal>
      )}
    </>
  );
}
