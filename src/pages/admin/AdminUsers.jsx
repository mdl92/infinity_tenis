import { useState } from 'react';
import {
  collection, doc, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch, arrayRemove,
} from 'firebase/firestore';
import { Plus, Search, X } from 'lucide-react';
import { createAuthAccount, db } from '../../firebase';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTournament } from '../../context/TournamentContext.jsx';
import { useCollection, usePeople } from '../../hooks/useFirestore';
import {
  authPassword, authUsernameOf, emailFor, initialPassword, passwordOf, usernameOf,
} from '../../lib/access';
import { byName } from '../../lib/tennis';
import { isKnockout } from '../../lib/bracket';
import { moveUserData } from '../../lib/accounts';
import { Avatar, Modal } from '../../components/ui.jsx';
import Select, { Segmented } from '../../components/Select.jsx';

/** Cómo entra cada persona: nombre + primer apellido y su contraseña automática. */
function accessOf(u) {
  if (!u.username || !u.firstName || !u.lastName) return null; // p. ej. el primer admin, que entra con su email
  return { login: `${u.firstName} ${u.lastName}`, password: passwordOf(u) };
}

/** Texto para buscar: minúsculas y sin tildes («Martín» se encuentra escribiendo «martin»). */
const norm = (t = '') => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const NO_GROUP = '__sin-grupo__';
const ROLES = { all: 'all', player: 'player', admin: 'admin' };

/** ¿Hay otra persona que ya entra (o entraba) con ese usuario? */
const usernameTaken = (users, username, exceptId) =>
  users.some((u) => u.id !== exceptId && (u.username === username || authUsernameOf(u) === username));

export default function AdminUsers() {
  const { user } = useAuth();
  const { users, teams: allTeams, loading } = usePeople();
  const { active } = useTournament();
  const { data: groups } = useCollection('groups', [['tournamentId', '==', active?.id]]);
  const { data: categories } = useCollection('categories', [['tournamentId', '==', active?.id]]);
  const teams = allTeams.filter((t) => t.tournamentId === active?.id);
  // Dónde juega: directamente o, en dobles, con su pareja
  const idsOf = (id) => [id, ...teams.filter((t) => t.memberIds?.includes(id)).map((t) => t.id)];
  const groupsOf = (id) => [
    ...groups.filter((g) => g.playerIds?.some((x) => idsOf(id).includes(x)))
      .map((g) => `${categories.find((c) => c.id === g.categoryId)?.name ?? ''} · ${g.name}`),
    ...categories.filter((c) => isKnockout(c) && c.playerIds?.some((x) => idsOf(id).includes(x))).map((c) => `${c.name} · Eliminatoria`),
  ];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [search, setSearch] = useState('');
  const [place, setPlace] = useState(''); // '' = todas · id de categoría · NO_GROUP
  const [role, setRole] = useState(ROLES.all);

  async function removeUser(u) {
    if (!window.confirm(`¿Dar de baja a ${u.name}? Se quitará de sus grupos y ya no podrá entrar.`)) return;
    const batch = writeBatch(db);
    const groups = await getDocs(query(collection(db, 'groups'), where('playerIds', 'array-contains', u.id)));
    groups.forEach((g) => batch.update(g.ref, { playerIds: arrayRemove(u.id) }));
    const kos = await getDocs(query(collection(db, 'categories'), where('playerIds', 'array-contains', u.id)));
    kos.forEach((c) => batch.update(c.ref, { playerIds: arrayRemove(u.id) }));
    // Partidos en los que el rival también está dado de baja: ya no tienen sentido, se borran
    const ids = new Set(users.map((x) => x.id));
    ids.delete(u.id);
    for (const field of ['player1Id', 'player2Id']) {
      const snap = await getDocs(query(collection(db, 'matches'), where(field, '==', u.id)));
      snap.forEach((m) => {
        const rival = field === 'player1Id' ? m.data().player2Id : m.data().player1Id;
        if (!ids.has(rival)) batch.delete(m.ref);
      });
    }
    batch.delete(doc(db, 'users', u.id));
    await batch.commit();
    setMsg({ type: 'ok', text: `${u.name} dado de baja. Para borrar también su cuenta de acceso, hazlo en Firebase › Authentication.` });
  }

  const sorted = [...users].sort(byName);

  // ---- Filtro: nombre (o cómo entra) · categoría o «sin grupo» · rol ----
  const inCategory = (id, c) => (isKnockout(c)
    ? Boolean(c.playerIds?.includes(id))
    : groups.some((g) => g.categoryId === c.id && g.playerIds?.includes(id)));
  const q = norm(search);
  const shown = sorted.filter((u) => {
    if (role !== ROLES.all && (u.role === 'admin') !== (role === ROLES.admin)) return false;
    if (place === NO_GROUP && (u.role === 'admin' || groupsOf(u.id).length > 0)) return false;
    if (place && place !== NO_GROUP && !inCategory(u.id, categories.find((c) => c.id === place) ?? {})) return false;
    if (q && !norm(`${u.name} ${accessOf(u)?.login ?? ''}`).includes(q)) return false;
    return true;
  });
  const filtering = Boolean(q || place || role !== ROLES.all);
  const clearFilters = () => { setSearch(''); setPlace(''); setRole(ROLES.all); };
  const placeOptions = [
    { value: '', label: 'Todas las categorías' },
    ...[...categories].sort(byName).map((c) => ({ value: c.id, label: c.name, hint: isKnockout(c) ? 'Eliminatoria' : undefined })),
    { value: NO_GROUP, label: 'Sin grupo' },
  ];

  return (
    <>
      {msg.text && (
        <div className={`notice ${msg.type === 'error' ? 'notice-coral' : 'notice-green'}`} role="status" style={{ marginBottom: '1rem' }}><span>{msg.text}</span></div>
      )}

      <section className="hm-cat" aria-labelledby="users-title">
        <div className="hm-cat-head">
          <h2 id="users-title">Jugadores</h2>
          <span className="hm-meta">{sorted.length} personas con acceso · entran con su nombre y primer apellido</span>
          <button type="button" className="hm-tool adm2-head-btn" onClick={() => setOpen(true)}><Plus aria-hidden="true" /> Dar de alta</button>
        </div>
        <div className="hm-groups">
      <div className="users-filters" role="search">
        <label className="users-search">
          <Search aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…" aria-label="Buscar jugador por nombre" />
          {search && <button type="button" className="icon-btn" onClick={() => setSearch('')} aria-label="Borrar búsqueda"><X /></button>}
        </label>
        <Select label="Filtrar por categoría" value={place} onChange={setPlace} size="sm" options={placeOptions} />
        <Segmented label="Filtrar por rol" value={role} onChange={setRole}
          options={[{ value: ROLES.all, label: 'Todos' }, { value: ROLES.player, label: 'Jugadores' }, { value: ROLES.admin, label: 'Admins' }]} />
      </div>
      {filtering && (
        <p className="users-count">
          {shown.length} de {sorted.length} {sorted.length === 1 ? 'persona' : 'personas'}
          <button type="button" className="link" onClick={clearFilters}>Quitar filtros</button>
        </p>
      )}
      <div className="hm-card users-table">
        {loading && <p className="loading" style={{ padding: '1.25rem' }}>Cargando…</p>}
        <div className="table-scroll">
          <table className="table hm-table">
            <thead>
              <tr><th>Nombre</th><th className="hide-sm">Entra como</th><th>Contraseña</th><th className="hide-sm">Grupo</th><th className="actions" aria-label="Acciones" /></tr>
            </thead>
            <tbody>
              {!loading && shown.length === 0 && (
                <tr><td colSpan={5} className="muted users-empty">Nadie coincide con estos filtros.</td></tr>
              )}
              {shown.map((u) => {
                const acc = accessOf(u);
                return (
                  <tr key={u.id}>
                    <td><span className="hm-person"><Avatar name={u.name} me={u.id === user.uid} size="sm" /><span>{u.name}</span></span></td>
                    <td className="hide-sm" data-label="Entra como">{acc ? acc.login : <span className="muted">Con su email</span>}</td>
                    <td data-label="Contraseña">{acc ? <code className="pass">{acc.password}</code> : <span className="muted">—</span>}</td>
                    <td className="hide-sm" data-label="Grupo">
                      {u.role === 'admin'
                        ? <span className="muted">Organización</span>
                        : groupsOf(u.id).length
                          ? groupsOf(u.id).join(', ')
                          : <span className="tag tag-yellow">Sin grupo</span>}
                    </td>
                    <td className="actions">
                      <span className="actions-inner text-actions">
                        <button className="link" onClick={() => setEditing(u)}>Editar</button>
                        {u.id !== user.uid && <button className="link danger" onClick={() => removeUser(u)}>Dar de baja</button>}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </div>
      </section>

      {open && <UserModal users={users} onClose={() => setOpen(false)} onDone={(text) => setMsg({ type: 'ok', text })} />}
      {editing && (
        <UserModal users={users} editing={editing} isSelf={editing.id === user.uid}
          onClose={() => setEditing(null)} onDone={(text) => setMsg({ type: 'ok', text })} />
      )}
    </>
  );
}

/** Alta de una persona o, con `editing`, edición de sus datos. */
function UserModal({ users, editing, isSelf, onClose, onDone }) {
  const [form, setForm] = useState(() => ({
    firstName: editing?.firstName ?? editing?.name ?? '',
    lastName: editing?.lastName ?? '',
    secondLastName: editing?.secondLastName ?? '',
    role: editing?.role ?? 'player',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const firstName = form.firstName.trim().replace(/\s+/g, ' ');
  const lastName = form.lastName.trim().replace(/\s+/g, ' ');
  const secondLastName = form.secondLastName.trim().replace(/\s+/g, ' ');
  // El primer admin (creado a mano) entra con su email: se le puede cambiar el nombre, pero no cómo entra
  const byEmail = Boolean(editing) && !editing.username;
  const ready = byEmail ? Boolean(firstName) : Boolean(firstName && lastName);
  const username = ready && !byEmail ? usernameOf(firstName, lastName) : '';
  const newPassword = ready && !byEmail ? initialPassword(firstName, lastName) : '';
  // ¿Cambia cómo entra (usuario o contraseña) respecto a su cuenta actual?
  const credChanged = Boolean(editing) && Boolean(username)
    && (username !== authUsernameOf(editing) || newPassword !== passwordOf(editing));
  // A otra persona se le crea una cuenta nueva; a uno mismo no (cambiaría de cuenta en mitad de la sesión)
  const newAccount = credChanged && !isSelf;
  const password = !ready || byEmail ? '' : editing && !newAccount ? passwordOf(editing) : newPassword;
  // Mientras se guarda no se comprueba: el perfil recién creado ya sale en `users` y se vería a sí mismo como repetido
  const taken = !busy && Boolean(username) && usernameTaken(users, username, editing?.id);
  const loginChanged = editing && username && username !== editing.username;
  const name = [firstName, lastName, secondLastName].filter(Boolean).join(' ');
  const oldLogin = editing?.firstName && editing?.lastName ? `${editing.authFirstName ?? editing.firstName} ${editing.authLastName ?? editing.lastName}` : '';

  async function create() {
    const uid = await createAuthAccount(emailFor(username), authPassword(password));
    await setDoc(doc(db, 'users', uid), {
      name, firstName, lastName, secondLastName, username, role: form.role,
      authUsername: username, authFirstName: firstName, authLastName: lastName, createdAt: serverTimestamp(),
    });
    return `${name} dado de alta. Entra como «${firstName} ${lastName}» con la contraseña «${password}».`;
  }

  /** Cuenta nueva con el usuario y la contraseña del nombre nuevo, y traslado de todos sus datos. */
  async function replaceAccount() {
    const newId = await createAuthAccount(emailFor(username), authPassword(password));
    const moved = await moveUserData(editing.id, newId, {
      name, firstName, lastName, secondLastName, username, role: form.role,
      authUsername: username, authFirstName: firstName, authLastName: lastName,
      createdAt: editing.createdAt ?? serverTimestamp(),
    });
    const what = [
      moved.groups && `${moved.groups} ${moved.groups === 1 ? 'grupo' : 'grupos'}`,
      moved.knockouts && `${moved.knockouts} ${moved.knockouts === 1 ? 'eliminatoria' : 'eliminatorias'}`,
      moved.teams && `${moved.teams} ${moved.teams === 1 ? 'pareja' : 'parejas'}`,
      moved.matches && `${moved.matches} ${moved.matches === 1 ? 'partido' : 'partidos'}`,
    ].filter(Boolean).join(', ');
    return `${name} actualizado. Ahora entra como «${firstName} ${lastName}» con la contraseña «${password}»`
      + `${what ? ` (se han pasado a su cuenta nueva ${what})` : ''}. `
      + `Su cuenta antigua${oldLogin ? ` («${oldLogin}»)` : ''} ya no sirve; si quieres, bórrala en Firebase › Authentication.`;
  }

  async function update() {
    if (newAccount) return replaceAccount();
    const data = { name, firstName, lastName, secondLastName };
    if (!isSelf) data.role = form.role;
    if (!byEmail) {
      // La cuenta de acceso no cambia: se guarda con qué datos se creó (si aún no estaba guardado)
      Object.assign(data, {
        username,
        authUsername: authUsernameOf(editing),
        authFirstName: editing.authFirstName ?? editing.firstName,
        authLastName: editing.authLastName ?? editing.lastName,
      });
    }
    await updateDoc(doc(db, 'users', editing.id), data);
    return loginChanged
      ? `${name} actualizado. Ahora entra como «${firstName} ${lastName}»; su contraseña sigue siendo «${password}».`
      : `${name} actualizado.`;
  }

  async function submit(e) {
    e.preventDefault();
    if (!ready || taken) return;
    setBusy(true);
    setError('');
    try {
      onDone(editing ? await update() : await create());
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.code === 'auth/email-already-in-use'
        ? (editing
          ? `Ya existe una cuenta de acceso para «${firstName} ${lastName}» (puede ser de alguien dado de baja o de un cambio de nombre anterior). Bórrala en Firebase › Authentication y vuelve a intentarlo.`
          : 'Ya existe una cuenta con ese nombre y primer apellido.')
        : 'No se ha podido guardar. Inténtalo de nuevo.');
      setBusy(false);
    }
  }

  return (
    <Modal
      title={editing ? 'Editar datos' : 'Dar de alta'}
      description={editing
        ? (byEmail
          ? 'Esta cuenta entra con su email; aquí solo cambias cómo se muestra el nombre.'
          : isSelf
            ? 'Si cambias tu nombre o primer apellido, entrarás con los nuevos, pero tu contraseña no cambia.'
            : 'Si cambias el nombre o el primer apellido, se le crea una cuenta nueva con su contraseña nueva y se le pasan sus grupos y partidos.')
        : 'La contraseña se genera sola: inicial del nombre + primer apellido.'}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label className="field">
          <span>Nombre</span>
          <input autoFocus value={form.firstName} onChange={set('firstName')} placeholder="p. ej. Laura" required />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Primer apellido{byEmail ? ' (opcional)' : ''}</span>
            <input value={form.lastName} onChange={set('lastName')} placeholder="p. ej. Martín" required={!byEmail} />
          </label>
          <label className="field">
            <span>Segundo apellido (opcional)</span>
            <input value={form.secondLastName} onChange={set('secondLastName')} />
          </label>
        </div>
        {!isSelf && (
          <div className="field">
            <span>Rol</span>
            <Segmented label="Rol" value={form.role} onChange={(role) => setForm((f) => ({ ...f, role }))}
              options={[{ value: 'player', label: 'Jugador/a' }, { value: 'admin', label: 'Administrador' }]} />
          </div>
        )}

        {ready && !byEmail && (!editing || loginChanged || credChanged || taken) && (
          <div className={`notice ${taken ? 'notice-coral' : 'notice-sky'}`} style={{ marginBottom: '1rem' }}>
            <span>
              {taken
                ? <>Ya hay alguien que entra como «{firstName} {lastName}». Escribe el nombre de otra forma (por ejemplo, con el segundo nombre).</>
                : newAccount
                  ? <>Se le creará una cuenta nueva: entrará como <b>{firstName} {lastName}</b> con la contraseña <code className="pass">{password}</code>. Sus grupos, eliminatorias y partidos pasan a la cuenta nueva y la antigua{oldLogin ? <> («{oldLogin}»)</> : null} dejará de funcionar.</>
                  : <>{editing ? 'Ahora entrará' : 'Entrará'} como <b>{firstName} {lastName}</b> con la contraseña <code className="pass">{password}</code></>}
            </span>
          </div>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy || !ready || taken}>
            {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Dar de alta'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
