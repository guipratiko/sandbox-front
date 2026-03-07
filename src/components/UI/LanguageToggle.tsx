import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-[#091D41] border border-gray-300 dark:border-gray-700 text-clerky-backendText dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-clerky-backendButton dark:hover:border-clerky-backendButton transition-smooth shadow-sm hover:shadow-md flex-1"
      aria-label="Toggle language"
      title={language === 'pt' ? 'Mudar para inglês' : 'Change to Portuguese'}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      <span className="text-sm font-semibold">
        {language === 'pt' ? 'PT' : 'EN'}
      </span>
    </button>
  );
};

export default LanguageToggle;

