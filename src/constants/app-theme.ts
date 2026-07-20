import { Platform } from 'react-native';

/**
 * Marilab Mover Visual System 1.2
 * A calm, premium operational interface: deep navy identity, cyan highlights,
 * warm off-white canvases and compact high-contrast information cards.
 */
export const palette = {
  brand: '#0B5578',
  brandDark: '#082E43',
  brandDeep: '#051F30',
  brandBright: '#08A7D4',
  brandGlow: '#42D3EE',
  brandSoft: '#DDF3F9',
  brandMist: '#F0FAFC',
  accent: '#19B8A3',
  accentSoft: '#DDF7F2',
  background: '#EEF3F5',
  backgroundWarm: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceElevated: '#FBFDFD',
  surfaceMuted: '#E5EDF0',
  text: '#102A38',
  textStrong: '#071F2C',
  textMuted: '#647985',
  border: '#D7E2E6',
  success: '#16845C',
  successSoft: '#E1F4EC',
  warning: '#BD7600',
  warningSoft: '#FFF1D2',
  danger: '#C64255',
  dangerSoft: '#FBE8EC',
  info: '#167DB5',
  infoSoft: '#E2F1FA',
  violet: '#665AC6',
  violetSoft: '#ECEAFF',
  teal: '#0F8177',
  tealSoft: '#DCF5F1',
  coral: '#E06A5C',
  coralSoft: '#FFF0ED',
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#082E43',
};

export const gradients = {
  brand: [palette.brandBright, palette.brand, palette.brandDark] as const,
  brandDeep: [palette.brand, palette.brandDeep] as const,
  aqua: ['#0BA7D4', '#0A6F91'] as const,
  calm: ['#F7FBFC', '#EDF4F6'] as const,
  login: ['#061F30', '#0B5578', '#08A7D4'] as const,
};

export const typography = {
  display: Platform.select({
    ios: 'Futura',
    android: 'sans-serif-medium',
    web: 'Futura, "Avenir Next", "Century Gothic", Arial, sans-serif',
    default: 'sans-serif',
  }),
  body: Platform.select({
    ios: 'Avenir Next',
    android: 'sans-serif',
    web: '"Avenir Next", Inter, Arial, sans-serif',
    default: 'sans-serif',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    default: 'monospace',
  }),
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

export const radius = {
  sm: 10,
  md: 15,
  lg: 20,
  xl: 26,
  xxl: 32,
  pill: 999,
};
