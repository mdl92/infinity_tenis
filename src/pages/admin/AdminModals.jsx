import { useState } from 'react';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { deleteWithChildren } from '../../lib/data';
import { Modal } from '../../components/ui.jsx';
import Select, { Segmented } from '../../components/Select.jsx';
import { FORMATS } from '../../lib/bracket';

// Modales de organización: torneo, categoría y grupo.

export function TournamentModal({ tournament, onClose, onCreated }) {
  const [name, setName] = useState(tournament?.name ?? '');
  const [startDate, setStartDate] = useState(tournament?.startDate ?? '');
  const [endDate, setEndDate] = useState(tournament?.endDate ?? '');
  const [venue, setVenue] = useState(tournament?.venue ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const data = { name: name.trim(), startDate: startDate || null, endDate: endDate || null, venue: venue.trim() || null };
    if (tournament) {
      await updateDoc(doc(db, 'tournaments', tournament.id), data);
    } else {
      const ref = await addDoc(collection(db, 'tournaments'), { ...data, createdAt: serverTimestamp() });
      onCreated(ref.id);
    }
    onClose();
  }

  return (
    <Modal title={tournament ? 'Editar torneo' : 'Crear torneo'} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Nombre del torneo</span>
          <input autoFocus placeholder="p. ej. Torneo de Otoño 2026" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Empieza (opcional)</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Termina (opcional)</span>
            <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Lugar (opcional)</span>
          <input placeholder="p. ej. Club Infinity" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </label>
        <div className="modal-actions">
          {tournament && (
            <button type="button" className="btn btn-ghost btn-danger" style={{ marginRight: 'auto' }} onClick={async () => {
              if (!window.confirm(`Se eliminará «${tournament.name}» con todas sus categorías, grupos y partidos. ¿Continuar?`)) return;
              await deleteWithChildren('tournaments', tournament.id, 'tournamentId', ['categories', 'groups', 'matches']);
              onClose();
            }}>Eliminar torneo</button>
          )}
          <button type="button" className="btn btn-soft" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>{tournament ? 'Guardar' : 'Crear torneo'}</button>
        </div>
      </form>
    </Modal>
  );
}

/** `canChangeFormat`: el formato solo se puede cambiar mientras la categoría está vacía. */
export function CategoryModal({ tournamentId, category, canChangeFormat = true, onClose }) {
  const [name, setName] = useState(category?.name ?? '');
  const [format, setFormat] = useState(category?.format ?? FORMATS.groups);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const data = { name: name.trim(), ...(canChangeFormat ? { format } : {}) };
    if (category) await updateDoc(doc(db, 'categories', category.id), data);
    else await addDoc(collection(db, 'categories'), { tournamentId, ...data, playerIds: [], createdAt: serverTimestamp() });
    onClose();
  }

  return (
    <Modal title={category ? 'Editar categoría' : 'Crear categoría'} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Nombre de la categoría</span>
          <input autoFocus placeholder="p. ej. Femenina" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="field">
          <span>Tipo de torneo</span>
          <Segmented label="Tipo de torneo" value={format} onChange={canChangeFormat ? setFormat : () => {}}
            options={[{ value: FORMATS.groups, label: 'Torneo de grupos' }, { value: FORMATS.knockout, label: 'Eliminatoria' }]} />
          <span className="field-hint">
            {!canChangeFormat
              ? 'No se puede cambiar: la categoría ya tiene grupos, jugadores o cuadro.'
              : format === FORMATS.groups
                ? 'Grupos de todos contra todos con clasificación por puntos.'
                : 'Cuadro por rondas: quien pierde queda eliminado y el ganador pasa a la siguiente ronda.'}
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy || !name.trim()}>{category ? 'Guardar' : 'Crear categoría'}</button>
        </div>
      </form>
    </Modal>
  );
}

export function GroupModal({ tournamentId, categories, group, defaultCategoryId, onClose }) {
  const [name, setName] = useState(group?.name ?? '');
  const [categoryId, setCategoryId] = useState(group?.categoryId ?? defaultCategoryId ?? '');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    setBusy(true);
    if (group) {
      await updateDoc(doc(db, 'groups', group.id), { name: name.trim() });
    } else {
      await addDoc(collection(db, 'groups'), {
        tournamentId, categoryId, name: name.trim(), playerIds: [], createdAt: serverTimestamp(),
      });
    }
    onClose();
  }

  return (
    <Modal title={group ? 'Editar grupo' : 'Crear grupo'} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Nombre del grupo</span>
          <input autoFocus placeholder="p. ej. Grupo A" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="field">
          <span>Categoría</span>
          <Select label="Categoría" value={categoryId} onChange={setCategoryId} disabled={Boolean(group)}
            placeholder="Elige una categoría…" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          {group && <span className="field-hint">La categoría no se puede cambiar una vez creado el grupo.</span>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-soft" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy || !name.trim() || !categoryId}>{group ? 'Guardar' : 'Crear grupo'}</button>
        </div>
      </form>
    </Modal>
  );
}
