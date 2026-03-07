/**
 * Utilitários compartilhados para funcionalidades de grupos
 */

/**
 * Obtém o label do tipo de movimentação
 */
export const getMovementTypeLabel = (type: string, t: (key: string) => string): string => {
  const labels: Record<string, string> = {
    join: t('groupManager.history.entry'),
    leave: t('groupManager.history.exit'),
    promote: t('groupManager.history.promotes'),
    demote: t('groupManager.history.demotes'),
  };
  return labels[type] || type;
};

/**
 * Obtém o ícone do tipo de movimentação
 */
export const getMovementTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    join: '✅',
    leave: '👋',
    promote: '⬆️',
    demote: '⬇️',
  };
  return icons[type] || '📋';
};
