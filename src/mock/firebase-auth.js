// Sustituto de 'firebase/auth' para el modo demo.
import { state, persist, subscribe, newId } from './store.js';

const authError = (code) => Object.assign(new Error(code), { code });

export function getAuth(app) {
  return { app, primary: !app?.name?.startsWith('secondary') };
}

const currentUser = () => (state.session ? { uid: state.session.uid, email: state.session.email } : null);

export function onAuthStateChanged(auth, cb) {
  let last;
  const emit = () => {
    const u = currentUser();
    if (u?.uid === last?.uid && last !== undefined) return;
    last = u;
    cb(u);
  };
  queueMicrotask(emit);
  return subscribe(emit);
}

export async function signInWithEmailAndPassword(auth, email, password) {
  const acc = state.auth[email.toLowerCase()];
  if (!acc || acc.password !== password) throw authError('auth/invalid-credential');
  state.session = { uid: acc.uid, email: email.toLowerCase() };
  persist();
  return { user: currentUser() };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  const e = email.toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(e)) throw authError('auth/invalid-email');
  if (password.length < 6) throw authError('auth/weak-password');
  if (state.auth[e]) throw authError('auth/email-already-in-use');
  const uid = newId();
  state.auth[e] = { uid, password };
  if (auth.primary) state.session = { uid, email: e };
  persist();
  return { user: { uid, email: e } };
}

export async function sendPasswordResetEmail(auth, email) {
  console.info(`[demo] Se simularía un email de restablecimiento a ${email}`);
}

export async function signOut(auth) {
  if (!auth.primary) return; // la instancia secundaria no toca la sesión del admin
  state.session = null;
  persist();
}
