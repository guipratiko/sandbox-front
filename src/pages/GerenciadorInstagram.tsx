import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { instagramAPI, InstagramInstance } from '../services/api';
import InstagramAutomations from '../components/Instagram/InstagramAutomations';
import InstagramReports from '../components/Instagram/InstagramReports';
import { getErrorMessage, logError } from '../utils/errorHandler';

const GerenciadorInstagram: React.FC = () => {
  const { t } = useLanguage();
  const [instances, setInstances] = useState<InstagramInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'automations' | 'reports'>('automations');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInstances = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await instagramAPI.getInstances();
      setInstances(response.data);
      setError(null);
    } catch (error: unknown) {
      logError('GerenciadorInstagram.loadInstances', error);
      const errorMsg = getErrorMessage(error, 'Erro ao carregar instâncias');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Atualizar selectedInstanceId quando instances carregarem e não houver seleção
  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances]);

  return (
    <AppLayout>
      <div className="animate-fadeIn max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('instagram.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
            {t('instagram.subtitle')}
            <HelpIcon helpKey="instagram" className="ml-1" />
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {/* Seletor de Instância */}
        <div className="mb-6">
          <Card padding="md" shadow="md">
            <div className="flex items-center gap-4">
              <label htmlFor="instance-select" className="text-sm font-medium text-clerky-backendText dark:text-gray-200 whitespace-nowrap">
                {t('instagram.instance')}
              </label>
              <select
                id="instance-select"
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                disabled={isLoading || instances.length === 0}
              >
                {isLoading ? (
                  <option value="">{t('common.loading')}</option>
                ) : instances.length === 0 ? (
                  <option value="">{t('instagram.noInstances')}</option>
                ) : (
                  <>
                    <option value="">{t('instagram.selectInstance')}</option>
                    {instances.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.name} {instance.username && `(@${instance.username})`}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('automations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'automations'
                  ? 'border-clerky-backendButton text-clerky-backendButton'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('instagram.automations')}
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'reports'
                  ? 'border-clerky-backendButton text-clerky-backendButton'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {t('instagram.reports')}
            </button>
          </nav>
        </div>

        {/* Conteúdo das Tabs */}
        {selectedInstanceId ? (
          <>
            {activeTab === 'automations' && (
              <div>
                <InstagramAutomations instanceId={selectedInstanceId} />
              </div>
            )}
            {activeTab === 'reports' && (
              <div>
                <InstagramReports instanceId={selectedInstanceId} />
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instagram.selectInstance')}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              {t('instagram.selectInstanceDescription')}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GerenciadorInstagram;
