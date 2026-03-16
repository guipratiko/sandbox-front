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
          <h4 className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
            {t('groupManager.configureGroup.removeParticipants')}
          </h4>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
            {loadingParticipants ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.loading')}</p>
            ) : currentParticipants.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.configureGroup.noParticipants')}</p>
            ) : (
              currentParticipants.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-clerky-backendText dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={participantsToRemove.has(p.id)}
                    onChange={() => toggleRemoveParticipant(p.id)}
                    className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
                  />
                  <span>{(p as GroupParticipantEvolution).name ?? (p as GroupParticipantEvolution).phoneNumber ?? p.id}</span>
                </label>
              ))
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
