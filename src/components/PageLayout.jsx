import { Link, Outlet, useLocation } from 'react-router-dom';
import { ArrowLeft, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { TournamentSelect } from '../context/TournamentContext.jsx';
import { Avatar, FooterLogo, Logo } from './ui.jsx';

/** Páginas interiores (grupo, partido, resultados…): sin menú lateral, solo logo y vuelta a la portada. */
export default function PageLayout() {
  const { user, profile, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="landing-plain">
      <header className="page-top">
        <Logo to="/" />
        <div className="page-top-end">
          <TournamentSelect />
          {isAdmin && <Link className="icon-btn" to="/admin" aria-label="Administración" title="Administración"><Settings /></Link>}
          {user && <>
            <Avatar name={profile?.name} me size="sm" />
            <button className="icon-btn" onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut /></button>
          </>}
        </div>
      </header>
      <main className="page" key={pathname}>
        <Link className="back-link" to="/"><ArrowLeft /> Volver a la portada</Link>
        <Outlet />
      </main>
      <FooterLogo />
    </div>
  );
}
