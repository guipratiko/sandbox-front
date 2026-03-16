import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { Group } from '../../services/api';

export type BulkConfigureData = {
  name: string;
  description: string;
  /** Colocar #1, #2, ... antes do nome de cada grupo */
  addNumbering: boolean;
  /** URL da imagem (data URL ou HTTP) a aplicar a todos os grupos; omitir se não alterar foto */
  imageUrl?: string | null;
  onlyAdminsSend: boolean;
  onlyAdminsEdit: boolean;
  participantsToAdd: Array<{ phone: string; name?: string }>;
};

interface BulkConfigureGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  groups: Group[];
  instanceId: string;
  onSave: (groupIds: string[], data: BulkConfigureData) => void;
}

type AddParticipantTab = 'csv' | 'manual' | 'crm';

const BulkConfigureGroupsModal: React.FC<BulkConfigureGroupsModalProps> = ({
  isOpen,
  onClose,
  groups,
  instanceId,
  onSave,
}) => {
  const { t } = useLanguage();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [addNumbering, setAddNumbering] = useState(false);
  const [onlyAdminsSend, setOnlyAdminsSend] = useState(false);
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(false);
  const [addTab, setAddTab] = useState<AddParticipantTab>('manual');
  const [manualParticipants, setManualParticipants] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && groups.length > 0) {
      setSelectedIds(new Set(groups.map((g) => g.id)));
      setName('');
      setDescription('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setAddNumbering(false);
      setOnlyAdminsSend(false);
      setOnlyAdminsEdit(false);
      setManualParticipants('');
    }
  }, [isOpen, groups]);

  const toggleGroup = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(groups.map((g) => g.id)));
    else setSelectedIds(new Set());
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const parseManualParticipants = (): Array<{ phone: string; name?: string }> => {
    const lines = manualParticipants.trim().split(/[\n,;]+/).filter(Boolean);
    return lines
      .map((line) => {
        const parts = line.trim().split(/\s+/);
        const phone = parts[0].replace(/\D/g, '');
        const name = parts[1];
        return { phone, name };
      })
      .filter((p) => p.phone.length >= 10);
  };

  const handleSave = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    onSave(ids, {
      name: name.trim(),
      description: description.trim(),
      addNumbering,
      imageUrl: photoPreview || undefined,
      onlyAdminsSend,
      onlyAdminsEdit,
      participantsToAdd: addTab === 'manual' ? parseManualParticipants() : [],
    });
    onClose();
  };

  const allSelected = groups.length > 0 && selectedIds.size === groups.length;
  const someSelected = selectedIds.size > 0;
  const selectAllRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('groupManager.bulkConfigure.title')}
      size="lg"
      showCloseButton
      contentScroll={false}
    >
      <div className="flex flex-col min-h-0 h-[70vh]">
        <div className="mb-4">
          <h4 className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
            {t('groupManager.bulkConfigure.selectGroups')}
          </h4>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-28 overflow-y-auto space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-clerky-backendText dark:text-gray-200">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
              />
              {t('groupManager.bulkConfigure.selectAll')}
            </label>
            {groups.map((g) => (
              <label
                key={g.id}
                className="flex items-center gap-2 text-sm text-clerky-backendText dark:text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(g.id)}
                  onChange={() => toggleGroup(g.id)}
                  className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
                />
                <span className="truncate">{g.name ?? g.id}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-1 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <Input
            label={t('groupManager.configureGroup.groupName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('groupManager.bulkConfigure.namePlaceholder')}
            className="text-clerky-backendText dark:text-gray-200"
          />
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={addNumbering}
              onChange={(e) => setAddNumbering(e.target.checked)}
              className="mt-1 rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
            />
            <div>
              <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
                {t('groupManager.bulkConfigure.addNumbering')}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('groupManager.bulkConfigure.addNumberingHint')}
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
              {t('groupManager.configureGroup.addParticipants')}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {t('groupManager.bulkConfigure.addParticipantsHint')}
            </p>
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
                rows={3}
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

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <Button variant="outline" onClick={onClose}>
            {t('groupManager.campaign.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={selectedIds.size === 0}>
            {t('groupManager.bulkConfigure.applyToSelected')} ({selectedIds.size})
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default BulkConfigureGroupsModal;
