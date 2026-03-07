import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Modal } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { instanceAPI, Instance, UpdateInstanceSettingsData } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { getErrorMessage, logError } from '../../utils/errorHandler';

// Helper para construir URL pública do QR code
const getPublicQRCodeUrl = (token: string): string => {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:4331/api';
  const baseUrl = apiUrl.replace('/api', '');
  return `${baseUrl}/api/public/qrcode/${token}`;
};

const WhatsAppInstances: React.FC = () => {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const maxWhatsApp = user?.maxWhatsAppInstances ?? 0;
  const atWhatsAppLimit = maxWhatsApp > 0 && instances.length >= maxWhatsApp;

  // Formulário de criação
  const [formData, setFormData] = useState({
    name: '',
    rejectCall: false,
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
  });

  // Formulário de atualização de settings
  const [settingsData, setSettingsData] = useState<UpdateInstanceSettingsData>({
    rejectCall: false,
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    readStatus: false,
    syncFullHistory: true,
  });

  // Callback para atualizar status via WebSocket
  const handleStatusUpdate = useCallback((data: { instanceId: string; status: string }) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === data.instanceId ? { ...inst, status: data.status as Instance['status'] } : inst
      )
    );

    // Fechar modal de QR Code se a instância conectou
    if (data.status === 'connected') {
      setSelectedInstance((currentInstance) => {
        // Verificar se a instância que conectou é a que está no modal
        if (currentInstance?.id === data.instanceId) {
          setShowQRModal(false);
          setSuccessMessage(t('instances.connectedSuccess'));
          setTimeout(() => setSuccessMessage(null), 3000);
          return null;
        }
        return currentInstance;
      });
    }
  }, [t]);

  // Conectar ao WebSocket
  useSocket(token, handleStatusUpdate);

  const loadInstances = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await instanceAPI.getAll();
      setInstances((response.instances || []).filter((i) => i.integration !== 'WHATSAPP-CLOUD'));
      setError(null);
    } catch (error: unknown) {
      logError('WhatsAppInstances.loadInstances', error);
      const errorMsg = getErrorMessage(error, t('error.getInstancesFailed'));
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const handleCreateInstance = async () => {
    try {
      setIsCreating(true);
      setError(null);
      const response = await instanceAPI.create(formData);
      setInstances([...instances, response.instance]);
      setShowCreateModal(false);
      setSuccessMessage(t('instances.createSuccess'));
      setFormData({
        name: '',
        rejectCall: false,
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
      });

      // Se tiver QR code, mostrar modal
      if (response.instance.qrcodeBase64) {
        setSelectedInstance(response.instance);
        setShowQRModal(true);
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      logError('WhatsAppInstances.createInstance', error);
      const errorMsg = getErrorMessage(error, t('error.createInstanceFailed'));
      setError(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateSettings = async () => {
    if (!selectedInstance) return;

    try {
      setIsUpdating(true);
      setError(null);
      await instanceAPI.updateSettings(selectedInstance.id, settingsData);
      await loadInstances(); // Recarregar lista
      setShowSettingsModal(false);
      setSuccessMessage(t('instances.settingsUpdated'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      logError('WhatsAppInstances.updateSettings', error);
      const errorMsg = getErrorMessage(error, t('error.updateSettingsFailed'));
      setError(errorMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!window.confirm(t('instances.deleteConfirm'))) {
      return;
    }

    try {
      await instanceAPI.delete(id);
      setInstances(instances.filter((inst) => inst.id !== id));
      setSuccessMessage(t('instances.deleteSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      logError('WhatsAppInstances.deleteInstance', error);
      const errorMsg = getErrorMessage(error, t('error.deleteInstanceFailed'));
      setError(errorMsg);
    }
  };

  const handleOpenSettings = (instance: Instance) => {
    setSelectedInstance(instance);
    setSettingsData({
      rejectCall: instance.settings.rejectCall,
      groupsIgnore: instance.settings.groupsIgnore,
      alwaysOnline: instance.settings.alwaysOnline,
      readMessages: instance.settings.readMessages,
      readStatus: instance.settings.readStatus,
      syncFullHistory: instance.settings.syncFullHistory,
    });
    setShowSettingsModal(true);
  };

  const getStatusColor = (status: Instance['status']) => {
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

  const getStatusText = (status: Instance['status']) => {
    switch (status) {
      case 'created':
        return t('instances.created');
      case 'connecting':
        return t('instances.connecting');
      case 'connected':
        return t('instances.connected');
      case 'disconnected':
        return t('instances.disconnected');
      case 'error':
        return t('instances.error');
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
          onClick={() => setShowCreateModal(true)}
          disabled={atWhatsAppLimit}
          title={atWhatsAppLimit ? `Limite do plano atingido (${maxWhatsApp} conexão(ões)). Faça upgrade para adicionar mais.` : undefined}
        >
          {t('instances.create')}
        </Button>
      </div>

      {isLoading ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
          </div>
        </Card>
      ) : instances.length === 0 ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instances.noInstances')}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              {t('instances.noInstancesDescription')}
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
                  <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100 flex-1 line-clamp-1">
                    {instance.name}
                  </h3>
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

                {instance.token && (
                  <div className="flex items-start gap-3 text-sm">
                    <div className="flex-shrink-0 w-24 text-gray-500 dark:text-gray-400 font-medium">
                      Token API:
                    </div>
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <code className="flex-1 px-2 py-1 bg-gray-100 dark:bg-[#091D41] text-xs font-mono text-gray-800 dark:text-gray-200 rounded border border-gray-300 dark:border-gray-700 truncate min-w-0">
                        {instance.token}
                      </code>
                      <button
                        onClick={(e) => {
                          navigator.clipboard.writeText(instance.token || '');
                          const btn = e.currentTarget;
                          const originalHTML = btn.innerHTML;
                          btn.innerHTML = '✓';
                          btn.classList.add('text-green-500');
                          setTimeout(() => {
                            btn.innerHTML = originalHTML;
                            btn.classList.remove('text-green-500');
                          }, 2000);
                        }}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors flex-shrink-0"
                        title="Copiar token"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Botões de Ação */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {instance.qrcodeBase64 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedInstance(instance);
                      setShowQRModal(true);
                    }}
                    className="flex-1 min-w-[100px] text-xs font-medium"
                  >
                    {t('instances.qrcode')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenSettings(instance)}
                  className="flex-1 min-w-[100px] text-xs font-medium"
                >
                  {t('instances.settings')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteInstance(instance.id)}
                  className="flex-1 min-w-[100px] text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                >
                  {t('instances.delete')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Criação */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t('instances.createNew')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="instance-name" className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instances.instanceName')}
            </label>
            <input
              id="instance-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('instances.instanceNamePlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              required
              minLength={3}
              maxLength={50}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('instances.instanceNameHelp')}
            </p>
          </div>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.rejectCall}
                onChange={(e) => setFormData({ ...formData, rejectCall: e.target.checked })}
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.rejectCall')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.groupsIgnore}
                onChange={(e) => setFormData({ ...formData, groupsIgnore: e.target.checked })}
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.groupsIgnore')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.alwaysOnline}
                onChange={(e) => setFormData({ ...formData, alwaysOnline: e.target.checked })}
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.alwaysOnline')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.readMessages}
                onChange={(e) => setFormData({ ...formData, readMessages: e.target.checked })}
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.readMessages')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.readStatus}
                onChange={(e) => setFormData({ ...formData, readStatus: e.target.checked })}
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.readStatus')}
              </span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {t('instances.cancel')}
            </Button>
            <Button variant="primary" onClick={handleCreateInstance} isLoading={isCreating}>
              {isCreating ? t('instances.creating') : t('instances.createButton')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de QR Code */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title={t('instances.qrcode')}
        size="sm"
        showCloseButton={true}
      >
        {selectedInstance?.qrcodeBase64 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300 text-center">
              {t('instances.scanQRCode')}
            </p>
            <div className="flex justify-center">
              <img
                src={selectedInstance.qrcodeBase64}
                alt="QR Code"
                className="max-w-full h-auto rounded-lg border-2 border-gray-200 dark:border-gray-700"
              />
            </div>
            
            {/* Link público para compartilhar */}
            {selectedInstance.token && (
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Link público para compartilhar:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getPublicQRCodeUrl(selectedInstance.token!)}
                    className="flex-1 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={(e) => {
                      if (!selectedInstance.token) return;
                      const url = getPublicQRCodeUrl(selectedInstance.token);
                      navigator.clipboard.writeText(url);
                      const btn = e.currentTarget;
                      const originalHTML = btn.innerHTML;
                      btn.innerHTML = '✓';
                      btn.classList.add('text-green-500');
                      setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.classList.remove('text-green-500');
                      }, 2000);
                    }}
                    className="px-3 py-2 bg-clerky-backendButton hover:bg-blue-600 text-white rounded-lg transition-colors flex-shrink-0"
                    title="Copiar link"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Compartilhe este link para que seus clientes possam escanear o QR Code
                </p>
              </div>
            )}
            
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {t('instances.qrCodeAutoClose')}
            </p>
          </div>
        )}
      </Modal>

      {/* Modal de Settings */}
      <Modal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        title={t('instances.updateSettings')}
        size="md"
      >
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsData.rejectCall || false}
                onChange={(e) =>
                  setSettingsData({ ...settingsData, rejectCall: e.target.checked })
                }
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.rejectCall')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsData.groupsIgnore || false}
                onChange={(e) =>
                  setSettingsData({ ...settingsData, groupsIgnore: e.target.checked })
                }
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.groupsIgnore')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsData.alwaysOnline || false}
                onChange={(e) =>
                  setSettingsData({ ...settingsData, alwaysOnline: e.target.checked })
                }
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.alwaysOnline')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsData.readMessages || false}
                onChange={(e) =>
                  setSettingsData({ ...settingsData, readMessages: e.target.checked })
                }
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.readMessages')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsData.readStatus || false}
                onChange={(e) =>
                  setSettingsData({ ...settingsData, readStatus: e.target.checked })
                }
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.readStatus')}
              </span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settingsData.syncFullHistory || false}
                onChange={(e) =>
                  setSettingsData({ ...settingsData, syncFullHistory: e.target.checked })
                }
                className="w-5 h-5 text-clerky-backendButton rounded focus:ring-clerky-backendButton"
              />
              <span className="text-clerky-backendText dark:text-gray-200">
                {t('instances.syncFullHistory')}
              </span>
            </label>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setShowSettingsModal(false)}>
              {t('instances.cancel')}
            </Button>
            <Button variant="primary" onClick={handleUpdateSettings} isLoading={isUpdating}>
              {isUpdating ? t('instances.updating') : t('instances.updateButton')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WhatsAppInstances;
