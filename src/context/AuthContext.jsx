import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { loginAttempts } from '../lib/access';

/** Inicia sesión con «nombre y primer apellido» + contraseña (o con email, para el primer admin). */
async function loginWithName(identifier, password) {
  let lastError;
  for (const attempt of loginAttempts(identifier, password)) {
    try {
      return await signInWithEmailAndPassword(auth, attempt.email, attempt.password);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);       // usuario de Firebase Auth
  const [profile, setProfile] = useState(null); // documento users/{uid} (nombre, rol…)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = () => {};
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubProfile();
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          setProfile(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoading(false);
        },
        () => {
          setProfile(null);
          setLoading(false);
        }
      );
    });
    return () => {
      unsubProfile();
      unsubAuth();
    };
  }, []);

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    // No hay registro: las cuentas las crea el administrador (Administración › Usuarios)
    login: loginWithName,
    logout: () => signOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
