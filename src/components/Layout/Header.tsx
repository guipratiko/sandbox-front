import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const logoSrc = theme === 'dark' ? '/OnlyFlow-logo.png' : '/OnlyFlow-logo-claro.png';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-[#091D41] border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
      {/* Logo e Botões de Menu */}
      <div className="flex items-center gap-2">
        {/* Logo */}
        <div className="flex items-center justify-center">
          <img src={logoSrc} alt="OnlyFlow" className="h-10 w-auto" />
        </div>
        
        {/* Botão Menu Mobile */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-clerky-backendText dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-smooth"
          aria-label="Menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Spacer para mobile */}
      <div className="lg:hidden" />

      {/* Direita: User Info */}
      <div className="flex items-center gap-3 ml-auto">
        {/* User Info */}
        <div className="hidden sm:flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-clerky-backendText dark:text-gray-200">
              {user?.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
          </div>
          {user?.profilePicture ? (
            <img
              src={user.profilePicture}
              alt={user?.name || 'User'}
              className="w-10 h-10 rounded-full object-cover border-2 border-clerky-backendButton"
            />
          ) : (
          <div className="w-10 h-10 rounded-full bg-clerky-backendButton flex items-center justify-center text-white font-semibold">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

