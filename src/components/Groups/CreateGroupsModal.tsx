import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';

const MAX_GROUPS = 100;
const RECOMMENDED_MAX = 30;

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

  useEffect(() => {
    if (isOpen) {
      setCount(1);
      setBaseName('');
      setDescription('');
      setAddNumbering(true);
      setParticipantsText('');
      setError(null);
    }
  }, [isOpen]);

  const participants = participantsText
    .trim()
    .split(/[\n,;]+/)
    .map((line) => line.trim().split(/\s+/)[0].replace(/\D/g, ''))
    .filter((p) => p.length >= 10);

  const handleCreate = async () => {
    const name = baseName.trim();
    if (!name) {
      setError(t('groupManager.createGroup.errorName'));
      return;
    }
    const num = Math.max(1, Math.min(MAX_GROUPS, count));
    setCreating(true);
    setError(null);
    try {
      await onCreateGroups({
        instanceId,
        campaignId,
        count: num,
        baseName: name,
        description: description.trim(),
        addNumbering,
        participants,
      });
      onCreated();
      onClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : t('groupManager.error.loadGroups');
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const overRecommended = count > RECOMMENDED_MAX;
  const countValid = count >= 1 && count <= MAX_GROUPS;

  return (
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
        {overRecommended && (
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
            {t('groupManager.createGroup.participants')}
          </label>
          <textarea
            value={participantsText}
            onChange={(e) => setParticipantsText(e.target.value)}
            placeholder={t('groupManager.configureGroup.manualPlaceholder')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-clerky-backendText dark:text-gray-200 text-sm"
          />
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
  );
};

export default CreateGroupsModal;
