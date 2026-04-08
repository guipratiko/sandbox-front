import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { LanguageToggle, ThemeToggle } from '../UI';
import { getUpgradePlanUrl } from '../../config/marketing';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, isCollapsed = false, onToggleCollapse }) => {
  const { logout, user } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isCrmPage = location.pathname === '/crm';
  const showCrmCollapseHint = isCrmPage && !isCollapsed && Boolean(onToggleCollapse);
  
  const handleLanguageToggle = () => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  };

  interface MenuItem {
    path: string;
    key: string;
    icon: React.ReactNode;
    isMobileRestricted?: boolean;
    isPremiumRestricted?: boolean;
    isStartRestricted?: boolean;
    /** Ex.: Disparo Oficial: exige plano com vaga de API Oficial (Advance/Pro). */
    requiresOfficialWhatsAppPlan?: boolean;
  }

  const menuItems: MenuItem[] = [
    { 
      path: '/inicio', 
      key: 'menu.home',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    { 
      path: '/gerenciador-conexoes', 
      key: 'menu.connectionManager',
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      )
    },
    { 
      path: '/disparos', 
      key: 'menu.dispatches',
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      )
    },
    { 
      path: '/disparo-api', 
      key: 'menu.dispatchesOfficial',
      isPremiumRestricted: true,
      requiresOfficialWhatsAppPlan: true,
      icon: (
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      )
    },
    { 
      path: '/crm', 
      key: 'menu.crm',
      isMobileRestricted: true,
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    { 
      path: '/manyflow', 
      key: 'menu.manyFlow',
      isMobileRestricted: true,
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      )
    },
    { 
      path: '/integracao', 
      key: 'menu.integration',
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      path: '/agente-ia', 
      key: 'menu.aiAgent',
      isPremiumRestricted: true,
      isStartRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      path: '/gerenciador-grupos', 
      key: 'menu.groupManager',
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    { 
      path: '/gerenciador-instagram', 
      key: 'menu.instagramManager',
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      path: '/scraping', 
      key: 'menu.scraping',
      isPremiumRestricted: true,
      icon: (
        <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    { 
      path: '/documentacao', 
      key: 'menu.documentation',
      icon: (
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    { 
      path: '/configuracoes', 
      key: 'menu.settings',
      icon: (
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Overlay para mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-40
          ${isCollapsed ? 'w-16 lg:w-16' : 'w-64'} bg-white dark:bg-[#091D41] shadow-lg
          transform transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          flex flex-col
        `}
      >
        {/* Header do Sidebar - Botão Fechar (Mobile) */}
        <div className={`relative flex items-center justify-end ${isCollapsed ? 'px-0' : 'px-4'} h-[72px] border-b border-gray-200 dark:border-gray-700 ${isCollapsed ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-smooth"
            aria-label="Fechar menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} py-6 space-y-1.5 overflow-y-auto`}>
          {menuItems.map((item) => {
            const isMobileRestricted = isMobile && item.isMobileRestricted;
            const isPremiumRestricted = item.isPremiumRestricted && (!user || !user.premiumPlan || user.premiumPlan === 'free');
            const isStartRestricted = item.isStartRestricted && user?.premiumPlan === 'start';
            const isRestricted = isMobileRestricted || isPremiumRestricted || isStartRestricted;
            const isOfficialPlanLocked =
              item.requiresOfficialWhatsAppPlan === true &&
              !isRestricted &&
              (user?.maxOfficialWhatsAppInstances ?? 0) === 0;

            const looksDisabled = isRestricted || isOfficialPlanLocked;
            const dimClass = looksDisabled
              ? isOfficialPlanLocked
                ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
              : '';

            const itemContent = (
              <div
              className={`
                flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3 ${isCollapsed ? 'px-2' : 'px-4'} py-2.5 rounded-lg
                  transition-all duration-200 relative
                ${
                    isActive(item.path) && !looksDisabled
                    ? 'bg-clerky-backendButton text-white shadow-md'
                      : looksDisabled
                      ? dimClass
                    : 'text-clerky-backendText dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm'
                }
              `}
                title={
                  isCollapsed
                    ? isOfficialPlanLocked
                      ? `${t(item.key)} — ${t('menu.officialPlanTooltip')}`
                      : t(item.key)
                    : isMobileRestricted
                    ? t('mobileRestriction.tooltip')
                    : isPremiumRestricted
                    ? t('premium.tooltip')
                    : isStartRestricted
                    ? t('premium.tooltip')
                    : isOfficialPlanLocked
                    ? t('menu.officialPlanTooltip')
                    : ''
                }
            >
              <span className={`flex-shrink-0 ${isActive(item.path) && !looksDisabled ? '[&>svg]:!text-white' : ''}`}>
                {item.icon}
              </span>
              {!isCollapsed && (
                  <>
                <span className="text-sm font-medium flex-1 text-left">{t(item.key)}</span>
                    {isOfficialPlanLocked && (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex-shrink-0">
                        {t('menu.officialPlanBadge')}
                      </span>
                    )}
                    {isMobileRestricted && (
                      <span className="flex-shrink-0" title={t('mobileRestriction.tooltip')}>
                        <svg
                          className="w-4 h-4 text-gray-400 dark:text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        </svg>
                      </span>
                    )}
                    {(isPremiumRestricted || isStartRestricted) && !isMobileRestricted && (
                      <span className="flex-shrink-0" title={t('premium.tooltip')}>
                        <svg
                          className="w-4 h-4 text-gray-400 dark:text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                          />
                        </svg>
                      </span>
                    )}
                  </>
                )}
              </div>
            );

            if (isRestricted) {
              return (
                <div 
                  key={item.path} 
                  onClick={(e) => {
                    e.preventDefault();
                    if ((isPremiumRestricted || isStartRestricted) && !isMobileRestricted) {
                      window.location.href = getUpgradePlanUrl();
                    }
                  }}
                >
                  {itemContent}
                </div>
              );
            }

            if (isOfficialPlanLocked) {
              return (
                <div
                  key={item.path}
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.href = getUpgradePlanUrl();
                  }}
                >
                  {itemContent}
                </div>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
              >
                {itemContent}
            </Link>
            );
          })}
        </nav>

        {/* Footer do Sidebar */}
        {!isCollapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* Botão Recolher Menu (Desktop) */}
            {onToggleCollapse && (
              <div
                className={`relative hidden lg:block ${showCrmCollapseHint ? 'group/crmCollapse' : ''}`}
              >
                {showCrmCollapseHint && (
                  <div
                    role="tooltip"
                    className="pointer-events-none invisible absolute bottom-[calc(100%+10px)] left-[62%] z-[70] w-[min(20.4rem,calc(100vw-1.25rem))] -translate-x-1/2 rounded-xl border border-gray-200/90 bg-white/95 px-4 py-3 text-left text-[13px] leading-snug text-gray-700 opacity-0 shadow-lg backdrop-blur-sm transition-all duration-200 dark:border-gray-600 dark:bg-gray-800/95 dark:text-gray-200 group-hover/crmCollapse:visible group-hover/crmCollapse:opacity-100"
                  >
                    {t('sidebar.collapseCrmTooltip')}
                  </div>
                )}
                <div
                  className={
                    showCrmCollapseHint
                      ? 'animate-crm-collapse-hint rounded-lg ring-2 ring-clerky-backendButton/35 dark:ring-clerky-backendButton/40'
                      : ''
                  }
                >
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className="relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-clerky-backendText shadow-sm transition-smooth hover:border-clerky-backendButton hover:bg-gray-100 hover:shadow-md dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-clerky-backendButton dark:hover:bg-gray-600"
                    aria-label={t('sidebar.collapse')}
                    title={showCrmCollapseHint ? undefined : t('sidebar.collapse')}
                  >
                    {showCrmCollapseHint && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-lg"
                      >
                        <span
                          className="absolute left-0 top-0 h-full w-[65%] min-w-[5.5rem] bg-gradient-to-r from-transparent via-cyan-400/95 to-transparent shadow-[0_0_14px_5px_rgba(34,211,238,0.65),0_0_28px_10px_rgba(59,130,246,0.4),inset_0_0_20px_rgba(165,243,252,0.35)] animate-crm-collapse-glow dark:via-sky-300 dark:shadow-[0_0_16px_6px_rgba(125,211,252,0.55),0_0_32px_12px_rgba(56,189,248,0.35)]"
                        />
                      </span>
                    )}
                    <svg
                      className="relative z-10 h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                    <span className="relative z-10 text-sm font-semibold">{t('sidebar.collapse')}</span>
                  </button>
                </div>
              </div>
            )}
            
            {/* Botões de Ação */}
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
            
            {/* Botão Sair */}
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:border-red-300 dark:hover:border-red-700 transition-smooth shadow-sm hover:shadow-md"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              <span className="font-semibold text-sm">{t('menu.logout')}</span>
            </button>
          </div>
        )}
        
        {/* Footer Recolhido - Apenas ícones */}
        {isCollapsed && (
          <div className="p-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
            {/* Botão Expandir Menu (Desktop quando recolhido) */}
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="mb-2 hidden w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2 text-clerky-backendText shadow-sm transition-smooth hover:border-clerky-backendButton hover:bg-gray-100 hover:shadow-md dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:border-clerky-backendButton dark:hover:bg-gray-600 lg:flex"
                aria-label={t('sidebar.expand')}
                title={t('sidebar.expand')}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
            
            {/* Botões de Tradução e Tema (apenas ícones) */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleLanguageToggle}
                className="w-full flex items-center justify-center p-2 rounded-lg bg-white dark:bg-[#091D41] border border-gray-300 dark:border-gray-700 text-clerky-backendText dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-smooth"
                title={language === 'pt' ? 'Mudar para inglês' : 'Change to Portuguese'}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
              </button>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center p-2 rounded-lg bg-white dark:bg-[#091D41] border border-gray-300 dark:border-gray-700 text-clerky-backendText dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-smooth"
                title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Botão Sair */}
            <button
              onClick={logout}
              className="w-full flex items-center justify-center p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-smooth"
              title={t('menu.logout')}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;

