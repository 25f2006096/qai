import { useNavigate } from 'react-router-dom';
import { useProgress } from '../../context/ProgressContext.jsx';
import { getWorldMap } from '../../utils/worldMap.js';

export default function WorldMap() {
  const navigate = useNavigate();
  const { progress } = useProgress();
  const regions = getWorldMap(progress);
  const available = regions.find(region => region.state === 'available');

  return (
    <div className="page fade-in">
      <div className="page-header">
        <h1 className="page-title">🗺️ Quantum World Map</h1>
        <p className="page-subtitle">Your learning route is based on completed curriculum modules—not XP or page visits.</p>
      </div>

      {available && (
        <section className="card" style={{ marginBottom: 24, borderLeft: '4px solid var(--accent)' }} aria-labelledby="next-region-heading">
          <div style={{ fontSize: '.72rem', color: 'var(--accent)', fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase' }}>Next learning region</div>
          <h2 id="next-region-heading" style={{ margin: '5px 0 8px' }}>{available.icon} {available.name}</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 14 }}>{available.description}</p>
          {available.nextModule && <button className="btn btn-primary" onClick={() => navigate(`/modules/${available.nextModule.id}`)}>Start Module {available.nextModule.id} →</button>}
        </section>
      )}

      <section className="world-map-grid" aria-label="Quantum learning regions">
        {regions.map((region, index) => {
          const locked = region.state === 'locked';
          return (
            <article key={region.id} className={`world-region ${region.state}`}>
              <div className="world-region-index">Region {index + 1}</div>
              <div className="world-region-icon" aria-hidden="true">{locked ? '🔒' : region.icon}</div>
              <div>
                <h2>{region.name}</h2>
                <p>{region.description}</p>
              </div>
              <div className="world-region-progress">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.78rem', marginBottom: 6 }}>
                  <span>{locked ? 'Complete earlier regions to unlock' : `${region.completedCount} of ${region.totalCount} modules`}</span>
                  <strong>{locked ? 'Locked' : `${region.progress}%`}</strong>
                </div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${locked ? 0 : region.progress}%` }} /></div>
              </div>
              {!locked && region.nextModule && <button className="text-action" onClick={() => navigate(`/modules/${region.nextModule.id}`)}>Continue {region.nextModule.title} →</button>}
              {region.state === 'complete' && <span className="tag tag-success">✓ Region complete</span>}
            </article>
          );
        })}
      </section>
    </div>
  );
}
