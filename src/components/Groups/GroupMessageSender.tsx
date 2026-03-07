import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input } from '../UI';
import { groupAPI, Group } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { getErrorMessage, logError } from '../../utils/errorHandler';
import GroupMessageTemplateForm from './GroupMessageTemplateForm';

interface GroupMessageTemplate {
  id: string;
  name: string;
  messageType: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
  contentJson: Record<string, any>;
}

interface ScheduledMessage {
  id: string;
  instanceId: string;
  messageType: string;
  targetType: 'all' | 'specific';
  groupIds: string[];
  scheduledAt: string;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';
  createdAt: string;
}

interface GroupMessageSenderProps {
  instanceId: string;
  groups: Group[];
}

const GroupMessageSender: React.FC<GroupMessageSenderProps> = ({ instanceId, groups }) => {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<GroupMessageTemplate[]>([]);
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  
  // Estados do formulário
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [messageType, setMessageType] = useState<'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio'>('text');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [contentJson, setContentJson] = useState<Record<string, any>>({});
  const [scheduledAt, setScheduledAt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    if (instanceId) {
      loadTemplates();
      loadScheduledMessages();
    }
  }, [instanceId]);

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const response = await groupAPI.getMessageTemplates(instanceId);
      setTemplates(response.data || []);
    } catch (error: unknown) {
      logError('Erro ao carregar templates', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadScheduledMessages = async () => {
    try {
      setIsLoadingScheduled(true);
      const response = await groupAPI.getScheduledGroupMessages(instanceId);
      setScheduledMessages(response.data || []);
    } catch (error: unknown) {
      logError('Erro ao carregar mensagens agendadas', error);
    } finally {
      setIsLoadingScheduled(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplateId(templateId);
      setMessageType(template.messageType);
      setContentJson(template.contentJson);
    }
  };

  const handleSendNow = async () => {
    if (!validateForm()) return;

    try {
      setIsSending(true);
      setError(null);

      const response = await groupAPI.sendGroupMessageNow({
        instanceId,
        messageType,
        contentJson,
        targetType,
        groupIds: targetType === 'all' ? groups.map(g => g.id) : Array.from(selectedGroupIds),
        templateId: selectedTemplateId || undefined,
      });

      // Verificar resultados do envio
      const results = response.data?.results || [];
      const successCount = results.filter((r: any) => r.success).length;
      const failCount = results.filter((r: any) => !r.success).length;
      const totalCount = results.length;

      if (totalCount === 0) {
        setError('Nenhuma mensagem foi enviada. Verifique se há grupos disponíveis.');
      } else if (failCount === 0) {
        setSuccessMessage(`Mensagem enviada com sucesso para ${successCount} grupo(s)!`);
        handleCloseModals();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else if (successCount === 0) {
        // Todas falharam
        const errorDetails = results
          .filter((r: any) => !r.success)
          .map((r: any) => r.error || 'Erro desconhecido')
          .join('; ');
        setError(`Falha ao enviar mensagem para todos os grupos. Erros: ${errorDetails}`);
      } else {
        // Algumas falharam
        const errorDetails = results
          .filter((r: any) => !r.success)
          .map((r: any) => r.error || 'Erro desconhecido')
          .join('; ');
        setError(
          `Mensagem enviada para ${successCount} grupo(s), mas falhou para ${failCount} grupo(s). Erros: ${errorDetails}`
        );
        handleCloseModals();
      }
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao enviar mensagem');
      setError(errorMessage);
      logError('Erro ao enviar mensagem', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!validateForm()) return;
    if (!scheduledAt) {
      setError('Selecione uma data e hora para o agendamento');
      return;
    }

    try {
      setIsScheduling(true);
      setError(null);

      await groupAPI.scheduleGroupMessage({
        instanceId,
        messageType,
        contentJson,
        targetType,
        groupIds: targetType === 'all' ? groups.map(g => g.id) : Array.from(selectedGroupIds),
        templateId: selectedTemplateId || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });

      setSuccessMessage('Mensagem agendada com sucesso!');
      handleCloseModals();
      await loadScheduledMessages();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao agendar mensagem');
      setError(errorMessage);
      logError('Erro ao agendar mensagem', error);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }

    try {
      setError(null);
      await groupAPI.cancelScheduledGroupMessage(id);
      setSuccessMessage('Agendamento cancelado com sucesso!');
      await loadScheduledMessages();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao cancelar agendamento');
      setError(errorMessage);
      logError('Erro ao cancelar agendamento', error);
    }
  };

  const validateForm = (): boolean => {
    if (Object.keys(contentJson).length === 0) {
      setError('Configure o conteúdo da mensagem');
      return false;
    }
    if (targetType === 'specific' && selectedGroupIds.size === 0) {
      setError('Selecione pelo menos um grupo');
      return false;
    }
    return true;
  };

  const handleCloseModals = () => {
    setShowSendModal(false);
    setShowScheduleModal(false);
    setSelectedTemplateId('');
    setMessageType('text');
    setTargetType('all');
    setSelectedGroupIds(new Set());
    setContentJson({});
    setScheduledAt('');
  };

  const getMessageTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      text: t('groupManager.templates.types.text'),
      media: t('groupManager.templates.types.media'),
      poll: t('groupManager.templates.types.poll'),
      contact: t('groupManager.templates.types.contact'),
      location: t('groupManager.templates.types.location'),
      audio: t('groupManager.templates.types.audio'),
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      scheduled: t('groupManager.sendMessages.status.scheduled'),
      processing: t('groupManager.sendMessages.status.processing'),
      sent: t('groupManager.sendMessages.status.sent'),
      failed: t('groupManager.sendMessages.status.failed'),
      cancelled: t('groupManager.sendMessages.status.cancelled'),
    };
    return labels[status] || status;
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
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

      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200">
            {t('groupManager.sendMessages.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('groupManager.sendMessages.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={() => setShowSendModal(true)}>
            {t('groupManager.sendMessages.sendNow')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowScheduleModal(true)}>
            {t('groupManager.sendMessages.schedule')}
          </Button>
        </div>
      </div>

      {/* Mensagens Agendadas */}
      <Card padding="md">
        <h4 className="font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
          {t('groupManager.sendMessages.scheduledTitle')}
        </h4>
        {isLoadingScheduled ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            {t('groupManager.loading')}
          </div>
        ) : scheduledMessages.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            {t('groupManager.sendMessages.noScheduled')}
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledMessages.map((msg) => (
              <div
                key={msg.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#091D41] rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                      {getMessageTypeLabel(msg.messageType)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      msg.status === 'scheduled' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      msg.status === 'sent' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      msg.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                    }`}>
                      {getStatusLabel(msg.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {msg.targetType === 'all' 
                      ? t('groupManager.sendMessages.allGroups')
                      : t('groupManager.sendMessages.specificGroups', { count: msg.groupIds.length.toString() })
                    }
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {t('groupManager.sendMessages.scheduledFor')}: {formatDateTime(msg.scheduledAt)}
                  </p>
                </div>
                {msg.status === 'scheduled' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelScheduled(msg.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    {t('groupManager.sendMessages.cancel')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de Enviar Agora */}
      <Modal
        isOpen={showSendModal}
        onClose={handleCloseModals}
        title={t('groupManager.sendMessages.sendNowTitle')}
        size="lg"
      >
        <SendMessageForm
          templates={templates}
          groups={groups}
          selectedTemplateId={selectedTemplateId}
          onTemplateSelect={handleTemplateSelect}
          messageType={messageType}
          onMessageTypeChange={setMessageType}
          targetType={targetType}
          onTargetTypeChange={setTargetType}
          selectedGroupIds={selectedGroupIds}
          onSelectedGroupIdsChange={setSelectedGroupIds}
          contentJson={contentJson}
          onContentJsonChange={setContentJson}
          onSubmit={handleSendNow}
          onCancel={handleCloseModals}
          isSubmitting={isSending}
          submitLabel={t('groupManager.sendMessages.send')}
        />
      </Modal>

      {/* Modal de Agendar */}
      <Modal
        isOpen={showScheduleModal}
        onClose={handleCloseModals}
        title={t('groupManager.sendMessages.scheduleTitle')}
        size="lg"
      >
        <SendMessageForm
          templates={templates}
          groups={groups}
          selectedTemplateId={selectedTemplateId}
          onTemplateSelect={handleTemplateSelect}
          messageType={messageType}
          onMessageTypeChange={setMessageType}
          targetType={targetType}
          onTargetTypeChange={setTargetType}
          selectedGroupIds={selectedGroupIds}
          onSelectedGroupIdsChange={setSelectedGroupIds}
          contentJson={contentJson}
          onContentJsonChange={setContentJson}
          scheduledAt={scheduledAt}
          onScheduledAtChange={setScheduledAt}
          onSubmit={handleSchedule}
          onCancel={handleCloseModals}
          isSubmitting={isScheduling}
          submitLabel={t('groupManager.sendMessages.schedule')}
        />
      </Modal>
    </div>
  );
};

interface SendMessageFormProps {
  templates: GroupMessageTemplate[];
  groups: Group[];
  selectedTemplateId: string;
  onTemplateSelect: (id: string) => void;
  messageType: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
  onMessageTypeChange: (type: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio') => void;
  targetType: 'all' | 'specific';
  onTargetTypeChange: (type: 'all' | 'specific') => void;
  selectedGroupIds: Set<string>;
  onSelectedGroupIdsChange: (ids: Set<string>) => void;
  contentJson: Record<string, any>;
  onContentJsonChange: (json: Record<string, any>) => void;
  scheduledAt?: string;
  onScheduledAtChange?: (date: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  submitLabel: string;
}

const SendMessageForm: React.FC<SendMessageFormProps> = ({
  templates,
  groups,
  selectedTemplateId,
  onTemplateSelect,
  messageType,
  onMessageTypeChange,
  targetType,
  onTargetTypeChange,
  selectedGroupIds,
  onSelectedGroupIdsChange,
  contentJson,
  onContentJsonChange,
  scheduledAt,
  onScheduledAtChange,
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel,
}) => {
  const { t } = useLanguage();

  const handleGroupToggle = (groupId: string) => {
    const newSet = new Set(selectedGroupIds);
    if (newSet.has(groupId)) {
      newSet.delete(groupId);
    } else {
      newSet.add(groupId);
    }
    onSelectedGroupIdsChange(newSet);
  };

  const handleSelectAllGroups = () => {
    if (selectedGroupIds.size === groups.length) {
      onSelectedGroupIdsChange(new Set());
    } else {
      onSelectedGroupIdsChange(new Set(groups.map((g) => g.id)));
    }
  };

  return (
    <div className="space-y-4">
      {/* Seletor de Template */}
      {templates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.sendMessages.selectTemplate')}
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => onTemplateSelect(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            <option value="">{t('groupManager.sendMessages.noTemplate')}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({t(`groupManager.templates.types.${template.messageType}`)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tipo de Mensagem */}
      {!selectedTemplateId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.sendMessages.messageType')} *
          </label>
          <select
            value={messageType}
            onChange={(e) => {
              onMessageTypeChange(e.target.value as any);
              onContentJsonChange({});
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            <option value="text">{t('groupManager.templates.types.text')}</option>
            <option value="media">{t('groupManager.templates.types.media')}</option>
            <option value="poll">{t('groupManager.templates.types.poll')}</option>
            <option value="contact">{t('groupManager.templates.types.contact')}</option>
            <option value="location">{t('groupManager.templates.types.location')}</option>
            <option value="audio">{t('groupManager.templates.types.audio')}</option>
          </select>
        </div>
      )}

      {/* Conteúdo */}
      {!selectedTemplateId && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.sendMessages.content')} *
          </label>
          <GroupMessageTemplateForm
            messageType={messageType}
            contentJson={contentJson}
            onContentChange={onContentJsonChange}
          />
        </div>
      )}

      {/* Tipo de Destino */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('groupManager.sendMessages.targetType')} *
        </label>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer text-gray-800 dark:text-gray-200">
            <input
              type="radio"
              value="all"
              checked={targetType === 'all'}
              onChange={(e) => onTargetTypeChange(e.target.value as 'all' | 'specific')}
              className="mr-2"
            />
            {t('groupManager.sendMessages.allGroups')}
          </label>
          <label className="flex items-center cursor-pointer text-gray-800 dark:text-gray-200">
            <input
              type="radio"
              value="specific"
              checked={targetType === 'specific'}
              onChange={(e) => onTargetTypeChange(e.target.value as 'all' | 'specific')}
              className="mr-2"
            />
            {t('groupManager.sendMessages.specificGroups')}
          </label>
        </div>
      </div>

      {/* Seleção de Grupos */}
      {targetType === 'specific' && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('groupManager.sendMessages.selectGroups')} *
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAllGroups}
            >
              {selectedGroupIds.size === groups.length
                ? t('groupManager.sendMessages.deselectAll')
                : t('groupManager.sendMessages.selectAll')
              }
            </Button>
          </div>
          <div className="max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-2 space-y-2">
            {groups.map((group) => (
              <label key={group.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedGroupIds.has(group.id)}
                  onChange={() => handleGroupToggle(group.id)}
                  className="mr-2"
                />
                <span className="text-sm text-clerky-backendText dark:text-gray-200">
                  {group.name || group.id}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Data/Hora de Agendamento */}
      {scheduledAt !== undefined && onScheduledAtChange && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.sendMessages.scheduledAt')} *
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => onScheduledAtChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            min={new Date().toISOString().slice(0, 16)}
          />
        </div>
      )}

      {/* Botões */}
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('groupManager.cancel')}
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? t('groupManager.sendMessages.sending') : submitLabel}
        </Button>
      </div>
    </div>
  );
};

export default GroupMessageSender;
