import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../UI';

interface AdminRouteProps {
  children: React.ReactElement;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    // Se não for admin e não estiver carregando, redirecionar
    if (!isLoading && user && !user.admin) {
      const timer = setTimeout(() => {
        navigate('/inicio');
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

  if (!user || !user.admin) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)] p-4">
        <Card className="text-center p-8 max-w-md w-full">
          <div className="text-red-500 dark:text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
            Acesso Negado
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Esta página é exclusiva para administradores.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Redirecionando...
          </p>
        </Card>
      </div>
    );
  }

  return children;
};

export default AdminRoute;

