// D-Clix Scoring System design tokens, ported 1:1 from the design system (tokens.json).
// Arena = dark (judge devices, TV). Daylight = light (officials' consoles).

export type ThemeName = 'arena' | 'daylight';

const arena = {
  ground: '#0b0e13',
  surface: '#141920',
  surfaceRaised: '#1c232d',
  surfaceSunken: '#07090c',
  hairline: '#283140',
  controlBorder: '#66748a',
  ink: '#eef1f5',
  inkMuted: '#9aa5b4',
  chung: '#2459e8',
  chungDeep: '#12389f',
  chungSoft: '#13254f',
  chungText: '#8db0ff',
  onChung: '#ffffff',
  hong: '#d42a3a',
  hongDeep: '#8c1520',
  hongSoft: '#3d1218',
  hongText: '#ff8f98',
  onHong: '#ffffff',
  gold: '#f5c04a',
  goldSoft: '#33280f',
  goldText: '#f5c04a',
  onGold: '#1a1405',
  ok: '#3dd9b0',
  okSoft: '#0f2e28',
  okText: '#6fe8c6',
  onOk: '#04241b',
  alert: '#ff7a59',
  alertSoft: '#3a1a12',
  alertText: '#ff9c82',
  focus: '#ffd66b',
  scrim: 'rgba(4, 6, 9, 0.72)',
};

export type Palette = typeof arena;

const daylight: Palette = {
  ground: '#f4f1ea',
  surface: '#ffffff',
  surfaceRaised: '#faf8f3',
  surfaceSunken: '#e8e3d8',
  hairline: '#ddd6c8',
  controlBorder: '#8c8372',
  ink: '#151a21',
  inkMuted: '#5a6170',
  chung: '#2459e8',
  chungDeep: '#163fae',
  chungSoft: '#e3ebff',
  chungText: '#1d47c2',
  onChung: '#ffffff',
  hong: '#d42a3a',
  hongDeep: '#9c1a26',
  hongSoft: '#fde4e6',
  hongText: '#b01e2c',
  onHong: '#ffffff',
  gold: '#f2b533',
  goldSoft: '#fbefd0',
  goldText: '#7d5300',
  onGold: '#1a1405',
  ok: '#0b7a5a',
  okSoft: '#ddf3eb',
  okText: '#0a6b4f',
  onOk: '#ffffff',
  alert: '#c2410c',
  alertSoft: '#fde6dc',
  alertText: '#a8360a',
  focus: '#1d47c2',
  scrim: 'rgba(21, 26, 33, 0.45)',
};

export const palettes: Record<ThemeName, Palette> = { arena, daylight };

export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64 } as const;
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 } as const;
export const size = {
  targetMin: 56,
  keyMajor: 176,
  keyMinor: 120,
  keyMajorCompact: 128,
  keyMinorCompact: 88,
  barHeight: 64,
  barHeightCompact: 48,
} as const;

// Font family names are the keys registered with useFonts in the root layout.
export const fonts = {
  display: 'SairaCondensed_700Bold',
  displayHeavy: 'SairaCondensed_800ExtraBold',
  displaySemi: 'SairaCondensed_600SemiBold',
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemi: 'IBMPlexSans_600SemiBold',
  sansBold: 'IBMPlexSans_700Bold',
  mono: 'IBMPlexMono_400Regular',
} as const;

// Type scale from the design system (fontSize / lineHeight).
export const type = {
  scoreHero: { fontFamily: fonts.display, fontSize: 64, lineHeight: 62 },
  scoreXl: { fontFamily: fonts.display, fontSize: 48, lineHeight: 48 },
  scoreLg: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34 },
  scoreMd: { fontFamily: fonts.displaySemi, fontSize: 24, lineHeight: 28 },
  title: { fontFamily: fonts.sansBold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.sansSemi, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.sansSemi, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.sansBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
} as const;
