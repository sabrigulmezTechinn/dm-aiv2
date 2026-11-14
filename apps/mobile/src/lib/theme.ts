import { Platform } from 'react-native';

export const colors = {
  bg: '#15110e',
  surface: '#1f1a16',
  surface2: '#2a231e',
  surface3: '#352c25',
  border: '#43382f',
  text: '#f1e7d6',
  muted: '#a99a86',
  faint: '#76695a',
  gold: '#d6a84c',
  goldDim: '#8a6a2c',
  red: '#c84a3c',
  green: '#6aa86f',
  blue: '#6c94c8',
  teal: '#4fb5a5',
  parchment: '#efe2c4',
};

export const fonts = {
  serif: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' }) as string,
  sans: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }) as string,
};

export const space = (n: number) => n * 4;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

export const CHARACTER_COLORS = ['#c0392b', '#d35400', '#d4a64a', '#27ae60', '#16a085', '#2980b9', '#8e44ad', '#7f8c8d', '#e8e1d0', '#5d4037'];
