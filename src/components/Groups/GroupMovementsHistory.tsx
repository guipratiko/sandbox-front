import React, { useState, useEffect } from 'react';
import { Card, Button } from '../UI';
import { groupAPI, Group } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { getErrorMessage, logError } from '../../utils/errorHandler';
import { formatDateTime } from '../../utils/dateFormatters';
import { getMovementTypeLabel, getMovementTypeIcon } from '../../utils/groupUtils';
import * as XLSX from 'xlsx';

interface GroupMovement {
  id: string;
  userId: string;
  instanceId: string;
  groupId: string;
  groupName: string | null;
  participantId: string;
  participantPhone: string | null;
  participantName: string | null;
  movementType: 'join' | 'leave' | 'promote' | 'demote';
  isAdmin: boolean;
  actionBy: string | null;
  actionByPhone: string | null;
  actionByName: string | null;
  createdAt: string;
}

interface GroupMovementsHistoryProps {
  instanceId: string;
  groupId?: string;
  groupName?: string;
  onClose?: () => void;
}

const GroupMovementsHistory: React.FC<GroupMovementsHistoryProps> = ({
  instanceId,
  groupId,
  groupName,
  onClose,
}) => {
  const { t, language } = useLanguage();
  const [movements, setMovements] = useState<GroupMovement[]>([]);
  const [statistics, setStatistics] = useState<{
    totalJoins: number;
    totalLeaves: number;
    totalPromotes: number;
    totalDemotes: number;
    uniqueParticipants: number;
    uniqueGroups: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filters, setFilters] = useState<{
    movementType?: 'join' | 'leave' | 'promote' | 'demote';
    groupId?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  useEffect(() => {
    if (instanceId) {
      loadGroups();
      loadMovements();
      loadStatistics();
    }
  }, [instanceId, groupId, page, filters]);

  const loadGroups = async () => {
    try {
      const response = await groupAPI.getAll(instanceId);
      setGroups(response.groups || []);
    } catch (error: unknown) {
      logError('Erro ao carregar grupos', error);
    }
  };

  const loadMovements = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await groupAPI.getMovements({
        instanceId,
        groupId: filters.groupId || groupId,
        movementType: filters.movementType,
        startDate: filters.startDate,
        endDate: filters.endDate,
        page,
        limit: 50,
      });
      
      setMovements(response.data.movements);
      setTotal(response.data.total);
      setHasMore(response.data.hasMore);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao carregar histórico de movimentações');
      setError(errorMessage);
      logError('Erro ao carregar histórico de movimentações', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await groupAPI.getMovementsStatistics({
        instanceId,
        groupId: filters.groupId || groupId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      setStatistics(response.data);
    } catch (error: unknown) {
      logError('Erro ao carregar estatísticas', error);
    }
  };



  const handleDownload = async () => {
    try {
      // Buscar todos os movimentos fazendo múltiplas requisições paginadas
      let allMovements: any[] = [];
      let currentPage = 1;
      let hasMore = true;
      const limit = 100; // Limite máximo permitido pelo backend

      while (hasMore) {
        const response = await groupAPI.getMovements({
          instanceId,
          groupId: filters.groupId || groupId,
          movementType: filters.movementType,
          startDate: filters.startDate,
          endDate: filters.endDate,
          page: currentPage,
          limit: limit,
        });

        allMovements = [...allMovements, ...response.data.movements];
        hasMore = response.data.hasMore;
        currentPage++;
      }

      const data = allMovements.map((movement) => ({
        'Tipo': getMovementTypeLabel(movement.movementType, t),
        'Grupo': movement.groupName || movement.groupId,
        'Participante': movement.participantName || movement.participantPhone || 'N/A',
        'Telefone': movement.participantPhone || 'N/A',
        'É Admin': movement.isAdmin ? 'Sim' : 'Não',
        'Ação por': movement.actionByName || movement.actionByPhone || 'N/A',
        'Data': formatDateTime(movement.createdAt, language),
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações');
      
      const fileName = `historico_movimentacoes_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error: unknown) {
      logError('Erro ao fazer download do histórico', error);
      alert('Erro ao fazer download do histórico');
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200">
            {groupId ? t('groupManager.history.title', { groupName: groupName || '' }) : t('groupManager.history')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('groupManager.history.description')}
          </p>
        </div>
        {!groupId && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownload}
          >
              {t('groupManager.history.download')}
          </Button>
        )}
      </div>

      {/* Estatísticas */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
                {statistics.totalJoins}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('groupManager.history.entries')}</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
                {statistics.totalLeaves}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('groupManager.history.leaves')}</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
                {statistics.totalPromotes}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('groupManager.history.promotes')}</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
                {statistics.totalDemotes}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('groupManager.history.demotes')}</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
                {statistics.uniqueParticipants}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('groupManager.history.participants')}</div>
            </div>
          </Card>
          <Card padding="sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
                {statistics.uniqueGroups}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{t('groupManager.history.groups')}</div>
            </div>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <Card padding="md">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {!groupId && (
            <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.history.group')}
            </label>
              <select
                value={filters.groupId || ''}
                onChange={(e) => setFilters({ ...filters, groupId: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-sm"
              >
                <option value="">{t('groupManager.history.all')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name || group.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.history.movementType')}
            </label>
            <select
              value={filters.movementType || ''}
              onChange={(e) => setFilters({ ...filters, movementType: e.target.value as any || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-sm"
            >
              <option value="">{t('groupManager.history.all')}</option>
              <option value="join">{t('groupManager.history.entry')}</option>
              <option value="leave">{t('groupManager.history.exit')}</option>
              <option value="promote">{t('groupManager.history.promotes')}</option>
              <option value="demote">{t('groupManager.history.demotes')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.history.startDate')}
            </label>
            <input
              type="date"
              value={filters.startDate || ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.history.endDate')}
            </label>
            <input
              type="date"
              value={filters.endDate || ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-sm"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilters({});
                setPage(1);
              }}
              className="w-full"
            >
              {t('groupManager.history.clearFilters')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Lista de Movimentações */}
      <Card padding="md">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Carregando...</div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            Nenhuma movimentação encontrada
          </div>
        ) : (
          <div className="space-y-3">
            {movements.map((movement) => (
              <div
                key={movement.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getMovementTypeIcon(movement.movementType)}</span>
                      <span className="font-semibold text-clerky-backendText dark:text-gray-200">
                        {getMovementTypeLabel(movement.movementType, t)}
                      </span>
                      {movement.isAdmin && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                      <p>
                        <span className="font-medium">{t('groupManager.history.participant')}:</span>{' '}
                        {movement.participantName || movement.participantPhone || movement.participantId}
                      </p>
                      {movement.groupName && (
                        <p>
                          <span className="font-medium">{t('groupManager.history.group')}:</span> {movement.groupName}
                        </p>
                      )}
                      {movement.actionByName && (
                        <p>
                          <span className="font-medium">Ação realizada por:</span> {movement.actionByName}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(movement.createdAt, language)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginação */}
        {!isLoading && movements.length > 0 && (
          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Página {page} de {Math.ceil(total / 50)} • Total: {total} movimentações
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default GroupMovementsHistory;
