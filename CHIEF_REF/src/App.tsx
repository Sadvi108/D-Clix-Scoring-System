import { useEffect, useState } from 'react';
import { api } from './api';
import { AccountMenu } from './components/AccountMenu';
import { Header } from './components/Header';
import { useAsync } from './hooks/useAsync';
import { go, useRoute } from './hooks/useRoute';
import { HistoryDetailPage } from './pages/HistoryDetailPage';
import { HistoryPage } from './pages/HistoryPage';
import { RingsPage } from './pages/RingsPage';
import { RoundsPage } from './pages/RoundsPage';

export default function App() {
  const route = useRoute();
  const [ringId, setRingId] = useState('A');
  const [swapped, setSwapped] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem('lang') ?? 'en');
  const [signedOut, setSignedOut] = useState(false);
  const rings = useAsync(api.listRings, [], 3000);
  const account = useAsync(api.getAccount, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
  }, [lang]);

  const openRing = (id: string) => {
    setRingId(id);
    go('history');
  };

  return (
    <>
      <Header page={route.page} online={!rings.error}>
        <AccountMenu
          account={account.data}
          swapped={swapped}
          onSwap={() => setSwapped(!swapped)}
          lang={lang}
          onLang={setLang}
          onSignOut={() => api.signOut().then(() => setSignedOut(true))}
        />
      </Header>
      <main className="main">
        {signedOut ? (
          <div className="notice">
            You've signed out.
            <button className="btn btn-primary" onClick={() => setSignedOut(false)}>Sign in again</button>
          </div>
        ) : route.page === 'rings' ? (
          <RingsPage rings={rings} onOpen={openRing} />
        ) : route.page === 'rounds' ? (
          <RoundsPage />
        ) : route.id ? (
          <HistoryDetailPage id={route.id} swapped={swapped} />
        ) : (
          <HistoryPage rings={rings} ringId={ringId} onRing={setRingId} />
        )}
      </main>
    </>
  );
}
