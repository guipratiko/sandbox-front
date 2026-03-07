import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../UI';

interface PremiumRouteProps {
  children: React.ReactElement;
}

const PremiumRoute: React.FC<PremiumRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    // Se não for premium e não estiver carregando, redirecionar após um pequeno delay
    if (!isLoading && user && (!user.premiumPlan || user.premiumPlan === 'free')) {
      const timer = setTimeout(() => {
        window.location.href = 'https://clerky.com.br/#precos';
      }, 2000); // Redirecionar após 2 segundos

      return () => clearTimeout(timer);
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clerky-backendBg dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
          <p className="text-clerky-backendText dark:text-gray-200">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user || !user.premiumPlan || user.premiumPlan === 'free') {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <Card className="text-center p-8 max-w-md w-full">
          <div className="text-clerky-backendButton dark:text-clerky-secondary mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('premium.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {t('premium.message')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {t('premium.redirecting')}
          </p>
        </Card>
      </div>
    );
  }

  return children;
};

export default PremiumRoute;

