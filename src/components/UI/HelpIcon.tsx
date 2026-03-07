import React, { useState } from 'react';
import Modal from './Modal';
import { useLanguage } from '../../contexts/LanguageContext';

interface HelpIconProps {
  helpKey: string; // Chave da tradução para o conteúdo da ajuda
  className?: string;
}

const HelpIcon: React.FC<HelpIconProps> = ({ helpKey, className = '' }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const helpContent = t(`${helpKey}.help`);
  const helpTitle = t(`${helpKey}.title`) || t('help.title');

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 shadow-sm hover:shadow ${className}`}
        aria-label={t('help.openHelp')}
        title={t('help.openHelp')}
      >
        <svg
          className="w-3 h-3 md:w-4 md:h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={helpTitle}
        size="lg"
      >
        <div className="prose dark:prose-invert max-w-none">
          <div className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
            {helpContent}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default HelpIcon;

