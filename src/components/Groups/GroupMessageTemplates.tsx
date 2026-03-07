import React, { useState, useEffect } from 'react';
import { Card, Button, Modal, Input } from '../UI';
import { groupAPI } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { getErrorMessage, logError } from '../../utils/errorHandler';
import GroupMessageTemplateForm from './GroupMessageTemplateForm';

interface GroupMessageTemplate {
  id: string;
  userId: string;
  instanceId: string;
  name: string;
  description?: string | null;
  messageType: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
  contentJson: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface GroupMessageTemplatesProps {
  instanceId: string;
}

const GroupMessageTemplates: React.FC<GroupMessageTemplatesProps> = ({ instanceId }) => {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<GroupMessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GroupMessageTemplate | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formMessageType, setFormMessageType] = useState<'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio'>('text');
  const [formContentJson, setFormContentJson] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (instanceId) {
      loadTemplates();
    }
  }, [instanceId]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await groupAPI.getMessageTemplates(instanceId);
      setTemplates(response.data || []);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao carregar templates');
      setError(errorMessage);
      logError('Erro ao carregar templates', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormMessageType('text');
    setFormContentJson({ text: '' });
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (template: GroupMessageTemplate) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormDescription(template.description || '');
    setFormMessageType(template.messageType);
    setFormContentJson(template.contentJson);
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormMessageType('text');
    setFormContentJson({});
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

  const handleSave = async () => {
    if (!formName.trim()) {
      setError('O nome do template é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      if (editingTemplate) {
        await groupAPI.updateMessageTemplate(editingTemplate.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          contentJson: formContentJson,
        });
        setSuccessMessage('Template atualizado com sucesso!');
      } else {
        await groupAPI.createMessageTemplate({
          instanceId,
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          messageType: formMessageType,
          contentJson: formContentJson,
        });
        setSuccessMessage('Template criado com sucesso!');
      }

      handleCloseModal();
      await loadTemplates();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao salvar template');
      setError(errorMessage);
      logError('Erro ao salvar template', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este template?')) {
      return;
    }

    try {
      setError(null);
      await groupAPI.deleteMessageTemplate(id);
      setSuccessMessage('Template deletado com sucesso!');
      await loadTemplates();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error, 'Erro ao deletar template');
      setError(errorMessage);
      logError('Erro ao deletar template', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500 dark:text-gray-400">{t('groupManager.loading')}</div>
      </div>
    );
  }

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
            {t('groupManager.templates.title')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t('groupManager.templates.description')}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenCreateModal}>
          {t('groupManager.templates.create')}
        </Button>
      </div>

      {/* Lista de Templates */}
      {templates.length === 0 ? (
        <Card padding="md">
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="mb-4">{t('groupManager.templates.noTemplates')}</p>
            <Button variant="outline" size="sm" onClick={handleOpenCreateModal}>
              {t('groupManager.templates.createFirst')}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} padding="md" className="hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-clerky-backendText dark:text-gray-200 truncate">
                    {template.name}
                  </h4>
                  {template.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {template.description}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {getMessageTypeLabel(template.messageType)}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenEditModal(template)}
                  className="flex-1"
                >
                  {t('groupManager.templates.edit')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(template.id)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  {t('groupManager.templates.delete')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Criar/Editar Template */}
      <Modal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        title={editingTemplate ? t('groupManager.templates.editTitle') : t('groupManager.templates.createTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.templates.name')} *
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t('groupManager.templates.namePlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.templates.descriptionLabel')}
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={t('groupManager.templates.descriptionPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 min-h-[80px]"
            />
          </div>

          {!editingTemplate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('groupManager.templates.type')} *
              </label>
              <select
                value={formMessageType}
                onChange={(e) => {
                  const newType = e.target.value as 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
                  setFormMessageType(newType);
                  // Inicializar conteúdo baseado no tipo
                  if (newType === 'text') {
                    setFormContentJson({ text: '' });
                  } else if (newType === 'media') {
                    setFormContentJson({ mediatype: 'image', media: '', mimetype: '', caption: '', fileName: '' });
                  } else if (newType === 'poll') {
                    setFormContentJson({ name: '', selectableCount: 1, values: [''] });
                  } else if (newType === 'contact') {
                    setFormContentJson({ contact: [{ fullName: '', wuid: '', phoneNumber: '' }] });
                  } else if (newType === 'location') {
                    setFormContentJson({ name: '', address: '', latitude: undefined, longitude: undefined });
                  } else if (newType === 'audio') {
                    setFormContentJson({ audio: '' });
                  } else {
                    setFormContentJson({});
                  }
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

          {editingTemplate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('groupManager.templates.type')}
              </label>
              <div className="px-4 py-2 bg-gray-100 dark:bg-[#091D41] rounded-lg text-sm text-gray-600 dark:text-gray-400">
                {getMessageTypeLabel(formMessageType)}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.templates.content')} *
            </label>
            <GroupMessageTemplateForm
              messageType={formMessageType}
              contentJson={formContentJson}
              onContentChange={setFormContentJson}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={handleCloseModal} disabled={isSaving}>
              {t('groupManager.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formName.trim()}>
              {isSaving ? t('groupManager.templates.saving') : (editingTemplate ? t('groupManager.templates.update') : t('groupManager.templates.create'))}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GroupMessageTemplates;
