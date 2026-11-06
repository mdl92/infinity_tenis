// Sustituto mínimo de 'firebase/firestore' para el modo demo.
// Solo implementa lo que usa la app.
import { state, persist, subscribe, newId, now } from './store.js';

const SERVER_TS = { __op: 'serverTimestamp' };

export function getFirestore() { return {}; }
export const serverTimestamp = () => SERVER_TS;
export const arrayUnion = (...values) => ({ __op: 'arrayUnion', values });
export const arrayRemove = (...values) => ({ __op: 'arrayRemove', values });

const col = (name) => (state.collections[name] ??= {});

export function collection(db, name) {
  return { type: 'collection', name };
}

export function doc(dbOrCol, name, id) {
  if (dbOrCol?.type === 'collection') return { type: 'doc', col: dbOrCol.name, id: newId() };
  return { type: 'doc', col: name, id };
}

export function where(field, op, value) { return { field, op, value }; }
export function query(c, ...filters) { return { ...c, filters }; }

function matches(data, { field, op, value }) {
  const v = data[field];
  if (op === '==') return v === value;
  if (op === 'array-contains') return Array.isArray(v) && v.includes(value);
  throw new Error(`[demo] operador no soportado: ${op}`);
}

function applyFields(current, data) {
  const out = { ...current };
  for (const [k, v] of Object.entries(data)) {
    if (v === SERVER_TS || v?.__op === 'serverTimestamp') out[k] = now();
    else if (v?.__op === 'arrayUnion') out[k] = [...new Set([...(out[k] ?? []), ...v.values])];
    else if (v?.__op === 'arrayRemove') out[k] = (out[k] ?? []).filter((x) => !v.values.includes(x));
    else out[k] = structuredClone(v);
  }
  return out;
}

const snapDoc = (ref) => {
  const data = col(ref.col)[ref.id];
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => (data ? structuredClone(data) : undefined),
  };
};

function snapQuery(q) {
  const docs = Object.keys(col(q.name))
    .filter((id) => (q.filters ?? []).every((f) => matches(col(q.name)[id], f)))
    .map((id) => snapDoc({ type: 'doc', col: q.name, id }));
  return { docs, forEach: (fn) => docs.forEach(fn), size: docs.length, empty: docs.length === 0 };
}

const snapshotOf = (target) => (target.type === 'doc' ? snapDoc(target) : snapQuery(target));

export function onSnapshot(target, next) {
  const emit = () => next(snapshotOf(target));
  queueMicrotask(emit);
  return subscribe(emit);
}

export async function getDocs(q) { return snapQuery(q); }
export async function getDoc(ref) { return snapDoc(ref); }

// --- Escrituras ---
function writeSet(ref, data) { col(ref.col)[ref.id] = applyFields({}, data); }
function writeUpdate(ref, data) {
  if (!col(ref.col)[ref.id]) throw new Error(`[demo] no existe ${ref.col}/${ref.id}`);
  col(ref.col)[ref.id] = applyFields(col(ref.col)[ref.id], data);
}
function writeDelete(ref) { delete col(ref.col)[ref.id]; }

export async function addDoc(c, data) {
  const ref = doc(c);
  writeSet(ref, data);
  persist();
  return ref;
}
export async function setDoc(ref, data) { writeSet(ref, data); persist(); }
export async function updateDoc(ref, data) { writeUpdate(ref, data); persist(); }
export async function deleteDoc(ref) { writeDelete(ref); persist(); }

export function writeBatch() {
  const ops = [];
  return {
    set(ref, data) { ops.push(() => writeSet(ref, data)); return this; },
    update(ref, data) { ops.push(() => writeUpdate(ref, data)); return this; },
    delete(ref) { ops.push(() => writeDelete(ref)); return this; },
    async commit() { ops.forEach((op) => op()); persist(); },
  };
}
