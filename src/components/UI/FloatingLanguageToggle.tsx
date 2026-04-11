import React from 'react';
import LanguageToggle from './LanguageToggle';

/**
 * Componente para exibir o botão de idioma fixo no canto superior direito
 * Usado nas páginas de login e registro
 */

import ThemeToggle from './ThemeToggle';

const FloatingLanguageToggle: React.FC = () => {
  return (
    <div
      className="fixed z-50 flex flex-row flex-nowrap items-center gap-1.5 sm:gap-2
        top-[max(0.75rem,env(safe-area-inset-top))]
        right-[max(0.75rem,env(safe-area-inset-right))]"
      role="toolbar"
      aria-label="Idioma e tema"
    >
      <LanguageToggle className="!flex-none shrink-0" />
      <ThemeToggle className="!flex-none shrink-0" />
    </div>
  );
};

export default FloatingLanguageToggle;

