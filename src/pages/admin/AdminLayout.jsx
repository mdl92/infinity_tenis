import { useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, ExternalLink, LayoutGrid, LogOut, MapPin, Pencil, Plus, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTournament } from '../../context/TournamentContext.jsx';
import { useCollection } from '../../hooks/useFirestore';
import { byCategory } from '../../lib/tennis';
import { isDoubles } from '../../lib/teams';
import { clubPhoto, FooterLogo } from '../../components/ui.jsx';
import Select from '../../components/Select.jsx';
import { TournamentModal } from './AdminModals.jsx';
import FloatingDock from '../../components/FloatingDock.jsx';

const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const day = (iso) => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return dayFmt.format(new Date(y, m - 1, d)).replace('.', '');
};

/** Organización con el mismo estilo que la portada: foto de fondo, cabecera y hoja blanca. */
export default function AdminLayout() {
  const { logout } = useAuth();
  const { tournaments, active, choose } = useTournament();
  const { data: categories } = useCollection('categories', [['tournamentId', '==', active?.id]]);
  const [modal, setModal] = useState(null); // 'new' | 'edit'
  const accountRef = useRef(null);
  const { pathname } = useLocation();

  const cats = [...categories].sort(byCategory);
  const dates = [day(active?.startDate) && `Inicio: ${day(active.startDate)}`, day(active?.endDate) && `Fin: ${day(active.endDate)}`].filter(Boolean).join(' – ');

  return (
    <div className="hm adm2" style={{ '--club': `url(${clubPhoto})` }}>
      <header className="hm-hero">
        <div className="hm-hero-inner">
          <nav className="hm-account" aria-label="Organización" ref={accountRef}>
            <NavLink to="/admin" end className={({ isActive }) => `hm-acc-btn ${isActive ? 'on' : ''}`}><LayoutGrid /> <span>Cuadros</span></NavLink>
            <NavLink to="/admin/jugadores" className={({ isActive }) => `hm-acc-btn ${isActive ? 'on' : ''}`}><Users /> <span>Jugadores</span></NavLink>
            <Link to="/" className="hm-acc-btn" aria-label="Ver la web"><ExternalLink /> <span className="lbl-long">Ver la web</span><span className="lbl-short">Web</span></Link>
            <button type="button" className="hm-acc-btn" onClick={logout} aria-label="Cerrar sesión"><LogOut /> <span>Salir</span></button>
          </nav>

          <h1>{active?.name ?? 'Sin torneo'}</h1>
          {active && (
            <p className="hm-sub">
              {isDoubles(active) ? 'Dobles' : 'Individual'}{cats.length > 0 && <> · {cats.length === 1 ? 'Categoría' : 'Categorías'} {cats.map((c) => c.name).join(', ')}</>}
            </p>
          )}
          {(dates || active?.venue) && (
            <p className="hm-chip">
              {dates && <span><CalendarDays aria-hidden="true" /> {dates}</span>}
              {dates && active?.venue && <i aria-hidden="true" />}
              {active?.venue && <span><MapPin aria-hidden="true" /> {active.venue}</span>}
            </p>
          )}
          <div className="adm2-tournament">
            {tournaments.length > 1 && (
              <Select label="Torneo" className="adm2-tsel" size="sm" value={active?.id ?? ''} onChange={choose}
                options={tournaments.map((t) => ({ value: t.id, label: t.name }))} />
            )}
            {active && <button type="button" className="hm-acc-btn" onClick={() => setModal('edit')}><Pencil /> <span>Editar torneo</span></button>}
            <button type="button" className="hm-acc-btn" onClick={() => setModal('new')}><Plus /> <span>Nuevo torneo</span></button>
          </div>
        </div>
      </header>

      <FloatingDock watchRef={accountRef} items={[
        { key: 'board', label: 'Cuadros', icon: LayoutGrid, to: '/admin', active: pathname === '/admin' },
        { key: 'users', label: 'Jugadores', icon: Users, to: '/admin/jugadores', active: pathname.startsWith('/admin/jugadores') },
        { key: 'web', label: 'Ver la web', icon: ExternalLink, to: '/' },
        { key: 'out', label: 'Salir', icon: LogOut, onClick: logout },
      ]} />

      <main className="hm-sheet">
        <Outlet />
      </main>

      <FooterLogo onPhoto />

      {modal && (
        <TournamentModal
          tournament={modal === 'edit' ? active : null}
          canChangeModality={modal === 'new' || cats.length === 0}
          onClose={() => setModal(null)}
          onCreated={choose}
        />
      )}
    </div>
  );
}
