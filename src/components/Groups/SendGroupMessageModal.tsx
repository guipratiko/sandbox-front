import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  importGroups: 'all' | string[] | null;
}

const MESSAGE_TYPES: GroupMessageType[] = ['text', 'media', 'poll', 'contact', 'location', 'audio'];
const TARGET_TYPES: { value: GroupMessageTargetType; labelKey: string }[] = [
  { value: 'all', labelKey: 'groupManager.sendMessages.allGroups' },
  { value: 'specific', labelKey: 'groupManager.sendMessages.groupsInCampaign' },
  { value: 'campaign', labelKey: 'groupManager.sendMessages.targetCampaigns' },
];
const REPEAT_OPTIONS: { value: RepeatRule; labelKey: string }[] = [
  { value: 'none', labelKey: 'groupManager.sendMessages.repeat.none' },
  { value: 'daily', labelKey: 'groupManager.sendMessages.repeat.daily' },
  { value: 'weekly', labelKey: 'groupManager.sendMessages.repeat.weekly' },
  { value: 'monthly', labelKey: 'groupManager.sendMessages.repeat.monthly' },
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const day = parseInt(m[3], 10);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

function combineLocalDateTime(dateStr: string, timeStr: string): Date | null {
  const d = parseYMD(dateStr);
  if (!d || !timeStr) return null;
  const [hh, mm] = timeStr.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  d.setHours(hh, mm, 0, 0);
  return d;
}

/** Mini calendário mensal (seleção de dia) */
function DatePickerCalendar({
  value,
  onChange,
  minDateStr,
  labelsWeek,
}: {
  value: string;
  onChange: (ymd: string) => void;
  minDateStr: string;
  labelsWeek: string[];
}) {
  const minD = parseYMD(minDateStr);
  const selected = parseYMD(value);
  const base = selected ?? minD ?? new Date();
  const [year, setYear] = useState(base.getFullYear());
  const [month, setMonth] = useState(base.getMonth());

  useEffect(() => {
    if (selected) {
      setYear(selected.getFullYear());
      setMonth(selected.getMonth());
    }
  }, [value]);

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const days: (number | null)[] = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);

  const isDisabled = (day: number) => {
    const cell = new Date(year, month, day);
    if (minD && cell < new Date(minD.getFullYear(), minD.getMonth(), minD.getDate())) return true;
    return false;
  };

  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) =>
      new Date(2000, i, 1).toLocaleString(undefined, { month: 'long' })
    );
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-600 p-3 bg-gray-50/80 dark:bg-gray-800/50">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-clerky-backendText"
          onClick={() => {
            if (month === 0) {
              setMonth(11);
              setYear((y) => y - 1);
            } else setMonth((m) => m - 1);
          }}
          aria-label="prev"
        >
          ‹
        </button>
        <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200 capitalize">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-clerky-backendText"
          onClick={() => {
            if (month === 11) {
              setMonth(0);
              setYear((y) => y + 1);
            } else setMonth((m) => m + 1);
          }}
          aria-label="next"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-gray-500 dark:text-gray-400 mb-1">
        {labelsWeek.map((w) => (
          <div key={w} className="py-1 font-medium">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) =>
          day === null ? (
            <div key={`e-${idx}`} className="aspect-square" />
          ) : (
            <button
              key={day}
              type="button"
              disabled={isDisabled(day)}
              onClick={() => onChange(`${year}-${pad2(month + 1)}-${pad2(day)}`)}
              className={`aspect-square text-sm rounded-lg transition-colors ${
                value === `${year}-${pad2(month + 1)}-${pad2(day)}`
                  ? 'bg-clerky-backendButton text-white font-semibold'
                  : isDisabled(day)
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-clerky-backendText dark:text-gray-200'
              }`}
            >
              {day}
            </button>
          )
        )}
      </div>
    </div>
  );
}

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
  const weekLabels = useMemo(() => {
    const sun = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) =>
      new Date(sun.getTime() + i * 86400000).toLocaleString(undefined, { weekday: 'short' })
    );
  }, []);

  const [templates, setTemplates] = useState<GroupMessageTemplate[]>([]);
  const [groupsAll, setGroupsAll] = useState<Group[]>([]);
  const [loadingAllGroups, setLoadingAllGroups] = useState(false);
  const [specificCampaignId, setSpecificCampaignId] = useState('');
  const [campaignGroups, setCampaignGroups] = useState<Group[]>([]);
  const [loadingCampaignGroups, setLoadingCampaignGroups] = useState(false);

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<GroupMessageType>('text');
  const [contentJson, setContentJson] = useState<Record<string, unknown>>({ text: '' });
  const [targetType, setTargetType] = useState<GroupMessageTargetType>('specific');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [mentionsEveryone, setMentionsEveryone] = useState(false);

  const todayStr = useCallback(() => toYMD(new Date()), []);
  const [scheduleDate, setScheduleDate] = useState(() => toYMD(new Date()));
  const [scheduleTime, setScheduleTime] = useState('');
  const [repeatRule, setRepeatRule] = useState<RepeatRule>('none');
  const [repeatUntilDate, setRepeatUntilDate] = useState('');
  const [repeatUntilTime, setRepeatUntilTime] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const instanceCampaigns = useMemo(
    () => campaigns.filter((c) => c.instanceId === instanceId),
    [campaigns, instanceId]
  );

  useEffect(() => {
    if (!isOpen || !instanceId) return;
    groupMessageTemplatesAPI.getByInstance(instanceId).then((r) => setTemplates(r.data ?? []));
  }, [isOpen, instanceId]);

  useEffect(() => {
    if (!isOpen || !instanceId) return;
    setLoadingAllGroups(true);
    groupAPI
      .getAll(instanceId)
      .then((r) => setGroupsAll(r.groups ?? []))
      .finally(() => setLoadingAllGroups(false));
  }, [isOpen, instanceId]);

  useEffect(() => {
    if (!isOpen) return;
    const t0 = todayStr();
    setScheduleDate(t0);
    const d = new Date();
    d.setMinutes(d.getMinutes() + 15);
    setScheduleTime(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
    setRepeatUntilDate(t0);
    setRepeatUntilTime('23:59');
    setSpecificCampaignId('');
    setCampaignGroups([]);
    setSelectedGroupIds([]);
    setSelectedCampaignIds([]);
    setTemplateId(null);
    setMessageType('text');
    setContentJson({ text: '' });
    setTargetType('specific');
    setMentionsEveryone(false);
    setRepeatRule('none');
  }, [isOpen, todayStr]);

  useEffect(() => {
    if (!templateId) return;
    const tpl = templates.find((x) => x.id === templateId);
    if (tpl) {
      setMessageType(tpl.messageType);
      setContentJson((tpl.contentJson && typeof tpl.contentJson === 'object' ? tpl.contentJson : {}) as Record<string, unknown>);
    }
  }, [templateId, templates]);

  const loadCampaignGroups = useCallback(async (campaignId: string) => {
    const camp = instanceCampaigns.find((c) => c.id === campaignId);
    if (!camp) {
      setCampaignGroups([]);
      return;
    }
    setLoadingCampaignGroups(true);
    try {
      if (camp.importGroups === null) {
        setCampaignGroups([]);
      } else if (camp.importGroups === 'all') {
        const r = await groupAPI.getAll(camp.instanceId);
        setCampaignGroups(r.groups ?? []);
      } else {
        const r = await groupAPI.getGroupsByIds(camp.instanceId, camp.importGroups);
        setCampaignGroups(r.groups ?? []);
      }
    } catch {
      setCampaignGroups([]);
    } finally {
      setLoadingCampaignGroups(false);
    }
  }, [instanceCampaigns]);

  useEffect(() => {
    if (!isOpen || targetType !== 'specific' || !specificCampaignId) {
      if (targetType !== 'specific') return;
      setCampaignGroups([]);
      setSelectedGroupIds([]);
      return;
    }
    loadCampaignGroups(specificCampaignId);
    setSelectedGroupIds([]);
  }, [isOpen, targetType, specificCampaignId, loadCampaignGroups]);

  const effectiveMessageType: GroupMessageType = templateId
    ? templates.find((x) => x.id === templateId)?.messageType ?? messageType
    : messageType;

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const toggleCampaign = (id: string) => {
    setSelectedCampaignIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllCampaignGroups = () => {
    setSelectedGroupIds(campaignGroups.map((g) => g.id));
  };
  const deselectAllCampaignGroups = () => setSelectedGroupIds([]);

  const getTargetGroupIds = (): string[] => {
    if (targetType === 'all') return groupsAll.map((g) => g.id);
    if (targetType === 'specific') return selectedGroupIds;
    return [];
  };

  const mentionsPayload =
    mentionsEveryone && effectiveMessageType === 'text' ? { mentionsEveryone: true } : {};

  const handleSendNow = async () => {
    const groupIds = getTargetGroupIds();
    if (targetType === 'campaign') {
      if (selectedCampaignIds.length === 0) {
        alert(t('groupManager.sendMessages.selectCampaigns'));
        return;
      }
    } else if (targetType === 'specific') {
      if (!specificCampaignId) {
        alert(t('groupManager.sendMessages.chooseCampaign'));
        return;
      }
      if (groupIds.length === 0) {
        alert(t('groupManager.sendMessages.selectGroups'));
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
        messageType: effectiveMessageType,
        contentJson,
        targetType,
        groupIds: targetType !== 'campaign' ? groupIds : undefined,
        campaignIds: targetType === 'campaign' ? selectedCampaignIds : undefined,
        templateId: templateId ?? undefined,
        ...mentionsPayload,
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
    } else if (targetType === 'specific') {
      if (!specificCampaignId) {
        alert(t('groupManager.sendMessages.chooseCampaign'));
        return;
      }
      if (groupIds.length === 0) {
        alert(t('groupManager.sendMessages.selectGroups'));
        return;
      }
    } else if (groupIds.length === 0) {
      alert(t('groupManager.sendMessages.selectGroups'));
      return;
    }
    const at = combineLocalDateTime(scheduleDate, scheduleTime);
    if (!at || at.getTime() < Date.now()) {
      alert(t('groupManager.sendMessages.scheduledAt'));
      return;
    }
    let repeatUntilIso: string | undefined;
    if (repeatRule !== 'none' && repeatUntilDate && repeatUntilTime) {
      const ru = combineLocalDateTime(repeatUntilDate, repeatUntilTime);
      if (ru && ru.getTime() >= at.getTime()) {
        repeatUntilIso = ru.toISOString();
      }
    }
    try {
      setScheduling(true);
      await groupMessagesAPI.schedule({
        instanceId,
        messageType: effectiveMessageType,
        contentJson,
        targetType,
        groupIds: targetType !== 'campaign' ? groupIds : undefined,
        campaignIds: targetType === 'campaign' ? selectedCampaignIds : undefined,
        templateId: templateId ?? undefined,
        scheduledAt: at.toISOString(),
        repeatRule: repeatRule === 'none' ? undefined : repeatRule,
        repeatUntil: repeatUntilIso,
        ...mentionsPayload,
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

        {effectiveMessageType === 'text' && (
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mentionsEveryone}
              onChange={(e) => setMentionsEveryone(e.target.checked)}
              className="mt-1 rounded border-gray-300 text-clerky-backendButton focus:ring-clerky-backendButton"
            />
            <span className="text-sm text-clerky-backendText dark:text-gray-200">
              {t('groupManager.sendMessages.mentionEveryone')}
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('groupManager.sendMessages.mentionEveryoneHint')}
              </span>
            </span>
          </label>
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
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.sendMessages.chooseCampaign')}</label>
              <select
                value={specificCampaignId}
                onChange={(e) => setSpecificCampaignId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
              >
                <option value="">{t('groupManager.sendMessages.chooseCampaignPlaceholder')}</option>
                {instanceCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.campaignName}
                  </option>
                ))}
              </select>
            </div>
            {specificCampaignId && (
              <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('groupManager.sendMessages.selectGroups')}</p>
                  {campaignGroups.length > 0 && (
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="xs" onClick={selectAllCampaignGroups}>
                        {t('groupManager.sendMessages.selectAllGroups')}
                      </Button>
                      <Button type="button" variant="outline" size="xs" onClick={deselectAllCampaignGroups}>
                        {t('groupManager.sendMessages.deselectAll')}
                      </Button>
                    </div>
                  )}
                </div>
                {loadingCampaignGroups ? (
                  <p className="text-gray-500 text-sm">{t('groupManager.loading')}</p>
                ) : campaignGroups.length === 0 ? (
                  <p className="text-gray-500 text-sm">{t('groupManager.noGroups')}</p>
                ) : (
                  campaignGroups.map((g) => (
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
          </div>
        )}

        {targetType === 'campaign' && (
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('groupManager.sendMessages.selectCampaigns')}</p>
            {instanceCampaigns.map((c) => (
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
            {t('groupManager.sendMessages.allGroups')}: {loadingAllGroups ? '…' : groupsAll.length}
          </p>
        )}

        <hr className="border-gray-200 dark:border-gray-600" />

        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('groupManager.sendMessages.scheduledAt')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('groupManager.sendMessages.dateLabel')}</label>
              <DatePickerCalendar
                value={scheduleDate}
                onChange={setScheduleDate}
                minDateStr={todayStr()}
                labelsWeek={weekLabels}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('groupManager.sendMessages.timeLabel')}</label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full max-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText text-lg"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('groupManager.sendMessages.repeatUntil')} — {t('groupManager.sendMessages.dateLabel')}</label>
              <DatePickerCalendar
                value={repeatUntilDate}
                onChange={setRepeatUntilDate}
                minDateStr={scheduleDate || todayStr()}
                labelsWeek={weekLabels}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('groupManager.sendMessages.timeLabel')}</label>
              <input
                type="time"
                value={repeatUntilTime}
                onChange={(e) => setRepeatUntilTime(e.target.value)}
                className="w-full max-w-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText text-lg"
              />
            </div>
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
