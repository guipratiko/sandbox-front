import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { Group, groupAPI, GroupParticipantEvolution } from '../../services/api';
import { getGroupParticipantCardDisplay, normalizeGroupParticipantFromApi } from '../../utils/groupUtils';

interface ConfigureGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: Group | null;
  instanceId: string;
  onSave: (data: {
    name: string;
    description: string;
    addNumberingToName?: boolean;
    photoFile?: File | null;
    onlyAdminsSend: boolean;
    onlyAdminsEdit: boolean;
    participantsToRemove: string[];
    participantsToAdd: Array<{ phone: string; name?: string }>;
  }) => void;
}

type AddParticipantTab = 'csv' | 'manual' | 'crm';

function isEvolutionGroupAdmin(p: GroupParticipantEvolution): boolean {
  const a = p.admin;
  if (a == null || a === '') return false;
  if (typeof a === 'boolean') return a;
  const s = String(a).toLowerCase();
  return s === 'true' || s === '1' || s === 'admin' || s === 'superadmin';
}

/** Criador do grupo (superadmin) — não oferecemos «remover admin» para evitar erro da API. */
function isEvolutionSuperAdmin(p: GroupParticipantEvolution): boolean {
  const a = p.admin;
  if (a == null || a === '') return false;
  return String(a).toLowerCase() === 'superadmin';
}

const ConfigureGroupModal: React.FC<ConfigureGroupModalProps> = ({
  isOpen,
  onClose,
  group,
  instanceId,
  onSave,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(false);
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(false);
  const [addTab, setAddTab] = useState<AddParticipantTab>('manual');
  const [manualParticipants, setManualParticipants] = useState('');
  const [addNumberingToName, setAddNumberingToName] = useState(false);
  const [participantsToRemove, setParticipantsToRemove] = useState<Set<string>>(new Set());
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [participantsList, setParticipantsList] = useState<GroupParticipantEvolution[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [adminMutationParticipantId, setAdminMutationParticipantId] = useState<string | null>(null);
  const [adminMutationError, setAdminMutationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const updateScrollHint = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const canScrollDown = el.scrollHeight - el.scrollTop > el.clientHeight + 8;
    setShowScrollHint(canScrollDown);
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateScrollHint();
    el.addEventListener('scroll', updateScrollHint);
    const ro = new ResizeObserver(updateScrollHint);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollHint);
      ro.disconnect();
    };
  }, [group, isOpen]);

  useEffect(() => {
    if (group && isOpen) {
      setName(group.name ?? '');
      setDescription(group.description ?? '');
      setAddNumberingToName(false);
      setPhotoPreview(group.pictureUrl ?? null);
      setOnlyAdminsSend(group.announcement ?? false);
      setOnlyAdminsEdit(group.locked ?? false);
      setParticipantsToRemove(new Set());
      setManualParticipants('');
      setSaveError(null);
      setAdminMutationError(null);
      setAdminMutationParticipantId(null);
      setParticipantsList(group.participants?.length ? [] : []);
      if (group.id && instanceId) {
        setLoadingParticipants(true);
        groupAPI
          .getParticipants(instanceId, group.id)
          .then((r) =>
            setParticipantsList(
              (r.participants ?? []).map((row) =>
                normalizeGroupParticipantFromApi(row as GroupParticipantEvolution)
              )
            )
          )
          .catch(() => setParticipantsList([]))
          .finally(() => setLoadingParticipants(false));
      }
    }
  }, [group, isOpen, instanceId]);

  const refreshParticipants = useCallback(async () => {
    if (!group?.id || !instanceId) return;
    setLoadingParticipants(true);
    try {
      const r = await groupAPI.getParticipants(instanceId, group.id);
      setParticipantsList(r.participants ?? []);
    } catch {
      setParticipantsList([]);
    } finally {
      setLoadingParticipants(false);
    }
  }, [group?.id, instanceId]);

  const runAdminMutation = async (
    participantId: string,
    action: 'promote' | 'demote',
    confirmKey: string,
    errorKey: string
  ) => {
    if (!group?.id) return;
    if (!window.confirm(t(confirmKey))) return;
    setAdminMutationError(null);
    setAdminMutationParticipantId(participantId);
    try {
      await groupAPI.updateParticipant(instanceId, group.id, action, [participantId]);
      await refreshParticipants();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t(errorKey);
      setAdminMutationError(message);
    } finally {
      setAdminMutationParticipantId(null);
    }
  };

  const handlePromoteToAdmin = (participantId: string) =>
    void runAdminMutation(
      participantId,
      'promote',
      'groupManager.configureGroup.promoteToAdminConfirm',
      'groupManager.configureGroup.promoteToAdminError'
    );

  const handleDemoteFromAdmin = (participantId: string) =>
    void runAdminMutation(
      participantId,
      'demote',
      'groupManager.configureGroup.demoteFromAdminConfirm',
      'groupManager.configureGroup.demoteFromAdminError'
    );

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleRemoveParticipant = (id: string) => {
    setParticipantsToRemove((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const parseManualParticipants = (): Array<{ phone: string; name?: string }> => {
    const lines = manualParticipants.trim().split(/[\n,;]+/).filter(Boolean);
    return lines.map((line) => {
      const parts = line.trim().split(/\s+/);
      const phone = parts[0].replace(/\D/g, '');
      const name = parts[1];
      return { phone, name };
    }).filter((p) => p.phone.length >= 10);
  };

  const handleSave = async () => {
    const groupJid = group!.id;
    const nameVal = addNumberingToName ? `#1 ${name.trim()}`.trim() : name.trim();
    const descVal = description.trim();
    const toRemove = Array.from(participantsToRemove);
    const toAdd = addTab === 'manual' ? parseManualParticipants() : [];
    setSaving(true);
    setSaveError(null);
    try {
      await groupAPI.updateGroupSubject(instanceId, groupJid, nameVal);
      await groupAPI.updateGroupDescription(instanceId, groupJid, descVal);
      if (photoPreview && (photoFile || group!.pictureUrl !== photoPreview)) {
        await groupAPI.updateGroupPicture(instanceId, groupJid, photoPreview);
      }
      await groupAPI.updateSetting(
        instanceId,
        groupJid,
        onlyAdminsSend ? 'announcement' : 'not_announcement'
      );
      await groupAPI.updateSetting(instanceId, groupJid, onlyAdminsEdit ? 'locked' : 'unlocked');
      if (toRemove.length) {
        await groupAPI.updateParticipant(instanceId, groupJid, 'remove', toRemove);
      }
      if (toAdd.length) {
        await groupAPI.updateParticipant(
          instanceId,
          groupJid,
          'add',
          toAdd.map((p) => p.phone)
        );
      }
      onSave({
        name: nameVal,
        description: descVal,
        photoFile: photoFile ?? undefined,
        onlyAdminsSend,
        onlyAdminsEdit,
        participantsToRemove: toRemove,
        participantsToAdd: toAdd,
      });
      onClose();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Erro ao salvar';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!group) return null;

  const currentParticipants = participantsList.length ? participantsList : (group.participants ?? []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('groupManager.configureGroup.title')}
      size="lg"
      showCloseButton
      contentScroll={false}
    >
      <div className="flex flex-col min-h-0 max-h-[70vh]">
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-6 pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          onScroll={updateScrollHint}
        >
          <Input
          label={t('groupManager.configureGroup.groupName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-clerky-backendText dark:text-gray-200"
        />
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={addNumberingToName}
            onChange={(e) => setAddNumberingToName(e.target.checked)}
            className="mt-1 rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
          />
          <div>
            <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
              {t('groupManager.configureGroup.addNumberingToName')}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {t('groupManager.configureGroup.addNumberingToNameHint')}
            </p>
          </div>
        </label>
        <Input
          label={t('groupManager.configureGroup.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="text-clerky-backendText dark:text-gray-200"
        />
        <div>
          <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
            {t('groupManager.configureGroup.photo')}
          </label>
          <div className="flex items-center gap-4">
            {(photoPreview || photoFile) && (
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                <img
                  src={photoPreview ?? (photoFile ? URL.createObjectURL(photoFile) : '')}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              {t('groupManager.configureGroup.photo')}
            </Button>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 mb-1">
            {t('groupManager.configureGroup.participantsSectionTitle')}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('groupManager.configureGroup.removeParticipantsHint')}
          </p>
          <p className="text-xs text-clerky-backendButton/90 dark:text-emerald-300/90 mb-3 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {t('groupManager.configureGroup.adminActionsHint')}
          </p>
          {adminMutationError && (
            <p className="text-sm text-red-600 dark:text-red-400 mb-2">{adminMutationError}</p>
          )}
          <div className="space-y-2.5">
            {loadingParticipants ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-600">
                {t('groupManager.loading')}
              </p>
            ) : currentParticipants.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-600">
                {t('groupManager.configureGroup.noParticipants')}
              </p>
            ) : (
              currentParticipants.map((p) => {
                const pe = p as GroupParticipantEvolution;
                const { title: cardTitle, subtitle: cardSubtitle, avatarInitial } = getGroupParticipantCardDisplay(pe);
                const isAdmin = isEvolutionGroupAdmin(pe);
                const isSuper = isEvolutionSuperAdmin(pe);
                const busy = adminMutationParticipantId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 transition-shadow ${
                      isAdmin
                        ? 'border-amber-200/80 bg-amber-50/40 dark:border-amber-800/50 dark:bg-amber-950/25'
                        : 'border-gray-200 dark:border-gray-600 bg-white/80 dark:bg-[#0a1628]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          isAdmin
                            ? 'bg-amber-200 text-amber-950 dark:bg-amber-800/80 dark:text-amber-50'
                            : 'bg-clerky-backendButton/15 text-clerky-backendButton dark:bg-clerky-backendButton/25 dark:text-emerald-200'
                        }`}
                        aria-hidden
                      >
                        {avatarInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-sm text-clerky-backendText dark:text-gray-100 truncate">
                            {cardTitle}
                          </span>
                          {isSuper && (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-md bg-violet-200 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100">
                              {t('groupManager.configureGroup.groupCreatorBadge')}
                            </span>
                          )}
                          {isAdmin && !isSuper && (
                            <span className="shrink-0 text-[10px] uppercase tracking-wide font-bold px-2 py-0.5 rounded-md bg-amber-200 text-amber-950 dark:bg-amber-800/70 dark:text-amber-50">
                              {t('groupManager.admin')}
                            </span>
                          )}
                        </div>
                        {cardSubtitle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 tabular-nums">
                            {cardSubtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 shrink-0 sm:ml-auto">
                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-gray-600 dark:text-gray-400 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/80 border border-transparent hover:border-gray-200 dark:hover:border-gray-600">
                        <input
                          type="checkbox"
                          checked={participantsToRemove.has(p.id)}
                          onChange={() => toggleRemoveParticipant(p.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton shrink-0"
                        />
                        <span>{t('groupManager.configureGroup.removeFromGroupShort')}</span>
                      </label>

                      <div className="flex flex-wrap gap-2 sm:pl-2 sm:border-l sm:border-gray-200 sm:dark:border-gray-600">
                        {!isAdmin && (
                          <button
                            type="button"
                            disabled={saving || (!!adminMutationParticipantId && !busy)}
                            onClick={() => handlePromoteToAdmin(p.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm ring-1 ring-emerald-500/30 min-w-[8.5rem]"
                          >
                            {busy ? (
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                                />
                              </svg>
                            )}
                            <span className="hidden sm:inline">{t('groupManager.configureGroup.promoteToAdmin')}</span>
                            <span className="sm:hidden">{t('groupManager.configureGroup.promoteToAdminShort')}</span>
                          </button>
                        )}
                        {isAdmin && !isSuper && (
                          <button
                            type="button"
                            disabled={saving || (!!adminMutationParticipantId && !busy)}
                            onClick={() => handleDemoteFromAdmin(p.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-amber-950 dark:text-amber-100 bg-white dark:bg-gray-900/80 border-2 border-amber-300 dark:border-amber-600/80 hover:bg-amber-50 dark:hover:bg-amber-950/50 disabled:opacity-50 disabled:cursor-not-allowed min-w-[8.5rem]"
                          >
                            {busy ? (
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                                />
                              </svg>
                            )}
                            <span className="hidden sm:inline">{t('groupManager.configureGroup.demoteFromAdmin')}</span>
                            <span className="sm:hidden">{t('groupManager.configureGroup.demoteFromAdminShort')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
            {t('groupManager.configureGroup.addParticipants')}
          </h4>
          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => setAddTab('manual')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                addTab === 'manual'
                  ? 'bg-clerky-backendButton text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t('groupManager.configureGroup.addManually')}
            </button>
            <button
              type="button"
              onClick={() => setAddTab('csv')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                addTab === 'csv'
                  ? 'bg-clerky-backendButton text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t('groupManager.configureGroup.addFromCsv')}
            </button>
            <button
              type="button"
              onClick={() => setAddTab('crm')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                addTab === 'crm'
                  ? 'bg-clerky-backendButton text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {t('groupManager.configureGroup.addFromCrm')}
            </button>
          </div>
          {addTab === 'manual' && (
            <textarea
              value={manualParticipants}
              onChange={(e) => setManualParticipants(e.target.value)}
              placeholder={t('groupManager.configureGroup.manualPlaceholder')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-clerky-backendText dark:text-gray-200 text-sm"
            />
          )}
          {addTab === 'csv' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Upload de arquivo CSV (TODO: integrar quando API estiver disponível).
            </p>
          )}
          {addTab === 'crm' && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Seleção de contatos do CRM (TODO: integrar quando API estiver disponível).
            </p>
          )}
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyAdminsSend}
              onChange={(e) => setOnlyAdminsSend(e.target.checked)}
              className="mt-1 rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
            />
            <div>
              <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
                {t('groupManager.configureGroup.onlyAdminsSend')}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('groupManager.configureGroup.onlyAdminsSendHint')}
              </p>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyAdminsEdit}
              onChange={(e) => setOnlyAdminsEdit(e.target.checked)}
              className="mt-1 rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
            />
            <div>
              <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
                {t('groupManager.configureGroup.onlyAdminsEdit')}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('groupManager.configureGroup.onlyAdminsEditHint')}
              </p>
            </div>
          </label>
        </div>
        </div>
        {showScrollHint && (
          <div className="flex justify-center py-2 border-t border-gray-100 dark:border-gray-700/80 shrink-0" aria-hidden>
            <span className="text-gray-400 dark:text-gray-500" title={t('groupManager.configureGroup.scrollHint')}>
              <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </span>
          </div>
        )}
      {saveError && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-2 shrink-0">{saveError}</p>
      )}
      <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
        <Button variant="outline" onClick={onClose} disabled={saving}>
          {t('groupManager.campaign.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? t('groupManager.updating') : t('groupManager.campaign.finish')}
        </Button>
      </div>
      </div>
    </Modal>
  );
};

export default ConfigureGroupModal;
