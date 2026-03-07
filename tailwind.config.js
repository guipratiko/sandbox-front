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
        // Paleta de cores baseada no site clerky.com.br
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
    },
  },
  plugins: [],
}

