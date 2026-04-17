import React, { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { instanceAPI, groupFlowAPI, type Instance } from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';

const GroupFlow: React.FC = () => {
  const { t } = useLanguage();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [selectedInstanceName, setSelectedInstanceName] = useState('');
  const [connectedOnly, setConnectedOnly] = useState(true);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const loadInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      setError(null);
      const res = await instanceAPI.getAll();
      const list = res.instances || [];
      setInstances(list);
      const filtered = connectedOnly ? list.filter((i) => i.status === 'connected') : list;
      const preferred = filtered[0] ?? list[0];
      if (preferred?.instanceName) {
        setSelectedInstanceName((prev) => (prev && filtered.some((i) => i.instanceName === prev) ? prev : preferred.instanceName));
      } else {
        setSelectedInstanceName('');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingInstances(false);
    }
  }, [connectedOnly, t]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const visibleInstances = connectedOnly ? instances.filter((i) => i.status === 'connected') : instances;

  const handleQuery = async () => {
    if (!selectedInstanceName.trim()) {
      setError(t('groupFlow.noInstances'));
      return;
    }
    try {
      setLoadingQuery(true);
      setError(null);
      setResult(null);
      const data = await groupFlowAPI.getGroups(selectedInstanceName.trim());
      setResult(data);
    } catch (e: unknown) {
      setResult(null);
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingQuery(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card padding="lg" shadow="md">
          <h1 className="text-xl font-semibold text-clerky-backendText dark:text-gray-100 mb-2">
            {t('groupFlow.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{t('groupFlow.helpIntro')}</p>

          {loadingInstances ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupFlow.loadingInstances')}</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('groupFlow.noInstances')}</p>
          ) : visibleInstances.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('groupFlow.noneConnected')}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="groupflow-instance"
                    className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1"
                  >
                    {t('groupFlow.selectInstance')}
                  </label>
                  <select
                    id="groupflow-instance"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-clerky-backendText dark:text-gray-100 px-3 py-2 text-sm"
                    value={selectedInstanceName}
                    onChange={(e) => setSelectedInstanceName(e.target.value)}
                  >
                    {visibleInstances.map((inst) => (
                      <option key={inst.id} value={inst.instanceName}>
                        {inst.name} — {inst.instanceName} ({inst.status})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{t('groupFlow.selectHint')}</p>
                </div>
                <Button type="button" variant="primary" onClick={handleQuery} disabled={loadingQuery}>
                  {loadingQuery ? t('groupFlow.loading') : t('groupFlow.queryButton')}
                </Button>
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={connectedOnly}
                  onChange={(e) => setConnectedOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {t('groupFlow.onlyConnected')}
              </label>
            </div>
          )}

          {error && (
            <div
              className="mt-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              role="alert"
            >
              <strong className="font-semibold">{t('groupFlow.error')}: </strong>
              {error}
            </div>
          )}
        </Card>

        {result !== null && (
          <Card padding="lg" shadow="md">
            <h2 className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('groupFlow.apiResult')}
            </h2>
            <pre className="text-xs overflow-x-auto rounded-lg bg-gray-50 dark:bg-gray-900/80 p-4 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
              {JSON.stringify(result, null, 2)}
            </pre>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default GroupFlow;
