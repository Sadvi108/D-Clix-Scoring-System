import { Fragment, useState } from 'react';
import { api } from '../api';
import { Loaded } from '../components/Loaded';
import { useAsync, type Async } from '../hooks/useAsync';
import { useDebounced } from '../hooks/useDebounced';
import type { RingSummary } from '../types';

interface Props {
  rings: Async<RingSummary[]>;
  ringId: string;
  onRing: (ringId: string) => void;
}

export function HistoryPage({ rings, ringId, onRing }: Props) {
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const games = useAsync(() => api.listHistory({ ringId, search }), [ringId, search]);

  return (
    <section>
      <h1>History</h1>
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Ring">
          {rings.data?.map((ring) => (
            <button key={ring.id} className="tab" role="tab" aria-selected={ring.id === ringId} onClick={() => onRing(ring.id)}>
              {ring.name}
            </button>
          ))}
        </div>
        <input
          className="search"
          type="search"
          aria-label="Search by athlete or game number"
          placeholder="Search athlete or game no."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <Loaded state={games}>
        {(rows) =>
          rows.length === 0 ? (
            <div className="notice">No finished games match.</div>
          ) : (
            <ul className="rows">
              {rows.map((game) => (
                <li key={game.id}>
                  <a className="row" href={`#/history/${game.id}`}>
                  <span className="game">{game.gameNo}</span>
                  <div>
                    <b>
                      {game.athletes.map((a, i) => (
                        <Fragment key={a.name}>
                          {i > 0 && ' vs '}
                          <span className={a.side && `side-${a.side}`}>{a.name}</span>
                        </Fragment>
                      ))}
                    </b>
                    <div className="meta">{game.event}</div>
                  </div>
                  <span className="outcome">{game.outcome}</span>
                  <span className={`pill pill-${game.tag}`}>{game.tag === 'no_show' ? 'No-show' : 'Released'}</span>
                  </a>
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </section>
  );
}
