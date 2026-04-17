import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
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

function buildPublicJoinUrl(campaignId: string): string {
  const raw = (process.env.REACT_APP_API_URL || 'http://localhost:4331/api').replace(/\/+$/, '');
  return `${raw}/public/join/${encodeURIComponent(campaignId)}`;
}

function extractGroupInfoFromGetInfo(data: unknown): { subject: string; description: string } {
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
  if (!o) return { subject: '', description: '' };
  const subject = String(o.subject ?? o.name ?? o.groupName ?? '');
  const description = String(o.desc ?? o.description ?? o.about ?? '');
  return { subject, description };
}

function truncateText(s: string, max: number): string {
  const x = s.trim();
  if (x.length <= max) return x;
  return `${x.slice(0, max)}…`;
}

type WizardStep = 'instance' | 'name' | 'import';

type CampaignGroupMeta = { jid: string; subject: string; description: string };

const GroupFlow: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const messagesMode = searchParams.get('messages') === '1';
  const campaignId = searchParams.get('campaign');

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

  const [campaignDetail, setCampaignDetail] = useState<{ campaign: GrupoCampaignRow; groupJids: string[] } | null>(null);
  const [loadingCampaignDetail, setLoadingCampaignDetail] = useState(false);
  const [campaignDetailError, setCampaignDetailError] = useState<string | null>(null);
  const [campaignGroupsMeta, setCampaignGroupsMeta] = useState<CampaignGroupMeta[]>([]);
  const [refreshingGroupMeta, setRefreshingGroupMeta] = useState(false);
  const [selectedCampaignJids, setSelectedCampaignJids] = useState<Set<string>>(() => new Set());
  const [linkCopiedFlash, setLinkCopiedFlash] = useState(false);

  const [addGroupsModalOpen, setAddGroupsModalOpen] = useState(false);
  const [loadingAddGroupsModalList, setLoadingAddGroupsModalList] = useState(false);
  const [addGroupsCandidateList, setAddGroupsCandidateList] = useState<unknown[]>([]);
  const [addGroupsSelected, setAddGroupsSelected] = useState<Set<string>>(() => new Set());
  const [addGroupsSubmitting, setAddGroupsSubmitting] = useState(false);

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
    if (!messagesMode && !campaignId) loadCampaigns();
  }, [messagesMode, campaignId, loadCampaigns]);

  const refreshCampaignDetail = useCallback(
    async (id: string) => {
      setLoadingCampaignDetail(true);
      setCampaignDetailError(null);
      try {
        const res = await grupoCampaignAPI.get(id);
        setCampaignDetail({ campaign: res.campaign as GrupoCampaignRow, groupJids: res.groupJids });
      } catch (e: unknown) {
        setCampaignDetail(null);
        setCampaignDetailError(getErrorMessage(e, t('groupFlow.error')));
      } finally {
        setLoadingCampaignDetail(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!campaignId) {
      setCampaignDetail(null);
      setCampaignGroupsMeta([]);
      setSelectedCampaignJids(new Set());
      setCampaignDetailError(null);
      return;
    }
    void refreshCampaignDetail(campaignId);
  }, [campaignId, refreshCampaignDetail]);

  const loadGroupMetas = useCallback(
    async (inst: string, jids: string[]) => {
      if (!jids.length) {
        setCampaignGroupsMeta([]);
        return;
      }
      setRefreshingGroupMeta(true);
      try {
        const metas: CampaignGroupMeta[] = await Promise.all(
          jids.map(async (jid) => {
            try {
              const r = await groupFlowAPI.getGroupInfo(inst, jid);
              const { subject, description } = extractGroupInfoFromGetInfo(r.data);
              const sub = subject.trim() || t('groupFlow.groupNameUnknown');
              return { jid, subject: sub, description: description.trim() };
            } catch {
              return { jid, subject: t('groupFlow.groupNameUnknown'), description: '' };
            }
          })
        );
        setCampaignGroupsMeta(metas);
      } finally {
        setRefreshingGroupMeta(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!campaignDetail) return;
    void loadGroupMetas(campaignDetail.campaign.evolution_instance_name, campaignDetail.groupJids);
  }, [campaignDetail, loadGroupMetas]);

  useEffect(() => {
    if (!campaignDetail?.groupJids) return;
    const allowed = new Set(campaignDetail.groupJids);
    setSelectedCampaignJids((prev) => {
      const next = new Set<string>();
      prev.forEach((j) => {
        if (allowed.has(j)) next.add(j);
      });
      return next;
    });
  }, [campaignDetail?.groupJids]);

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

  const openCampaignById = (id: string) => {
    setError(null);
    const p = new URLSearchParams(searchParams);
    p.set('campaign', id);
    p.delete('messages');
    setSearchParams(p);
  };

  const closeCampaignDetail = () => {
    const p = new URLSearchParams(searchParams);
    p.delete('campaign');
    setSearchParams(p);
    void loadCampaigns();
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm(t('groupFlow.deleteCampaignConfirm'))) return;
    try {
      setError(null);
      await grupoCampaignAPI.delete(id);
      closeCampaignDetail();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const handleCopyJoinLink = async (id: string) => {
    const url = buildPublicJoinUrl(id);
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiedFlash(true);
      window.setTimeout(() => setLinkCopiedFlash(false), 2000);
    } catch {
      setError(t('groupFlow.error'));
    }
  };

  const toggleCampaignGroupSelect = (jid: string) => {
    setSelectedCampaignJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const handleSelectAllCampaignGroups = () => {
    if (!campaignDetail) return;
    const all = campaignDetail.groupJids;
    const allSelected = all.length > 0 && all.every((j) => selectedCampaignJids.has(j));
    if (allSelected) setSelectedCampaignJids(new Set());
    else setSelectedCampaignJids(new Set(all));
  };

  const handleRemoveGroupFromCampaign = async (jid: string) => {
    if (!campaignDetail || !campaignId) return;
    if (!window.confirm(t('groupFlow.deleteGroupConfirm'))) return;
    try {
      setError(null);
      await grupoCampaignAPI.removeGroup(campaignId, jid);
      await refreshCampaignDetail(campaignId);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const handleDeleteAllGroupsFromCampaign = async () => {
    if (!campaignDetail || !campaignId) return;
    if (!window.confirm(t('groupFlow.deleteAllGroupsConfirm'))) return;
    try {
      setError(null);
      for (const jid of campaignDetail.groupJids) {
        await grupoCampaignAPI.removeGroup(campaignId, jid);
      }
      await refreshCampaignDetail(campaignId);
      setSelectedCampaignJids(new Set());
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const openAddGroupsModal = async () => {
    if (!campaignDetail) return;
    const inst = campaignDetail.campaign.evolution_instance_name;
    setAddGroupsModalOpen(true);
    setAddGroupsSelected(new Set());
    setAddGroupsCandidateList([]);
    try {
      setLoadingAddGroupsModalList(true);
      setError(null);
      const res = await groupFlowAPI.listGroups(inst, false);
      const list = res.data?.groups;
      const arr = Array.isArray(list) ? list : [];
      const inCampaign = new Set(campaignDetail.groupJids);
      const filtered = arr.filter((g) => {
        const { id } = extractGroupFields(g);
        return id && id !== '-' && !inCampaign.has(id);
      });
      setAddGroupsCandidateList(filtered);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
      setAddGroupsCandidateList([]);
    } finally {
      setLoadingAddGroupsModalList(false);
    }
  };

  const toggleAddGroupCandidate = (jid: string) => {
    setAddGroupsSelected((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const submitAddGroupsModal = async () => {
    if (!campaignId || addGroupsSelected.size === 0) return;
    try {
      setAddGroupsSubmitting(true);
      setError(null);
      await grupoCampaignAPI.addGroups(campaignId, Array.from(addGroupsSelected));
      setAddGroupsModalOpen(false);
      setAddGroupsSelected(new Set());
      await refreshCampaignDetail(campaignId);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setAddGroupsSubmitting(false);
    }
  };

  const instanceDisplayName = useMemo(() => {
    if (!campaignDetail) return '';
    return (
      instances.find((i) => i.instanceName === campaignDetail.campaign.evolution_instance_name)?.name ??
      campaignDetail.campaign.evolution_instance_name
    );
  }, [campaignDetail, instances]);

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

  if (campaignId) {
    const ownerLabel = (user?.name && user.name.trim()) || user?.email || '—';
    const inviteUrl = campaignDetail ? buildPublicJoinUrl(campaignDetail.campaign.id) : '';

    return (
      <AppLayout>
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
          <button
            type="button"
            onClick={closeCampaignDetail}
            className="text-sm font-medium text-clerky-backendButton hover:underline"
          >
            ← {t('groupFlow.backToCampaigns')}
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

          {loadingCampaignDetail && !campaignDetail ? (
            <p className="text-sm text-gray-500 py-12 text-center">{t('groupFlow.loadingCampaign')}</p>
          ) : campaignDetailError && !campaignDetail ? (
            <Card padding="lg" shadow="md">
              <p className="text-sm text-red-700 dark:text-red-300">{campaignDetailError}</p>
              <Button type="button" variant="outline" className="mt-4" onClick={closeCampaignDetail}>
                {t('groupFlow.backToCampaigns')}
              </Button>
            </Card>
          ) : campaignDetail ? (
            <>
              <Card padding="lg" shadow="md" className="bg-white dark:bg-gray-900/40">
                <h1 className="text-2xl font-bold text-clerky-backendText dark:text-gray-100">{campaignDetail.campaign.name}</h1>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {t('groupFlow.campaignSubtitleLine', {
                    owner: ownerLabel,
                    contacts: String(campaignDetail.campaign.contacts_per_group_hint),
                  })}
                </p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{instanceDisplayName}</p>

                <div className="mt-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-4">
                  <p className="text-sm font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.inviteLinkLabel')}</p>
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {t('groupFlow.inviteLinkHelp', { n: String(campaignDetail.campaign.contacts_per_group_hint) })}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <input
                      readOnly
                      className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-xs text-clerky-backendText dark:text-gray-100"
                      value={inviteUrl}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => handleCopyJoinLink(campaignDetail.campaign.id)}>
                      {t('groupFlow.copyLink')}
                    </Button>
                  </div>
                  {linkCopiedFlash && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{t('groupFlow.linkCopied')}</p>}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" disabled title={t('groupFlow.comingSoon')}>
                    {t('groupFlow.editCampaign')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled title={t('groupFlow.comingSoon')}>
                    {t('groupFlow.createGroup')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void openAddGroupsModal()}>
                    {t('groupFlow.addGroup')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={refreshingGroupMeta || !campaignDetail.groupJids.length}
                    onClick={() =>
                      void loadGroupMetas(
                        campaignDetail.campaign.evolution_instance_name,
                        campaignDetail.groupJids
                      )
                    }
                  >
                    {t('groupFlow.refreshGroups')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled title={t('groupFlow.comingSoon')}>
                    {t('groupFlow.configureGroups')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled title={t('groupFlow.comingSoon')}>
                    {t('groupFlow.mentionAllCampaign')}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!campaignDetail.groupJids.length}
                    onClick={() => void handleDeleteAllGroupsFromCampaign()}
                    className="text-sm font-semibold rounded-lg border-2 border-red-600 text-red-600 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('groupFlow.deleteAllGroups')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteCampaign(campaignDetail.campaign.id)}
                    className="text-sm font-semibold rounded-lg border-2 border-red-600 text-red-600 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    {t('groupFlow.campaignDelete')}
                  </button>
                </div>
              </Card>

              <Card padding="lg" shadow="md" className="bg-white dark:bg-gray-900/40">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.campaignGroupsTitle')}</h2>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!campaignDetail.groupJids.length}
                    onClick={handleSelectAllCampaignGroups}
                  >
                    {t('groupFlow.selectAll')}
                  </Button>
                </div>

                {refreshingGroupMeta && campaignDetail.groupJids.length > 0 && campaignGroupsMeta.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">{t('groupFlow.loading')}</p>
                ) : campaignDetail.groupJids.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    {t('groupFlow.noGroupsInCampaign')}
                  </p>
                ) : (
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
                    {campaignDetail.groupJids.map((jid) => {
                      const row = campaignGroupsMeta.find((m) => m.jid === jid);
                      const title = row?.subject ?? t('groupFlow.groupNameUnknown');
                      const desc = truncateText(row?.description ?? '', 140);
                      const checked = selectedCampaignJids.has(jid);
                      return (
                        <li key={jid} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between bg-white dark:bg-gray-900/20">
                          <div className="flex gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 flex-shrink-0 rounded border-gray-300"
                              checked={checked}
                              onChange={() => toggleCampaignGroupSelect(jid)}
                              aria-label={title}
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-clerky-backendText dark:text-gray-100">{title}</p>
                              {desc ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{desc}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:flex-shrink-0 sm:justify-end">
                            <Button type="button" variant="outline" size="sm" disabled title={t('groupFlow.comingSoon')}>
                              {t('groupFlow.configure')}
                            </Button>
                            <Button type="button" variant="outline" size="sm" disabled title={t('groupFlow.comingSoon')}>
                              {t('groupFlow.mentionAll')}
                            </Button>
                            <button
                              type="button"
                              onClick={() => void handleRemoveGroupFromCampaign(jid)}
                              className="text-sm font-semibold rounded-lg border-2 border-red-600 text-red-600 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              {t('groupFlow.deleteGroup')}
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              {addGroupsModalOpen && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
                  role="dialog"
                  aria-modal
                >
                  <Card padding="lg" shadow="lg" className="max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.addGroupsModalTitle')}</h3>
                      <button
                        type="button"
                        onClick={() => setAddGroupsModalOpen(false)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={t('groupFlow.wizardClose')}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1 min-h-0">
                      {loadingAddGroupsModalList ? (
                        <p className="text-sm text-gray-500 py-6">{t('groupFlow.loadingGroupsList')}</p>
                      ) : addGroupsCandidateList.length === 0 ? (
                        <p className="text-sm text-gray-500 py-6">{t('groupFlow.addGroupsModalEmpty')}</p>
                      ) : (
                        <ul className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                          {addGroupsCandidateList.map((g, idx) => {
                            const row = extractGroupFields(g);
                            const sel = addGroupsSelected.has(row.id);
                            return (
                              <li key={`${row.id}-${idx}`} className="flex items-center gap-3 px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={sel}
                                  onChange={() => toggleAddGroupCandidate(row.id)}
                                  disabled={row.id === '-'}
                                />
                                <span className="text-sm text-clerky-backendText dark:text-gray-100 truncate">{row.subject}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                      <Button type="button" variant="outline" onClick={() => setAddGroupsModalOpen(false)}>
                        {t('groupFlow.cancel')}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        disabled={addGroupsSelected.size === 0 || addGroupsSubmitting}
                        isLoading={addGroupsSubmitting}
                        onClick={() => void submitAddGroupsModal()}
                      >
                        {t('groupFlow.addGroupsModalSubmit')}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </>
          ) : null}
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
      </div>
    </AppLayout>
  );
};

export default GroupFlow;
