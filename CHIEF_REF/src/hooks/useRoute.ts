import { useEffect, useState } from 'react';
import { PAGES, type Page } from '../types';

export interface Route {
  page: Page;
  id?: string;
}

function parse(): Route {
  const [page, id] = location.hash.replace(/^#\/?/, '').split('/');
  return { page: PAGES.find((p) => p === page) ?? 'rings', id };
}

/** Hash routing (#/history/g101) keeps the browser back button and deep links working with no server config. */
export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const go = (page: Page) => {
  location.hash = `/${page}`;
};
