import { api } from '../api';
import { Loaded } from '../components/Loaded';
import { useAsync } from '../hooks/useAsync';
import type { RoundStatus } from '../types';

const STATUS_LABEL: Record<RoundStatus, string> = {
  qualified: 'Qualified',
  tie: 'Tie on line',
  scoring: 'Scoring',
  not_started: 'Not started',
};

export function RoundsPage() {
  const rounds = useAsync(api.listRounds, [], 5000);
  return (
    <section>
      <h1>Rounds</h1>
      <Loaded state={rounds}>
        {(list) => (
          <ul className="rows">
            {list.map((r) => {
              const percent = r.total ? Math.round((r.scored / r.total) * 100) : 0;
              return (
                <li key={r.id} className="card round">
                  <div>
                    <b>{r.category}</b>
                    <div className="meta">{r.stage}</div>
                  </div>
                  <div className="round-progress">
                    <span className="meta"><b>{r.scored}/{r.total} scored</b> · Top {r.qualifyCount} qualify</span>
                    <div className="bar" role="progressbar" aria-label={`${r.category} scored`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <span className={`pill pill-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Loaded>
    </section>
  );
}
