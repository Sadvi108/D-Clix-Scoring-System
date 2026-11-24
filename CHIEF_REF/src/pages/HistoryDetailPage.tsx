import { api } from '../api';
import { Loaded } from '../components/Loaded';
import { useAsync } from '../hooks/useAsync';

const SIDE_LABEL = { blue: 'Chung', red: 'Hong' };

interface Props {
  id: string;
  swapped: boolean;
}

export function HistoryDetailPage({ id, swapped }: Props) {
  const detail = useAsync(() => api.getHistoryDetail(id), [id]);

  return (
    <section>
      <Loaded state={detail}>
        {(d) => {
          const entries = swapped ? [...d.entries].reverse() : d.entries;
          return (
            <>
              <div className="detail-head">
                <a className="btn" href="#/history">‹ History</a>
                <div className="detail-title">
                  <h1>{d.gameNo} · {d.entries.map((e) => e.name).join(' vs ')}</h1>
                  <p className="meta">{d.event}</p>
                </div>
                <span className={`pill pill-${d.tag}`}>{d.tag === 'no_show' ? 'No-show' : 'Released'}</span>
              </div>
              <div className="entries">
                {entries.map((e) => (
                  <article key={e.name} className={e.side ? `card entry-${e.side}` : 'card'}>
                    <h2 className={e.side && `side-${e.side}`}>
                      {e.side && `${SIDE_LABEL[e.side]} · `}{e.name}
                    </h2>
                    <p className="meta">{e.rank ? `Rank ${e.rank}` : 'No rank'}</p>
                    <p className="result">{e.result}</p>
                    {e.judges.length > 0 && (
                      <table className="fig">
                        <thead>
                          <tr><th>Judge</th><th>Acc</th><th>Pres</th><th>Total</th></tr>
                        </thead>
                        <tbody>
                          {e.judges.map((j) => (
                            <tr key={j.judge} className={j.trimmed ? 'out' : undefined}>
                              <td>{j.judge}{j.trimmed && ' (trimmed)'}</td>
                              <td>{j.accuracy}</td>
                              <td>{j.presentation}</td>
                              <td><b>{j.total}</b></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </article>
                ))}
              </div>
              <h2 className="section-title">Audit trail</h2>
              <ul className="card audit">
                {d.audit.map((a) => (
                  <li key={a.time + a.text}><time>{a.time}</time><span>{a.text}</span></li>
                ))}
              </ul>
            </>
          );
        }}
      </Loaded>
    </section>
  );
}
