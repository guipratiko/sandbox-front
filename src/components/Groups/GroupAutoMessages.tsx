import React, { useState, useEffect } from 'react';
import { Card, Button, Modal } from '../UI';
import { groupAPI } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { getErrorMessage, logError } from '../../utils/errorHandler';

interface GroupAutoMessage {
  id: string;
  userId: string;
  instanceId: string;
  groupId: string | null;
  isActive: boolean;
  messageType: 'welcome' | 'goodbye';
  messageText: string;
  delaySeconds: number;
  createdAt: string;
  updatedAt: string;
}

interface GroupAutoMessagesProps {
  instanceId: string;
  groupId?: string | null; // Se fornecido, mostra apenas mensagens deste grupo
  groupName?: string;
  onClose?: () => void;
}

const GroupAutoMessages: React.FC<GroupAutoMessagesProps> = ({
  instanceId,
  groupId = null,
  groupName,
  onClose,
}) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<GroupAutoMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingMessage, setEditingMessage] = useState<GroupAutoMessage | null>(null);
  const [formMessageType, setFormMessageType] = useState<'welcome' | 'goodbye'>('welcome');
  const [formMessageText, setFormMessageText] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formDelaySeconds, setFormDelaySeconds] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (instanceId) {
      loadMessages();
    }
  }, [instanceId]);

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await groupAPI.getAutoMessages(instanceId);
      
      // Filtrar por grupo se fornecido
      let filtered = response.data;
      if (groupId !== null) {
        filtered = response.data.filter((msg) => msg.groupId === groupId);
      } else {
        // Se não há groupId, mostrar apenas mensagens globais (groupId === null)
        filtered = response.data.filter((msg) => msg.groupId === null);
      }
      
      setMessages(filtered);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao carregar mensagens automáticas');
      setError(errorMessage);
      logError('Erro ao carregar mensagens automáticas', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = (type: 'welcome' | 'goodbye') => {
    setFormMessageType(type);
    setFormMessageText('');
    setFormIsActive(true);
    setFormDelaySeconds(0);
    setEditingMessage(null);
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (message: GroupAutoMessage) => {
    setEditingMessage(message);
    setFormMessageType(message.messageType);
    setFormMessageText(message.messageText);
    setFormIsActive(message.isActive);
    setFormDelaySeconds(message.delaySeconds || 0);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingMessage(null);
    setFormMessageText('');
    setFormDelaySeconds(0);
  };

  const handleSave = async () => {
    if (!formMessageText.trim()) {
      setError('O texto da mensagem é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      if (editingMessage) {
        await groupAPI.updateAutoMessage(editingMessage.id, {
          messageText: formMessageText.trim(),
          isActive: formIsActive,
          delaySeconds: formDelaySeconds,
        });
        setSuccessMessage('Mensagem automática atualizada com sucesso!');
      } else {
        await groupAPI.upsertAutoMessage({
          instanceId,
          groupId: groupId || null,
          messageType: formMessageType,
          messageText: formMessageText.trim(),
          isActive: formIsActive,
          delaySeconds: formDelaySeconds,
        });
        setSuccessMessage('Mensagem automática criada com sucesso!');
      }

      handleCloseModal();
      await loadMessages();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao salvar mensagem automática');
      setError(errorMessage);
      logError('Erro ao salvar mensagem automática', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta mensagem automática?')) {
      return;
    }

    try {
      setError(null);
      await groupAPI.deleteAutoMessage(id);
      setSuccessMessage('Mensagem automática deletada com sucesso!');
      await loadMessages();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao deletar mensagem automática');
      setError(errorMessage);
      logError('Erro ao deletar mensagem automática', error);
    }
  };

  const handleToggleActive = async (message: GroupAutoMessage) => {
    try {
      setError(null);
      await groupAPI.updateAutoMessage(message.id, {
        isActive: !message.isActive,
      });
      await loadMessages();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao atualizar mensagem automática');
      setError(errorMessage);
      logError('Erro ao atualizar mensagem automática', error);
    }
  };

  const handleReplaceGroupMessages = async () => {
    if (!window.confirm('Tem certeza que deseja substituir as mensagens automáticas de todos os grupos pelas mensagens globais? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await groupAPI.replaceGroupAutoMessages(instanceId);
      setSuccessMessage('Mensagens automáticas substituídas com sucesso em todos os grupos!');
      await loadMessages();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao substituir mensagens automáticas');
      setError(errorMessage);
      logError('Erro ao substituir mensagens automáticas', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtrar mensagens por tipo
  const welcomeMessages = messages.filter((msg) => msg.messageType === 'welcome');
  const goodbyeMessages = messages.filter((msg) => msg.messageType === 'goodbye');

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 text-green-700 dark:text-green-400 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {/* Cabeçalho - só mostra se não estiver dentro de um modal (onClose indica que está em modal) */}
      {!onClose && (
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200">
              {groupId ? t('groupManager.autoMessages.title', { groupName: groupName || '' }) : t('groupManager.autoMessages.global')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('groupManager.autoMessages.description')}
            </p>
          </div>
          {!groupId && (welcomeMessages.length > 0 || goodbyeMessages.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReplaceGroupMessages}
              disabled={isSaving}
            >
              {isSaving ? t('groupManager.autoMessages.replacing') : t('groupManager.autoMessages.replaceGroups')}
            </Button>
          )}
        </div>
      )}

      {/* Mensagens de Boas-vindas */}
      <Card padding="md">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-semibold text-clerky-backendText dark:text-gray-200">
            {t('groupManager.autoMessages.welcome')}
          </h4>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenCreateModal('welcome')}
          >
            {welcomeMessages.length > 0 ? t('groupManager.autoMessages.edit') : t('groupManager.autoMessages.create')}
          </Button>
        </div>

        {welcomeMessages.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <p className="mb-2">{t('groupManager.autoMessages.noWelcome')}</p>
            <Button variant="outline" size="sm" onClick={() => handleOpenCreateModal('welcome')}>
              {t('groupManager.autoMessages.createMessage')}
            </Button>
          </div>
        ) : (
          welcomeMessages.map((message) => (
            <div key={message.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    message.isActive
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {message.isActive ? t('groupManager.autoMessages.activeLabel') : t('groupManager.autoMessages.inactiveLabel')}
                  </span>
                  {message.delaySeconds > 0 && (
                    <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded">
                      Delay: {message.delaySeconds}s
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(message)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {message.isActive ? t('groupManager.autoMessages.deactivate') : t('groupManager.autoMessages.activate')}
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(message)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t('groupManager.autoMessages.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(message.id)}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    {t('groupManager.autoMessages.delete')}
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {message.messageText}
              </p>
            </div>
          ))
        )}
      </Card>

      {/* Mensagens de Despedida */}
      <Card padding="md">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-semibold text-clerky-backendText dark:text-gray-200">
            {t('groupManager.autoMessages.goodbye')}
          </h4>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenCreateModal('goodbye')}
          >
            {goodbyeMessages.length > 0 ? t('groupManager.autoMessages.edit') : t('groupManager.autoMessages.create')}
          </Button>
        </div>

        {goodbyeMessages.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <p className="mb-2">{t('groupManager.autoMessages.noGoodbye')}</p>
            <Button variant="outline" size="sm" onClick={() => handleOpenCreateModal('goodbye')}>
              {t('groupManager.autoMessages.createMessage')}
            </Button>
          </div>
        ) : (
          goodbyeMessages.map((message) => (
            <div key={message.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-3">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 text-xs rounded ${
                    message.isActive
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}>
                    {message.isActive ? t('groupManager.autoMessages.activeLabel') : t('groupManager.autoMessages.inactiveLabel')}
                  </span>
                  {message.delaySeconds > 0 && (
                    <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded">
                      Delay: {message.delaySeconds}s
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(message)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {message.isActive ? t('groupManager.autoMessages.deactivate') : t('groupManager.autoMessages.activate')}
                  </button>
                  <button
                    onClick={() => handleOpenEditModal(message)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {t('groupManager.autoMessages.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(message.id)}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    {t('groupManager.autoMessages.delete')}
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {message.messageText}
              </p>
            </div>
          ))
        )}
      </Card>

      {/* Modal de Criar/Editar */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        title={editingMessage ? 'Editar Mensagem Automática' : 'Criar Mensagem Automática'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Tipo de mensagem só aparece ao editar ou quando não há tipo específico definido */}
          {editingMessage && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo de Mensagem
              </label>
              <select
                value={formMessageType}
                onChange={(e) => setFormMessageType(e.target.value as 'welcome' | 'goodbye')}
                disabled={!!editingMessage}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              >
                <option value="welcome">Boas-vindas (ao entrar no grupo)</option>
                <option value="goodbye">Despedida (ao sair do grupo)</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Texto da Mensagem
            </label>
            <textarea
              value={formMessageText}
              onChange={(e) => setFormMessageText(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              rows={5}
              placeholder="Digite a mensagem aqui."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Delay antes de enviar (segundos)
            </label>
            <input
              type="number"
              min="0"
              max="300"
              value={formDelaySeconds}
              onChange={(e) => setFormDelaySeconds(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              placeholder="0"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Tempo de espera em segundos antes de enviar a mensagem automática (0-300 segundos)
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="w-4 h-4 text-clerky-backendButton border-gray-300 rounded focus:ring-clerky-backendButton"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Mensagem ativa</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={handleCloseModal} disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving || !formMessageText.trim()}>
              {isSaving ? 'Salvando...' : editingMessage ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GroupAutoMessages;
