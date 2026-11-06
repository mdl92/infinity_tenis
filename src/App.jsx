import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { TournamentProvider } from './context/TournamentContext.jsx';
import PageLayout from './components/PageLayout.jsx';
import { EmptyState, Logo } from './components/ui.jsx';
import Home from './pages/Home.jsx';
import Dashboard from './pages/Dashboard.jsx';
import MyMatches from './pages/MyMatches.jsx';
import Categories from './pages/Categories.jsx';
import Category from './pages/Category.jsx';
import Group from './pages/Group.jsx';
import Match from './pages/Match.jsx';
import Results from './pages/Results.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminBoard from './pages/admin/AdminBoard.jsx';

const Loading = () => <div className="center-screen muted">Cargando…</div>;

/** Solo con sesión (y, si admin, solo administradores). */
function Protected({ admin = false, children }) {
  const { user, profile, loading, isAdmin, logout } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/" replace />;
  if (!profile) {
    return (
      <div className="center-screen">
        <div className="card card-pad" style={{ maxWidth: 420 }}>
          <Logo />
          <EmptyState title="Cuenta sin perfil" action={<button className="btn" onClick={logout}>Cerrar sesión</button>}>
            Tu cuenta existe pero no tiene perfil en el torneo. Pide al club que te dé de alta.
          </EmptyState>
        </div>
      </div>
    );
  }
  if (admin && !isAdmin) return <Navigate to="/inicio" replace />;
  return children;
}



export default function App() {
  return (
    <HashRouter>
      <TournamentProvider>
      <Routes>
        {/* Todo en una pantalla: franja para identificarse y cartas desplegables */}
        <Route path="/" element={<Home />} />

        {/* Páginas interiores, sin menú lateral */}
        <Route element={<PageLayout />}>
          <Route path="/inicio" element={<Protected><Dashboard /></Protected>} />
          <Route path="/partidos" element={<Protected><MyMatches /></Protected>} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/categoria/:categoryId" element={<Category />} />
          <Route path="/grupo/:groupId" element={<Group />} />
          <Route path="/partido/:matchId" element={<Match />} />
          <Route path="/resultados" element={<Results />} />
        </Route>

        {/* Organización: una sola pantalla de cuadros y la lista de jugadores */}
        <Route path="/admin" element={<Protected admin><AdminLayout /></Protected>}>
          <Route index element={<AdminBoard />} />
          <Route path="jugadores" element={<AdminUsers />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>

        {/* Direcciones antiguas */}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/registro" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </TournamentProvider>
    </HashRouter>
  );
}
