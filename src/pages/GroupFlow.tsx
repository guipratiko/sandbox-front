import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import {
  instanceAPI,
  groupFlowAPI,
  grupoCampaignAPI,
  type Instance,
  type GrupoCampaignRow,
  type GrupoCampaignInclusionRule,
} from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';

function isBaileysInstance(i: Instance): boolean {
  return i.integration !== 'WHATSAPP-CLOUD';
}

function extractGroupFields(item: unknown): { id: string; subject: string; size?: number } {
  if (!item || typeof item !== 'object') return { id: '-', subject: '-' };
  const o = item as Record<string, unknown>;
  const id = String(o.id ?? o.jid ?? o.groupJid ?? '-');
  const subject = String(o.subject ?? o.name ?? '-');
  let size: number | undefined;
  if (typeof o.size === 'number') size = o.size;
  else if (Array.isArray(o.participants)) size = o.participants.length;
  return { id, subject, size };
}

type WizardStep = 'instance' | 'name' | 'import';

const GroupFlow: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesMode = searchParams.get('messages') === '1';

  const [instances, setInstances] = useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  /** Instância selecionada no topo da página (visão geral) */
  const [pageInstanceName, setPageInstanceName] = useState('');
  const [campaigns, setCampaigns] = useState<GrupoCampaignRow[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('instance');
  const [wizardInstance, setWizardInstance] = useState('');
  const [wizardName, setWizardName] = useState('');
  const [wizardContactsPerGroup, setWizardContactsPerGroup] = useState(1024);
  const [importChoice, setImportChoice] = useState<'yes' | 'no' | null>(null);
  const [wizardGroups, setWizardGroups] = useState<unknown[]>([]);
  const [wizardSelectedJids, setWizardSelectedJids] = useState<Set<string>>(() => new Set());
  const [importAllMode, setImportAllMode] = useState(false);
  const [loadingWizardGroups, setLoadingWizardGroups] = useState(false);

  const [openCampaign, setOpenCampaign] = useState<{ campaign: GrupoCampaignRow; groupJids: string[] } | null>(null);
  const [addJidsText, setAddJidsText] = useState('');

  const baileysInstances = useMemo(() => instances.filter(isBaileysInstance), [instances]);
  const connectedBaileys = useMemo(
    () => baileysInstances.filter((i) => i.status === 'connected'),
    [baileysInstances]
  );

  const loadInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      setError(null);
      const res = await instanceAPI.getAll();
      setInstances(res.instances || []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingInstances(false);
    }
  }, [t]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  useEffect(() => {
    if (!instances.length) {
      setPageInstanceName('');
      return;
    }
    const bay = instances.filter(isBaileysInstance);
    const pool = bay.some((i) => i.status === 'connected') ? bay.filter((i) => i.status === 'connected') : bay;
    const preferred = pool[0] ?? bay[0];
    if (!preferred?.instanceName) {
      setPageInstanceName('');
      return;
    }
    setPageInstanceName((prev) => (prev && pool.some((i) => i.instanceName === prev) ? prev : preferred.instanceName));
  }, [instances]);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoadingCampaigns(true);
      setError(null);
      const res = await grupoCampaignAPI.list();
      setCampaigns(res.campaigns || []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingCampaigns(false);
    }
  }, [t]);

  useEffect(() => {
    if (!messagesMode) loadCampaigns();
  }, [messagesMode, loadCampaigns]);

  const resetWizard = () => {
    setWizardStep('instance');
    setWizardInstance(pageInstanceName || connectedBaileys[0]?.instanceName || '');
    setWizardName('');
    setWizardContactsPerGroup(1024);
    setImportChoice(null);
    setWizardGroups([]);
    setWizardSelectedJids(new Set());
    setImportAllMode(false);
  };

  const openWizard = () => {
    resetWizard();
    setWizardInstance(pageInstanceName || connectedBaileys[0]?.instanceName || '');
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
  };

  const loadWizardGroups = useCallback(async () => {
    const inst = wizardInstance.trim();
    if (!inst) return;
    try {
      setLoadingWizardGroups(true);
      setError(null);
      const res = await groupFlowAPI.listGroups(inst, false);
      const list = res.data?.groups;
      setWizardGroups(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      setWizardGroups([]);
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingWizardGroups(false);
    }
  }, [wizardInstance, t]);

  useEffect(() => {
    if (!wizardOpen || wizardStep !== 'import' || importChoice !== 'yes') return;
    loadWizardGroups();
  }, [wizardOpen, wizardStep, importChoice, loadWizardGroups]);

  const toggleJid = (jid: string) => {
    setWizardSelectedJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
    setImportAllMode(false);
  };

  const handleImportAll = () => {
    const all = new Set<string>();
    wizardGroups.forEach((g) => {
      const { id } = extractGroupFields(g);
      if (id && id !== '-') all.add(id);
    });
    setWizardSelectedJids(all);
    setImportAllMode(true);
  };

  const clampContacts = (n: number) => Math.min(1024, Math.max(1, n || 1));

  const submitWizard = async () => {
    const inst = wizardInstance.trim();
    const name = wizardName.trim();
    if (!inst || !name) return;
    let inclusionRule: GrupoCampaignInclusionRule = 'empty';
    let groupJids: string[] | undefined;
    if (importChoice === 'yes') {
      if (importAllMode || wizardSelectedJids.size === 0) {
        inclusionRule = 'all';
      } else {
        inclusionRule = 'explicit';
        groupJids = Array.from(wizardSelectedJids);
      }
    }
    try {
      setError(null);
      await grupoCampaignAPI.create({
        name,
        evolutionInstanceName: inst,
        inclusionRule,
        contactsPerGroupHint: clampContacts(wizardContactsPerGroup),
        groupJids,
      });
      closeWizard();
      await loadCampaigns();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const openCampaignById = async (id: string) => {
    try {
      setError(null);
      const res = await grupoCampaignAPI.get(id);
      setOpenCampaign({ campaign: res.campaign as GrupoCampaignRow, groupJids: res.groupJids });
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm(t('groupFlow.deleteCampaignConfirm'))) return;
    try {
      await grupoCampaignAPI.delete(id);
      setOpenCampaign(null);
      await loadCampaigns();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const handleAddJidsToCampaign = async () => {
    if (!openCampaign) return;
    const jids = addJidsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!jids.length) return;
    try {
      await grupoCampaignAPI.addGroups(openCampaign.campaign.id, jids);
      setAddJidsText('');
      await openCampaignById(openCampaign.campaign.id);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const goMessages = () => {
    const p = new URLSearchParams(searchParams);
    p.set('messages', '1');
    setSearchParams(p, { replace: false });
  };

  const leaveMessages = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('messages');
    setSearchParams(p, { replace: true });
  };

  if (messagesMode) {
    return (
      <AppLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <button
            type="button"
            onClick={leaveMessages}
            className="text-sm font-medium text-clerky-backendButton hover:underline"
          >
            ← {t('groupFlow.messagesBack')}
          </button>

          <Card padding="lg" shadow="md" className="divide-y divide-gray-200 dark:divide-gray-700">
            <div className="pb-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">
                  {t('groupFlow.templatesTitle')}
                </h2>
                <span className="text-sm text-gray-500">{t('groupFlow.templatesCount', { n: '0' })}</span>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{t('groupFlow.templatesEmpty')}</p>
              <div className="flex justify-end">
                <Button type="button" variant="primary" size="sm" disabled title={t('groupFlow.comingSoon')}>
                  {t('groupFlow.createTemplate')}
                </Button>
              </div>
            </div>

            <div className="py-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">
                  {t('groupFlow.scheduledTitle')}
                </h2>
                <span className="text-sm text-gray-500">{t('groupFlow.scheduledCount', { n: '0' })}</span>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">{t('groupFlow.scheduledEmpty')}</p>
              <div className="flex justify-end">
                <Button type="button" variant="primary" size="sm" disabled title={t('groupFlow.comingSoon')}>
                  {t('groupFlow.createSchedule')}
                </Button>
              </div>
            </div>

            <div className="pt-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">
                    {t('groupFlow.immediateTitle')}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xl">{t('groupFlow.immediateDesc')}</p>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button type="button" variant="primary" size="sm" disabled title={t('groupFlow.comingSoon')}>
                  {t('groupFlow.sendNow')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-clerky-backendText dark:text-gray-100">{t('groupFlow.managerTitle')}</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 max-w-xl">{t('groupFlow.managerSubtitle')}</p>
          </div>
          <div className="w-full sm:w-72 flex-shrink-0">
            <label htmlFor="gf-page-instance" className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
              {t('groupFlow.selectInstanceLabel')}
            </label>
            <select
              id="gf-page-instance"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-clerky-backendText dark:text-gray-100 px-3 py-2.5 text-sm"
              value={pageInstanceName}
              onChange={(e) => setPageInstanceName(e.target.value)}
              disabled={loadingInstances || !baileysInstances.length}
            >
              <option value="">{t('groupFlow.selectInstancePlaceholder')}</option>
              {baileysInstances.map((inst) => (
                <option key={inst.id} value={inst.instanceName}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-200"
            role="alert"
          >
            <strong className="font-semibold">{t('groupFlow.error')}: </strong>
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="primary" onClick={openWizard} disabled={!pageInstanceName}>
            {t('groupFlow.newCampaign')}
          </Button>
          <Button type="button" variant="outline" onClick={() => loadCampaigns()} disabled={loadingCampaigns}>
            {t('groupFlow.refreshCampaigns')}
          </Button>
        </div>

        <Card padding="lg" shadow="md" className="bg-white dark:bg-gray-900/40">
          <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100 mb-4">{t('groupFlow.campaignsTitle')}</h2>
          {loadingCampaigns ? (
            <p className="text-sm text-gray-500 py-8 text-center">{t('groupFlow.loading')}</p>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-10 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
              {t('groupFlow.campaignEmpty')}
            </p>
          ) : (
            <ul className="space-y-2">
              {campaigns.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/50 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-clerky-backendText dark:text-gray-100">{c.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {c.evolution_instance_name} · {c.inclusion_rule} · {c.contacts_per_group_hint} contatos/grupo
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => openCampaignById(c.id)}>
                    {t('groupFlow.campaignOpen')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wide">
            {t('groupFlow.messagesSectionTitle')}
          </h2>
          <button
            type="button"
            onClick={goMessages}
            className="w-full text-left rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/60 p-5 shadow-sm hover:border-clerky-backendButton/40 hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-clerky-backendButton/10 text-clerky-backendButton">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.messagesCardTitle')}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('groupFlow.messagesCardDesc')}</p>
              </div>
            </div>
          </button>
        </div>

        {!loadingInstances && !baileysInstances.length && (
          <p className="text-sm text-amber-700 dark:text-amber-300">{t('groupFlow.noBaileysInstances')}</p>
        )}

        {wizardOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" role="dialog">
            <Card padding="none" shadow="lg" className="relative max-w-lg w-full overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-6 py-4">
                <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">
                  {wizardStep === 'instance' && t('groupFlow.wizardStepInstance')}
                  {wizardStep === 'name' && t('groupFlow.wizardStepName')}
                  {wizardStep === 'import' && t('groupFlow.wizardImportTitle')}
                </h3>
                <button
                  type="button"
                  onClick={closeWizard}
                  className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label={t('groupFlow.wizardClose')}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-5 max-h-[min(70vh,520px)] overflow-y-auto">
                {wizardStep === 'instance' && (
                  <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">{t('groupFlow.wizardInstanceHelp')}</p>
                    <select
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-3 text-sm"
                      value={wizardInstance}
                      onChange={(e) => setWizardInstance(e.target.value)}
                    >
                      <option value="">{t('groupFlow.selectInstancePlaceholder')}</option>
                      {baileysInstances.map((inst) => (
                        <option key={inst.id} value={inst.instanceName}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {wizardStep === 'name' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                        {t('groupFlow.wizardCampaignNameLabel')}
                      </label>
                      <input
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
                        value={wizardName}
                        onChange={(e) => setWizardName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                        {t('groupFlow.wizardContactsLabel')}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1024}
                        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm"
                        value={wizardContactsPerGroup}
                        onChange={(e) => setWizardContactsPerGroup(clampContacts(Number(e.target.value)))}
                      />
                      <p className="text-xs text-gray-500 mt-1">{t('groupFlow.wizardContactsHint')}</p>
                    </div>
                  </div>
                )}

                {wizardStep === 'import' && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('groupFlow.wizardImportQuestion')}
                    </p>
                    <div className="flex gap-6">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="importChoice"
                          checked={importChoice === 'yes'}
                          onChange={() => {
                            setImportChoice('yes');
                            setWizardSelectedJids(new Set());
                            setImportAllMode(false);
                          }}
                        />
                        <span>{t('groupFlow.yes')}</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="importChoice"
                          checked={importChoice === 'no'}
                          onChange={() => {
                            setImportChoice('no');
                            setWizardGroups([]);
                            setWizardSelectedJids(new Set());
                            setImportAllMode(false);
                          }}
                        />
                        <span>{t('groupFlow.no')}</span>
                      </label>
                    </div>

                    {importChoice === 'yes' && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
                            {t('groupFlow.selectGroupsLabel')}
                          </span>
                          <Button type="button" variant="outline" size="sm" onClick={handleImportAll} disabled={loadingWizardGroups}>
                            {t('groupFlow.importAll')}
                          </Button>
                        </div>
                        {loadingWizardGroups ? (
                          <p className="text-sm text-gray-500 py-4">{t('groupFlow.loadingGroupsList')}</p>
                        ) : (
                          <ul className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                            {wizardGroups.map((g, idx) => {
                              const row = extractGroupFields(g);
                              const checked = wizardSelectedJids.has(row.id);
                              return (
                                <li key={`${row.id}-${idx}`} className="flex items-center gap-3 px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleJid(row.id)}
                                    disabled={row.id === '-'}
                                  />
                                  <span className="text-sm text-clerky-backendText dark:text-gray-100 truncate">{row.subject}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-6 py-4 bg-gray-50/80 dark:bg-gray-800/50">
                <Button type="button" variant="outline" onClick={closeWizard}>
                  {t('groupFlow.cancel')}
                </Button>
                {wizardStep !== 'instance' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (wizardStep === 'name') setWizardStep('instance');
                      if (wizardStep === 'import') setWizardStep('name');
                    }}
                  >
                    {t('groupFlow.back')}
                  </Button>
                )}
                {wizardStep === 'instance' && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!wizardInstance.trim()}
                    onClick={() => setWizardStep('name')}
                  >
                    {t('groupFlow.advance')}
                  </Button>
                )}
                {wizardStep === 'name' && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={!wizardName.trim()}
                    onClick={() => {
                      setWizardStep('import');
                      setImportChoice(null);
                    }}
                  >
                    {t('groupFlow.advance')}
                  </Button>
                )}
                {wizardStep === 'import' && (
                  <Button
                    type="button"
                    variant="primary"
                    disabled={
                      importChoice === null ||
                      loadingWizardGroups ||
                      (importChoice === 'yes' &&
                        wizardGroups.length > 0 &&
                        !importAllMode &&
                        wizardSelectedJids.size === 0)
                    }
                    onClick={() => submitWizard()}
                  >
                    {t('groupFlow.finish')}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}

        {openCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
            <Card padding="lg" shadow="lg" className="max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl">
              <h3 className="text-lg font-semibold mb-2 text-clerky-backendText dark:text-gray-100">{openCampaign.campaign.name}</h3>
              <p className="text-xs text-gray-500 mb-4">
                {openCampaign.campaign.evolution_instance_name} · {openCampaign.campaign.inclusion_rule}
              </p>
              <p className="text-sm font-medium mb-1">{t('groupFlow.campaignJids')}</p>
              <ul className="text-xs font-mono max-h-32 overflow-y-auto mb-4 space-y-1 border rounded-lg p-2 border-gray-200 dark:border-gray-700">
                {openCampaign.groupJids.length === 0 ? (
                  <li className="text-gray-500">—</li>
                ) : (
                  openCampaign.groupJids.map((j) => <li key={j}>{j}</li>)
                )}
              </ul>
              <label className="block text-sm font-medium mb-1">{t('groupFlow.addJids')}</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono min-h-[80px] mb-3"
                placeholder={t('groupFlow.jidsPlaceholder')}
                value={addJidsText}
                onChange={(e) => setAddJidsText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" size="sm" onClick={handleAddJidsToCampaign}>
                  {t('groupFlow.addJids')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setOpenCampaign(null)}>
                  {t('groupFlow.cancel')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleDeleteCampaign(openCampaign.campaign.id)}>
                  {t('groupFlow.campaignDelete')}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GroupFlow;
