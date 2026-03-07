/**
 * Sistema de Design Global - OnlyFlow
 * Baseado na paleta de cores do site clerky.com.br
 */

export const theme = {
  colors: {
    primary: '#0040FF',      // Azul profundo
    secondary: '#00C0FF',    // Azul vibrante/ciano
    dark: '#000000',         // Preto
    light: '#F5F5F5',        // Cinza claro
    white: '#FFFFFF',
    // Cores do Backend
    backend: {
      bg: '#EBF2FD',         // Background do backend
      text: '#111D32',       // Textos do backend
      button: '#5B9DFE',     // Botões do backend
    },
    // Cores de estado
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#3B82F6',
  },
  fonts: {
    primary: "'Inter', system-ui, -apple-system, sans-serif",
    weights: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },
  transitions: {
    default: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },
  shadows: {
    soft: '0 2px 15px rgba(0, 64, 255, 0.1)',
    glow: '0 0 20px rgba(0, 192, 255, 0.3)',
    medium: '0 4px 20px rgba(0, 64, 255, 0.15)',
    large: '0 8px 30px rgba(0, 64, 255, 0.2)',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    '2xl': '4rem',
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

export type Theme = typeof theme;

