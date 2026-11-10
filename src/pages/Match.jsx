import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteDoc, doc } from 'firebase/firestore';
import { ArrowLeft, CircleCheck, Hourglass, LayoutGrid, Layers, TriangleAlert } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext.jsx';
import { useDoc, usePeople } from '../hooks/useFirestore';
import {
  confirmResult, formatSets, isParticipant, matchState, permissionMessage, rejectResult, saveResult, sideOf,
} from '../lib/matches';
import {
  DECIDERS, cleanSets, deciderOf, formSets, isSuper, needsDecider, needsTiebreak, validateSets,
} from '../lib/tennis';
import { isKoMatch, roundName } from '../lib/bracket';
import { isMe, sideOfUser } from '../lib/teams';
import { Avatar, CourtSvg, EmptyState } from '../components/ui.jsx';
import { Segmented } from '../components/Select.jsx';

const TITLES = {
  entry: 'Partido pendiente',
  dispute: 'Resultado en discrepancia',
  todo: 'Confirmar resultado',
  waiting: 'Pendiente de confirmación',
  review: 'Pendiente de confirmación',
  confirmed: 'Resultado confirmado',
};

/** Detalle de un partido. Con `compact` se despliega dentro de la lista (sin cabecera de página). */
export default function Match({ matchId: idProp, compact = false, onDeleted }) {
  const params = useParams();
  const matchId = idProp ?? params.matchId;
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: match, loading } = useDoc('matches', matchId);
  const { data: group } = useDoc('groups', match?.groupId);
  const { data: category } = useDoc('categories', match?.categoryId);
  const { byId: usersById } = usePeople();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <p className="loading">Cargando…</p>;
  if (!match) {
    return <EmptyState title="Partido no encontrado" action={<Link className="btn" to="/categorias">Volver a categorías</Link>} />;
  }

  const name = (id) => usersById[id]?.name ?? 'Jugador eliminado';
  const uid = user?.uid;
  const state = matchState(match, uid);
  const mine = isParticipant(match, uid);
  const sets = match.sets ?? [];
  const decided = sets.length > 0;

  // Quién puede hacer qué (las reglas de Firestore lo vuelven a comprobar)
  const canEnter = isAdmin || (mine && match.status === 'pending');
  const canConfirm = mine && state.key === 'todo';
  const showForm = (canEnter && !decided && match.status === 'pending') || editing;

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      setEditing(false);
    } catch (e) {
      console.error(e);
      setError(permissionMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const reject = () => {
    if (!window.confirm('El marcador se borrará y quedará marcado como discrepancia para que lo volváis a introducir. ¿Continuar?')) return;
    run(() => rejectResult(match, uid));
  };

  const remove = () => {
    if (!window.confirm(`¿Eliminar el partido ${name(match.player1Id)} – ${name(match.player2Id)}?`)) return;
    run(async () => {
      await deleteDoc(doc(db, 'matches', match.id));
      if (onDeleted) onDeleted();
      else if (!compact) navigate(-1);
    });
  };

  const title = showForm ? 'Introducir resultado' : TITLES[state.key];
  const ko = isKoMatch(match);
  const place = ko ? roundName(match.round, match.rounds) : group?.name;
  const back = mine ? { to: '/partidos', label: 'Volver a mis partidos' }
    : ko ? { to: '/', label: 'Volver al cuadro' }
      : { to: `/grupo/${match.groupId}`, label: 'Volver al grupo' };

  const resultSection = (
    <section className="result-bottom" aria-label="Resultado">
      <p className="result-section-title">Resultado</p>

      {showForm ? (
        <ResultForm
          match={match}
          name={name}
          busy={busy}
          submitLabel={isAdmin ? 'Guardar resultado' : 'Enviar resultado'}
          onCancel={editing ? () => setEditing(false) : null}
          onSubmit={(clean) => run(() => saveResult(match, clean, uid, isAdmin))}
        />
      ) : (
        <>
          <SetsView match={match} name={name} />
          <div className="result-actions">
            {canConfirm && (
              <>
                <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => run(() => confirmResult(match, uid))}>
                  Confirmar resultado
                </button>
                <button className="btn btn-lg" disabled={busy} onClick={reject}>No es correcto</button>
              </>
            )}
            {isAdmin && !canConfirm && (
              <button className="btn btn-soft" disabled={busy} onClick={() => setEditing(true)}>
                {decided ? 'Editar resultado' : 'Introducir resultado'}
              </button>
            )}
            {isAdmin && match.status === 'reported' && !canConfirm && (
              <button className="btn btn-primary" disabled={busy} onClick={() => run(() => confirmResult(match, uid))}>Validar</button>
            )}
          </div>
        </>
      )}
      {error && <p className="error" role="alert" style={{ textAlign: 'center', marginTop: '1rem' }}>{error}</p>}

      {isAdmin && !ko && (
        <div className="result-actions" style={{ marginTop: '1rem' }}>
          <button className="btn btn-ghost btn-danger btn-sm" disabled={busy} onClick={remove}>Eliminar partido</button>
        </div>
      )}
    </section>
  );

  if (compact) {
    return (
      <div className="match-panel">
        <StatusLine state={state} match={match} name={name} uid={uid} />
        {!uid && !decided && <p className="result-hint">Identifícate arriba para apuntar el resultado.</p>}
        {resultSection}
      </div>
    );
  }

  return (
    <div className="result-wrap">
      <Link className="link-back" to={back.to}><ArrowLeft /> {back.label}</Link>
      <header className="page-head" style={{ marginBottom: '1.5rem' }}>
        <div>
          <p className="eyebrow">{[category?.name, place].filter(Boolean).join(' · ') || 'Partido'}</p>
          <h1>{title}</h1>
        </div>
        <span className={`tag tag-${state.tone}`}>{state.label}</span>
      </header>

      <article className="result-card">
        <div className="result-top tile">
          <CourtSvg />
          <StatusLine state={state} match={match} name={name} uid={uid} />

          <div className="faceoff">
            {[match.player1Id, match.player2Id].map((pid, i) => (
              <div key={pid} className="faceoff-player" style={{ gridColumn: i === 0 ? 1 : 3 }}>
                <Avatar name={name(pid)} me={isMe(usersById, pid, uid)} size="lg" />
                <span className="faceoff-name">{name(pid)}</span>
                {decided && match.winnerId === pid && <span className="winner-mark">Ganador/a</span>}
              </div>
            ))}
            <span className="faceoff-vs" style={{ gridColumn: 2, gridRow: 1 }} aria-label="contra"><span className="ball-shape" /><b>vs</b></span>
          </div>

          <div className="faceoff-meta">
            {category && <span><Layers aria-hidden="true" /> {category.name}</span>}
            {place && <span><LayoutGrid aria-hidden="true" /> {place}</span>}
          </div>
        </div>

        {resultSection}
      </article>
    </div>
  );
}

/** Aviso del estado del partido, distinto para cada caso. */
function StatusLine({ state, match, name, uid }) {
  // En dobles, el rival es la otra pareja y quien envía el resultado es una persona de una de ellas
  const rival = sideOfUser(match, uid) === 'a' ? name(match.player2Id) : name(match.player1Id);
  const confirmer = sideOfUser(match, match.reportedBy) === 'a' ? name(match.player2Id) : name(match.player1Id);
  switch (state.key) {
    case 'todo':
      return (
        <div className="notice" role="status">
          <Hourglass aria-hidden="true" />
          <span>{name(match.reportedBy)} ha enviado este resultado. Revísalo y confírmalo si es correcto.</span>
        </div>
      );
    case 'waiting':
      return (
        <div className="notice notice-sky" role="status">
          <Hourglass aria-hidden="true" />
          <span>Resultado enviado. Falta que {rival} lo confirme.</span>
        </div>
      );
    case 'review':
      return (
        <div className="notice notice-sky" role="status">
          <Hourglass aria-hidden="true" />
          <span>Resultado sin confirmar: falta que {confirmer} lo confirme.</span>
        </div>
      );
    case 'confirmed':
      return (
        <div className="notice notice-green" role="status">
          <CircleCheck aria-hidden="true" />
          <span>{isKoMatch(match) ? 'Resultado confirmado. El ganador pasa a la siguiente ronda.' : 'Resultado confirmado. Ya cuenta para la clasificación.'}</span>
        </div>
      );
    case 'dispute':
      return (
        <div className="notice notice-coral" role="alert">
          <TriangleAlert aria-hidden="true" />
          <span>
            Hay una discrepancia: {name(match.disputedBy)} no estuvo de acuerdo
            {match.disputedSets?.length ? <> con el {formatSets(match.disputedSets)}</> : null}.
            Hablad entre vosotros e introducid el resultado correcto.
          </span>
        </div>
      );
    default:
      return (
        <div className="notice notice-yellow" role="status">
          <Hourglass aria-hidden="true" />
          <span>Partido pendiente. Cuando lo juguéis, cualquiera de los dos puede introducir el resultado.</span>
        </div>
      );
  }
}

function SetsView({ match, name }) {
  const sets = match.sets ?? [];
  const third = sets[2];
  const cols = third ? 3 : 2;
  const label = (x, i) => (isSuper(x) ? 'Súper TB' : `Set ${i + 1}`);
  return (
    <div className={`sets-grid cols-${cols}`}>
      <span />
      {[0, 1, 2].slice(0, cols).map((i) => <span key={i} className="set-label">{label(sets[i], i)}</span>)}
      {[['a', match.player1Id], ['b', match.player2Id]].map(([side, pid]) => (
        <Fragment key={side}>
          <span className="person-name">{name(pid)}</span>
          {[0, 1, 2].slice(0, cols).map((i) => {
            const x = sets[i];
            if (!x) return <span key={i} className="set-box empty">–</span>;
            const { games, other, tiebreak } = sideOf(x, side);
            return (
              <span key={i} className={`set-box ${isSuper(x) ? 'super' : ''} ${games > other ? 'won' : ''}`}>
                {games}{tiebreak !== null && <sup className="tb" aria-label={`tie-break ${tiebreak}`}>{tiebreak}</sup>}
              </span>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

const digits = (v, max = 2) => v.replace(/\D/g, '').slice(0, max);
const firstName = (n = '') => n.split(' ')[0];

function ResultForm({ match, name, onSubmit, onCancel, busy, submitLabel }) {
  const [sets, setSets] = useState(() => formSets(match.sets));
  const [decider, setDecider] = useState(() => deciderOf(match.sets));
  const [error, setError] = useState('');

  const change = (i, key, value) =>
    setSets((prev) => prev.map((x, j) => (j === i ? { ...x, [key]: digits(value) } : x)));
  const thirdOn = needsDecider(sets);
  const isSuperTb = thirdOn && decider === DECIDERS.super;
  const players = [['a', match.player1Id], ['b', match.player2Id]];
  // Sets con tie-break: los dos primeros y, si se jugó, el tercero
  const tbSets = (thirdOn && !isSuperTb ? [0, 1, 2] : [0, 1]).filter((i) => needsTiebreak(sets[i].a, sets[i].b));
  const thirdLabel = isSuperTb ? 'Súper TB' : 'Set 3';

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateSets(sets, decider);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    onSubmit(cleanSets(sets, decider));
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="sets-grid cols-3">
        <span />
        <span className="set-label">Set 1</span>
        <span className="set-label">Set 2</span>
        <span className={`set-label ${thirdOn ? '' : 'off'}`}>{thirdLabel}</span>
        {players.map(([side, pid]) => (
          <Fragment key={side}>
            <span className="person-name">{name(pid)}</span>
            {[0, 1].map((i) => (
              <input
                key={i}
                aria-label={`${name(pid)}, juegos del set ${i + 1}`}
                inputMode="numeric"
                placeholder="0"
                value={sets[i][side]}
                onChange={(e) => change(i, side, e.target.value)}
              />
            ))}
            <input
              aria-label={isSuperTb ? `${name(pid)}, puntos del súper tie-break` : `${name(pid)}, juegos del set 3`}
              className="super"
              inputMode="numeric"
              placeholder={thirdOn ? '0' : '–'}
              disabled={!thirdOn}
              value={thirdOn ? sets[2][side] : ''}
              onChange={(e) => change(2, side, e.target.value)}
            />
          </Fragment>
        ))}
      </div>

      {thirdOn && (
        <div className="decider-row">
          <p>Un set cada uno. ¿Cómo lo desempatasteis?</p>
          <Segmented
            label="Desempate"
            value={decider}
            onChange={setDecider}
            options={[{ value: DECIDERS.set, label: 'Tercer set' }, { value: DECIDERS.super, label: 'Súper tie-break' }]}
          />
        </div>
      )}

      {tbSets.map((i) => (
        <div key={i} className="tb-row" role="group" aria-label={`Tie-break del set ${i + 1}`}>
          <p>Tie-break del set {i + 1} <span>· {sets[i].a}-{sets[i].b}</span></p>
          <div className="tb-inputs">
            {players.map(([side, pid], k) => (
              <Fragment key={side}>
                {k === 1 && <span className="tb-sep" aria-hidden="true">–</span>}
                <label>
                  <span>{firstName(name(pid))}</span>
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    value={sets[i][side === 'a' ? 'ta' : 'tb']}
                    onChange={(e) => change(i, side === 'a' ? 'ta' : 'tb', e.target.value)}
                    aria-label={`${name(pid)}, puntos del tie-break del set ${i + 1}`}
                  />
                </label>
              </Fragment>
            ))}
          </div>
        </div>
      ))}

      <p className="result-hint">
        {!thirdOn && 'Al mejor de 3 sets. Si ganáis uno cada uno, elegís entre tercer set o súper tie-break. Con 7-6 te pediremos los puntos del tie-break.'}
        {thirdOn && isSuperTb && 'Súper tie-break: a 10 puntos, con 2 de diferencia.'}
        {thirdOn && !isSuperTb && 'Tercer set: como los anteriores (6-0…6-4, 7-5 o 7-6).'}
      </p>
      {error && <p className="error" role="alert" style={{ textAlign: 'center' }}>{error}</p>}
      <div className="result-actions">
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'Guardando…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn-lg" onClick={onCancel} disabled={busy}>Cancelar</button>}
      </div>
    </form>
  );
}
