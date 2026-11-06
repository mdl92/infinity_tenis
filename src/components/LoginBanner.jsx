import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

/** Formulario de identificación (nombre y primer apellido + contraseña). */
export default function LoginForm({ onDone }) {
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(name, password);
      onDone?.();
    } catch {
      setError('El nombre o la contraseña no coinciden. Escribe tu nombre y primer apellido tal y como te dio de alta el club.');
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Nombre y primer apellido</span>
        <input autoFocus autoComplete="username" placeholder="p. ej. Laura Martín" value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="field">
        <span>Contraseña</span>
        <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? 'Entrando…' : <>Entrar <ArrowRight /></>}</button>
      {__DEMO_MODE__ && (
        <p className="login-demo">
          Demo · Jugadora: <b>Laura Martín</b> / <b>lmartin</b> · Admin: <b>Admin Demo</b> / <b>ademo</b>
        </p>
      )}
      <p className="login-help">¿No tienes cuenta o no puedes entrar? Pídeselo a la organización del torneo.</p>
    </form>
  );
}
