import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { Button, Card, ImageCrop, Modal } from '../UI';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  grupoCampaignAPI,
  grupoFlowMessagesAPI,
  groupFlowAPI,
  type GrupoCampaignRow,
  type GrupoFlowMessageTemplate,
  type GrupoFlowMessageTemplateType,
  type GrupoFlowScheduleRow,
} from '../../services/api';
import { getErrorMessage } from '../../utils/errorHandler';
import { compressImage } from '../../utils/formatters';
import { prepareGroupFlowImageDataUrl } from '../../utils/groupFlowImage';

export type GroupMessagesPageProps = {
  campaigns: GrupoCampaignRow[];
  loadingCampaigns: boolean;
  onReloadCampaigns: () => void | Promise<void>;
  onBack: () => void;
};

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const BTN =
  'inline-flex min-h-[40px] items-center justify-center rounded-xl border-2 border-clerky-backendButton/85 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-clerky-backendButton shadow-sm transition hover:bg-clerky-backendButton/10';

type CampaignGroupPickRow = { jid: string; subject: string };

function extractGroupInfoFromGetInfo(data: unknown): { subject: string; description: string; memberCount: number | null } {
  const unwrap = (v: unknown): Record<string, unknown> | null => {
    if (!v || typeof v !== 'object') return null;
    if (Array.isArray(v)) {
      for (const item of v) {
        const o = unwrap(item);
        if (o) return o;
      }
      return null;
    }
    return v as Record<string, unknown>;
  };
  let o = unwrap(data);
  if (o && typeof o.data === 'object' && o.data !== null) {
    const inner = unwrap(o.data);
    if (inner) o = inner;
  }
  if (!o) return { subject: '', description: '', memberCount: null };
  const subject = String(o.subject ?? o.name ?? o.groupName ?? '');
  const description = String(o.desc ?? o.description ?? o.about ?? '');
  let memberCount: number | null = null;
  if (typeof o.size === 'number' && Number.isFinite(o.size)) memberCount = o.size;
  else if (Array.isArray(o.participants)) memberCount = o.participants.length;
  return { subject, description, memberCount };
}

/** Grupos da campanha (API) + nome amigável via Evolution (sem mostrar JID ao utilizador). */
function useCampaignGroupRows(campaignId: string, enabled: boolean, t: (key: string) => string) {
  const [rows, setRows] = useState<CampaignGroupPickRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !campaignId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRows([]);
    void (async () => {
      try {
        const res = await grupoCampaignAPI.get(campaignId);
        if (cancelled) return;
        const jids = res.groupJids || [];
        const inst = res.campaign.evolution_instance_name;
        const unknownLabel = t('groupFlow.groupNameUnknown');
        const raw: CampaignGroupPickRow[] = await Promise.all(
          jids.map(async (jid) => {
            try {
              const r = await groupFlowAPI.getGroupInfo(inst, jid);
              const { subject } = extractGroupInfoFromGetInfo(r.data);
              const sub = subject.trim() || unknownLabel;
              return { jid, subject: sub };
            } catch {
              return { jid, subject: unknownLabel };
            }
          })
        );
        const usage = new Map<string, number>();
        const out = raw.map((row) => {
          const base = row.subject;
          const seen = (usage.get(base) || 0) + 1;
          usage.set(base, seen);
          const sameName = raw.filter((x) => x.subject === base).length;
          if (sameName <= 1) return row;
          return { ...row, subject: `${base} (${seen})` };
        });
        if (!cancelled) setRows(out);
      } catch {
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId, enabled, t]);

  return { rows, loading };
}

const GroupMessagesPage: React.FC<GroupMessagesPageProps> = ({ campaigns, loadingCampaigns, onReloadCampaigns, onBack }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const scheduleUserIana = useMemo(() => {
    const z = user?.timezone?.trim();
    return z && z.length > 1 ? z : 'America/Sao_Paulo';
  }, [user?.timezone]);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<GrupoFlowMessageTemplate[]>([]);
  const [schedules, setSchedules] = useState<GrupoFlowScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplType, setTplType] = useState<GrupoFlowMessageTemplateType>('text');
  const [tplText, setTplText] = useState('');
  const [tplCaption, setTplCaption] = useState('');
  const [tplMediaUrl, setTplMediaUrl] = useState<string | null>(null);
  const [tplMediaUrlInput, setTplMediaUrlInput] = useState('');
  const [tplPollQuestion, setTplPollQuestion] = useState('');
  const [tplPollOptions, setTplPollOptions] = useState<string[]>(['', '']);
  const [tplPollSelectable, setTplPollSelectable] = useState(1);
  const [locLat, setLocLat] = useState('-23.55');
  const [locLng, setLocLng] = useState('-46.63');
  const [locName, setLocName] = useState('');
  const [locAddress, setLocAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [schTemplateId, setSchTemplateId] = useState('');
  const [schCampaignId, setSchCampaignId] = useState('');
  const [schScope, setSchScope] = useState<'all_campaign' | 'selected'>('all_campaign');
  const [schSelectedJids, setSchSelectedJids] = useState<Set<string>>(() => new Set());
  const [schAt, setSchAt] = useState(() => toDatetimeLocalValue(new Date(Date.now() + 3600000)));

  const [immediateFormOpen, setImmediateFormOpen] = useState(false);
  const [imTemplateId, setImTemplateId] = useState('');
  const [imCampaignId, setImCampaignId] = useState('');
  const [imScope, setImScope] = useState<'all_campaign' | 'selected'>('all_campaign');
  const [imSelectedJids, setImSelectedJids] = useState<Set<string>>(() => new Set());

  const schCampaignGroups = useCampaignGroupRows(schCampaignId, schScope === 'selected', t);
  const imCampaignGroups = useCampaignGroupRows(imCampaignId, imScope === 'selected', t);

  useEffect(() => {
    setSchSelectedJids(new Set());
  }, [schCampaignId, schScope]);

  useEffect(() => {
    setImSelectedJids(new Set());
  }, [imCampaignId, imScope]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, sRes] = await Promise.all([grupoFlowMessagesAPI.listTemplates(), grupoFlowMessagesAPI.listSchedules()]);
      setTemplates(tRes.templates || []);
      setSchedules(sRes.schedules || []);
      await onReloadCampaigns();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoading(false);
    }
  }, [onReloadCampaigns, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const templateTypeLabel = (type: string) => {
    const m: Record<string, string> = {
      text: t('groupFlow.msgTypeText'),
      image: t('groupFlow.msgTypeImage'),
      video: t('groupFlow.msgTypeVideo'),
      audio: t('groupFlow.msgTypeAudio'),
      poll: t('groupFlow.msgTypePoll'),
      location: t('groupFlow.msgTypeLocation'),
      contact: t('groupFlow.msgTypeContact'),
    };
    return m[type] || type;
  };

  const openNewTemplate = () => {
    setTplName('');
    setTplDesc('');
    setTplType('text');
    setTplText('');
    setTplCaption('');
    setTplMediaUrl(null);
    setTplMediaUrlInput('');
    setTplPollQuestion('');
    setTplPollOptions(['', '']);
    setTplPollSelectable(1);
    setLocLat('-23.55');
    setLocLng('-46.63');
    setLocName('');
    setLocAddress('');
    setContactName('');
    setContactPhone('');
    setTemplateModalOpen(true);
  };

  const fillLocationFromBrowser = () => {
    if (!navigator.geolocation) {
      setError(t('groupFlow.msgGeolocationUnavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocLat(String(pos.coords.latitude));
        setLocLng(String(pos.coords.longitude));
      },
      () => setError(t('groupFlow.msgGeolocationDenied'))
    );
  };

  const onPickTemplateImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setError(t('groupFlow.photoFileTooLarge'));
      return;
    }
    try {
      const compressed = await compressImage(file, 1600, 1600, 0.88);
      setCropSrc(compressed);
      setCropOpen(true);
    } catch {
      setError(t('groupFlow.error'));
    }
  };

  const onCropDone = async (croppedBase64: string) => {
    setCropOpen(false);
    setCropSrc(null);
    try {
      const jpeg = await prepareGroupFlowImageDataUrl(croppedBase64);
      const up = await grupoCampaignAPI.uploadGroupFlowImage(jpeg);
      setTplMediaUrl(up.fullUrl);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const saveTemplate = async () => {
    const name = tplName.trim();
    if (!name) return;
    const mediaUrl = (tplMediaUrl || tplMediaUrlInput.trim()) || undefined;
    setSaving(true);
    setError(null);
    try {
      const description = tplDesc.trim() || undefined;
      if (tplType === 'text') {
        if (!tplText.trim()) {
          setError(t('groupFlow.msgTextRequired'));
          setSaving(false);
          return;
        }
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description,
          type: 'text',
          contentText: tplText.trim(),
        });
      } else if (tplType === 'image') {
        if (!mediaUrl) {
          setError(t('groupFlow.msgMediaUrlRequired'));
          setSaving(false);
          return;
        }
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description,
          type: 'image',
          contentText: tplCaption.trim() || undefined,
          mediaUrl,
        });
      } else if (tplType === 'video' || tplType === 'audio') {
        if (!mediaUrl) {
          setError(t('groupFlow.msgMediaUrlRequired'));
          setSaving(false);
          return;
        }
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description,
          type: tplType,
          mediaUrl,
          contentText: tplCaption.trim() || undefined,
        });
      } else if (tplType === 'poll') {
        const values = tplPollOptions.map((o) => o.trim()).filter(Boolean);
        if (!tplPollQuestion.trim() || values.length < 2) {
          setError(t('groupFlow.msgPollInvalid'));
          setSaving(false);
          return;
        }
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description,
          type: 'poll',
          contentText: tplPollQuestion.trim(),
          payload: { values, selectableCount: Math.max(1, tplPollSelectable) },
        });
      } else if (tplType === 'location') {
        const lat = Number(locLat);
        const lng = Number(locLng);
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
          setError(t('groupFlow.msgLocationInvalid'));
          setSaving(false);
          return;
        }
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description,
          type: 'location',
          payload: {
            latitude: lat,
            longitude: lng,
            name: locName.trim() || undefined,
            address: locAddress.trim() || undefined,
          },
        });
      } else if (tplType === 'contact') {
        if (!contactName.trim() || !contactPhone.trim()) {
          setError(t('groupFlow.msgContactInvalid'));
          setSaving(false);
          return;
        }
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description,
          type: 'contact',
          payload: { fullName: contactName.trim(), phone: contactPhone.trim() },
        });
      }
      setTemplateModalOpen(false);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!window.confirm(t('groupFlow.msgDeleteTemplateConfirm'))) return;
    setError(null);
    try {
      await grupoFlowMessagesAPI.deleteTemplate(id);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const submitSchedule = async () => {
    if (!schTemplateId || !schCampaignId) {
      setError(t('groupFlow.error'));
      return;
    }
    let when: Date;
    try {
      when = fromZonedTime(schAt, scheduleUserIana);
    } catch {
      setError(t('groupFlow.msgScheduleTimezoneInvalid'));
      return;
    }
    if (Number.isNaN(when.getTime())) {
      setError(t('groupFlow.error'));
      return;
    }
    const groupJids = schScope === 'selected' ? Array.from(schSelectedJids) : undefined;
    if (schScope === 'selected' && (!groupJids || !groupJids.length)) {
      setError(t('groupFlow.msgSelectGroupsRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await grupoFlowMessagesAPI.createSchedule({
        templateId: schTemplateId,
        campaignId: schCampaignId,
        scheduledAt: when.toISOString(),
        scope: schScope,
        groupJids,
      });
      setScheduleFormOpen(false);
      alert(t('groupFlow.msgScheduleCreated'));
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setSaving(false);
    }
  };

  const cancelSchedule = async (id: string) => {
    if (!window.confirm(t('groupFlow.msgScheduleCancelConfirm'))) return;
    try {
      await grupoFlowMessagesAPI.deleteSchedule(id);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const submitImmediate = async () => {
    if (!imTemplateId || !imCampaignId) {
      setError(t('groupFlow.error'));
      return;
    }
    const groupJids = imScope === 'selected' ? Array.from(imSelectedJids) : undefined;
    if (imScope === 'selected' && (!groupJids || !groupJids.length)) {
      setError(t('groupFlow.msgSelectGroupsRequired'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await grupoFlowMessagesAPI.sendImmediate({
        templateId: imTemplateId,
        campaignId: imCampaignId,
        scope: imScope,
        groupJids,
      });
      alert(t('groupFlow.msgSentTo', { n: String(r.sentTo) }));
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setSaving(false);
    }
  };

  const tplCount = templates.length;
  const schCount = schedules.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button type="button" onClick={onBack} className="text-sm font-medium text-clerky-backendButton hover:underline">
        ← {t('groupFlow.messagesBack')}
      </button>

      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
          role="alert"
        >
          <strong className="font-semibold">{t('groupFlow.error')}: </strong>
          {error}
        </div>
      )}

      <Card padding="lg" shadow="md" className="divide-y divide-gray-200 dark:divide-gray-700">
        <div className="pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.templatesTitle')}</h2>
            <span className="text-sm text-gray-500">{t('groupFlow.templatesCount', { n: String(tplCount) })}</span>
          </div>
          {loading ? (
            <p className="text-center text-sm text-gray-500 py-8">{t('groupFlow.loading')}</p>
          ) : templates.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{t('groupFlow.templatesEmpty')}</p>
          ) : (
            <ul className="space-y-2 mb-4">
              {templates.map((tpl) => (
                <li
                  key={tpl.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-clerky-backendText dark:text-gray-100">{tpl.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {templateTypeLabel(tpl.type)}
                      {tpl.description ? ` · ${tpl.description}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-600 hover:underline dark:text-red-400"
                    onClick={() => void deleteTemplate(tpl.id)}
                  >
                    {t('groupFlow.msgDeleteTemplate')}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-end">
            <Button type="button" variant="primary" size="sm" onClick={openNewTemplate}>
              {t('groupFlow.createTemplate')}
            </Button>
          </div>
        </div>

        <div className="py-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.scheduledTitle')}</h2>
            <span className="text-sm text-gray-500">{t('groupFlow.scheduledCount', { n: String(schCount) })}</span>
          </div>
          {!scheduleFormOpen ? (
            <div className="flex justify-end mb-3">
              <button type="button" className={BTN} onClick={() => setScheduleFormOpen(true)}>
                {t('groupFlow.msgShowScheduleForm')}
              </button>
            </div>
          ) : (
            <div className="mb-4 space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/30">
              <div className="flex justify-end">
                <button type="button" className="text-xs font-semibold text-clerky-backendButton hover:underline" onClick={() => setScheduleFormOpen(false)}>
                  {t('groupFlow.msgHideScheduleForm')}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgSelectTemplate')}</label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={schTemplateId}
                  onChange={(e) => setSchTemplateId(e.target.value)}
                >
                  <option value="">{t('groupFlow.msgPickTemplate')}</option>
                  {templates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({templateTypeLabel(x.type)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgSelectCampaign')}</label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={schCampaignId}
                  onChange={(e) => setSchCampaignId(e.target.value)}
                  disabled={loadingCampaigns}
                >
                  <option value="">{t('groupFlow.msgPickCampaign')}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="schScope" checked={schScope === 'all_campaign'} onChange={() => setSchScope('all_campaign')} />
                  {t('groupFlow.msgScopeEntire')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="schScope" checked={schScope === 'selected'} onChange={() => setSchScope('selected')} />
                  {t('groupFlow.msgScopeSelected')}
                </label>
              </div>
              {schScope === 'selected' && (
                <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{t('groupFlow.msgScopeSelectedHelp')}</p>
                  {!schCampaignId ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">{t('groupFlow.msgPickCampaignFirst')}</p>
                  ) : schCampaignGroups.loading ? (
                    <p className="text-sm text-gray-500 py-2">{t('groupFlow.loading')}</p>
                  ) : schCampaignGroups.rows.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupFlow.noGroupsInCampaign')}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-clerky-backendText dark:text-gray-100">{t('groupFlow.msgGroupsPickTitle')}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={BTN}
                          onClick={() => setSchSelectedJids(new Set(schCampaignGroups.rows.map((r) => r.jid)))}
                        >
                          {t('groupFlow.selectAll')}
                        </button>
                        <button type="button" className={BTN} onClick={() => setSchSelectedJids(new Set())}>
                          {t('groupFlow.deselectAll')}
                        </button>
                      </div>
                      <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
                        {schCampaignGroups.rows.map(({ jid, subject }) => (
                          <li key={jid} className="flex items-start gap-3 px-3 py-2.5">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                              checked={schSelectedJids.has(jid)}
                              onChange={() =>
                                setSchSelectedJids((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(jid)) next.delete(jid);
                                  else next.add(jid);
                                  return next;
                                })
                              }
                              aria-label={subject}
                            />
                            <span className="text-sm font-medium text-clerky-backendText dark:text-gray-100 break-words">{subject}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgScheduleAt')}</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={schAt}
                  onChange={(e) => setSchAt(e.target.value)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('groupFlow.msgScheduleAtTimezoneHint', { tz: scheduleUserIana })}</p>
              </div>
              {!templates.length ? <p className="text-xs text-amber-700 dark:text-amber-300">{t('groupFlow.msgNoTemplateHint')}</p> : null}
              <Button type="button" variant="primary" disabled={saving || !templates.length} isLoading={saving} onClick={() => void submitSchedule()}>
                {t('groupFlow.msgScheduleSubmit')}
              </Button>
            </div>
          )}
          {schedules.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">{t('groupFlow.scheduledEmpty')}</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {schedules.map((s) => (
                <li key={s.id} className="rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2 text-sm flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">{s.template_name ?? '—'}</p>
                    <p className="text-xs text-gray-500">
                      {s.campaign_name ?? '—'} ·{' '}
                      {formatInTimeZone(new Date(s.scheduled_at), scheduleUserIana, 'dd/MM/yyyy, HH:mm:ss')} ·{' '}
                      {s.status === 'pending'
                        ? t('groupFlow.msgStatusPending')
                        : s.status === 'sent'
                          ? t('groupFlow.msgStatusSent')
                          : s.status === 'failed'
                            ? t('groupFlow.msgStatusFailed')
                            : s.status}
                    </p>
                    {s.last_error ? <p className="text-xs text-red-600 mt-1">{s.last_error}</p> : null}
                  </div>
                  {s.status === 'pending' && (
                    <button type="button" className="text-xs text-red-600 font-semibold" onClick={() => void cancelSchedule(s.id)}>
                      {t('groupFlow.msgScheduleCancel')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
            <div>
              <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.immediateTitle')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xl">{t('groupFlow.immediateDesc')}</p>
            </div>
          </div>
          {!immediateFormOpen ? (
            <div className="flex justify-end mt-4">
              <button type="button" className={BTN} onClick={() => setImmediateFormOpen(true)}>
                {t('groupFlow.msgShowImmediateForm')}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/30">
              <div className="flex justify-end">
                <button type="button" className="text-xs font-semibold text-clerky-backendButton hover:underline" onClick={() => setImmediateFormOpen(false)}>
                  {t('groupFlow.msgHideImmediateForm')}
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgSelectTemplate')}</label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={imTemplateId}
                  onChange={(e) => setImTemplateId(e.target.value)}
                >
                  <option value="">{t('groupFlow.msgPickTemplate')}</option>
                  {templates.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name} ({templateTypeLabel(x.type)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgSelectCampaign')}</label>
                <select
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={imCampaignId}
                  onChange={(e) => setImCampaignId(e.target.value)}
                  disabled={loadingCampaigns}
                >
                  <option value="">{t('groupFlow.msgPickCampaign')}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="imScope" checked={imScope === 'all_campaign'} onChange={() => setImScope('all_campaign')} />
                  {t('groupFlow.msgScopeEntire')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="imScope" checked={imScope === 'selected'} onChange={() => setImScope('selected')} />
                  {t('groupFlow.msgScopeSelected')}
                </label>
              </div>
              {imScope === 'selected' && (
                <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{t('groupFlow.msgScopeSelectedHelp')}</p>
                  {!imCampaignId ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">{t('groupFlow.msgPickCampaignFirst')}</p>
                  ) : imCampaignGroups.loading ? (
                    <p className="text-sm text-gray-500 py-2">{t('groupFlow.loading')}</p>
                  ) : imCampaignGroups.rows.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupFlow.noGroupsInCampaign')}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-clerky-backendText dark:text-gray-100">{t('groupFlow.msgGroupsPickTitle')}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={BTN}
                          onClick={() => setImSelectedJids(new Set(imCampaignGroups.rows.map((r) => r.jid)))}
                        >
                          {t('groupFlow.selectAll')}
                        </button>
                        <button type="button" className={BTN} onClick={() => setImSelectedJids(new Set())}>
                          {t('groupFlow.deselectAll')}
                        </button>
                      </div>
                      <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 rounded-lg border border-gray-100 dark:border-gray-800">
                        {imCampaignGroups.rows.map(({ jid, subject }) => (
                          <li key={jid} className="flex items-start gap-3 px-3 py-2.5">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300"
                              checked={imSelectedJids.has(jid)}
                              onChange={() =>
                                setImSelectedJids((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(jid)) next.delete(jid);
                                  else next.add(jid);
                                  return next;
                                })
                              }
                              aria-label={subject}
                            />
                            <span className="text-sm font-medium text-clerky-backendText dark:text-gray-100 break-words">{subject}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              {!templates.length ? <p className="text-xs text-amber-700 dark:text-amber-300">{t('groupFlow.msgNoTemplateHint')}</p> : null}
              <Button type="button" variant="primary" disabled={saving || !templates.length} isLoading={saving} onClick={() => void submitImmediate()}>
                {t('groupFlow.msgSendImmediate')}
              </Button>
            </div>
          )}
        </div>
      </Card>

      {templateModalOpen && (
        <Modal isOpen={templateModalOpen} onClose={() => !saving && setTemplateModalOpen(false)} title={t('groupFlow.msgCreateTemplateTitle')} size="lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('groupFlow.msgTemplateName')}</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder={t('groupFlow.msgTemplateNamePh')}
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('groupFlow.msgTemplateDescription')}</label>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder={t('groupFlow.msgTemplateDescPh')}
                value={tplDesc}
                onChange={(e) => setTplDesc(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('groupFlow.msgTemplateType')}</label>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={tplType}
                onChange={(e) => setTplType(e.target.value as GrupoFlowMessageTemplateType)}
              >
                <option value="text">{t('groupFlow.msgTypeText')}</option>
                <option value="image">{t('groupFlow.msgTypeImage')}</option>
                <option value="video">{t('groupFlow.msgTypeVideo')}</option>
                <option value="audio">{t('groupFlow.msgTypeAudio')}</option>
                <option value="poll">{t('groupFlow.msgTypePoll')}</option>
                <option value="location">{t('groupFlow.msgTypeLocation')}</option>
                <option value="contact">{t('groupFlow.msgTypeContact')}</option>
              </select>
            </div>
            {tplType === 'text' && (
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgTextBody')}</label>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-[120px]" value={tplText} onChange={(e) => setTplText(e.target.value)} />
              </div>
            )}
            {(tplType === 'image' || tplType === 'video' || tplType === 'audio') && (
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgMediaUrl')}</label>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  placeholder={t('groupFlow.msgMediaUrlPh')}
                  value={tplMediaUrlInput}
                  onChange={(e) => setTplMediaUrlInput(e.target.value)}
                />
                {(tplType === 'image' || tplType === 'video') && (
                  <>
                    <label className="block text-sm font-medium mb-1">{t('groupFlow.msgImageCaption')}</label>
                    <input className="w-full rounded-xl border px-3 py-2 text-sm" value={tplCaption} onChange={(e) => setTplCaption(e.target.value)} />
                  </>
                )}
                {tplType === 'image' && (
                  <>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t('groupFlow.msgImageUploadHint')}</p>
                    <input type="file" accept="image/*" className="text-sm" onChange={(e) => void onPickTemplateImage(e)} />
                    {tplMediaUrl ? (
                      <p className="text-xs text-green-700 dark:text-green-400 break-all">{t('groupFlow.msgUploaded')}: {tplMediaUrl}</p>
                    ) : null}
                  </>
                )}
              </div>
            )}
            {tplType === 'poll' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.msgPollQuestion')}</label>
                  <textarea
                    className="w-full rounded-xl border px-3 py-2 text-sm min-h-[72px]"
                    value={tplPollQuestion}
                    onChange={(e) => setTplPollQuestion(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.msgPollOptions')}</label>
                  <div className="space-y-2">
                    {tplPollOptions.map((opt, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          className="flex-1 rounded-xl border px-3 py-2 text-sm"
                          value={opt}
                          onChange={(e) =>
                            setTplPollOptions((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))
                          }
                        />
                        {tplPollOptions.length > 2 ? (
                          <button type="button" className="text-xs text-red-600 font-semibold shrink-0" onClick={() => setTplPollOptions((p) => p.filter((_, i) => i !== idx))}>
                            {t('groupFlow.msgPollRemove')}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <button type="button" className="mt-2 text-xs font-semibold text-clerky-backendButton hover:underline" onClick={() => setTplPollOptions((p) => [...p, ''])}>
                    {t('groupFlow.msgPollAdd')}
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.msgPollSelectable')}</label>
                  <input
                    type="number"
                    min={1}
                    className="w-28 rounded-xl border px-3 py-2 text-sm"
                    value={tplPollSelectable}
                    onChange={(e) => setTplPollSelectable(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </div>
              </div>
            )}
            {tplType === 'location' && (
              <div className="space-y-3">
                <button type="button" className={BTN} onClick={fillLocationFromBrowser}>
                  {t('groupFlow.msgLocUseCurrent')}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('groupFlow.msgLocLat')}</label>
                    <input className="w-full rounded-xl border px-3 py-2 text-sm" value={locLat} onChange={(e) => setLocLat(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">{t('groupFlow.msgLocLng')}</label>
                    <input className="w-full rounded-xl border px-3 py-2 text-sm" value={locLng} onChange={(e) => setLocLng(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.msgLocName')}</label>
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={locName} onChange={(e) => setLocName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.msgLocAddress')}</label>
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} />
                </div>
              </div>
            )}
            {tplType === 'contact' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.msgContactName')}</label>
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.msgContactPhone')}</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder={t('groupFlow.msgContactPhonePh')}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setTemplateModalOpen(false)}>
                {t('groupFlow.cancel')}
              </Button>
              <Button type="button" variant="primary" disabled={saving} isLoading={saving} onClick={() => void saveTemplate()}>
                {t('groupFlow.msgSaveTemplate')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {cropOpen && cropSrc && (
        <Modal
          isOpen={cropOpen}
          onClose={() => {
            if (!saving) {
              setCropOpen(false);
              setCropSrc(null);
            }
          }}
          title={t('groupFlow.msgAdjustImageTitle')}
          size="xl"
          zIndex={100}
        >
          <ImageCrop
            imageSrc={cropSrc}
            onCrop={(b64) => void onCropDone(b64)}
            onCancel={() => {
              setCropOpen(false);
              setCropSrc(null);
            }}
            aspectRatio={1}
            circular={false}
          />
        </Modal>
      )}
    </div>
  );
};

export default GroupMessagesPage;
