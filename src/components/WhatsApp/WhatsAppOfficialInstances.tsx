import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Modal } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { instanceAPI, Instance, CreateOfficialInstanceData } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { getErrorMessage, logError } from '../../utils/errorHandler';

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (callback: (r: { authResponse?: { code?: string } }) => void, opts: { config_id: string; response_type: string; override_default_response_type: boolean; extras: object }) => void;
    };
  }
}

const META_APP_ID = process.env.REACT_APP_META_APP_ID || '';
const META_CONFIG_ID = process.env.REACT_APP_META_EMBEDDED_SIGNUP_CONFIG_ID || '';
const OAUTH_CALLBACK_URL = process.env.REACT_APP_OAUTH_WHATSAPP_CALLBACK_URL || window.location.origin + '/oauth/whatsapp/callback';

const WhatsAppOfficialInstances: React.FC = () => {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const pendingSignup = useRef<{ name: string; waba_id?: string; phone_number_id?: string; code?: string; redirect_uri?: string } | null>(null);

  const maxWhatsApp = user?.maxWhatsAppInstances ?? 0;
  const officialOnly = instances.filter((i) => i.integration === 'WHATSAPP-CLOUD');
  const atLimit = maxWhatsApp > 0 && instances.length >= maxWhatsApp;

  const handleStatusUpdate = useCallback((data: { instanceId: string; status: string }) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === data.instanceId ? { ...inst, status: data.status as Instance['status'] } : inst
      )
    );
  }, []);

  useSocket(token, handleStatusUpdate);

  const loadInstances = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await instanceAPI.getAll();
      setInstances(response.instances);
      setError(null);
    } catch (err: unknown) {
      logError('WhatsAppOfficialInstances.loadInstances', err);
      setError(getErrorMessage(err, 'Falha ao carregar instâncias'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const submitPendingOfficial = useCallback(async () => {
    const p = pendingSignup.current;
    if (!p || !p.name || !p.waba_id || !p.phone_number_id) return;
    try {
      setIsCreating(true);
      setError(null);
      const data: CreateOfficialInstanceData = {
        name: p.name.trim(),
        waba_id: p.waba_id,
        phone_number_id: p.phone_number_id,
      };
      if (p.code && p.redirect_uri) {
        data.code = p.code;
        data.redirect_uri = p.redirect_uri;
      }
      const response = await instanceAPI.createOfficial(data);
      setInstances((prev) => [...prev, response.instance]);
      setShowCreateModal(false);
      setCreateName('');
      setSuccessMessage('Instância oficial criada com sucesso.');
      setTimeout(() => setSuccessMessage(null), 3000);
      pendingSignup.current = null;
      await loadInstances();
    } catch (err: unknown) {
      logError('WhatsAppOfficialInstances.createOfficial', err);
      setError(getErrorMessage(err, 'Falha ao criar instância oficial'));
    } finally {
      setIsCreating(false);
    }
  }, [loadInstances]);


  useEffect(() => {
    if (!META_APP_ID || typeof window.FB === 'undefined') return;
    window.FB.init({
      appId: META_APP_ID,
      autoLogAppEvents: true,
      xfbml: true,
      version: 'v25.0',
    });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event === 'FINISH' && data.data?.phone_number_id && data.data?.waba_id) {
          const name = pendingSignup.current?.name || 'WhatsApp Oficial';
          if (!pendingSignup.current) pendingSignup.current = { name };
          pendingSignup.current.waba_id = data.data.waba_id;
          pendingSignup.current.phone_number_id = data.data.phone_number_id;
          submitPendingOfficial();
        } else if (data.event === 'ERROR') {
          setError(data.data?.error_message || 'Erro no cadastro incorporado');
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [submitPendingOfficial]);

  const launchEmbeddedSignup = () => {
    const name = createName.trim() || 'WhatsApp Oficial';
    pendingSignup.current = { name };
    if (typeof window.FB === 'undefined') {
      setError('SDK do Facebook não carregado. Recarregue a página.');
      return;
    }
    window.FB.login(
      (response) => {
        if (response.authResponse?.code && pendingSignup.current) {
          pendingSignup.current.code = response.authResponse.code;
          pendingSignup.current.redirect_uri = OAUTH_CALLBACK_URL;
        }
      },
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { version: 'v3', setup: {} },
      }
    );
  };

  const handleDeleteInstance = async (id: string) => {
    if (!window.confirm('Excluir esta instância oficial?')) return;
    try {
      await instanceAPI.delete(id);
      setInstances((prev) => prev.filter((inst) => inst.id !== id));
      setSuccessMessage('Instância excluída.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Falha ao excluir'));
    }
  };

  const getStatusText = (status: Instance['status']) => {
    switch (status) {
      case 'connected': return 'Conectada';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectada';
      case 'error': return 'Erro';
      default: return status;
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
          onClick={() => { setCreateName(''); setShowCreateModal(true); setError(null); }}
          disabled={atLimit}
        >
          Conectar número (API Oficial)
        </Button>
      </div>

      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setCreateName(''); pendingSignup.current = null; }}
          title="Conectar WhatsApp (API Oficial)"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da instância</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ex: Atendimento"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ao clicar em Conectar, será aberta a janela do Facebook para vincular seu número ao OnlyFlow.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={launchEmbeddedSignup} disabled={isCreating}>
                {isCreating ? 'Conectando...' : 'Conectar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
          </div>
        </Card>
      ) : officialOnly.length === 0 ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              Nenhuma instância da API Oficial
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Conecte um número pelo botão acima para usar a WhatsApp Cloud API (Meta).
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {officialOnly.map((instance) => (
            <Card key={instance.id} padding="lg" shadow="lg" className="hover:shadow-xl transition-shadow">
              <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100 truncate">
                    {instance.name}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    instance.status === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {getStatusText(instance.status)}
                  </span>
                </div>
              </div>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">Internal Name:</span>
                  <span className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium truncate">
                    {instance.instanceName}
                  </span>
                </div>
                {instance.token && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">Token API:</span>
                    <code className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs font-mono rounded truncate">
                      {instance.token}
                    </code>
                  </div>
                )}
                {(instance.display_phone_number || instance.connectionLink) && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">Link:</span>
                    <a
                      href={instance.connectionLink || `https://wa.me/${(instance.display_phone_number || '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-clerky-backendButton hover:underline truncate"
                    >
                      {instance.display_phone_number || instance.connectionLink}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setSelectedInstance(instance); setShowSettingsModal(true); }}>
                  Configurações
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDeleteInstance(instance.id)}>
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showSettingsModal && selectedInstance && (
        <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Configurações">
          <p className="text-gray-600 dark:text-gray-400">
            Instância: {selectedInstance.name}. Ajustes avançados podem ser feitos no Backend.
          </p>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowSettingsModal(false)}>Fechar</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WhatsAppOfficialInstances;
