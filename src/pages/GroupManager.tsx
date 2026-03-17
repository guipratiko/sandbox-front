import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button, HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { instanceAPI, Instance } from '../services/api';
import { groupAPI, Group, campaignAPI } from '../services/api';
import { getErrorMessage, logError } from '../utils/errorHandler';
import NewCampaignWizard, { NewCampaignData } from '../components/Groups/NewCampaignWizard';
import EditCampaignModal, { CampaignEditData } from '../components/Groups/EditCampaignModal';
import ConfigureGroupModal from '../components/Groups/ConfigureGroupModal';
import BulkConfigureGroupsModal from '../components/Groups/BulkConfigureGroupsModal';
import CreateGroupsModal from '../components/Groups/CreateGroupsModal';

const GROUP_MANAGER_INSTANCE_KEY = 'groupManager.selectedInstanceId';

export type Campaign = NewCampaignData & {
  id: string;
  photoUrl?: string | null;
  inviteLinkSlug?: string | null;
};

const GroupManager: React.FC = () => {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(true);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<string>('');
  const [isLoadingInstances, setIsLoadingInstances] = useState(true);
  const [isRefreshingCampaigns, setIsRefreshingCampaigns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showNewCampaignWizard, setShowNewCampaignWizard] = useState(false);

  // Detalhe da campanha
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignGroups, setCampaignGroups] = useState<Group[]>([]);
  const [isLoadingCampaignGroups, setIsLoadingCampaignGroups] = useState(false);

  // Modais
  const [showEditCampaignModal, setShowEditCampaignModal] = useState(false);
  const [showConfigureGroupModal, setShowConfigureGroupModal] = useState(false);
  const [configureGroup, setConfigureGroup] = useState<Group | null>(null);
  const [showBulkConfigureModal, setShowBulkConfigureModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const initialGroupIdsRef = useRef<string[]>([]);

  const selectedCampaign = selectedCampaignId ? campaigns.find((c) => c.id === selectedCampaignId) ?? null : null;

  const selectedGroupIdsSet = new Set(selectedGroupIds);
  const toggleGroupSelection = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  }, []);
  const selectAllGroups = useCallback(() => {
    setSelectedGroupIds((prev) => {
      const allIds = campaignGroups.map((g) => g.id);
      const allSelected = allIds.length > 0 && allIds.every((id) => prev.includes(id));
      return allSelected ? [] : allIds;
    });
  }, [campaignGroups]);
  const isAllSelected = campaignGroups.length > 0 && campaignGroups.every((g) => selectedGroupIdsSet.has(g.id));

  const loadInstances = useCallback(async () => {
    try {
      setIsLoadingInstances(true);
      const response = await instanceAPI.getAll();
      setInstances(response.instances);
      if (response.instances.length === 0) {
        setIsLoadingInstances(false);
        return;
      }
      const savedId = localStorage.getItem(GROUP_MANAGER_INSTANCE_KEY);
      const savedExists = savedId && response.instances.some((i) => i.id === savedId);
      if (savedExists) {
        setSelectedInstance(savedId);
      } else if (!selectedInstance) {
        const firstId = response.instances[0].id;
        setSelectedInstance(firstId);
        localStorage.setItem(GROUP_MANAGER_INSTANCE_KEY, firstId);
      }
    } catch (err: unknown) {
      logError('Erro ao carregar instâncias', err);
      setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
    } finally {
      setIsLoadingInstances(false);
    }
  }, [selectedInstance, t]);

  const loadCampaignGroups = useCallback(async () => {
    if (!selectedCampaign || !selectedCampaignId) return;
    try {
      setIsLoadingCampaignGroups(true);
      setError(null);
      if (selectedCampaign.importGroups === null) {
        setCampaignGroups([]);
      } else if (selectedCampaign.importGroups === 'all') {
        const response = await groupAPI.getAll(selectedCampaign.instanceId);
        setCampaignGroups(response.groups ?? []);
      } else {
        const groupJids = selectedCampaign.importGroups;
        const response = await groupAPI.getGroupsByIds(selectedCampaign.instanceId, groupJids);
        const groups = response.groups ?? [];
        const existingIds = groups.map((g) => g.id);
        const removedCount = groupJids.length - existingIds.length;
        if (removedCount > 0) {
          await campaignAPI.update(selectedCampaignId, { importGroups: existingIds });
          setCampaigns((prev) =>
            prev.map((c) =>
              c.id === selectedCampaignId ? { ...c, importGroups: existingIds } : c
            )
          );
        }
        setCampaignGroups(groups);
      }
    } catch (err: unknown) {
      logError('Erro ao carregar grupos da campanha', err);
      setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
    } finally {
      setIsLoadingCampaignGroups(false);
      setSelectedGroupIds([]);
    }
  }, [selectedCampaign, selectedCampaignId, t]);

  useEffect(() => {
    if (selectedCampaignId) loadCampaignGroups();
  }, [selectedCampaignId, loadCampaignGroups]);

  const loadCampaigns = useCallback(async () => {
    try {
      setIsLoadingCampaigns(true);
      const res = await campaignAPI.getAll();
      const list = (res.campaigns ?? []).map((c) => ({
        id: c.id,
        campaignName: c.campaignName,
        contactsPerGroup: c.contactsPerGroup,
        instanceId: c.instanceId,
        importGroups: c.importGroups,
        photoUrl: c.photoUrl ?? null,
        inviteLinkSlug: c.inviteLinkSlug ?? null,
      }));
      setCampaigns(list);
    } catch (err: unknown) {
      logError('Erro ao carregar campanhas', err);
      setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
    } finally {
      setIsLoadingCampaigns(false);
    }
  }, [t]);

  // Se a campanha tem grupos mas não tem link de convite, garante o slug no Backend e atualiza a lista
  useEffect(() => {
    if (!selectedCampaignId || !selectedCampaign) return;
    const groups = selectedCampaign.importGroups;
    const hasGroups = Array.isArray(groups) && groups.length > 0;
    const noSlug = !selectedCampaign.inviteLinkSlug || String(selectedCampaign.inviteLinkSlug).trim() === '';
    if (hasGroups && noSlug) {
      campaignAPI
        .ensureInviteLink(selectedCampaignId)
        .then(() => loadCampaigns())
        .catch(() => {});
    }
  }, [selectedCampaignId, selectedCampaign, loadCampaigns]);

  const refreshCampaigns = useCallback(async () => {
    setError(null);
    setIsRefreshingCampaigns(true);
    try {
      await loadCampaigns();
      setSuccessMessage(t('groupManager.success.refreshed'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } finally {
      setIsRefreshingCampaigns(false);
    }
  }, [t, loadCampaigns]);

  useEffect(() => {
    if (token) loadInstances();
  }, [token, loadInstances]);

  useEffect(() => {
    if (token) loadCampaigns();
  }, [token, loadCampaigns]);

  const handleInstanceChange = (value: string) => {
    setSelectedInstance(value);
    if (value) localStorage.setItem(GROUP_MANAGER_INSTANCE_KEY, value);
    else localStorage.removeItem(GROUP_MANAGER_INSTANCE_KEY);
  };

  const handleCampaignComplete = async (data: NewCampaignData) => {
    try {
      setError(null);
      const res = await campaignAPI.create({
        campaignName: data.campaignName,
        contactsPerGroup: data.contactsPerGroup,
        instanceId: data.instanceId,
        importGroups: data.importGroups,
      });
      const newCampaign: Campaign = {
        id: res.campaign.id,
        campaignName: res.campaign.campaignName,
        contactsPerGroup: res.campaign.contactsPerGroup,
        instanceId: res.campaign.instanceId,
        importGroups: res.campaign.importGroups,
        photoUrl: res.campaign.photoUrl ?? null,
      };
      setCampaigns((prev) => [...prev, newCampaign]);
      setShowNewCampaignWizard(false);
    } catch (err: unknown) {
      logError('Erro ao criar campanha', err);
      setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
    }
  };

  const handleEditCampaignSave = async (data: CampaignEditData) => {
    if (!selectedCampaignId) return;
    try {
      setError(null);
      await campaignAPI.update(selectedCampaignId, {
        campaignName: data.campaignName,
        photoUrl: data.photoUrl ?? null,
      });
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === selectedCampaignId
            ? {
                ...c,
                campaignName: data.campaignName,
                photoUrl: data.photoFile ? URL.createObjectURL(data.photoFile) : data.photoUrl ?? c.photoUrl,
              }
            : c
        )
      );
      setShowEditCampaignModal(false);
    } catch (err: unknown) {
      logError('Erro ao atualizar campanha', err);
      setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
    }
  };

  const handleConfigureGroupSave = (_data: {
    name: string;
    description: string;
    photoFile?: File | null;
    onlyAdminsSend: boolean;
    onlyAdminsEdit: boolean;
    participantsToRemove: string[];
    participantsToAdd: Array<{ phone: string; name?: string }>;
  }) => {
    // TODO: chamar API quando Grupo-Flow tiver endpoints de atualização de grupo
    setShowConfigureGroupModal(false);
    setConfigureGroup(null);
  };

  const handleBulkConfigureSave = async (
    groupIds: string[],
    data: {
      name: string;
      description: string;
      addNumbering?: boolean;
      imageUrl?: string | null;
      onlyAdminsSend: boolean;
      onlyAdminsEdit: boolean;
      participantsToAdd: Array<{ phone: string; name?: string }>;
    }
  ) => {
    if (!selectedCampaign || groupIds.length === 0) return;
    const instanceId = selectedCampaign.instanceId;
    const nameVal = data.name.trim();
    const descVal = data.description.trim();
    const addNumbering = !!data.addNumbering;
    const delayMs = 150;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    try {
      for (let i = 0; i < groupIds.length; i++) {
        const groupJid = groupIds[i];
        if (i > 0) await sleep(delayMs);
        const subject = nameVal ? (addNumbering ? `#${i + 1} ${nameVal}` : nameVal) : '';
        if (subject) await groupAPI.updateGroupSubject(instanceId, groupJid, subject);
        if (descVal) await groupAPI.updateGroupDescription(instanceId, groupJid, descVal);
        if (data.imageUrl) await groupAPI.updateGroupPicture(instanceId, groupJid, data.imageUrl);
        await groupAPI.updateSetting(instanceId, groupJid, data.onlyAdminsSend ? 'announcement' : 'not_announcement');
        await groupAPI.updateSetting(instanceId, groupJid, data.onlyAdminsEdit ? 'locked' : 'unlocked');
        if (data.participantsToAdd.length) {
          await groupAPI.updateParticipant(
            instanceId,
            groupJid,
            'add',
            data.participantsToAdd.map((p) => p.phone)
          );
        }
      }
      setSuccessMessage(t('groupManager.success.refreshed'));
      setTimeout(() => setSuccessMessage(null), 3000);
      setShowBulkConfigureModal(false);
      loadCampaignGroups();
    } catch (err: unknown) {
      logError('Erro ao configurar grupos em massa', err);
      setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
    }
  };

  const handleCreateGroupsDone = useCallback(async () => {
    await loadCampaigns();
    setSuccessMessage(t('groupManager.createGroup.success'));
    setTimeout(() => setSuccessMessage(null), 4000);
  }, [loadCampaigns, t]);

  const handleCreateGroups = useCallback(
    async (params: {
      instanceId: string;
      campaignId: string | null;
      count: number;
      baseName: string;
      description: string;
      addNumbering: boolean;
      participants: string[];
      groupImageUrl?: string | null;
      groupSettings?: { announcement?: boolean; locked?: boolean };
    }) => {
      const { instanceId, campaignId, count, baseName, description, addNumbering, participants, groupImageUrl, groupSettings } = params;
      if (!campaignId) {
        setError(t('groupManager.error.loadGroups'));
        return;
      }
      console.log('[GroupManager] Criar grupos em lote (createBulk)', { instanceId, campaignId, count });
      await groupAPI.createBulk({
        instanceId,
        campaignId,
        count,
        baseName,
        description,
        addNumbering,
        participants,
        ...(groupImageUrl ? { groupImageUrl } : {}),
        ...(groupSettings ? { groupSettings } : {}),
      });
      handleCreateGroupsDone();
    },
    [t, handleCreateGroupsDone]
  );

  const handleOpenCreateGroupModal = useCallback(() => {
    if (!selectedCampaign) return;
    setShowCreateGroupModal(true);
  }, [selectedCampaign]);

  const handleDeleteCampaign = useCallback(async () => {
    if (!selectedCampaignId) return;
    if (!window.confirm(t('groupManager.campaignDetail.confirmDeleteCampaign'))) return;
    try {
      setError(null);
      await campaignAPI.delete(selectedCampaignId);
      setSelectedCampaignId(null);
      await loadCampaigns();
      setSuccessMessage(t('groupManager.campaignDetail.deleteCampaignSuccess'));
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      logError('Erro ao excluir campanha', err);
      setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
    }
  }, [selectedCampaignId, loadCampaigns, t]);

  const removeGroupsFromCampaign = useCallback(
    async (idsToRemove: string[]) => {
      if (!selectedCampaignId || !selectedCampaign || idsToRemove.length === 0) return;
      const instanceId = selectedCampaign.instanceId;
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      console.log('[GroupManager] Removendo grupos da campanha e saindo no WhatsApp:', idsToRemove.length, 'grupos');
      try {
        for (let i = 0; i < idsToRemove.length; i++) {
          if (i > 0) await sleep(800);
          try {
            await groupAPI.leaveGroup(instanceId, idsToRemove[i]);
            console.log('[GroupManager] leaveGroup ok:', idsToRemove[i]);
          } catch (leaveErr: unknown) {
            logError('Erro ao sair do grupo no WhatsApp', leaveErr);
            console.warn('[GroupManager] leaveGroup falhou para', idsToRemove[i], leaveErr);
          }
        }
      } catch (_) {}
      const current = selectedCampaign.importGroups;
      let next: string[] | null = [];
      if (current === 'all') {
        next = campaignGroups.map((g) => g.id).filter((id) => !idsToRemove.includes(id));
      } else if (Array.isArray(current)) {
        next = current.filter((id) => !idsToRemove.includes(id));
      }
      try {
        await campaignAPI.update(selectedCampaignId, { importGroups: next });
        setCampaigns((prev) =>
          prev.map((c) => (c.id === selectedCampaignId ? { ...c, importGroups: next } : c))
        );
        setCampaignGroups((prev) => prev.filter((g) => !idsToRemove.includes(g.id)));
        setSelectedGroupIds((prev) => prev.filter((id) => !idsToRemove.includes(id)));
        setSuccessMessage(t('groupManager.success.refreshed'));
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: unknown) {
        logError('Erro ao remover grupos da campanha', err);
        setError(getErrorMessage(err, t('groupManager.error.loadGroups')));
      }
    },
    [selectedCampaignId, selectedCampaign, campaignGroups, t]
  );

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      if (!window.confirm(t('groupManager.campaignDetail.confirmDeleteGroup'))) return;
      removeGroupsFromCampaign([groupId]);
    },
    [removeGroupsFromCampaign, t]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedGroupIds.length === 0) return;
    if (!window.confirm(t('groupManager.campaignDetail.confirmDeleteSelected'))) return;
    removeGroupsFromCampaign([...selectedGroupIds]);
  }, [selectedGroupIds, removeGroupsFromCampaign, t]);

  const handleDeleteAllGroups = useCallback(() => {
    if (campaignGroups.length === 0) return;
    if (!window.confirm(t('groupManager.campaignDetail.confirmDeleteAllGroups'))) return;
    removeGroupsFromCampaign(campaignGroups.map((g) => g.id));
  }, [campaignGroups, removeGroupsFromCampaign, t]);

  const getInstanceName = (instanceId: string) => {
    return instances.find((i) => i.id === instanceId)?.name ?? instanceId;
  };

  if (isLoadingInstances) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">{t('groupManager.loading')}</p>
        </div>
      </AppLayout>
    );
  }

  // Vista de detalhe da campanha
  if (selectedCampaign) {
    return (
      <AppLayout>
        <div className="animate-fadeIn space-y-4 md:space-y-5 max-w-6xl">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedCampaignId(null)}>
              ← {t('groupManager.campaignDetail.backToCampaigns')}
            </Button>
          </div>
          <Card padding="md" className="rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col gap-5">
              <div className="flex flex-shrink-0 items-start gap-4 min-w-0">
                {selectedCampaign.photoUrl && (
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0">
                    <img src={selectedCampaign.photoUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-clerky-backendText dark:text-gray-200 break-words">
                    {selectedCampaign.campaignName}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 break-words">
                    {getInstanceName(selectedCampaign.instanceId)} · {selectedCampaign.contactsPerGroup} {t('groupManager.contactsPerGroupShort')}
                  </p>
                </div>
              </div>
              {selectedCampaign.inviteLinkSlug && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    {t('groupManager.campaignDetail.inviteLinkTitle')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {t('groupManager.campaignDetail.inviteLinkHint')}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${process.env.REACT_APP_API_URL || 'http://localhost:4331/api'}/public/join/${selectedCampaign.inviteLinkSlug}`}
                      className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-clerky-backendText dark:text-gray-200"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const url = `${process.env.REACT_APP_API_URL || 'http://localhost:4331/api'}/public/join/${selectedCampaign.inviteLinkSlug}`;
                        navigator.clipboard.writeText(url).then(() => {
                          setInviteLinkCopied(true);
                          setTimeout(() => setInviteLinkCopied(false), 2000);
                        });
                      }}
                    >
                      {inviteLinkCopied ? t('groupManager.campaignDetail.inviteLinkCopied') : t('groupManager.campaignDetail.inviteLinkCopy')}
                    </Button>
                  </div>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowEditCampaignModal(true)}>
                    {t('groupManager.campaignDetail.editCampaign')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenCreateGroupModal}>
                    {t('groupManager.campaignDetail.createGroup')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadCampaignGroups}
                    disabled={isLoadingCampaignGroups}
                  >
                    {isLoadingCampaignGroups ? t('groupManager.refreshing') : t('groupManager.campaignDetail.updateGroups')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBulkConfigureModal(true)}
                    disabled={campaignGroups.length === 0}
                  >
                    {t('groupManager.campaignDetail.configureGroups')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteAllGroups}
                    disabled={campaignGroups.length === 0}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-200 dark:border-red-700"
                  >
                    {t('groupManager.campaignDetail.deleteAllGroups')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDeleteCampaign}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-200 dark:border-red-700"
                  >
                    {t('groupManager.campaignDetail.deleteCampaign')}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          {error && (
            <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </Card>
          )}

          <Card padding="md">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200">
                {t('groupManager.campaignDetail.groupsInCampaign')}
              </h2>
              {campaignGroups.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllGroups}>
                    {isAllSelected ? t('groupManager.campaignDetail.deselectAll') : t('groupManager.campaignDetail.selectAll')}
                  </Button>
                  {selectedGroupIds.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteSelected}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-200 dark:border-red-700"
                    >
                      {t('groupManager.campaignDetail.deleteSelected')} ({selectedGroupIds.length})
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isLoadingCampaignGroups ? (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">{t('groupManager.loading')}</p>
            ) : campaignGroups.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">{t('groupManager.noGroups')}</p>
            ) : (
              <div className="space-y-2">
                {campaignGroups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center gap-3 py-3 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30"
                  >
                    <label className="flex items-center shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedGroupIdsSet.has(group.id)}
                        onChange={() => toggleGroupSelection(group.id)}
                        aria-label={group.name ?? group.id}
                        className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton focus:ring-clerky-backendButton"
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-clerky-backendText dark:text-gray-200 truncate">
                        {group.name ?? group.id}
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{group.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setConfigureGroup(group);
                          setShowConfigureGroupModal(true);
                        }}
                      >
                        {t('groupManager.campaignDetail.configure')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border-red-200 dark:border-red-700"
                      >
                        {t('groupManager.campaignDetail.deleteGroup')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <EditCampaignModal
            isOpen={showEditCampaignModal}
            onClose={() => setShowEditCampaignModal(false)}
            initialName={selectedCampaign.campaignName}
            initialPhotoUrl={selectedCampaign.photoUrl}
            onSave={handleEditCampaignSave}
          />

          <ConfigureGroupModal
            isOpen={showConfigureGroupModal}
            onClose={() => {
              setShowConfigureGroupModal(false);
              setConfigureGroup(null);
            }}
            group={configureGroup}
            instanceId={selectedCampaign.instanceId}
            onSave={handleConfigureGroupSave}
          />

          <BulkConfigureGroupsModal
            isOpen={showBulkConfigureModal}
            onClose={() => setShowBulkConfigureModal(false)}
            groups={campaignGroups}
            instanceId={selectedCampaign.instanceId}
            onSave={handleBulkConfigureSave}
          />

          <CreateGroupsModal
            isOpen={showCreateGroupModal}
            onClose={() => setShowCreateGroupModal(false)}
            instanceId={selectedCampaign.instanceId}
            campaignId={selectedCampaignId}
            onCreated={handleCreateGroupsDone}
            onCreateGroups={handleCreateGroups}
          />
        </div>
      </AppLayout>
    );
  }

  // Lista de campanhas
  return (
    <AppLayout>
      <div className="animate-fadeIn space-y-4 md:space-y-5 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-clerky-backendText dark:text-gray-200">
              {t('groupManager.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2 mt-1 text-sm">
              {t('groupManager.subtitle')}
              <HelpIcon helpKey="groupManager" className="ml-1" />
            </p>
          </div>
          <div className="flex items-center gap-2 min-w-0 sm:min-w-[200px] max-w-xs">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap shrink-0">
              {t('groupManager.selectInstance')}
            </label>
            <select
              value={selectedInstance}
              onChange={(e) => handleInstanceChange(e.target.value)}
              className="w-full min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-sm touch-manipulation"
            >
              <option value="">{t('groupManager.selectInstancePlaceholder')}</option>
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="lg" onClick={() => setShowNewCampaignWizard(true)} className="shrink-0">
              {t('groupManager.newCampaign')}
            </Button>
            <Button
              variant="outline"
              onClick={refreshCampaigns}
              disabled={isRefreshingCampaigns}
              className="text-sm shrink-0"
            >
              {isRefreshingCampaigns ? t('groupManager.refreshing') : t('groupManager.refreshCampaigns')}
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          </Card>
        )}

        {successMessage && (
          <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 text-green-700 dark:text-green-400 px-4 py-3 rounded-xl text-sm" role="alert">
            <span className="block sm:inline">{successMessage}</span>
          </div>
        )}

        <Card padding="md">
          <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
            {t('groupManager.campaignsTitle')}
          </h2>
          {isLoadingCampaigns ? (
            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">{t('groupManager.loading')}</p>
          ) : campaigns.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 py-8 text-center">{t('groupManager.noCampaigns')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c) => (
                <Card
                  key={c.id}
                  padding="sm"
                  className="rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-clerky-backendButton transition-colors"
                  onClick={() => setSelectedCampaignId(c.id)}
                >
                  <div className="flex items-start gap-3">
                    {c.photoUrl && (
                      <div className="w-12 h-12 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0">
                        <img src={c.photoUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-clerky-backendText dark:text-gray-200 truncate" title={c.campaignName}>
                        {c.campaignName}
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {getInstanceName(c.instanceId)} · {c.contactsPerGroup} {t('groupManager.contactsPerGroupShort')}
                      </p>
                      {c.importGroups !== null && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {c.importGroups === 'all' ? t('groupManager.campaign.importAll') : `${Array.isArray(c.importGroups) ? c.importGroups.length : 0} grupos`}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Card>

        <NewCampaignWizard
          isOpen={showNewCampaignWizard}
          onClose={() => setShowNewCampaignWizard(false)}
          instances={instances}
          onComplete={handleCampaignComplete}
        />
      </div>
    </AppLayout>
  );
};

export default GroupManager;
