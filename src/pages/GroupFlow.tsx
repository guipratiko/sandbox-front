import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const joinBase = process.env.REACT_APP_PUBLIC_JOIN_BASE_URL?.trim();
  if (joinBase) {
    return `${joinBase.replace(/\/+$/, '')}/${encodeURIComponent(campaignId)}`;
  }
  const api = (process.env.REACT_APP_API_URL || 'http://localhost:4331/api').replace(/\/+$/, '');
  if (api.endsWith('/api')) {
    const host = api.slice(0, -4);
    return `${host}/app/public/join/${encodeURIComponent(campaignId)}`;
  }
  return `${api}/public/join/${encodeURIComponent(campaignId)}`;
}

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

function truncateText(s: string, max: number): string {
  const x = s.trim();
  if (x.length > max) return `${x.slice(0, max)}…`;
  return x;
}

/** Extrai números no formato que a Evolution espera em create/add (só dígitos, DDI+número, 10–15 dígitos). */
function parseParticipantInput(raw: string): string[] {
  const chunks = raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const phones = new Set<string>();
  for (const chunk of chunks) {
    const jid = chunk.match(/(\d{10,15}@s\.whatsapp\.net)/i);
    if (jid) {
      phones.add(jid[1].split('@')[0].replace(/\D/g, ''));
      continue;
    }
    const withName = chunk.match(/(\+?\d[\d\s().-]{8,}\d)\s*$/);
    if (withName) {
      const d = withName[1].replace(/\D/g, '');
      if (d.length >= 10 && d.length <= 15) phones.add(d);
      continue;
    }
    const d = chunk.replace(/\D/g, '');
    if (d.length >= 10 && d.length <= 15) phones.add(d);
  }
  return Array.from(phones);
}

function extractJidFromCreateGroupResponse(data: unknown): string | null {
  const pick = (o: Record<string, unknown> | null): string | null => {
    if (!o) return null;
    for (const k of ['id', 'jid', 'groupJid', 'remoteJid']) {
      const v = o[k];
      if (typeof v === 'string' && v.includes('@g.us')) return v;
    }
    return null;
  };
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const top = pick(o);
  if (top) return top;
  if (o.key && typeof o.key === 'object') return pick(o.key as Record<string, unknown>);
  return null;
}

function normalizeParticipantsList(data: unknown): Array<{ id: string; label: string; admin?: boolean }> {
  const out: Array<{ id: string; label: string; admin?: boolean }> = [];
  let list: unknown[] = [];
  if (Array.isArray(data)) list = data;
  else if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.participants)) list = d.participants;
    else if (d.data && typeof d.data === 'object' && Array.isArray((d.data as { participants?: unknown[] }).participants)) {
      list = (d.data as { participants: unknown[] }).participants;
    }
  }
  for (const item of list) {
    if (typeof item === 'string' && item.includes('@')) {
      out.push({ id: item, label: item.split('@')[0] || item });
      continue;
    }
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const id = String(p.id ?? p.jid ?? '');
    if (!id.includes('@')) continue;
    const admin = Boolean(p.admin ?? p.isAdmin);
    const label = String(p.notify ?? p.name ?? id.split('@')[0] ?? id);
    out.push({ id, label, admin });
  }
  return out;
}

/** Botões da barra de ações da campanha (responsivo, área de toque confortável). */
const CAMPAIGN_ACTION_BTN =
  'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border-2 border-clerky-backendButton/85 bg-white dark:bg-gray-900 px-3 py-2.5 text-center text-xs sm:text-sm font-semibold text-clerky-backendButton shadow-sm transition hover:border-clerky-backendButton hover:bg-clerky-backendButton/10 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton/25 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto';
const CAMPAIGN_DANGER_BTN =
  'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border-2 border-red-500 bg-white dark:bg-gray-900 px-3 py-2.5 text-center text-xs sm:text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300/40 disabled:cursor-not-allowed disabled:opacity-45 dark:text-red-400 dark:hover:bg-red-950/35 sm:w-auto';

function modalParticipantTabClass(active: boolean): string {
  return `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    active
      ? 'bg-clerky-backendButton text-white shadow'
      : 'border-2 border-clerky-backendButton/70 text-clerky-backendButton bg-white dark:bg-gray-900 hover:bg-clerky-backendButton/10'
  }`;
}

type WizardStep = 'instance' | 'name' | 'import';

type CampaignGroupMeta = { jid: string; subject: string; description: string; memberCount: number | null };

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

  const [editCampaignModalOpen, setEditCampaignModalOpen] = useState(false);
  const [editCampaignName, setEditCampaignName] = useState('');
  const [editCampaignPhotoPreview, setEditCampaignPhotoPreview] = useState<string | null>(null);
  const [editCampaignNewPhotoDataUrl, setEditCampaignNewPhotoDataUrl] = useState<string | null>(null);
  const [editCampaignClearPhoto, setEditCampaignClearPhoto] = useState(false);
  const [editCampaignSaving, setEditCampaignSaving] = useState(false);
  const editCampaignFileInputRef = useRef<HTMLInputElement>(null);

  const [createGroupsModalOpen, setCreateGroupsModalOpen] = useState(false);
  const [createGroupCount, setCreateGroupCount] = useState(1);
  const [createGroupBaseName, setCreateGroupBaseName] = useState('');
  const [createGroupNumberPrefix, setCreateGroupNumberPrefix] = useState(true);
  const [createGroupDescription, setCreateGroupDescription] = useState('');
  const [createGroupPhotoUrl, setCreateGroupPhotoUrl] = useState('');
  const [createGroupPhotoDataUrl, setCreateGroupPhotoDataUrl] = useState<string | null>(null);
  const [createGroupAnnounceOnly, setCreateGroupAnnounceOnly] = useState(false);
  const [createGroupLockSettings, setCreateGroupLockSettings] = useState(false);
  const [createGroupParticipantsRaw, setCreateGroupParticipantsRaw] = useState('');
  const [createGroupsSubmitting, setCreateGroupsSubmitting] = useState(false);
  const createGroupPhotoFileRef = useRef<HTMLInputElement>(null);
  const createParticipantsCsvRef = useRef<HTMLInputElement>(null);

  const [bulkConfigureModalOpen, setBulkConfigureModalOpen] = useState(false);
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkNumberSubjects, setBulkNumberSubjects] = useState(false);
  const [bulkDescription, setBulkDescription] = useState('');
  const [bulkPhotoUrl, setBulkPhotoUrl] = useState('');
  const [bulkPhotoDataUrl, setBulkPhotoDataUrl] = useState<string | null>(null);
  const [bulkAddParticipantsRaw, setBulkAddParticipantsRaw] = useState('');
  const [bulkParticipantTab, setBulkParticipantTab] = useState<'manual' | 'csv' | 'crm'>('manual');
  const [bulkAnnounce, setBulkAnnounce] = useState(false);
  const [bulkLock, setBulkLock] = useState(false);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkModalSelectedJids, setBulkModalSelectedJids] = useState<Set<string>>(() => new Set());
  const bulkPhotoFileRef = useRef<HTMLInputElement>(null);
  const bulkParticipantsCsvRef = useRef<HTMLInputElement>(null);

  const [mentionAllModalOpen, setMentionAllModalOpen] = useState(false);
  const [mentionAllMessage, setMentionAllMessage] = useState('');
  const [mentionAllSending, setMentionAllSending] = useState(false);
  /** Se não for null, o envio “mencionar todos” usa só estes JIDs (ex.: um grupo da linha). */
  const [mentionScopedJids, setMentionScopedJids] = useState<string[] | null>(null);

  const [configureSingleJid, setConfigureSingleJid] = useState<string | null>(null);
  const [singleSubject, setSingleSubject] = useState('');
  const [singleDescription, setSingleDescription] = useState('');
  const [singleHashPrefix, setSingleHashPrefix] = useState(false);
  const [singlePhotoUrl, setSinglePhotoUrl] = useState('');
  const [singlePhotoDataUrl, setSinglePhotoDataUrl] = useState<string | null>(null);
  const [singleAddParticipantsRaw, setSingleAddParticipantsRaw] = useState('');
  const [singleParticipantTab, setSingleParticipantTab] = useState<'manual' | 'csv' | 'crm'>('manual');
  const [singleAnnounce, setSingleAnnounce] = useState(false);
  const [singleLock, setSingleLock] = useState(false);
  const [singleParticipantsList, setSingleParticipantsList] = useState<
    Array<{ id: string; label: string; admin?: boolean }>
  >([]);
  const [singleRemoveIds, setSingleRemoveIds] = useState<Set<string>>(() => new Set());
  const [singleSaving, setSingleSaving] = useState(false);
  const [singleLoadingParticipants, setSingleLoadingParticipants] = useState(false);
  const singlePhotoFileRef = useRef<HTMLInputElement>(null);
  const singleParticipantsCsvRef = useRef<HTMLInputElement>(null);

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
              const { subject, description, memberCount } = extractGroupInfoFromGetInfo(r.data);
              const sub = subject.trim() || t('groupFlow.groupNameUnknown');
              return { jid, subject: sub, description: description.trim(), memberCount };
            } catch {
              return { jid, subject: t('groupFlow.groupNameUnknown'), description: '', memberCount: null };
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

  const openEditCampaignModal = () => {
    if (!campaignDetail) return;
    setEditCampaignName(campaignDetail.campaign.name);
    setEditCampaignPhotoPreview(campaignDetail.campaign.photo_url || null);
    setEditCampaignNewPhotoDataUrl(null);
    setEditCampaignClearPhoto(false);
    setEditCampaignModalOpen(true);
  };

  const closeEditCampaignModal = () => {
    setEditCampaignModalOpen(false);
  };

  const onEditCampaignPhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('groupFlow.photoFileTypeInvalid'));
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setError(t('groupFlow.photoFileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      setEditCampaignNewPhotoDataUrl(url);
      setEditCampaignPhotoPreview(url);
      setEditCampaignClearPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const removeEditCampaignPhoto = () => {
    setEditCampaignNewPhotoDataUrl(null);
    setEditCampaignPhotoPreview(null);
    setEditCampaignClearPhoto(true);
  };

  const saveEditCampaign = async () => {
    if (!campaignId || !campaignDetail) return;
    const name = editCampaignName.trim();
    if (!name) return;
    try {
      setEditCampaignSaving(true);
      setError(null);
      const body: {
        name: string;
        photoBase64?: string;
        clearPhoto?: boolean;
      } = { name };
      if (editCampaignNewPhotoDataUrl) body.photoBase64 = editCampaignNewPhotoDataUrl;
      else if (editCampaignClearPhoto) body.clearPhoto = true;
      await grupoCampaignAPI.update(campaignId, body);
      closeEditCampaignModal();
      await refreshCampaignDetail(campaignId);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setEditCampaignSaving(false);
    }
  };

  const resolveCampaignTargetJids = useCallback((): string[] => {
    if (!campaignDetail) return [];
    if (selectedCampaignJids.size > 0) return Array.from(selectedCampaignJids);
    return [...campaignDetail.groupJids];
  }, [campaignDetail, selectedCampaignJids]);

  const toggleAddGroupsModalSelectAll = () => {
    const ids = addGroupsCandidateList
      .map((g) => extractGroupFields(g).id)
      .filter((id): id is string => Boolean(id && id !== '-'));
    const allSelected = ids.length > 0 && ids.every((id) => addGroupsSelected.has(id));
    if (allSelected) setAddGroupsSelected(new Set());
    else setAddGroupsSelected(new Set(ids));
  };

  const openCreateGroupsModal = () => {
    setCreateGroupCount(1);
    setCreateGroupBaseName('');
    setCreateGroupNumberPrefix(true);
    setCreateGroupDescription('');
    setCreateGroupPhotoUrl('');
    setCreateGroupPhotoDataUrl(null);
    setCreateGroupAnnounceOnly(false);
    setCreateGroupLockSettings(false);
    setCreateGroupParticipantsRaw('');
    setCreateGroupsModalOpen(true);
  };

  const onCreateGroupPhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setError(t('groupFlow.photoFileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCreateGroupPhotoDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const submitCreateGroups = async () => {
    if (!campaignId || !campaignDetail) return;
    const base = createGroupBaseName.trim();
    if (!base) return;
    const n = Math.min(100, Math.max(1, Math.floor(createGroupCount) || 1));
    const inst = campaignDetail.campaign.evolution_instance_name;
    const participants = parseParticipantInput(createGroupParticipantsRaw);
    if (!participants.length) {
      setError(t('groupFlow.createGroupsParticipantsRequired'));
      return;
    }
    const desc = createGroupDescription.trim() || undefined;
    const image = createGroupPhotoDataUrl || createGroupPhotoUrl.trim() || undefined;
    setCreateGroupsSubmitting(true);
    setError(null);
    try {
      const newJids: string[] = [];
      for (let i = 1; i <= n; i += 1) {
        const subject = createGroupNumberPrefix ? `#${i} ${base}` : n > 1 ? `${base} ${i}` : base;
        const res = await groupFlowAPI.createGroup(inst, { subject, description: desc, participants });
        const jid = extractJidFromCreateGroupResponse(res.data);
        if (!jid) continue;
        newJids.push(jid);
        await groupFlowAPI.updateGroupSetting(inst, jid, createGroupAnnounceOnly ? 'announcement' : 'not_announcement');
        await groupFlowAPI.updateGroupSetting(inst, jid, createGroupLockSettings ? 'locked' : 'unlocked');
        if (image) await groupFlowAPI.updateGroupPicture(inst, jid, image);
      }
      if (newJids.length) await grupoCampaignAPI.addGroups(campaignId, newJids);
      setCreateGroupsModalOpen(false);
      await refreshCampaignDetail(campaignId);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setCreateGroupsSubmitting(false);
    }
  };

  const openBulkConfigureModal = () => {
    const jids = resolveCampaignTargetJids();
    if (!jids.length) {
      setError(t('groupFlow.selectGroupsForAction'));
      return;
    }
    setBulkModalSelectedJids(new Set(jids));
    setBulkSubject('');
    setBulkNumberSubjects(false);
    setBulkDescription('');
    setBulkPhotoUrl('');
    setBulkPhotoDataUrl(null);
    setBulkAddParticipantsRaw('');
    setBulkParticipantTab('manual');
    setBulkAnnounce(false);
    setBulkLock(false);
    setBulkConfigureModalOpen(true);
  };

  const onBulkPhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setError(t('groupFlow.photoFileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setBulkPhotoDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const onBulkCsvPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkAddParticipantsRaw(String(reader.result || ''));
    reader.readAsText(file);
  };

  const toggleBulkModalJid = (jid: string) => {
    setBulkModalSelectedJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  };

  const toggleBulkModalSelectAll = () => {
    if (!campaignDetail) return;
    const all = campaignDetail.groupJids;
    const allOn = all.length > 0 && all.every((j) => bulkModalSelectedJids.has(j));
    if (allOn) setBulkModalSelectedJids(new Set());
    else setBulkModalSelectedJids(new Set(all));
  };

  const submitBulkConfigure = async () => {
    if (!campaignDetail) return;
    const jids = Array.from(bulkModalSelectedJids);
    if (!jids.length) return;
    const inst = campaignDetail.campaign.evolution_instance_name;
    const adds = parseParticipantInput(bulkAddParticipantsRaw);
    const image = bulkPhotoDataUrl || bulkPhotoUrl.trim() || undefined;
    setBulkApplying(true);
    setError(null);
    try {
      let idx = 0;
      for (const jid of jids) {
        idx += 1;
        if (bulkSubject.trim()) {
          const subj = bulkNumberSubjects ? `#${idx} ${bulkSubject.trim()}` : bulkSubject.trim();
          await groupFlowAPI.updateGroupSubject(inst, jid, subj);
        }
        if (bulkDescription.trim()) {
          await groupFlowAPI.updateGroupDescription(inst, jid, bulkDescription.trim());
        }
        if (adds.length) {
          await groupFlowAPI.updateGroupParticipants(inst, jid, { action: 'add', participants: adds });
        }
        if (image) await groupFlowAPI.updateGroupPicture(inst, jid, image);
        await groupFlowAPI.updateGroupSetting(inst, jid, bulkAnnounce ? 'announcement' : 'not_announcement');
        await groupFlowAPI.updateGroupSetting(inst, jid, bulkLock ? 'locked' : 'unlocked');
      }
      setBulkConfigureModalOpen(false);
      if (campaignId) await refreshCampaignDetail(campaignId);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setBulkApplying(false);
    }
  };

  const openMentionAllModal = () => {
    const jids = resolveCampaignTargetJids();
    if (!jids.length) {
      setError(t('groupFlow.selectGroupsForAction'));
      return;
    }
    setMentionScopedJids(null);
    setMentionAllMessage('');
    setMentionAllModalOpen(true);
  };

  const submitMentionAll = async () => {
    if (!campaignDetail) return;
    const jids = mentionScopedJids ?? resolveCampaignTargetJids();
    const text = mentionAllMessage.trim();
    if (!jids.length || !text) return;
    const inst = campaignDetail.campaign.evolution_instance_name;
    setMentionAllSending(true);
    setError(null);
    try {
      for (const jid of jids) {
        await groupFlowAPI.sendGroupText(inst, jid, { text, mentionsEveryOne: true });
      }
      setMentionAllModalOpen(false);
      setMentionAllMessage('');
      setMentionScopedJids(null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setMentionAllSending(false);
    }
  };

  const openConfigureSingleGroup = (jid: string) => {
    setConfigureSingleJid(jid);
    setSingleSubject('');
    setSingleDescription('');
    setSingleHashPrefix(false);
    setSinglePhotoUrl('');
    setSinglePhotoDataUrl(null);
    setSingleAddParticipantsRaw('');
    setSingleParticipantTab('manual');
    setSingleAnnounce(false);
    setSingleLock(false);
    setSingleParticipantsList([]);
    setSingleRemoveIds(new Set());
  };

  const closeConfigureSingleGroup = () => {
    setConfigureSingleJid(null);
  };

  useEffect(() => {
    if (!configureSingleJid || !campaignDetail) return;
    const inst = campaignDetail.campaign.evolution_instance_name;
    let cancelled = false;
    (async () => {
      setSingleLoadingParticipants(true);
      setError(null);
      try {
        const [infoRes, partRes] = await Promise.all([
          groupFlowAPI.getGroupInfo(inst, configureSingleJid),
          groupFlowAPI.getParticipants(inst, configureSingleJid),
        ]);
        if (cancelled) return;
        const meta = extractGroupInfoFromGetInfo(infoRes.data);
        setSingleSubject(meta.subject.trim());
        setSingleDescription(meta.description.trim());
        setSingleParticipantsList(normalizeParticipantsList(partRes.data));
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e, t('groupFlow.error')));
      } finally {
        if (!cancelled) setSingleLoadingParticipants(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [configureSingleJid, campaignDetail]);

  const toggleSingleRemoveParticipant = (pid: string) => {
    setSingleRemoveIds((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const promoteParticipantNow = async (pid: string) => {
    if (!campaignDetail || !configureSingleJid) return;
    const inst = campaignDetail.campaign.evolution_instance_name;
    try {
      setError(null);
      await groupFlowAPI.updateGroupParticipants(inst, configureSingleJid, { action: 'promote', participants: [pid] });
      const partRes = await groupFlowAPI.getParticipants(inst, configureSingleJid);
      setSingleParticipantsList(normalizeParticipantsList(partRes.data));
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const onSinglePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file?.type.startsWith('image/')) return;
    if (file.size > 2.5 * 1024 * 1024) {
      setError(t('groupFlow.photoFileTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setSinglePhotoDataUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const onSingleCsvPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setSingleAddParticipantsRaw(String(reader.result || ''));
    reader.readAsText(file);
  };

  const saveSingleGroupConfigure = async () => {
    if (!campaignDetail || !configureSingleJid || !campaignId) return;
    const inst = campaignDetail.campaign.evolution_instance_name;
    const jid = configureSingleJid;
    let subj = singleSubject.trim();
    if (singleHashPrefix && subj) subj = `#1 ${subj.replace(/^#\d+\s+/, '')}`;
    const adds = parseParticipantInput(singleAddParticipantsRaw);
    setSingleSaving(true);
    setError(null);
    try {
      if (subj.trim()) await groupFlowAPI.updateGroupSubject(inst, jid, subj.trim());
      await groupFlowAPI.updateGroupDescription(inst, jid, singleDescription.trim());
      if (adds.length) await groupFlowAPI.updateGroupParticipants(inst, jid, { action: 'add', participants: adds });
      for (const rid of Array.from(singleRemoveIds)) {
        await groupFlowAPI.updateGroupParticipants(inst, jid, { action: 'remove', participants: [rid] });
      }
      await groupFlowAPI.updateGroupSetting(inst, jid, singleAnnounce ? 'announcement' : 'not_announcement');
      await groupFlowAPI.updateGroupSetting(inst, jid, singleLock ? 'locked' : 'unlocked');
      const img = singlePhotoDataUrl || singlePhotoUrl.trim();
      if (img) await groupFlowAPI.updateGroupPicture(inst, jid, img);
      closeConfigureSingleGroup();
      await refreshCampaignDetail(campaignId);
      void loadGroupMetas(inst, campaignDetail.groupJids);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setSingleSaving(false);
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
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {campaignDetail.campaign.photo_url ? (
                    <img
                      src={campaignDetail.campaign.photo_url}
                      alt=""
                      className="h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 rounded-2xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm"
                    />
                  ) : (
                    <div className="flex h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-100 to-gray-50 text-sm font-bold uppercase tracking-wide text-clerky-backendButton/50 dark:border-gray-600 dark:from-gray-800 dark:to-gray-900 dark:text-clerky-backendButton/40">
                      {campaignDetail.campaign.name.trim().slice(0, 2) || '—'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h1 className="text-2xl font-bold text-clerky-backendText dark:text-gray-100 break-words">{campaignDetail.campaign.name}</h1>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {t('groupFlow.campaignSubtitleLine', {
                        owner: ownerLabel,
                        contacts: String(campaignDetail.campaign.contacts_per_group_hint),
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{instanceDisplayName}</p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50/90 to-white dark:from-gray-800/50 dark:to-gray-900/30 p-4 sm:p-5 shadow-inner">
                  <p className="text-sm font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.inviteLinkLabel')}</p>
                  <p className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl">
                    {t('groupFlow.inviteLinkHelp', { n: String(campaignDetail.campaign.contacts_per_group_hint) })}
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
                    <input
                      readOnly
                      className="min-h-[44px] flex-1 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-xs sm:text-sm text-clerky-backendText dark:text-gray-100 shadow-sm"
                      value={inviteUrl}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[44px] shrink-0 rounded-xl px-5 sm:self-stretch"
                      onClick={() => handleCopyJoinLink(campaignDetail.campaign.id)}
                    >
                      {t('groupFlow.copyLink')}
                    </Button>
                  </div>
                  {linkCopiedFlash && <p className="mt-2 text-xs text-green-600 dark:text-green-400">{t('groupFlow.linkCopied')}</p>}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={openEditCampaignModal}>
                      {t('groupFlow.editCampaign')}
                    </button>
                    <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={openCreateGroupsModal}>
                      {t('groupFlow.createGroup')}
                    </button>
                    <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={() => void openAddGroupsModal()}>
                      {t('groupFlow.addGroup')}
                    </button>
                    <button
                      type="button"
                      className={CAMPAIGN_ACTION_BTN}
                      disabled={refreshingGroupMeta || !campaignDetail.groupJids.length}
                      onClick={() =>
                        void loadGroupMetas(
                          campaignDetail.campaign.evolution_instance_name,
                          campaignDetail.groupJids
                        )
                      }
                    >
                      {t('groupFlow.refreshGroups')}
                    </button>
                    <button
                      type="button"
                      className={CAMPAIGN_ACTION_BTN}
                      disabled={!campaignDetail.groupJids.length}
                      onClick={openBulkConfigureModal}
                    >
                      {t('groupFlow.configureGroups')}
                    </button>
                    <button
                      type="button"
                      className={CAMPAIGN_ACTION_BTN}
                      disabled={!campaignDetail.groupJids.length}
                      onClick={openMentionAllModal}
                    >
                      {t('groupFlow.mentionAllCampaign')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 border-t border-gray-100 dark:border-gray-800 pt-4">
                    <button
                      type="button"
                      className={CAMPAIGN_DANGER_BTN}
                      disabled={!campaignDetail.groupJids.length}
                      onClick={() => void handleDeleteAllGroupsFromCampaign()}
                    >
                      {t('groupFlow.deleteAllGroups')}
                    </button>
                    <button
                      type="button"
                      className={CAMPAIGN_DANGER_BTN}
                      onClick={() => void handleDeleteCampaign(campaignDetail.campaign.id)}
                    >
                      {t('groupFlow.campaignDelete')}
                    </button>
                  </div>
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
                      const cap = campaignDetail.campaign.contacts_per_group_hint;
                      const countLabel =
                        row?.memberCount != null
                          ? t('groupFlow.groupMembersCount', {
                              current: String(row.memberCount),
                              max: String(cap),
                            })
                          : t('groupFlow.groupMembersCount', { current: '—', max: String(cap) });
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
                              <div className="flex flex-wrap items-baseline gap-2 gap-y-0">
                                <p className="font-semibold text-clerky-backendText dark:text-gray-100">{title}</p>
                                <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400">{countLabel}</span>
                              </div>
                              {desc ? (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{desc}</p>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:flex-shrink-0 sm:justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={() => openConfigureSingleGroup(jid)}>
                              {t('groupFlow.configure')}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setMentionScopedJids([jid]);
                                setMentionAllMessage('');
                                setMentionAllModalOpen(true);
                              }}
                            >
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

              {editCampaignModalOpen && campaignDetail && (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
                  role="dialog"
                  aria-modal
                >
                  <Card padding="none" shadow="lg" className="max-w-md w-full overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
                      <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.editCampaignModalTitle')}</h3>
                      <button
                        type="button"
                        onClick={closeEditCampaignModal}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={t('groupFlow.wizardClose')}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="px-5 py-5 space-y-5 max-h-[min(80vh,520px)] overflow-y-auto">
                      <div>
                        <label htmlFor="gf-edit-campaign-name" className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1.5">
                          {t('groupFlow.wizardCampaignNameLabel')}
                        </label>
                        <input
                          id="gf-edit-campaign-name"
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2.5 text-sm text-clerky-backendText dark:text-gray-100 min-h-[44px]"
                          value={editCampaignName}
                          onChange={(e) => setEditCampaignName(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <div>
                        <p className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1.5">{t('groupFlow.campaignPhotoLabel')}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('groupFlow.campaignPhotoHint')}</p>
                        <input
                          ref={editCampaignFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={onEditCampaignPhotoSelected}
                        />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                          {editCampaignPhotoPreview ? (
                            <img
                              src={editCampaignPhotoPreview}
                              alt=""
                              className="h-24 w-24 rounded-xl object-cover border border-gray-200 dark:border-gray-700"
                            />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-400 dark:border-gray-600">
                              —
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={() => editCampaignFileInputRef.current?.click()}>
                              {t('groupFlow.choosePhoto')}
                            </button>
                            {(editCampaignPhotoPreview ||
                              (campaignDetail.campaign.photo_url && !editCampaignClearPhoto)) && (
                              <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={removeEditCampaignPhoto}>
                                {t('groupFlow.removePhoto')}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4 bg-gray-50/80 dark:bg-gray-800/50">
                      <Button type="button" variant="outline" className="min-h-[44px] rounded-xl px-5" onClick={closeEditCampaignModal}>
                        {t('groupFlow.cancel')}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        className="min-h-[44px] rounded-xl px-6"
                        disabled={!editCampaignName.trim() || editCampaignSaving}
                        isLoading={editCampaignSaving}
                        onClick={() => void saveEditCampaign()}
                      >
                        {t('groupFlow.finish')}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {createGroupsModalOpen && campaignDetail && (
                <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal>
                  <Card padding="none" shadow="lg" className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
                      <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.createGroupsModalTitle')}</h3>
                      <button
                        type="button"
                        onClick={() => setCreateGroupsModalOpen(false)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={t('groupFlow.wizardClose')}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                      <div>
                        <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">{t('groupFlow.createGroupsCountLabel')}</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          value={createGroupCount}
                          onChange={(e) => setCreateGroupCount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                        />
                        <p className="text-xs text-gray-500 mt-1">{t('groupFlow.createGroupsCountHint')}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">{t('groupFlow.createGroupsBaseNameLabel')}</label>
                        <input
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          placeholder={t('groupFlow.createGroupsBaseNamePlaceholder')}
                          value={createGroupBaseName}
                          onChange={(e) => setCreateGroupBaseName(e.target.value)}
                        />
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer text-sm text-clerky-backendText dark:text-gray-200">
                        <input type="checkbox" checked={createGroupNumberPrefix} onChange={(e) => setCreateGroupNumberPrefix(e.target.checked)} className="mt-0.5" />
                        <span>{t('groupFlow.createGroupsNumberPrefix')}</span>
                      </label>
                      <div>
                        <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">{t('groupFlow.createGroupsDescriptionLabel')}</label>
                        <textarea
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[72px]"
                          placeholder={t('groupFlow.createGroupsDescriptionPlaceholder')}
                          value={createGroupDescription}
                          onChange={(e) => setCreateGroupDescription(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">{t('groupFlow.groupPhotoLabel')}</p>
                        <input ref={createGroupPhotoFileRef} type="file" accept="image/*" className="hidden" onChange={onCreateGroupPhotoPick} />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={() => createGroupPhotoFileRef.current?.click()}>
                            {t('groupFlow.uploadImage')}
                          </button>
                        </div>
                        <input
                          className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          placeholder={t('groupFlow.imageUrlPlaceholder')}
                          value={createGroupPhotoUrl}
                          onChange={(e) => {
                            setCreateGroupPhotoUrl(e.target.value);
                            setCreateGroupPhotoDataUrl(null);
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 mb-2">{t('groupFlow.groupOptionsTitle')}</p>
                        <label className="flex items-start gap-2 cursor-pointer text-sm mb-2">
                          <input type="checkbox" checked={createGroupAnnounceOnly} onChange={(e) => setCreateGroupAnnounceOnly(e.target.checked)} className="mt-0.5" />
                          <span>{t('groupFlow.onlyAdminsSend')}</span>
                        </label>
                        <label className="flex items-start gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={createGroupLockSettings} onChange={(e) => setCreateGroupLockSettings(e.target.checked)} className="mt-0.5" />
                          <span>{t('groupFlow.onlyAdminsEditInfo')}</span>
                        </label>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">{t('groupFlow.createGroupsParticipantsLabel')}</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300/90 mb-2">{t('groupFlow.createGroupsParticipantsHint')}</p>
                        <input ref={createParticipantsCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => setCreateGroupParticipantsRaw(String(reader.result || ''));
                          reader.readAsText(f);
                        }} />
                        <div className="flex flex-wrap gap-2 mb-2">
                          <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={() => createParticipantsCsvRef.current?.click()}>
                            {t('groupFlow.uploadCsv')}
                          </button>
                          <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={() => setError(t('groupFlow.crmComingSoon'))}>
                            {t('groupFlow.fromCrm')}
                          </button>
                        </div>
                        <textarea
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[100px]"
                          placeholder={t('groupFlow.participantsPlaceholder')}
                          value={createGroupParticipantsRaw}
                          onChange={(e) => setCreateGroupParticipantsRaw(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 dark:border-gray-800 px-5 py-4 bg-gray-50/80 dark:bg-gray-800/50">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setCreateGroupsModalOpen(false)}>
                        {t('groupFlow.cancel')}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        className="rounded-xl"
                        disabled={!createGroupBaseName.trim() || createGroupsSubmitting}
                        isLoading={createGroupsSubmitting}
                        onClick={() => void submitCreateGroups()}
                      >
                        {t('groupFlow.finish')}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {bulkConfigureModalOpen && campaignDetail && (
                <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal>
                  <Card padding="none" shadow="lg" className="max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
                      <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.bulkConfigureTitle')}</h3>
                      <button
                        type="button"
                        onClick={() => setBulkConfigureModalOpen(false)}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={t('groupFlow.wizardClose')}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('groupFlow.bulkConfigureIntro')}</p>
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.selectGroupsLabel')}</p>
                          <button type="button" className="text-xs font-semibold text-clerky-backendButton hover:underline" onClick={toggleBulkModalSelectAll}>
                            {t('groupFlow.selectAll')}
                          </button>
                        </div>
                        <ul className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
                          {campaignDetail.groupJids.map((jid) => {
                            const row = campaignGroupsMeta.find((m) => m.jid === jid);
                            const title = row?.subject ?? t('groupFlow.groupNameUnknown');
                            return (
                              <li key={jid} className="flex items-center gap-3 px-3 py-2">
                                <input type="checkbox" checked={bulkModalSelectedJids.has(jid)} onChange={() => toggleBulkModalJid(jid)} />
                                <span className="text-sm truncate">{title}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('groupFlow.bulkGroupNameLabel')}</label>
                        <input
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          placeholder={t('groupFlow.bulkGroupNamePlaceholder')}
                          value={bulkSubject}
                          onChange={(e) => setBulkSubject(e.target.value)}
                        />
                        <label className="mt-2 flex items-start gap-2 cursor-pointer text-sm">
                          <input type="checkbox" checked={bulkNumberSubjects} onChange={(e) => setBulkNumberSubjects(e.target.checked)} className="mt-0.5" />
                          <span>
                            {t('groupFlow.bulkNumberGroups')}
                            <span className="block text-xs text-gray-500 font-normal mt-0.5">{t('groupFlow.bulkNumberGroupsHelp')}</span>
                          </span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('groupFlow.createGroupsDescriptionLabel')}</label>
                        <textarea
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[64px]"
                          value={bulkDescription}
                          onChange={(e) => setBulkDescription(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-2">{t('groupFlow.groupPhotoLabel')}</p>
                        <input ref={bulkPhotoFileRef} type="file" accept="image/*" className="hidden" onChange={onBulkPhotoPick} />
                        <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={() => bulkPhotoFileRef.current?.click()}>
                          {t('groupFlow.uploadImage')}
                        </button>
                        <input
                          className="mt-2 w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm"
                          placeholder={t('groupFlow.imageUrlPlaceholder')}
                          value={bulkPhotoUrl}
                          onChange={(e) => {
                            setBulkPhotoUrl(e.target.value);
                            setBulkPhotoDataUrl(null);
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-1">{t('groupFlow.addParticipantsBulk')}</p>
                        <p className="text-xs text-gray-500 mb-2">{t('groupFlow.addParticipantsBulkHelp')}</p>
                        <input ref={bulkParticipantsCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onBulkCsvPick} />
                        <div className="flex flex-wrap gap-2 mb-2">
                          <button type="button" className={modalParticipantTabClass(bulkParticipantTab === 'manual')} onClick={() => setBulkParticipantTab('manual')}>
                            {t('groupFlow.typeManually')}
                          </button>
                          <button type="button" className={modalParticipantTabClass(bulkParticipantTab === 'csv')} onClick={() => setBulkParticipantTab('csv')}>
                            {t('groupFlow.uploadCsv')}
                          </button>
                          <button
                            type="button"
                            className={modalParticipantTabClass(bulkParticipantTab === 'crm')}
                            onClick={() => {
                              setBulkParticipantTab('crm');
                              setError(t('groupFlow.crmComingSoon'));
                            }}
                          >
                            {t('groupFlow.fromCrm')}
                          </button>
                        </div>
                        {bulkParticipantTab !== 'crm' && (
                          <textarea
                            className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[88px]"
                            placeholder={t('groupFlow.participantsPlaceholder')}
                            value={bulkAddParticipantsRaw}
                            onChange={(e) => setBulkAddParticipantsRaw(e.target.value)}
                          />
                        )}
                        {bulkParticipantTab === 'csv' && (
                          <button type="button" className={`mt-2 ${CAMPAIGN_ACTION_BTN}`} onClick={() => bulkParticipantsCsvRef.current?.click()}>
                            {t('groupFlow.uploadCsv')}
                          </button>
                        )}
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={bulkAnnounce} onChange={(e) => setBulkAnnounce(e.target.checked)} className="mt-0.5" />
                        <span>
                          <span className="font-medium">{t('groupFlow.onlyAdminsSendLong')}</span>
                          <span className="block text-xs text-gray-500">{t('groupFlow.onlyAdminsSendHelp')}</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 cursor-pointer text-sm">
                        <input type="checkbox" checked={bulkLock} onChange={(e) => setBulkLock(e.target.checked)} className="mt-0.5" />
                        <span>
                          <span className="font-medium">{t('groupFlow.onlyAdminsSettingsLong')}</span>
                          <span className="block text-xs text-gray-500">{t('groupFlow.onlyAdminsSettingsHelp')}</span>
                        </span>
                      </label>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4 bg-gray-50/80 dark:bg-gray-800/50">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setBulkConfigureModalOpen(false)}>
                        {t('groupFlow.cancel')}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        className="rounded-xl"
                        disabled={!bulkModalSelectedJids.size || bulkApplying}
                        isLoading={bulkApplying}
                        onClick={() => void submitBulkConfigure()}
                      >
                        {t('groupFlow.applyToSelected', { n: String(bulkModalSelectedJids.size) })}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {mentionAllModalOpen && campaignDetail && (
                <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal>
                  <Card padding="none" shadow="lg" className="max-w-lg w-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
                      <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.mentionAllModalTitle')}</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setMentionAllModalOpen(false);
                          setMentionScopedJids(null);
                        }}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                        aria-label={t('groupFlow.wizardClose')}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('groupFlow.mentionAllModalSubtitle', { n: String((mentionScopedJids ?? resolveCampaignTargetJids()).length) })}
                      </p>
                      <div>
                        <label className="block text-sm font-medium mb-1">{t('groupFlow.mentionMessageLabel')}</label>
                        <textarea
                          className="w-full rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm min-h-[140px]"
                          placeholder={t('groupFlow.mentionMessagePlaceholder')}
                          value={mentionAllMessage}
                          onChange={(e) => setMentionAllMessage(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4 bg-gray-50/80 dark:bg-gray-800/50">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => {
                          setMentionAllModalOpen(false);
                          setMentionScopedJids(null);
                        }}
                      >
                        {t('groupFlow.cancel')}
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        className="rounded-xl"
                        disabled={!mentionAllMessage.trim() || mentionAllSending}
                        isLoading={mentionAllSending}
                        onClick={() => void submitMentionAll()}
                      >
                        {t('groupFlow.sendToAllGroups')}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {configureSingleJid && campaignDetail && (
                <div className="fixed inset-0 z-[58] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal>
                  <Card padding="none" shadow="lg" className="max-w-lg w-full max-h-[92vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 px-5 py-4">
                      <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.configureSingleTitle')}</h3>
                      <button type="button" onClick={closeConfigureSingleGroup} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('groupFlow.wizardClose')}>
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
                      {singleLoadingParticipants ? (
                        <p className="text-sm text-gray-500">{t('groupFlow.loading')}</p>
                      ) : (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-1">{t('groupFlow.bulkGroupNameLabel')}</label>
                            <input className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm" value={singleSubject} onChange={(e) => setSingleSubject(e.target.value)} />
                            <label className="mt-2 flex items-start gap-2 cursor-pointer text-sm">
                              <input type="checkbox" checked={singleHashPrefix} onChange={(e) => setSingleHashPrefix(e.target.checked)} className="mt-0.5" />
                              <span>
                                {t('groupFlow.addHashToName')}
                                <span className="block text-xs text-gray-500">{t('groupFlow.addHashToNameHelp')}</span>
                              </span>
                            </label>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">{t('groupFlow.createGroupsDescriptionLabel')}</label>
                            <textarea className="w-full rounded-xl border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm min-h-[64px]" value={singleDescription} onChange={(e) => setSingleDescription(e.target.value)} />
                          </div>
                          <div>
                            <p className="text-sm font-medium mb-2">{t('groupFlow.groupPhotoLabel')}</p>
                            <input ref={singlePhotoFileRef} type="file" accept="image/*" className="hidden" onChange={onSinglePhotoPick} />
                            <button type="button" className={CAMPAIGN_ACTION_BTN} onClick={() => singlePhotoFileRef.current?.click()}>
                              {t('groupFlow.uploadImage')}
                            </button>
                            <input className="mt-2 w-full rounded-xl border px-3 py-2 text-sm" placeholder={t('groupFlow.imageUrlPlaceholder')} value={singlePhotoUrl} onChange={(e) => { setSinglePhotoUrl(e.target.value); setSinglePhotoDataUrl(null); }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-1">{t('groupFlow.participantsSection')}</p>
                            <p className="text-xs text-gray-500 mb-2">{t('groupFlow.participantsListHelp')}</p>
                            <ul className="max-h-36 overflow-y-auto rounded-xl border divide-y">
                              {singleParticipantsList.map((p, idx) => (
                                <li key={p.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                                  <span className="font-medium tabular-nums">{p.label}</span>
                                  {idx === 0 && (
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-violet-100 text-violet-800">{t('groupFlow.creatorBadge')}</span>
                                  )}
                                  <label className="ml-auto flex items-center gap-1 text-xs cursor-pointer">
                                    <input type="checkbox" checked={singleRemoveIds.has(p.id)} onChange={() => toggleSingleRemoveParticipant(p.id)} />
                                    {t('groupFlow.deleteOnSave')}
                                  </label>
                                  {!p.admin && (
                                    <button type="button" className="text-xs font-semibold text-teal-600 hover:underline" onClick={() => void promoteParticipantNow(p.id)}>
                                      {t('groupFlow.makeAdmin')}
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-sm font-semibold mb-2">{t('groupFlow.addParticipantsBulk')}</p>
                            <input ref={singleParticipantsCsvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onSingleCsvPick} />
                            <div className="flex flex-wrap gap-2 mb-2">
                              <button type="button" className={modalParticipantTabClass(singleParticipantTab === 'manual')} onClick={() => setSingleParticipantTab('manual')}>
                                {t('groupFlow.typeManually')}
                              </button>
                              <button type="button" className={modalParticipantTabClass(singleParticipantTab === 'csv')} onClick={() => setSingleParticipantTab('csv')}>
                                {t('groupFlow.uploadCsv')}
                              </button>
                              <button type="button" className={modalParticipantTabClass(singleParticipantTab === 'crm')} onClick={() => { setSingleParticipantTab('crm'); setError(t('groupFlow.crmComingSoon')); }}>
                                {t('groupFlow.fromCrm')}
                              </button>
                            </div>
                            {singleParticipantTab !== 'crm' && (
                              <textarea className="w-full rounded-xl border px-3 py-2 text-sm min-h-[80px]" placeholder={t('groupFlow.participantsPlaceholder')} value={singleAddParticipantsRaw} onChange={(e) => setSingleAddParticipantsRaw(e.target.value)} />
                            )}
                            {singleParticipantTab === 'csv' && (
                              <button type="button" className={`mt-2 ${CAMPAIGN_ACTION_BTN}`} onClick={() => singleParticipantsCsvRef.current?.click()}>
                                {t('groupFlow.uploadCsv')}
                              </button>
                            )}
                          </div>
                          <label className="flex items-start gap-2 cursor-pointer text-sm">
                            <input type="checkbox" checked={singleAnnounce} onChange={(e) => setSingleAnnounce(e.target.checked)} className="mt-0.5" />
                            <span><span className="font-medium">{t('groupFlow.onlyAdminsSendLong')}</span><span className="block text-xs text-gray-500">{t('groupFlow.onlyAdminsSendHelp')}</span></span>
                          </label>
                          <label className="flex items-start gap-2 cursor-pointer text-sm">
                            <input type="checkbox" checked={singleLock} onChange={(e) => setSingleLock(e.target.checked)} className="mt-0.5" />
                            <span><span className="font-medium">{t('groupFlow.onlyAdminsSettingsLong')}</span><span className="block text-xs text-gray-500">{t('groupFlow.onlyAdminsSettingsHelp')}</span></span>
                          </label>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-4 bg-gray-50/80 dark:bg-gray-800/50">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={closeConfigureSingleGroup}>
                        {t('groupFlow.cancel')}
                      </Button>
                      <Button type="button" variant="primary" className="rounded-xl" disabled={singleSaving || singleLoadingParticipants} isLoading={singleSaving} onClick={() => void saveSingleGroupConfigure()}>
                        {t('groupFlow.finish')}
                      </Button>
                    </div>
                  </Card>
                </div>
              )}

              {addGroupsModalOpen && (
                <div
                  className="fixed inset-0 z-[58] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
                  role="dialog"
                  aria-modal
                >
                  <Card padding="lg" shadow="lg" className="max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
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
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('groupFlow.addGroupsModalIntro')}</p>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.addGroupsModalSelectSection')}</p>
                      <button type="button" className="text-xs font-semibold text-clerky-backendButton hover:underline" onClick={toggleAddGroupsModalSelectAll}>
                        {t('groupFlow.selectAll')}
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
                        {t('groupFlow.addButton')}
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
