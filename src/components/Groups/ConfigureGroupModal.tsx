import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { Group, groupAPI, GroupParticipantEvolution } from '../../services/api';

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

/** Número só dígitos para Evolution promote/demote (ex.: 556284049128). */
function digitsForEvolutionAdminAction(p: GroupParticipantEvolution): string | null {
  const fromPhone = String(p.phoneNumber ?? '').replace(/\D/g, '');
  if (fromPhone.length >= 10) return fromPhone;
  const id = String(p.id ?? '');
  const wa = id.match(/^(\d{10,16})@/);
  if (wa && wa[1].length >= 10) return wa[1];
  const digits = id.replace(/\D/g, '');
  return digits.length >= 10 ? digits : null;
}

function isParticipantAdminEvolution(p: GroupParticipantEvolution): boolean {
  const a = p.admin as unknown;
  if (a == null || a === false) return false;
  if (typeof a === 'string') {
    const s = a.toLowerCase().trim();
    if (s === '' || s === 'false' || s === '0') return false;
    return true;
  }
  return true;
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
  const [participantsToPromote, setParticipantsToPromote] = useState<Set<string>>(new Set());
  const [participantsToDemote, setParticipantsToDemote] = useState<Set<string>>(new Set());
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [participantsList, setParticipantsList] = useState<GroupParticipantEvolution[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
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
      setParticipantsToPromote(new Set());
      setParticipantsToDemote(new Set());
      setManualParticipants('');
      setSaveError(null);
      setParticipantsList(group.participants?.length ? [] : []);
      if (group.id && instanceId) {
        setLoadingParticipants(true);
        groupAPI
          .getParticipants(instanceId, group.id)
          .then((r) => setParticipantsList(r.participants ?? []))
          .catch(() => setParticipantsList([]))
          .finally(() => setLoadingParticipants(false));
      }
    }
  }, [group, isOpen, instanceId]);

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

  const togglePromoteAdmin = (participantId: string) => {
    setParticipantsToPromote((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
    setParticipantsToDemote((prev) => {
      const next = new Set(prev);
      next.delete(participantId);
      return next;
    });
  };

  const toggleDemoteAdmin = (participantId: string) => {
    setParticipantsToDemote((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
    setParticipantsToPromote((prev) => {
      const next = new Set(prev);
      next.delete(participantId);
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
    const participantSnapshot: GroupParticipantEvolution[] =
      participantsList.length > 0 ? participantsList : (group!.participants ?? []);
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
      const promotePhones: string[] = [];
      Array.from(participantsToPromote).forEach((pid) => {
        if (participantsToRemove.has(pid)) return;
        const p = participantSnapshot.find((x) => x.id === pid);
        const d = p ? digitsForEvolutionAdminAction(p) : null;
        if (d) promotePhones.push(d);
      });
      if (promotePhones.length) {
        await groupAPI.updateParticipant(instanceId, groupJid, 'promote', promotePhones);
      }
      const demotePhones: string[] = [];
      Array.from(participantsToDemote).forEach((pid) => {
        if (participantsToRemove.has(pid)) return;
        const p = participantSnapshot.find((x) => x.id === pid);
        const d = p ? digitsForEvolutionAdminAction(p) : null;
        if (d) demotePhones.push(d);
      });
      if (demotePhones.length) {
        await groupAPI.updateParticipant(instanceId, groupJid, 'demote', demotePhones);
      }
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
          <h4 className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
            {t('groupManager.configureGroup.removeParticipants')}
          </h4>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
            {loadingParticipants ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.loading')}</p>
            ) : currentParticipants.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.configureGroup.noParticipants')}</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                  {t('groupManager.configureGroup.adminsSectionHint')}
                </p>
                {currentParticipants.map((p) => {
                  const isAdmin = isParticipantAdminEvolution(p);
                  const phoneDigits = digitsForEvolutionAdminAction(p);
                  const canAdminAction = Boolean(phoneDigits);
                  const markedRemove = participantsToRemove.has(p.id);
                  const pendingPromote = participantsToPromote.has(p.id);
                  const pendingDemote = participantsToDemote.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="rounded-lg border border-gray-100 dark:border-gray-600/80 bg-gray-50/50 dark:bg-gray-800/40 p-2.5 space-y-2"
                    >
                      <label className="flex items-center gap-2 text-sm text-clerky-backendText dark:text-gray-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={markedRemove}
                          onChange={() => toggleRemoveParticipant(p.id)}
                          className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton shrink-0"
                        />
                        <span className="min-w-0 flex flex-wrap items-center gap-2">
                          <span className="truncate">
                            {(p as GroupParticipantEvolution).name ??
                              (p as GroupParticipantEvolution).phoneNumber ??
                              p.id}
                          </span>
                          {isAdmin && (
                            <span className="text-xs px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 shrink-0">
                              {t('groupManager.admin')}
                            </span>
                          )}
                          {pendingPromote && (
                            <span className="text-xs text-clerky-backendButton shrink-0">
                              {t('groupManager.configureGroup.pendingPromote')}
                            </span>
                          )}
                          {pendingDemote && (
                            <span className="text-xs text-orange-600 dark:text-orange-400 shrink-0">
                              {t('groupManager.configureGroup.pendingDemote')}
                            </span>
                          )}
                        </span>
                      </label>
                      {!canAdminAction && (
                        <p className="text-xs text-amber-700 dark:text-amber-300 pl-7">
                          {t('groupManager.configureGroup.cannotResolvePhone')}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pl-7">
                        <button
                          type="button"
                          disabled={markedRemove || !canAdminAction || isAdmin}
                          onClick={() => togglePromoteAdmin(p.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            pendingPromote
                              ? 'border-clerky-backendButton bg-clerky-backendButton/15 text-clerky-backendButton'
                              : 'border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800'
                          }`}
                        >
                          {t('groupManager.configureGroup.promoteToAdmin')}
                        </button>
                        <button
                          type="button"
                          disabled={markedRemove || !canAdminAction || !isAdmin}
                          onClick={() => toggleDemoteAdmin(p.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            pendingDemote
                              ? 'border-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-300'
                              : 'border-gray-300 dark:border-gray-600 hover:bg-white dark:hover:bg-gray-800'
                          }`}
                        >
                          {t('groupManager.configureGroup.demoteFromAdmin')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
