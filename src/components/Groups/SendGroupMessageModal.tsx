import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  Group,
  GroupMessageTemplate,
  GroupMessageType,
  GroupMessageTargetType,
  RepeatRule,
  groupAPI,
  groupMessagesAPI,
  groupMessageTemplatesAPI,
} from '../../services/api';
export interface CampaignForMessage {
  id: string;
  campaignName: string;
  instanceId: string;
}

const MESSAGE_TYPES: GroupMessageType[] = ['text', 'media', 'poll', 'contact', 'location', 'audio'];
const TARGET_TYPES: { value: GroupMessageTargetType; labelKey: string }[] = [
  { value: 'all', labelKey: 'groupManager.sendMessages.allGroups' },
  { value: 'specific', labelKey: 'groupManager.sendMessages.specificGroups' },
  { value: 'campaign', labelKey: 'groupManager.sendMessages.targetCampaigns' },
];
const REPEAT_OPTIONS: { value: RepeatRule; labelKey: string }[] = [
  { value: 'none', labelKey: 'groupManager.sendMessages.repeat.none' },
  { value: 'daily', labelKey: 'groupManager.sendMessages.repeat.daily' },
  { value: 'weekly', labelKey: 'groupManager.sendMessages.repeat.weekly' },
  { value: 'monthly', labelKey: 'groupManager.sendMessages.repeat.monthly' },
];

interface SendGroupMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  campaigns: CampaignForMessage[];
  onSent?: () => void;
  onScheduled?: () => void;
}

export const SendGroupMessageModal: React.FC<SendGroupMessageModalProps> = ({
  isOpen,
  onClose,
  instanceId,
  campaigns,
  onSent,
  onScheduled,
}) => {
  const { t } = useLanguage();
  const [templates, setTemplates] = useState<GroupMessageTemplate[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<GroupMessageType>('text');
  const [contentJson, setContentJson] = useState<Record<string, unknown>>({ text: '' });
  const [targetType, setTargetType] = useState<GroupMessageTargetType>('specific');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none');
  const [repeatUntil, setRepeatUntil] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    if (!isOpen || !instanceId) return;
    groupMessageTemplatesAPI.getByInstance(instanceId).then((r) => setTemplates(r.data ?? []));
  }, [isOpen, instanceId]);

  useEffect(() => {
    if (!isOpen || !instanceId) return;
    setLoadingGroups(true);
    groupAPI
      .getAll(instanceId)
      .then((r) => setGroups(r.groups ?? []))
      .finally(() => setLoadingGroups(false));
  }, [isOpen, instanceId]);

  useEffect(() => {
    if (!templateId) return;
    const tpl = templates.find((x) => x.id === templateId);
    if (tpl) {
      setMessageType(tpl.messageType);
      setContentJson((tpl.contentJson && typeof tpl.contentJson === 'object' ? tpl.contentJson : {}) as Record<string, unknown>);
    }
  }, [templateId, templates]);

  const minDatetime = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const getTargetGroupIds = (): string[] => {
    if (targetType === 'all') return groups.map((g) => g.id);
    if (targetType === 'specific') return selectedGroupIds;
    return [];
  };

  const handleSendNow = async () => {
    const groupIds = getTargetGroupIds();
    if (targetType === 'campaign') {
      if (selectedCampaignIds.length === 0) {
        alert(t('groupManager.sendMessages.selectCampaigns'));
        return;
      }
    } else if (groupIds.length === 0) {
      alert(t('groupManager.sendMessages.selectGroups'));
      return;
    }
    try {
      setSending(true);
      await groupMessagesAPI.sendNow({
        instanceId,
        messageType,
        contentJson,
        targetType,
        groupIds: targetType !== 'campaign' ? groupIds : undefined,
        campaignIds: targetType === 'campaign' ? selectedCampaignIds : undefined,
        templateId: templateId ?? undefined,
      });
      onSent?.();
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro ao enviar';
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSchedule = async () => {
    const groupIds = getTargetGroupIds();
    if (targetType === 'campaign') {
      if (selectedCampaignIds.length === 0) {
        alert(t('groupManager.sendMessages.selectCampaigns'));
        return;
      }
    } else if (groupIds.length === 0) {
      alert(t('groupManager.sendMessages.selectGroups'));
      return;
    }
    if (!scheduledAt) {
      alert(t('groupManager.sendMessages.scheduledAt'));
      return;
    }
    const at = new Date(scheduledAt);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) {
      alert(t('groupManager.sendMessages.scheduledAt'));
      return;
    }
    try {
      setScheduling(true);
      await groupMessagesAPI.schedule({
        instanceId,
        messageType,
        contentJson,
        targetType,
        groupIds: targetType !== 'campaign' ? groupIds : undefined,
        campaignIds: targetType === 'campaign' ? selectedCampaignIds : undefined,
        templateId: templateId ?? undefined,
        scheduledAt: at.toISOString(),
        repeatRule: repeatRule === 'none' ? undefined : repeatRule,
        repeatUntil: repeatRule !== 'none' && repeatUntil ? new Date(repeatUntil).toISOString() : undefined,
      });
      onScheduled?.();
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro ao agendar';
      alert(msg);
    } finally {
      setScheduling(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('groupManager.sendMessages.title')} size="xl">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.sendMessages.selectTemplate')}</label>
          <select
            value={templateId ?? ''}
            onChange={(e) => setTemplateId(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
          >
            <option value="">{t('groupManager.sendMessages.noTemplate')}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({t(`groupManager.templates.types.${tpl.messageType}`)})
              </option>
            ))}
          </select>
        </div>

        {!templateId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.sendMessages.messageType')}</label>
            <select
              value={messageType}
              onChange={(e) => setMessageType(e.target.value as GroupMessageType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
            >
              {MESSAGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`groupManager.templates.types.${type}`)}
                </option>
              ))}
            </select>
            {messageType === 'text' && (
              <textarea
                value={(contentJson.text as string) ?? ''}
                onChange={(e) => setContentJson((p) => ({ ...p, text: e.target.value }))}
                className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
                rows={3}
                placeholder={t('groupManager.sendMessages.contentPlaceholder')}
              />
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.sendMessages.targetType')}</label>
          <div className="flex flex-wrap gap-3">
            {TARGET_TYPES.map(({ value, labelKey }) => (
              <label key={value} className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === value}
                  onChange={() => setTargetType(value)}
                  className="rounded border-gray-300 text-clerky-backendButton focus:ring-clerky-backendButton"
                />
                <span className="text-sm text-clerky-backendText dark:text-gray-200">{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        {targetType === 'specific' && (
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('groupManager.sendMessages.selectGroups')}</p>
            {loadingGroups ? (
              <p className="text-gray-500 text-sm">{t('groupManager.loading')}</p>
            ) : (
              groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                    className="rounded border-gray-300 text-clerky-backendButton focus:ring-clerky-backendButton"
                  />
                  <span className="text-sm text-clerky-backendText dark:text-gray-200 truncate">{g.name ?? g.id}</span>
                </label>
              ))
            )}
          </div>
        )}

        {targetType === 'campaign' && (
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('groupManager.sendMessages.selectCampaigns')}</p>
            {campaigns
              .filter((c) => c.instanceId === instanceId)
              .map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCampaignIds.includes(c.id)}
                    onChange={() => toggleCampaign(c.id)}
                    className="rounded border-gray-300 text-clerky-backendButton focus:ring-clerky-backendButton"
                  />
                  <span className="text-sm text-clerky-backendText dark:text-gray-200">{c.campaignName}</span>
                </label>
              ))}
          </div>
        )}

        {targetType === 'all' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('groupManager.sendMessages.allGroups')}: {groups.length} {t('groupManager.loading').toLowerCase().replace('...', '')}
          </p>
        )}

        <hr className="border-gray-200 dark:border-gray-600" />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.sendMessages.scheduledAt')}</label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              min={minDatetime()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.sendMessages.repeatRule')}</label>
            <select
              value={repeatRule}
              onChange={(e) => setRepeatRule(e.target.value as RepeatRule)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
            >
              {REPEAT_OPTIONS.map(({ value, labelKey }) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {repeatRule !== 'none' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.sendMessages.repeatUntil')}</label>
            <input
              type="datetime-local"
              value={repeatUntil}
              onChange={(e) => setRepeatUntil(e.target.value)}
              min={minDatetime()}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSendNow} disabled={sending}>
            {sending ? t('groupManager.sendMessages.sending') : t('groupManager.sendMessages.sendNow')}
          </Button>
          <Button variant="primary" onClick={handleSchedule} disabled={scheduling}>
            {scheduling ? t('groupManager.sendMessages.sending') : t('groupManager.sendMessages.schedule')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default SendGroupMessageModal;
