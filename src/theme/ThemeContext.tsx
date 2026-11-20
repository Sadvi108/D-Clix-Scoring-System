import { createContext, useContext, type ReactNode } from 'react';
import { palettes, type Palette, type ThemeName } from './tokens';

type ThemeValue = { name: ThemeName; c: Palette };

const ThemeCtx = createContext<ThemeValue>({ name: 'arena', c: palettes.arena });

/** Wrap a screen to switch palette. Judge screens and the scoreboard use Arena; consoles use Daylight. */
export function ThemeProvider({ name, children }: { name: ThemeName; children: ReactNode }) {
  return <ThemeCtx.Provider value={{ name, c: palettes[name] }}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeCtx);
}
