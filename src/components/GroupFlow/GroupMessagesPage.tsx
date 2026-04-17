import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, ImageCrop, Modal } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  grupoCampaignAPI,
  grupoFlowMessagesAPI,
  type GrupoCampaignRow,
  type GrupoFlowMessageTemplate,
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

const GroupMessagesPage: React.FC<GroupMessagesPageProps> = ({ campaigns, loadingCampaigns, onReloadCampaigns, onBack }) => {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<GrupoFlowMessageTemplate[]>([]);
  const [schedules, setSchedules] = useState<GrupoFlowScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplType, setTplType] = useState<'text' | 'image'>('text');
  const [tplText, setTplText] = useState('');
  const [tplCaption, setTplCaption] = useState('');
  const [tplMediaUrl, setTplMediaUrl] = useState<string | null>(null);

  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const [scheduleFormOpen, setScheduleFormOpen] = useState(false);
  const [schTemplateId, setSchTemplateId] = useState('');
  const [schCampaignId, setSchCampaignId] = useState('');
  const [schScope, setSchScope] = useState<'all_campaign' | 'selected'>('all_campaign');
  const [schJidsRaw, setSchJidsRaw] = useState('');
  const [schAt, setSchAt] = useState(() => toDatetimeLocalValue(new Date(Date.now() + 3600000)));

  const [immediateFormOpen, setImmediateFormOpen] = useState(false);
  const [imTemplateId, setImTemplateId] = useState('');
  const [imCampaignId, setImCampaignId] = useState('');
  const [imScope, setImScope] = useState<'all_campaign' | 'selected'>('all_campaign');
  const [imJidsRaw, setImJidsRaw] = useState('');

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

  const openNewTemplate = () => {
    setTplName('');
    setTplDesc('');
    setTplType('text');
    setTplText('');
    setTplCaption('');
    setTplMediaUrl(null);
    setTemplateModalOpen(true);
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
    setSaving(true);
    setError(null);
    try {
      if (tplType === 'text') {
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description: tplDesc.trim() || undefined,
          type: 'text',
          contentText: tplText.trim(),
        });
      } else {
        if (!tplMediaUrl) {
          setError(t('groupFlow.error'));
          setSaving(false);
          return;
        }
        await grupoFlowMessagesAPI.createTemplate({
          name,
          description: tplDesc.trim() || undefined,
          type: 'image',
          contentText: tplCaption.trim() || undefined,
          mediaUrl: tplMediaUrl,
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
    const when = new Date(schAt);
    if (Number.isNaN(when.getTime())) return;
    const groupJids =
      schScope === 'selected'
        ? schJidsRaw
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    if (schScope === 'selected' && (!groupJids || !groupJids.length)) {
      setError(t('groupFlow.error'));
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
    const groupJids =
      imScope === 'selected'
        ? imJidsRaw
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    if (imScope === 'selected' && (!groupJids || !groupJids.length)) {
      setError(t('groupFlow.error'));
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
                      {tpl.type === 'text' ? t('groupFlow.msgTypeText') : t('groupFlow.msgTypeImage')}
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
                      {x.name}
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
                <textarea
                  className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
                  rows={4}
                  placeholder={t('groupFlow.msgSelectedJidsPlaceholder')}
                  value={schJidsRaw}
                  onChange={(e) => setSchJidsRaw(e.target.value)}
                />
              )}
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgScheduleAt')}</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={schAt}
                  onChange={(e) => setSchAt(e.target.value)}
                />
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
                      {s.campaign_name ?? '—'} · {new Date(s.scheduled_at).toLocaleString()} ·{' '}
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
                      {x.name}
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
                <textarea
                  className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
                  rows={4}
                  placeholder={t('groupFlow.msgSelectedJidsPlaceholder')}
                  value={imJidsRaw}
                  onChange={(e) => setImJidsRaw(e.target.value)}
                />
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
                onChange={(e) => setTplType(e.target.value as 'text' | 'image')}
              >
                <option value="text">{t('groupFlow.msgTypeText')}</option>
                <option value="image">{t('groupFlow.msgTypeImage')}</option>
              </select>
            </div>
            {tplType === 'text' ? (
              <div>
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgTextBody')}</label>
                <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-[120px]" value={tplText} onChange={(e) => setTplText(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-sm font-medium mb-1">{t('groupFlow.msgImageCaption')}</label>
                <input className="w-full rounded-xl border px-3 py-2 text-sm" value={tplCaption} onChange={(e) => setTplCaption(e.target.value)} />
                <input type="file" accept="image/*" className="text-sm" onChange={(e) => void onPickTemplateImage(e)} />
                {tplMediaUrl ? (
                  <p className="text-xs text-green-700 dark:text-green-400 break-all">URL: {tplMediaUrl}</p>
                ) : (
                  <p className="text-xs text-gray-500">{t('groupFlow.uploadImage')}</p>
                )}
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
