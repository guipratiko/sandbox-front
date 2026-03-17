import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  GroupMessageTemplate,
  GroupScheduledMessage,
  groupMessageTemplatesAPI,
  groupMessagesAPI,
} from '../../services/api';
import GroupMessageTemplateModal from './GroupMessageTemplateModal';
import SendGroupMessageModal from './SendGroupMessageModal';
import type { CampaignForMessage } from './SendGroupMessageModal';

interface GroupMessagesSectionProps {
  instanceId: string;
  campaigns: CampaignForMessage[];
}

const GROUP_MESSAGE_TYPE_KEYS: Record<string, string> = {
  text: 'groupManager.templates.types.text',
  media: 'groupManager.templates.types.media',
  poll: 'groupManager.templates.types.poll',
  contact: 'groupManager.templates.types.contact',
  location: 'groupManager.templates.types.location',
  audio: 'groupManager.templates.types.audio',
};

const STATUS_KEYS: Record<string, string> = {
  scheduled: 'groupManager.sendMessages.status.scheduled',
  processing: 'groupManager.sendMessages.status.processing',
  sent: 'groupManager.sendMessages.status.sent',
  failed: 'groupManager.sendMessages.status.failed',
  cancelled: 'groupManager.sendMessages.status.cancelled',
};

export const GroupMessagesSection: React.FC<GroupMessagesSectionProps> = ({ instanceId, campaigns }) => {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<GroupMessageTemplate[]>([]);
  const [scheduled, setScheduled] = useState<GroupScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<GroupMessageTemplate | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);

  const load = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    try {
      const [tplRes, schedRes] = await Promise.all([
        groupMessageTemplatesAPI.getByInstance(instanceId),
        groupMessagesAPI.getScheduled(instanceId),
      ]);
      setTemplates(tplRes.data ?? []);
      setScheduled(schedRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm(t('groupManager.templates.delete') + '?')) return;
    try {
      await groupMessageTemplatesAPI.delete(id);
      await load();
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro';
      alert(msg);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    if (!window.confirm(t('groupManager.sendMessages.cancel') + '?')) return;
    try {
      await groupMessagesAPI.cancelScheduled(id);
      await load();
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro';
      alert(msg);
    }
  };

  const openEditTemplate = (tpl: GroupMessageTemplate) => {
    setEditingTemplate(tpl);
    setShowTemplateModal(true);
  };

  const closeTemplateModal = () => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
  };

  return (
    <>
      <Card padding="md">
        <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
          {t('groupManager.messagesSection.title')}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('groupManager.messagesSection.description')}
        </p>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400 py-4">{t('groupManager.loading')}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button variant="primary" size="sm" onClick={() => { setEditingTemplate(null); setShowTemplateModal(true); }}>
                {t('groupManager.templates.create')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSendModal(true)}>
                {t('groupManager.sendMessages.sendNow')} / {t('groupManager.sendMessages.schedule')}
              </Button>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('groupManager.templates.title')}</h3>
              {templates.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('groupManager.templates.noTemplates')}</p>
              ) : (
                <ul className="space-y-2">
                  {templates.map((tpl) => (
                    <li
                      key={tpl.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
                    >
                      <div>
                        <span className="font-medium text-clerky-backendText dark:text-gray-200">{tpl.name}</span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {t(GROUP_MESSAGE_TYPE_KEYS[tpl.messageType] ?? tpl.messageType)}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="outline" size="xs" onClick={() => openEditTemplate(tpl)}>
                          {t('groupManager.templates.edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                          onClick={() => handleDeleteTemplate(tpl.id)}
                        >
                          {t('groupManager.templates.delete')}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('groupManager.sendMessages.scheduledTitle')}</h3>
              {scheduled.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('groupManager.sendMessages.noScheduled')}</p>
              ) : (
                <ul className="space-y-2">
                  {scheduled.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
                    >
                      <div className="text-sm text-clerky-backendText dark:text-gray-200">
                        {t('groupManager.sendMessages.scheduledFor')}: {new Date(s.scheduledAt).toLocaleString()}
                        <span className="ml-2 text-xs text-gray-500">
                          ({t(STATUS_KEYS[s.status] ?? s.status)})
                        </span>
                      </div>
                      {s.status === 'scheduled' && (
                        <Button variant="outline" size="xs" onClick={() => handleCancelScheduled(s.id)}>
                          {t('groupManager.sendMessages.cancel')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Card>

      <GroupMessageTemplateModal
        isOpen={showTemplateModal}
        onClose={closeTemplateModal}
        instanceId={instanceId}
        template={editingTemplate}
        onSaved={load}
      />

      <SendGroupMessageModal
        isOpen={showSendModal}
        onClose={() => setShowSendModal(false)}
        instanceId={instanceId}
        campaigns={campaigns}
        onSent={load}
        onScheduled={load}
      />
    </>
  );
};

export default GroupMessagesSection;
