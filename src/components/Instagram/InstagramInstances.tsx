import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Modal } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { instagramAPI, InstagramInstance } from '../../services/api';
import { getErrorMessage, logError } from '../../utils/errorHandler';
import { useSocket } from '../../hooks/useSocket';

interface InstagramInstancesProps {
  onStatusUpdate?: (data: { instanceId: string; status: string }) => void;
}

const InstagramInstances: React.FC<InstagramInstancesProps> = ({ onStatusUpdate }) => {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [instances, setInstances] = useState<InstagramInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<InstagramInstance | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const maxInstagram = user?.maxInstagramInstances ?? 0;
  const atInstagramLimit = maxInstagram > 0 && instances.length >= maxInstagram;
  const cannotAddInstagram = maxInstagram === 0 || atInstagramLimit;

  const loadInstances = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await instagramAPI.getInstances();
      setInstances(response.data);
      setError(null);
    } catch (error: unknown) {
      logError('InstagramInstances.loadInstances', error);
      const errorMsg = getErrorMessage(error, 'Erro ao carregar instâncias do Instagram');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const handleInstagramInstanceSocket = useCallback(
    (data: { instanceId: string; status: string }) => {
      if (data.status === 'deleted') {
        setInstances((prev) => prev.filter((inst) => inst.id !== data.instanceId));
        return;
      }
      if (data.status === 'connected') {
        void loadInstances();
        return;
      }
      setInstances((prev) =>
        prev.map((inst) =>
          inst.id === data.instanceId
            ? { ...inst, status: data.status as InstagramInstance['status'] }
            : inst
        )
      );
    },
    [loadInstances]
  );

  useSocket(
    token,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    handleInstagramInstanceSocket
  );

  const handleCreateInstance = async () => {
    try {
      setIsCreating(true);
      setError(null);
      // Criar instância sem nome - será preenchido com username após OAuth
      const response = await instagramAPI.createInstance({});
      const newInstance = response.data;
      setInstances([...instances, newInstance]);
      setSuccessMessage('Instância criada com sucesso');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      // Iniciar OAuth imediatamente após criar
      await handleConnect(newInstance);
    } catch (error: unknown) {
      logError('InstagramInstances.createInstance', error);
      const errorMsg = getErrorMessage(error, 'Erro ao criar instância');
      setError(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnect = async (instance: InstagramInstance) => {
    try {
      const response = await instagramAPI.initiateOAuth(instance.id);
      if (response.data.authUrl) {
        window.location.href = response.data.authUrl;
      }
    } catch (error: unknown) {
      logError('InstagramInstances.connect', error);
      const errorMsg = getErrorMessage(error, 'Erro ao conectar instância');
      setError(errorMsg);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta instância?')) {
      return;
    }

    try {
      await instagramAPI.deleteInstance(id);
      setInstances(instances.filter((inst) => inst.id !== id));
      setSuccessMessage('Instância deletada com sucesso');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      logError('InstagramInstances.deleteInstance', error);
      const errorMsg = getErrorMessage(error, 'Erro ao deletar instância');
      setError(errorMsg);
    }
  };


  const getStatusColor = (status: InstagramInstance['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  const getStatusText = (status: InstagramInstance['status']) => {
    switch (status) {
      case 'created':
        return 'Criada';
      case 'connecting':
        return 'Conectando';
      case 'connected':
        return 'Conectada';
      case 'disconnected':
        return 'Desconectada';
      case 'error':
        return 'Erro';
      default:
        return status;
    }
  };

  return (
    <div>
      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
          {successMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={handleCreateInstance}
          isLoading={isCreating}
          disabled={cannotAddInstagram}
          title={
            maxInstagram === 0
              ? 'Seu plano não inclui conexões Instagram. Faça upgrade para Advance ou PRO.'
              : atInstagramLimit
                ? `Limite do plano atingido (${maxInstagram} conexão(ões)). Faça upgrade para adicionar mais.`
                : undefined
          }
        >
          {isCreating ? t('instagram.creating') : t('instagram.createInstance')}
        </Button>
      </div>

      {isLoading ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
          </div>
        </Card>
      ) : instances.length === 0 ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              Nenhuma instância do Instagram
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Crie uma instância para começar a usar o Instagram no OnlyFlow
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {instances.map((instance) => (
            <Card key={instance.id} padding="lg" shadow="lg" className="hover:shadow-xl transition-shadow duration-200">
              {/* Header com Status e Nome */}
              <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {instance.profilePictureUrl ? (
                      <img
                        src={instance.profilePictureUrl}
                        alt={instance.name || instance.username || 'Instagram'}
                        className="w-[78px] h-[78px] rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          // Fallback caso a imagem não carregue
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-[78px] h-[78px] rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <svg
                          className="w-10 h-10 text-gray-400 dark:text-gray-500"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100 line-clamp-1">
                    {instance.name || instance.username || 'Sem nome'}
                  </h3>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                      instance.status === 'connected'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : instance.status === 'connecting'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      instance.status === 'connected' ? 'bg-green-500' : instance.status === 'connecting' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}></span>
                    {getStatusText(instance.status)}
                  </span>
                </div>
              </div>

              {/* Informações da Instância */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex-shrink-0 w-24 text-gray-500 dark:text-gray-400 font-medium">
                    Internal Name:
                  </div>
                  <div className="flex-1 text-clerky-backendText dark:text-gray-200 min-w-0">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium truncate max-w-full">
                      {instance.instanceName}
                    </span>
                  </div>
                </div>

                {instance.username && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-shrink-0 w-24 text-gray-500 dark:text-gray-400 font-medium">
                      Username:
                    </div>
                    <div className="flex-1 text-clerky-backendText dark:text-gray-200">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                        @{instance.username}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {instance.status !== 'connected' && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleConnect(instance)}
                    className="flex-1 min-w-[100px] text-xs font-medium"
                  >
                    Conectar
                  </Button>
                )}
                {instance.status === 'connecting' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteInstance(instance.id)}
                    className="flex-1 min-w-[100px] text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                  >
                    Deletar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisconnectModal(true)}
                  className="flex-1 min-w-[100px] text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
                >
                  Como desconectar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de instruções para desconectar */}
      <Modal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        title="Como desconectar do Instagram"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Para desconectar sua conta do Instagram do OnlyFlow, siga os passos abaixo:
          </p>
          
          <div className="bg-gray-50 dark:bg-[#091D41] rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-clerky-backendButton text-white flex items-center justify-center text-sm font-medium">
                1
              </span>
              <p className="text-gray-700 dark:text-gray-300">
                Abra o aplicativo do Instagram (Android ou iOS)
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-clerky-backendButton text-white flex items-center justify-center text-sm font-medium">
                2
              </span>
              <p className="text-gray-700 dark:text-gray-300">
                Acesse o seu perfil
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-clerky-backendButton text-white flex items-center justify-center text-sm font-medium">
                3
              </span>
              <p className="text-gray-700 dark:text-gray-300">
                Toque no menu ☰ no canto superior direito
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-clerky-backendButton text-white flex items-center justify-center text-sm font-medium">
                4
              </span>
              <p className="text-gray-700 dark:text-gray-300">
                Vá em <strong>Configurações e privacidade</strong>
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-clerky-backendButton text-white flex items-center justify-center text-sm font-medium">
                5
              </span>
              <p className="text-gray-700 dark:text-gray-300">
                Toque em <strong>Apps e sites</strong>
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-clerky-backendButton text-white flex items-center justify-center text-sm font-medium">
                6
              </span>
              <p className="text-gray-700 dark:text-gray-300">
                Selecione o aplicativo <strong>OnlyFlow-IG</strong>
              </p>
            </div>
            
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-clerky-backendButton text-white flex items-center justify-center text-sm font-medium">
                7
              </span>
              <p className="text-gray-700 dark:text-gray-300">
                Toque em <strong>Remover</strong>
              </p>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Após desconectar pelo Instagram, a instância será automaticamente atualizada no OnlyFlow.
          </p>
        </div>
      </Modal>

    </div>
  );
};

export default InstagramInstances;
