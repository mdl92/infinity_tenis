import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { photoStyle } from './ui.jsx';
import { isKnockout } from '../lib/bracket';

// Campos de color del cartel; la foto se funde con el color de cada tarjeta
const STYLES = ['bg-lavender', 'bg-violet', 'bg-sky', 'bg-yellow'];

/** Tarjetas de categoría: foto fundida en el color, nombre en grande y forma geométrica. */
export default function CategoryCards({ categories, groups }) {
  return (
    <div className="cat-grid">
      {categories.map((c, i) => {
        const own = groups.filter((g) => g.categoryId === c.id);
        const ko = isKnockout(c);
        const players = ko ? (c.playerIds ?? []).length : own.reduce((n, g) => n + (g.playerIds?.length ?? 0), 0);
        return (
          <Link key={c.id} to={`/categoria/${c.id}`} className={`cat-card ${STYLES[i % STYLES.length]}`}>
            <div className="cat-photo" style={photoStyle(i)} />
            <div className="cat-body">
              <span className={i % 3 === 2 ? 'diamond-shape' : 'ring-shape'} aria-hidden="true" />
              <div className="cat-name">{c.name}</div>
              <div className="cat-meta">
                <span>{ko ? 'Eliminatoria' : `${own.length} ${own.length === 1 ? 'grupo' : 'grupos'}`}</span>
                <span>{players} jugadores</span>
              </div>
              <span className="go-dot" aria-hidden="true"><ArrowRight /></span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
