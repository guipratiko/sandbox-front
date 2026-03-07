import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

// Mapeamento de rotas para chaves de tradução
const routeTitleMap: Record<string, string> = {
  '/': 'login.title',
  '/login': 'login.title',
  '/signup': 'signup.title',
  '/forgot-password': 'forgotPassword.title',
  '/reset-password': 'resetPassword.title',
  '/inicio': 'dashboard.title',
  '/gerenciador-conexoes': 'menu.connectionManager',
  '/disparos': 'menu.dispatches',
  '/crm': 'menu.crm',
  '/mindflow': 'menu.mindFlow',
  '/integracao': 'menu.integration',
  '/agente-ia': 'menu.aiAgent',
  '/documentacao': 'menu.documentation',
  '/configuracoes': 'menu.settings',
  '/gerenciador-grupos': 'menu.groupManager',
  '/gerenciador-instagram': 'menu.instagramManager',
  '/scraping': 'menu.scraping',
  '/excluir-conta': 'deleteAccount.title',
};

export const usePageTitle = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    const route = location.pathname;
    const titleKey = routeTitleMap[route] || 'common.appName';
    const pageTitle = t(titleKey);
    document.title = `OnlyFlow - ${pageTitle}`;
  }, [location.pathname, t]);
};

