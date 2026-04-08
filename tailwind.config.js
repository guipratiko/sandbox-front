/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      height: {
        '15': '60px',
        '17': '68px',
        '18': '72px',
        '19': '76px',
        '20': '80px',
      },
      colors: {
        // Paleta de cores baseada no site onlyflow.com.br
        clerky: {
          primary: '#0040FF',      // Azul profundo
          secondary: '#00C0FF',    // Azul vibrante/ciano
          dark: '#000000',         // Preto
          light: '#F5F5F5',        // Cinza claro para backgrounds
          white: '#FFFFFF',
          // Cores do Backend
          backendBg: '#EBF2FD',    // Background do backend
          backendText: '#111D32',  // Textos do backend
          backendButton: '#5B9DFE', // Botões do backend
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      transitionDuration: {
        'default': '300ms',
        'fast': '150ms',
        'slow': '500ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      boxShadow: {
        'soft': '0 2px 15px rgba(0, 64, 255, 0.1)',
        'glow': '0 0 20px rgba(0, 192, 255, 0.3)',
      },
      keyframes: {
        'crm-collapse-hint': {
          '0%, 100%': { transform: 'scale(1) translate3d(0, 0, 0)' },
          '10%': { transform: 'scale(1.04) translate3d(0, 0, 0)' },
          '18%': { transform: 'scale(1.07) translate3d(0, 0, 0)' },
          '24%': { transform: 'scale(1.05) translate3d(-3px, 0, 0)' },
          '30%': { transform: 'scale(1.05) translate3d(3px, 0, 0)' },
          '36%': { transform: 'scale(1.05) translate3d(-2px, 0, 0)' },
          '42%': { transform: 'scale(1.05) translate3d(2px, 0, 0)' },
          '48%': { transform: 'scale(1.02) translate3d(-1px, 0, 0)' },
          '54%': { transform: 'scale(1) translate3d(0, 0, 0)' },
        },
        'crm-collapse-glow': {
          '0%': { transform: 'translateX(-35%)', opacity: '0' },
          '6%': { opacity: '1' },
          '45%': { transform: 'translateX(220%)', opacity: '0.92' },
          '58%': { transform: 'translateX(260%)', opacity: '0' },
          '100%': { transform: 'translateX(260%)', opacity: '0' },
        },
      },
      animation: {
        'crm-collapse-hint': 'crm-collapse-hint 1.5s ease-in-out infinite',
        'crm-collapse-glow': 'crm-collapse-glow 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

