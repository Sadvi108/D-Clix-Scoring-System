import { useState } from 'react';
import { displayUrl } from '../api';
import type { Account } from '../types';

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'bn', label: 'বাংলা' },
  { id: 'ko', label: '한국어' },
];

interface Props {
  account?: Account;
  swapped: boolean;
  onSwap: () => void;
  lang: string;
  onLang: (lang: string) => void;
  onSignOut: () => void;
}

export function AccountMenu({ account, swapped, onSwap, lang, onLang, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const initials = account?.name.split(' ').map((w) => w[0]).join('').slice(0, 2) ?? '…';

  return (
    <div className="menu-wrap" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <button className="btn avatar" aria-label="Account and settings" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)}>
        {initials}
      </button>
      {open && (
        <>
          <div className="scrim" onClick={() => setOpen(false)} />
          <div className="menu" id="account-menu" role="dialog" aria-label="Account and settings">
            <div className="menu-row">
              <span><b>{account?.name}</b><br /><span className="meta">{account?.role}</span></span>
            </div>
            <div className="menu-row">
              <span>Swap sides (this device)</span>
              <button className="btn" aria-pressed={swapped} onClick={onSwap}>{swapped ? 'On' : 'Off'}</button>
            </div>
            <label className="menu-row">
              Language
              <select className="select" value={lang} onChange={(e) => onLang(e.target.value)}>
                {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            {displayUrl && (
              <div className="menu-row">
                <span>Venue display</span>
                <a className="btn btn-primary" href={displayUrl} target="_blank" rel="noreferrer">Open TV</a>
              </div>
            )}
            <button className="btn btn-danger" onClick={onSignOut}>Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
