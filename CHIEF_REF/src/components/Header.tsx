import type { ReactNode } from 'react';
import { isDemo } from '../api';
import { PAGES, type Page } from '../types';

const LABEL: Record<Page, string> = { rings: 'Rings', history: 'History', rounds: 'Rounds' };

interface Props {
  page: Page;
  online: boolean;
  children: ReactNode;
}

export function Header({ page, online, children }: Props) {
  return (
    <header className="header">
      <span className="brand">CHIEF</span>
      <nav className="nav" aria-label="Chief pages">
        {PAGES.map((p) => (
          <a key={p} href={`#/${p}`} aria-current={p === page ? 'page' : undefined}>
            {LABEL[p]}
          </a>
        ))}
      </nav>
      {isDemo && <span className="demo">Demo data</span>}
      <span className={online ? 'status' : 'status off'} role="status">
        <i className="dot" />
        {online ? 'Online' : 'Offline'}
      </span>
      {children}
    </header>
  );
}
