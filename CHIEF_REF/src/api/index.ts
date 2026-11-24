import type { ChiefApi } from '../types';
import { httpApi } from './http';
import { mockApi } from './mock';

const baseUrl = import.meta.env.VITE_API_URL as string | undefined;

export const isDemo = !baseUrl;
export const api: ChiefApi = baseUrl ? httpApi(baseUrl) : mockApi;
/** Venue display (TV) address; the menu link is hidden when unset. */
export const displayUrl = import.meta.env.VITE_DISPLAY_URL as string | undefined;
