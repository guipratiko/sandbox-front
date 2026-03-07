import React from 'react';
import LanguageToggle from './LanguageToggle';

/**
 * Componente para exibir o botão de idioma fixo no canto superior direito
 * Usado nas páginas de login e registro
 */

import ThemeToggle from './ThemeToggle';

const FloatingLanguageToggle: React.FC = () => {
  return (
    <div className="fixed top-4 right-4 z-50 flex gap-2">
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
};

export default FloatingLanguageToggle;

