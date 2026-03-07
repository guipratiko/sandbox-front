import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { instagramAPI, InstagramReport, InstagramStatistics, InstagramInstance } from '../../services/api';
import { getErrorMessage, logError } from '../../utils/errorHandler';

interface InstagramReportsProps {
  instanceId?: string;
}

const InstagramReports: React.FC<InstagramReportsProps> = ({ instanceId }) => {
  const { t } = useLanguage();
  const [reports, setReports] = useState<InstagramReport[]>([]);
  const [instances, setInstances] = useState<InstagramInstance[]>([]);
  const [statistics, setStatistics] = useState<InstagramStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    instanceId: instanceId || '',
    interactionType: '' as '' | 'dm' | 'comment',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentInstanceId = instanceId || filters.instanceId || undefined;
      const [instancesRes, reportsRes, statsRes] = await Promise.all([
        instagramAPI.getInstances(),
        instagramAPI.getReports({
          instanceId: currentInstanceId,
          interactionType: filters.interactionType || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          page: pagination.page,
          limit: pagination.limit,
        }),
        instagramAPI.getStatistics({
          instanceId: currentInstanceId,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        }),
      ]);
      setInstances(instancesRes.data);
      setReports(reportsRes.data);
      setPagination(reportsRes.pagination);
      setStatistics(statsRes.data);
      setError(null);
    } catch (error: unknown) {
      logError('InstagramReports.loadData', error);
      const errorMsg = getErrorMessage(error, 'Erro ao carregar relatórios');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, filters, pagination.page, pagination.limit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const currentInstanceId = instanceId || filters.instanceId || undefined;
      const blob = await instagramAPI.exportReports({
        instanceId: currentInstanceId,
        interactionType: filters.interactionType || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `instagram-reports-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: unknown) {
      logError('InstagramReports.export', error);
      const errorMsg = getErrorMessage(error, 'Erro ao exportar relatórios');
      setError(errorMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('pt-BR');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Estatísticas */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card padding="md" shadow="md">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('instagram.totalInteractions')}</div>
            <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
              {statistics.totalInteractions}
            </div>
          </Card>
          <Card padding="md" shadow="md">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('instagram.directMessages')}</div>
            <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
              {statistics.totalDMs}
            </div>
          </Card>
          <Card padding="md" shadow="md">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('instagram.comments')}</div>
            <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
              {statistics.totalComments}
            </div>
          </Card>
          <Card padding="md" shadow="md">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('instagram.sentResponses')}</div>
            <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
              {statistics.successfulResponses}
            </div>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card padding="lg" shadow="lg" className="mb-6">
        <div className={`grid ${instanceId ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4'} gap-4`}>
          {!instanceId && (
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Instância
              </label>
              <select
                value={filters.instanceId}
                onChange={(e) => {
                  setFilters({ ...filters, instanceId: e.target.value });
                  setPagination({ ...pagination, page: 1 });
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              >
                <option value="">Todas</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instagram.type')}
            </label>
            <select
              value={filters.interactionType}
              onChange={(e) => {
                setFilters({ ...filters, interactionType: e.target.value as '' | 'dm' | 'comment' });
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            >
              <option value="">{t('instagram.all')}</option>
              <option value="dm">{t('instagram.directMessage')}</option>
              <option value="comment">{t('instagram.comment')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instagram.initialDate')}
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => {
                setFilters({ ...filters, startDate: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instagram.finalDate')}
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => {
                setFilters({ ...filters, endDate: e.target.value });
                setPagination({ ...pagination, page: 1 });
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            />
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={handleExport} isLoading={isExporting}>
            {isExporting ? t('instagram.exporting') : t('instagram.exportCSV')}
          </Button>
        </div>
      </Card>

      {/* Lista de Relatórios */}
      {isLoading ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">{t('common.loading')}</p>
          </div>
        </Card>
      ) : reports.length === 0 ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instagram.noReports')}
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              {t('instagram.noReportsDescription')}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <Card padding="lg" shadow="lg">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.reportDateTime')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.reportType')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.reportUsername')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.reportInteraction')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.reportResponse')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.reportStatus')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(report.timestamp)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {report.interactionType === 'dm' ? t('instagram.directMessage') : t('instagram.comment')}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        @{report.username}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {report.interactionText}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                        {report.responseText || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            report.responseStatus
                          )}`}
                        >
                          {report.responseStatus === 'sent'
                            ? t('instagram.statusSent')
                            : report.responseStatus === 'failed'
                            ? t('instagram.statusFailed')
                            : t('instagram.statusPending')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Paginação */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Página {pagination.page} de {pagination.totalPages} ({pagination.total} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                  disabled={pagination.page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InstagramReports;
