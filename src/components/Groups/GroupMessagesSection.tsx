import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  groupAPI,
  groupMessageAPI,
  Group,
  GroupMessageTemplate,
  GroupMessageType,
  GroupScheduledMessage,
} from '../../services/api';
import { getErrorMessage, logError } from '../../utils/errorHandler';

type CampaignLite = {
  id: string;
  campaignName: string;
  instanceId: string;
  importGroups: 'all' | string[] | null;
};

type Tab = 'templates' | 'send' | 'scheduled';

function emptyContent(type: GroupMessageType): Record<string, unknown> {
  switch (type) {
    case 'text':
      return { text: '' };
    case 'media':
      return { media: '', mediatype: 'image', caption: '', fileName: '' };
    case 'poll':
      return { name: '', selectableCount: 1, values: ['', ''] };
    case 'contact':
      return {
        contact: [
          { fullName: '', wuid: '', phoneNumber: '', organization: '', email: '', url: '' },
        ],
      };
    case 'location':
      return { name: '', address: '', latitude: 0, longitude: 0 };
    case 'audio':
      return { audio: '' };
    default:
      return {};
  }
}

function normalizeContent(type: GroupMessageType, raw: Record<string, unknown>): Record<string, unknown> {
  const base = emptyContent(type);
  if (type === 'poll') {
    const values = Array.isArray(raw.values)
      ? (raw.values as unknown[]).map((v) => String(v))
      : (base.values as string[]);
    return {
      name: String(raw.name ?? base.name ?? ''),
      selectableCount: Number(raw.selectableCount ?? 1) || 1,
      values: values.length >= 2 ? values : ['', ''],
    };
  }
  if (type === 'contact') {
    const c = raw.contact;
    if (Array.isArray(c) && c.length) return { contact: c };
    return base;
  }
  return { ...base, ...raw };
}

const MESSAGE_TYPES: GroupMessageType[] = ['text', 'media', 'poll', 'contact', 'location', 'audio'];

interface GroupMessagesSectionProps {
  instanceId: string;
  campaigns: CampaignLite[];
}

const GroupMessagesSection: React.FC<GroupMessagesSectionProps> = ({ instanceId, campaigns }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>('send');
  const [templates, setTemplates] = useState<GroupMessageTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [scheduled, setScheduled] = useState<GroupScheduledMessage[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [templateModal, setTemplateModal] = useState<'create' | 'edit' | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplType, setTplType] = useState<GroupMessageType>('text');
  const [tplContent, setTplContent] = useState<Record<string, unknown>>(emptyContent('text'));

  const [sendType, setSendType] = useState<GroupMessageType>('text');
  const [sendContent, setSendContent] = useState<Record<string, unknown>>(emptyContent('text'));
  const [templatePick, setTemplatePick] = useState<string>('');
  const [targetMode, setTargetMode] = useState<'groups' | 'campaign'>('groups');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState<string>('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [repeatType, setRepeatType] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [sendContactJson, setSendContactJson] = useState('[{"fullName":"","phoneNumber":""}]');
  const [tplContactJson, setTplContactJson] = useState('[{"fullName":"","phoneNumber":""}]');

  const eligibleCampaigns = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          c.instanceId === instanceId &&
          Array.isArray(c.importGroups) &&
          c.importGroups.length > 0
      ),
    [campaigns, instanceId]
  );

  const loadTemplates = useCallback(async () => {
    if (!instanceId) return;
    setLoadingTemplates(true);
    setError(null);
    try {
      const res = await groupMessageAPI.getTemplates(instanceId);
      setTemplates(res.data ?? []);
    } catch (e: unknown) {
      logError('GroupMessagesSection.loadTemplates', e);
      setError(getErrorMessage(e, 'Erro ao carregar templates'));
    } finally {
      setLoadingTemplates(false);
    }
  }, [instanceId]);

  const loadGroups = useCallback(async () => {
    if (!instanceId) return;
    setLoadingGroups(true);
    try {
      const res = await groupAPI.getAll(instanceId);
      setGroups(res.groups ?? []);
    } catch (e: unknown) {
      logError('GroupMessagesSection.loadGroups', e);
      setError(getErrorMessage(e, 'Erro ao carregar grupos'));
    } finally {
      setLoadingGroups(false);
    }
  }, [instanceId]);

  const loadScheduled = useCallback(async () => {
    if (!instanceId) return;
    setLoadingScheduled(true);
    try {
      const res = await groupMessageAPI.getScheduled(instanceId);
      setScheduled(res.data ?? []);
    } catch (e: unknown) {
      logError('GroupMessagesSection.loadScheduled', e);
      setScheduled([]);
    } finally {
      setLoadingScheduled(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadTemplates();
    loadScheduled();
  }, [loadTemplates, loadScheduled]);

  useEffect(() => {
    if (tab === 'send' && targetMode === 'groups') loadGroups();
  }, [tab, targetMode, loadGroups]);

  useEffect(() => {
    if (templatePick) {
      const tpl = templates.find((x) => x.id === templatePick);
      if (tpl) {
        setSendType(tpl.messageType);
        setSendContent(normalizeContent(tpl.messageType, tpl.contentJson));
        if (tpl.messageType === 'contact') {
          setSendContactJson(JSON.stringify(tpl.contentJson.contact ?? [], null, 2));
        }
      }
    }
  }, [templatePick, templates]);

  useEffect(() => {
    if (sendType === 'contact' && !templatePick) {
      setSendContactJson(JSON.stringify(sendContent.contact ?? [{ fullName: '', phoneNumber: '' }], null, 2));
    }
  }, [sendType]);

  const openCreateTemplate = () => {
    setEditingTemplateId(null);
    setTplName('');
    setTplDesc('');
    setTplType('text');
    setTplContent(emptyContent('text'));
    setTplContactJson('[{"fullName":"","phoneNumber":""}]');
    setTemplateModal('create');
  };

  const openEditTemplate = (tpl: GroupMessageTemplate) => {
    setEditingTemplateId(tpl.id);
    setTplName(tpl.name);
    setTplDesc(tpl.description ?? '');
    setTplType(tpl.messageType);
    setTplContent(normalizeContent(tpl.messageType, tpl.contentJson));
    if (tpl.messageType === 'contact') {
      setTplContactJson(JSON.stringify(tpl.contentJson.contact ?? [], null, 2));
    }
    setTemplateModal('edit');
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) {
      setError(t('groupManager.templates.nameRequired'));
      return;
    }
    let content = tplContent;
    if (tplType === 'contact') {
      try {
        const arr = JSON.parse(tplContactJson) as unknown;
        if (!Array.isArray(arr) || arr.length === 0) {
          setError(t('groupManager.templates.contactJsonInvalid'));
          return;
        }
        content = { contact: arr };
      } catch {
        setError(t('groupManager.templates.contactJsonInvalid'));
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (editingTemplateId) {
        await groupMessageAPI.updateTemplate(editingTemplateId, {
          name: tplName.trim(),
          description: tplDesc || null,
          contentJson: content,
        });
        setSuccess(t('groupManager.templates.updatedToast'));
      } else {
        await groupMessageAPI.createTemplate({
          instanceId,
          name: tplName.trim(),
          description: tplDesc || null,
          messageType: tplType,
          contentJson: content,
        });
        setSuccess(t('groupManager.templates.createdToast'));
      }
      setTemplateModal(null);
      await loadTemplates();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Erro ao salvar'));
    } finally {
      setBusy(false);
    }
  };

  const deleteTpl = async (id: string) => {
    if (!window.confirm(t('groupManager.templates.confirmDelete'))) return;
    setBusy(true);
    try {
      await groupMessageAPI.deleteTemplate(id);
      setSuccess(t('groupManager.templates.deletedToast'));
      await loadTemplates();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Erro ao excluir'));
    } finally {
      setBusy(false);
    }
  };

  const getSendPayloadContent = (): Record<string, unknown> | null => {
    if (sendType === 'contact') {
      try {
        const arr = JSON.parse(sendContactJson) as unknown;
        if (!Array.isArray(arr) || arr.length === 0) {
          setError(t('groupManager.templates.contactJsonInvalid'));
          return null;
        }
        return { contact: arr };
      } catch {
        setError(t('groupManager.templates.contactJsonInvalid'));
        return null;
      }
    }
    return sendContent;
  };

  const validateSend = (): boolean => {
    const payload = getSendPayloadContent();
    if (payload === null) return false;
    if (targetMode === 'groups' && selectedGroupIds.length === 0) {
      setError(t('groupManager.sendMessages.pickGroups'));
      return false;
    }
    if (targetMode === 'campaign' && !campaignId) {
      setError(t('groupManager.sendMessages.pickCampaign'));
      return false;
    }
    if (sendType === 'contact') return true;
    const text = String(payload.text ?? '').trim();
    if (sendType === 'text' && !text) {
      setError(t('groupManager.templates.fields.textRequired'));
      return false;
    }
    if (sendType === 'media' && !String(payload.media ?? '').trim()) {
      setError(t('groupManager.templates.fields.mediaUrlRequired'));
      return false;
    }
    if (sendType === 'poll') {
      const vals = (payload.values as string[])?.filter((v) => v.trim()) ?? [];
      if (!String(payload.name ?? '').trim() || vals.length < 2) {
        setError(t('groupManager.templates.fields.pollInvalid'));
        return false;
      }
    }
    if (sendType === 'audio' && !String(payload.audio ?? '').trim()) {
      setError(t('groupManager.templates.fields.audioRequired'));
      return false;
    }
    if (sendType === 'location') {
      if (payload.latitude == null || payload.longitude == null) {
        setError(t('groupManager.templates.fields.latLngRequired'));
        return false;
      }
    }
    return true;
  };

  const handleSendNow = async () => {
    if (!validateSend()) return;
    const contentJson = getSendPayloadContent();
    if (!contentJson) return;
    setBusy(true);
    setError(null);
    try {
      const res = await groupMessageAPI.sendNow({
        instanceId,
        messageType: sendType,
        contentJson,
        targetType: targetMode,
        groupIds: targetMode === 'groups' ? selectedGroupIds : undefined,
        campaignId: targetMode === 'campaign' ? campaignId : undefined,
        templateId: templatePick || undefined,
      });
      const ok = res.data.results.filter((r) => r.success).length;
      const fail = res.data.results.length - ok;
      setSuccess(
        fail
          ? t('groupManager.sendMessages.partialResult', { ok: String(ok), fail: String(fail) })
          : t('groupManager.sendMessages.allSent', { n: String(ok) })
      );
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Erro ao enviar'));
    } finally {
      setBusy(false);
    }
  };

  const handleSchedule = async () => {
    if (!validateSend()) return;
    const contentJson = getSendPayloadContent();
    if (!contentJson) return;
    if (!scheduledAt) {
      setError(t('groupManager.sendMessages.scheduledAtRequired'));
      return;
    }
    const d = new Date(scheduledAt);
    if (d.getTime() < Date.now() - 30_000) {
      setError(t('groupManager.sendMessages.futureOnly'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await groupMessageAPI.schedule({
        instanceId,
        messageType: sendType,
        contentJson,
        targetType: targetMode,
        groupIds: targetMode === 'groups' ? selectedGroupIds : undefined,
        campaignId: targetMode === 'campaign' ? campaignId : undefined,
        templateId: templatePick || undefined,
        scheduledAt: d.toISOString(),
        repeat: { type: repeatType },
      });
      setSuccess(t('groupManager.sendMessages.scheduledOk'));
      setScheduledAt('');
      await loadScheduled();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Erro ao agendar'));
    } finally {
      setBusy(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    setBusy(true);
    try {
      await groupMessageAPI.cancelScheduled(id);
      setSuccess(t('groupManager.sendMessages.cancelOk'));
      await loadScheduled();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Erro ao cancelar'));
    } finally {
      setBusy(false);
    }
  };

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const renderContentFields = (
    type: GroupMessageType,
    content: Record<string, unknown>,
    setContent: React.Dispatch<React.SetStateAction<Record<string, unknown>>>,
    disabled: boolean
  ) => {
    const patch = (p: Record<string, unknown>) => setContent((c) => ({ ...c, ...p }));
    switch (type) {
      case 'text':
        return (
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('groupManager.templates.fields.text')}
            </span>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              rows={4}
              value={String(content.text ?? '')}
              onChange={(e) => patch({ text: e.target.value })}
              disabled={disabled}
            />
          </label>
        );
      case 'media':
        return (
          <div className="space-y-2">
            <label className="block">
              <span className="text-sm font-medium">URL</span>
              <input
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                value={String(content.media ?? '')}
                onChange={(e) => patch({ media: e.target.value })}
                disabled={disabled}
              />
            </label>
            <select
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              value={String(content.mediatype ?? 'image')}
              onChange={(e) => patch({ mediatype: e.target.value })}
              disabled={disabled}
            >
              <option value="image">{t('groupManager.templates.types.media')} (image)</option>
              <option value="video">video</option>
              <option value="document">document</option>
            </select>
            <input
              placeholder={t('groupManager.templates.fields.captionPlaceholder')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              value={String(content.caption ?? '')}
              onChange={(e) => patch({ caption: e.target.value })}
              disabled={disabled}
            />
          </div>
        );
      case 'poll':
        return (
          <div className="space-y-2">
            <input
              placeholder={t('groupManager.templates.fields.pollNamePlaceholder')}
              className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
              value={String(content.name ?? '')}
              onChange={(e) => patch({ name: e.target.value })}
              disabled={disabled}
            />
            {(Array.isArray(content.values) ? content.values : ['', '']).map((v: string, i: number) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={String(v)}
                  onChange={(e) => {
                    const vals = [...(content.values as string[])];
                    vals[i] = e.target.value;
                    patch({ values: vals });
                  }}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={disabled || (content.values as string[]).length <= 2}
                  onClick={() => {
                    const vals = (content.values as string[]).filter((_, j) => j !== i);
                    patch({ values: vals.length >= 2 ? vals : ['', ''] });
                  }}
                >
                  {t('groupManager.templates.fields.remove')}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={disabled}
              onClick={() => patch({ values: [...(content.values as string[]), ''] })}
            >
              {t('groupManager.templates.fields.addOption')}
            </Button>
          </div>
        );
      case 'contact':
        return null;
      case 'location':
        return (
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder={t('groupManager.templates.fields.latitude')}
              className="rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
              type="number"
              value={content.latitude != null ? Number(content.latitude) : ''}
              onChange={(e) => patch({ latitude: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
            />
            <input
              placeholder={t('groupManager.templates.fields.longitude')}
              type="number"
              className="rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
              value={content.longitude != null ? Number(content.longitude) : ''}
              onChange={(e) => patch({ longitude: parseFloat(e.target.value) || 0 })}
              disabled={disabled}
            />
            <input
              className="col-span-2 rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
              placeholder={t('groupManager.templates.fields.locationNamePlaceholder')}
              value={String(content.name ?? '')}
              onChange={(e) => patch({ name: e.target.value })}
              disabled={disabled}
            />
          </div>
        );
      case 'audio':
        return (
          <input
            placeholder={t('groupManager.templates.fields.audioUrlPlaceholder')}
            className="w-full rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
            value={String(content.audio ?? '')}
            onChange={(e) => patch({ audio: e.target.value })}
            disabled={disabled}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Card padding="md" className="rounded-xl border border-gray-200 dark:border-gray-700">
      <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-1">
        {t('groupManager.messages.sectionTitle')}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {t('groupManager.messages.sectionHint')}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['send', 'templates', 'scheduled'] as Tab[]).map((k) => (
          <Button
            key={k}
            variant={tab === k ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setTab(k)}
          >
            {k === 'send' && t('groupManager.sendMessages.sendNowTitle')}
            {k === 'templates' && t('groupManager.templates.title')}
            {k === 'scheduled' && t('groupManager.sendMessages.scheduledTitle')}
          </Button>
        ))}
      </div>

      {error && (
        <div className="mb-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
          {success}
          <button type="button" className="ml-2 underline" onClick={() => setSuccess(null)}>
            OK
          </button>
        </div>
      )}

      {tab === 'templates' && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {loadingTemplates ? '…' : `${templates.length} templates`}
            </span>
            <Button size="sm" variant="primary" onClick={openCreateTemplate}>
              {t('groupManager.templates.create')}
            </Button>
          </div>
          {templates.length === 0 && !loadingTemplates ? (
            <p className="text-gray-500 text-sm py-6 text-center">{t('groupManager.templates.noTemplates')}</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {templates.map((tpl) => (
                <li
                  key={tpl.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700"
                >
                  <div>
                    <div className="font-medium text-sm">{tpl.name}</div>
                    <div className="text-xs text-gray-500">
                      {t(`groupManager.templates.types.${tpl.messageType}`)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="xs" variant="outline" onClick={() => openEditTemplate(tpl)}>
                      {t('groupManager.templates.edit')}
                    </Button>
                    <Button size="xs" variant="outline" onClick={() => deleteTpl(tpl.id)} disabled={busy}>
                      {t('groupManager.templates.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'send' && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">{t('groupManager.sendMessages.selectTemplate')}</label>
            <select
              className="w-full max-w-md rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
              value={templatePick}
              onChange={(e) => {
                setTemplatePick(e.target.value);
                if (!e.target.value) {
                  setSendType('text');
                  setSendContent(emptyContent('text'));
                }
              }}
            >
              <option value="">{t('groupManager.sendMessages.noTemplate')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.messageType})
                </option>
              ))}
            </select>
          </div>
          {!templatePick && (
            <div>
              <label className="text-sm font-medium block mb-1">{t('groupManager.sendMessages.messageType')}</label>
              <select
                className="w-full max-w-md rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                value={sendType}
                onChange={(t) => {
                  const nt = t.target.value as GroupMessageType;
                  setSendType(nt);
                  setSendContent(emptyContent(nt));
                }}
              >
                {MESSAGE_TYPES.map((mt) => (
                  <option key={mt} value={mt}>
                    {t(`groupManager.templates.types.${mt}`)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            {sendType === 'contact' ? (
              <label className="block">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('groupManager.templates.types.contact')} (JSON)
                </span>
                <textarea
                  className="mt-1 w-full font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 min-h-[140px]"
                  value={sendContactJson}
                  onChange={(e) => setSendContactJson(e.target.value)}
                />
              </label>
            ) : (
              renderContentFields(sendType, sendContent, setSendContent, false)
            )}
          </div>

          <div>
            <span className="text-sm font-medium block mb-2">{t('groupManager.sendMessages.targetType')}</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={targetMode === 'groups'}
                  onChange={() => setTargetMode('groups')}
                />
                {t('groupManager.sendMessages.specificGroups')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={targetMode === 'campaign'}
                  onChange={() => setTargetMode('campaign')}
                />
                {t('groupManager.sendMessages.targetCampaign')}
              </label>
            </div>
          </div>

          {targetMode === 'groups' && (
            <div>
              <div className="flex gap-2 mb-2">
                <Button size="xs" variant="outline" onClick={() => setSelectedGroupIds(groups.map((g) => g.id))}>
                  {t('groupManager.sendMessages.selectAll')}
                </Button>
                <Button size="xs" variant="outline" onClick={() => setSelectedGroupIds([])}>
                  {t('groupManager.sendMessages.deselectAll')}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 space-y-1">
                {loadingGroups ? (
                  <p className="text-sm text-gray-500">…</p>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-gray-500">{t('groupManager.noGroups')}</p>
                ) : (
                  groups.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(g.id)}
                        onChange={() => toggleGroup(g.id)}
                      />
                      <span className="truncate">{g.name || g.id}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {targetMode === 'campaign' && (
            <div>
              <label className="text-sm font-medium block mb-1">{t('groupManager.sendMessages.selectCampaign')}</label>
              <select
                className="w-full max-w-md rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
              >
                <option value="">{t('groupManager.sendMessages.chooseCampaign')}</option>
                {eligibleCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campaignName} ({(c.importGroups as string[]).length} grupos)
                  </option>
                ))}
              </select>
              {eligibleCampaigns.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">{t('groupManager.sendMessages.noEligibleCampaign')}</p>
              )}
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
            <p className="text-sm font-medium">{t('groupManager.sendMessages.scheduleTitle')}</p>
            <div className="flex flex-wrap gap-4 items-end">
              <label className="block">
                <span className="text-xs text-gray-500 block">{t('groupManager.sendMessages.scheduledAt')}</span>
                <input
                  type="datetime-local"
                  className="rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500 block">{t('groupManager.sendMessages.repeat')}</span>
                <select
                  className="rounded-lg border px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={repeatType}
                  onChange={(e) => setRepeatType(e.target.value as typeof repeatType)}
                >
                  <option value="none">{t('groupManager.sendMessages.repeatNone')}</option>
                  <option value="daily">{t('groupManager.sendMessages.repeatDaily')}</option>
                  <option value="weekly">{t('groupManager.sendMessages.repeatWeekly')}</option>
                  <option value="monthly">{t('groupManager.sendMessages.repeatMonthly')}</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={handleSendNow} disabled={busy}>
                {busy ? t('groupManager.sendMessages.sending') : t('groupManager.sendMessages.sendNow')}
              </Button>
              <Button variant="outline" onClick={handleSchedule} disabled={busy}>
                {t('groupManager.sendMessages.schedule')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tab === 'scheduled' && (
        <div>
          <Button size="sm" variant="outline" className="mb-3" onClick={loadScheduled}>
            {t('groupManager.refreshCampaigns')}
          </Button>
          {loadingScheduled ? (
            <p className="text-sm text-gray-500">…</p>
          ) : scheduled.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">{t('groupManager.sendMessages.noScheduled')}</p>
          ) : (
            <ul className="space-y-2">
              {scheduled.map((s) => (
                <li
                  key={s.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm flex flex-wrap justify-between gap-2"
                >
                  <div>
                    <div className="font-medium">{s.label || s.messageType}</div>
                    <div className="text-xs text-gray-500">
                      {t('groupManager.sendMessages.scheduledFor')}:{' '}
                      {new Date(s.nextRunAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.groupJids.length} grupos · {s.repeat.type}
                    </div>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => handleCancelSchedule(s.id)} disabled={busy}>
                    {t('groupManager.sendMessages.cancel')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-lg w-full max-h-[90vh] overflow-y-auto p-4">
            <h3 className="font-semibold mb-3">
              {editingTemplateId ? t('groupManager.templates.edit') : t('groupManager.templates.create')}
            </h3>
            <div className="space-y-3">
              <input
                placeholder={t('groupManager.templates.namePlaceholder')}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
              <input
                placeholder={t('groupManager.templates.descriptionPlaceholder')}
                className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
              />
              {!editingTemplateId && (
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600"
                  value={tplType}
                  onChange={(e) => {
                    const nt = e.target.value as GroupMessageType;
                    setTplType(nt);
                    setTplContent(emptyContent(nt));
                    if (nt === 'contact') {
                      setTplContactJson('[{"fullName":"","phoneNumber":""}]');
                    }
                  }}
                >
                  {MESSAGE_TYPES.map((mt) => (
                    <option key={mt} value={mt}>
                      {t(`groupManager.templates.types.${mt}`)}
                    </option>
                  ))}
                </select>
              )}
              {tplType === 'contact' ? (
                <textarea
                  className="w-full font-mono text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 min-h-[140px]"
                  value={tplContactJson}
                  onChange={(e) => setTplContactJson(e.target.value)}
                />
              ) : (
                renderContentFields(tplType, tplContent, setTplContent, false)
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setTemplateModal(null)}>
                {t('groupManager.sendMessages.cancel')}
              </Button>
              <Button variant="primary" onClick={saveTemplate} disabled={busy}>
                {busy ? t('groupManager.templates.saving') : t('groupManager.templates.save')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
};

export default GroupMessagesSection;
