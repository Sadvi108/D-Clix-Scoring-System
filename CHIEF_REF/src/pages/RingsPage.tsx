import { Loaded } from '../components/Loaded';
import type { Async } from '../hooks/useAsync';
import type { RingStatus, RingSummary } from '../types';

const STATUS_LABEL: Record<RingStatus, string> = {
  scoring: 'Scoring',
  with_ric: 'With RIC',
  paused: 'Paused',
  idle: 'Idle',
};

function RingCard({ ring, onOpen }: { ring: RingSummary; onOpen: (id: string) => void }) {
  const total = ring.done + ring.left;
  const percent = total ? Math.round((ring.done / total) * 100) : 0;
  return (
    <article className="card">
      <div className="ring-head">
        <h2>{ring.name}</h2>
        <span className={`pill pill-${ring.status}`}>{STATUS_LABEL[ring.status]}</span>
      </div>
      <p className="meta">{ring.note}</p>
      <div className="bar" role="progressbar" aria-label={`${ring.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <i style={{ width: `${percent}%` }} />
      </div>
      <p className="counts">
        <span><b>{ring.done}</b> games done</span>
        <span><b>{ring.left}</b> left</span>
      </p>
      <p className="meta">
        Operator {ring.operatorOnline ? 'online' : 'offline'} · Referees online {ring.refereesOnline} / {ring.refereesTotal}
      </p>
      <button className="btn btn-primary" onClick={() => onOpen(ring.id)}>Open this ring</button>
    </article>
  );
}

interface Props {
  rings: Async<RingSummary[]>;
  onOpen: (ringId: string) => void;
}

export function RingsPage({ rings, onOpen }: Props) {
  return (
    <section>
      <h1>All rings</h1>
      <Loaded state={rings}>
        {(list) => (
          <div className="ring-grid">
            {list.map((ring) => <RingCard key={ring.id} ring={ring} onOpen={onOpen} />)}
          </div>
        )}
      </Loaded>
    </section>
  );
}
