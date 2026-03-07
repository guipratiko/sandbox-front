import React from 'react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useLanguage } from '../../contexts/LanguageContext';
import { Card } from '../UI';

interface MobileRestrictedRouteProps {
  children: React.ReactElement;
}

/**
 * Componente que bloqueia acesso a rotas específicas em dispositivos móveis
 * Mostra uma mensagem informativa ao invés de redirecionar
 */
const MobileRestrictedRoute: React.FC<MobileRestrictedRouteProps> = ({ children }) => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();

  if (isMobile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clerky-backendBg dark:bg-gray-900 p-4">
        <Card className="max-w-md w-full text-center">
          <div className="p-6">
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto text-clerky-backendButton"
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
            </div>
            <h2 className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-3">
              Funcionalidade não disponível
            </h2>
            <p className="text-clerky-backendText dark:text-gray-300 mb-4">
              Esta funcionalidade não está disponível em dispositivos móveis. Acesse pelo computador.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Para uma melhor experiência, utilize um dispositivo desktop ou tablet com largura mínima de 768px.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return children;
};

export default MobileRestrictedRoute;

