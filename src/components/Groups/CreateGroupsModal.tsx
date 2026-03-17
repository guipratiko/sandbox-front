import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { groupAPI, crmAPI, dispatchAPI, type Contact } from '../../services/api';
import ImageCrop from '../UI/ImageCrop';

const MAX_GROUPS = 100;
const RECOMMENDED_MAX = 30;
const MAX_PARTICIPANTS_PER_GROUP = 1023;

function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = (arr[0].match(/:(.*?);/) || [])[1] || 'image/png';
  const bstr = atob(arr[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

interface CreateGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  campaignId: string | null;
  onCreated: () => void;
  onCreateGroups: (params: {
    instanceId: string;
    campaignId: string | null;
    count: number;
    baseName: string;
    description: string;
    addNumbering: boolean;
    participants: string[];
    groupImageUrl?: string | null;
    groupSettings?: { announcement?: boolean; locked?: boolean };
  }) => Promise<void>;
}

const CreateGroupsModal: React.FC<CreateGroupsModalProps> = ({
  isOpen,
  onClose,
  instanceId,
  campaignId,
  onCreated,
  onCreateGroups,
}) => {
  const { t } = useLanguage();
  const [count, setCount] = useState(1);
  const [baseName, setBaseName] = useState('');
  const [description, setDescription] = useState('');
  const [addNumbering, setAddNumbering] = useState(true);
  const [participantsText, setParticipantsText] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupImageUrl, setGroupImageUrl] = useState<string | null>(null);
  const [groupImageUrlInput, setGroupImageUrlInput] = useState('');
  const [imageFileForCrop, setImageFileForCrop] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [onlyAdminsSend, setOnlyAdminsSend] = useState(false);
  const [onlyAdminsEdit, setOnlyAdminsEdit] = useState(false);

  const [showCrmPicker, setShowCrmPicker] = useState(false);
  const [crmContacts, setCrmContacts] = useState<Contact[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSelectedIds, setCrmSelectedIds] = useState<Set<string>>(new Set());
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCount(1);
      setBaseName('');
      setDescription('');
      setAddNumbering(true);
      setParticipantsText('');
      setError(null);
      setGroupImageUrl(null);
      setGroupImageUrlInput('');
      setImageFileForCrop(null);
      setOnlyAdminsSend(false);
      setOnlyAdminsEdit(false);
      setCrmSelectedIds(new Set());
    }
  }, [isOpen]);

  const participants = participantsText
    .trim()
    .split(/[\n,;]+/)
    .map((line) => line.trim().split(/\s+/)[0].replace(/\D/g, ''))
    .filter((p) => p.length >= 10);

  const effectiveCount =
    participants.length > MAX_PARTICIPANTS_PER_GROUP
      ? Math.ceil(participants.length / MAX_PARTICIPANTS_PER_GROUP)
      : count;

  const handleCreate = async () => {
    const name = baseName.trim();
    if (!name) {
      setError(t('groupManager.createGroup.errorName'));
      return;
    }
    const num = Math.max(1, Math.min(MAX_GROUPS, effectiveCount));
    setCreating(true);
    setError(null);
    try {
      const finalImageUrl = groupImageUrl || (groupImageUrlInput.trim() || null) || undefined;
      await onCreateGroups({
        instanceId,
        campaignId,
        count: num,
        baseName: name,
        description: description.trim(),
        addNumbering,
        participants,
        groupImageUrl: finalImageUrl || undefined,
        groupSettings:
          onlyAdminsSend || onlyAdminsEdit
            ? { announcement: onlyAdminsSend, locked: onlyAdminsEdit }
            : undefined,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : t('groupManager.error.loadGroups');
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setImageFileForCrop(url);
    e.target.value = '';
  };

  const handleCropDone = async (croppedBase64: string) => {
    setImageFileForCrop(null);
    const file = dataURLtoFile(croppedBase64, 'group-photo.png');
    setUploadingImage(true);
    try {
      const res = await groupAPI.uploadImage(file);
      setGroupImageUrl(res.fullUrl);
      setGroupImageUrlInput('');
    } catch {
      setError(t('groupManager.createGroup.errorUploadImage'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    try {
      const res = await dispatchAPI.uploadCSV(file);
      const phones = (res.contacts || []).map((c) => c.phone).filter(Boolean);
      const existing = participantsText.trim().split(/[\n,;]+/).map((s) => s.trim().replace(/\D/g, '')).filter((s) => s.length >= 10);
      const combined = Array.from(new Set([...existing, ...phones]));
      setParticipantsText(combined.join('\n'));
    } catch {
      setError(t('groupManager.createGroup.errorUploadCsv'));
    } finally {
      setCsvLoading(false);
      e.target.value = '';
    }
  };

  const handleOpenCrmPicker = async () => {
    setShowCrmPicker(true);
    setCrmLoading(true);
    try {
      const res = await crmAPI.getContacts();
      setCrmContacts(res.contacts || []);
      setCrmSelectedIds(new Set());
    } catch {
      setError(t('groupManager.createGroup.errorLoadCrm'));
    } finally {
      setCrmLoading(false);
    }
  };

  const toggleCrmContact = (id: string) => {
    setCrmSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddCrmSelected = () => {
    const toAdd = crmContacts.filter((c) => crmSelectedIds.has(c.id)).map((c) => c.phone).filter(Boolean);
    const existing = participantsText.trim().split(/[\n,;]+/).map((s) => s.trim().replace(/\D/g, '')).filter((s) => s.length >= 10);
    const combined = Array.from(new Set([...existing, ...toAdd]));
    setParticipantsText(combined.join('\n'));
    setShowCrmPicker(false);
  };

  const overRecommended = effectiveCount > RECOMMENDED_MAX;
  const countValid =
    baseName.trim().length > 0 &&
    ((participants.length <= MAX_PARTICIPANTS_PER_GROUP && count >= 1 && count <= MAX_GROUPS) ||
      (participants.length > MAX_PARTICIPANTS_PER_GROUP && effectiveCount <= MAX_GROUPS));

  if (imageFileForCrop) {
    return (
      <Modal isOpen={true} onClose={() => setImageFileForCrop(null)} title={t('groupManager.createGroup.adjustPhoto')} size="lg" showCloseButton>
        <ImageCrop
          imageSrc={imageFileForCrop}
          aspectRatio={1}
          circular={false}
          onCrop={handleCropDone}
          onCancel={() => setImageFileForCrop(null)}
        />
      </Modal>
    );
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('groupManager.createGroup.title')}
        size="md"
        showCloseButton
      >
        <div className="space-y-4">
          <Input
            type="number"
            min={1}
            max={MAX_GROUPS}
            label={t('groupManager.createGroup.numberOfGroups')}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(MAX_GROUPS, parseInt(e.target.value, 10) || 1)))}
            helperText={t('groupManager.createGroup.numberOfGroupsHint')}
            className="text-clerky-backendText dark:text-gray-200"
          />
          {participants.length > MAX_PARTICIPANTS_PER_GROUP && (
            <p className="text-sm text-amber-600 dark:text-amber-400 font-medium bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              {t('groupManager.createGroup.participantsHint1023')} ({effectiveCount} {t('groupManager.createGroup.groupsWillBeCreated')})
            </p>
          )}
          {overRecommended && participants.length <= MAX_PARTICIPANTS_PER_GROUP && (
            <p className="text-sm text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              {t('groupManager.createGroup.warningOver30')}
            </p>
          )}
          <Input
            label={t('groupManager.createGroup.baseName')}
            value={baseName}
            onChange={(e) => setBaseName(e.target.value)}
            placeholder={t('groupManager.createGroup.baseNamePlaceholder')}
            className="text-clerky-backendText dark:text-gray-200"
          />
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={addNumbering}
              onChange={(e) => setAddNumbering(e.target.checked)}
              className="mt-1 rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
            />
            <span className="text-sm text-clerky-backendText dark:text-gray-200">
              {t('groupManager.createGroup.addNumbering')}
            </span>
          </label>
          <Input
            label={t('groupManager.createGroup.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('groupManager.createGroup.descriptionPlaceholder')}
            className="text-clerky-backendText dark:text-gray-200"
          />

          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
              {t('groupManager.createGroup.groupPhoto')}
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFileChange}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
                {uploadingImage ? t('groupManager.createGroup.uploadingPhoto') : t('groupManager.createGroup.uploadPhoto')}
              </Button>
              <span className="text-xs text-gray-500 dark:text-gray-400">ou</span>
              <Input
                value={groupImageUrlInput}
                onChange={(e) => setGroupImageUrlInput(e.target.value)}
                placeholder={t('groupManager.createGroup.groupPhotoUrlPlaceholder')}
                className="flex-1 min-w-[180px] text-clerky-backendText dark:text-gray-200 text-sm"
              />
            </div>
            {groupImageUrl && (
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                {t('groupManager.createGroup.photoReady')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
              {t('groupManager.createGroup.groupOptions')}
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAdminsSend}
                onChange={(e) => setOnlyAdminsSend(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
              />
              <span className="text-sm text-clerky-backendText dark:text-gray-200">
                {t('groupManager.createGroup.onlyAdminsSend')}
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAdminsEdit}
                onChange={(e) => setOnlyAdminsEdit(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton"
              />
              <span className="text-sm text-clerky-backendText dark:text-gray-200">
                {t('groupManager.createGroup.onlyAdminsEdit')}
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
              {t('groupManager.createGroup.participants')}
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              <input
                type="file"
                accept=".csv"
                className="hidden"
                id="create-group-csv"
                onChange={handleUploadCsv}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('create-group-csv')?.click()}
                disabled={csvLoading}
              >
                {csvLoading ? t('groupManager.createGroup.loadingCsv') : t('groupManager.configureGroup.addFromCsv')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleOpenCrmPicker}>
                {t('groupManager.configureGroup.addFromCrm')}
              </Button>
            </div>
            <textarea
              value={participantsText}
              onChange={(e) => setParticipantsText(e.target.value)}
              placeholder={t('groupManager.configureGroup.manualPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-clerky-backendText dark:text-gray-200 text-sm"
            />
            {participants.length > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {participants.length} {t('groupManager.createGroup.participantsCount')}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            {t('groupManager.campaign.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating || !countValid || !baseName.trim()}
          >
            {creating ? t('groupManager.createGroup.creating') : t('groupManager.createGroup.create')}
          </Button>
        </div>
      </Modal>

      {showCrmPicker && (
        <Modal
          isOpen={true}
          onClose={() => setShowCrmPicker(false)}
          title={t('groupManager.createGroup.selectFromCrm')}
          size="md"
          showCloseButton
        >
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {crmLoading ? (
              <p className="text-sm text-gray-500">{t('groupManager.createGroup.loadingCrm')}</p>
            ) : (
              crmContacts.map((c) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  <input
                    type="checkbox"
                    checked={crmSelectedIds.has(c.id)}
                    onChange={() => toggleCrmContact(c.id)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-clerky-backendText dark:text-gray-200 truncate">
                    {c.name || c.phone} {c.phone && <span className="text-gray-500">({c.phone})</span>}
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button variant="outline" onClick={() => setShowCrmPicker(false)}>
              {t('groupManager.campaign.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleAddCrmSelected}
              disabled={crmSelectedIds.size === 0}
            >
              {t('groupManager.createGroup.addSelected')} ({crmSelectedIds.size})
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default CreateGroupsModal;
