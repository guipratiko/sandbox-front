import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal, Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { groupAPI, Group } from '../../services/api';

interface AddGroupsToCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  importGroups: 'all' | string[] | null;
  onConfirm: (selectedGroupJids: string[]) => Promise<void>;
}

const AddGroupsToCampaignModal: React.FC<AddGroupsToCampaignModalProps> = ({
  isOpen,
  onClose,
  instanceId,
  importGroups,
  onConfirm,
}) => {
  const { t } = useLanguage();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!instanceId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await groupAPI.getAll(instanceId);
      setGroups(res.groups ?? []);
    } catch {
      setGroups([]);
      setLoadError(t('groupManager.error.loadGroups'));
    } finally {
      setLoading(false);
    }
  }, [instanceId, t]);

  useEffect(() => {
    if (!isOpen) {
      setGroups([]);
      setSelectedIds(new Set());
      setLoadError(null);
      setSaveError(null);
      setSaving(false);
      setLoading(false);
      return;
    }
    if (importGroups === 'all') {
      setGroups([]);
      setLoading(false);
      setLoadError(null);
      return;
    }
    fetchGroups();
  }, [isOpen, importGroups, fetchGroups]);

  const existingJids = useMemo(() => {
    if (importGroups === 'all') {
      return new Set(groups.map((g) => g.id));
    }
    if (Array.isArray(importGroups)) {
      return new Set(importGroups);
    }
    return new Set<string>();
  }, [importGroups, groups]);

  const availableGroups = useMemo(
    () => groups.filter((g) => !existingJids.has(g.id)),
    [groups, existingJids]
  );

  const isImportAll = importGroups === 'all';

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllAvailable = () => {
    if (availableGroups.length === 0) return;
    const allSelected = availableGroups.every((g) => selectedIds.has(g.id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availableGroups.map((g) => g.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || isImportAll) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onConfirm(Array.from(selectedIds));
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : String(e);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('groupManager.addGroupsModal.title')} size="md">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('groupManager.addGroupsModal.hint')}</p>

        {isImportAll && (
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {t('groupManager.addGroupsModal.allGroupsMode')}
          </p>
        )}

        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.loading')}</p>}
        {loadError && <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>}

        {!loading && !loadError && !isImportAll && (
          <>
            {availableGroups.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.addGroupsModal.noneToAdd')}</p>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-gray-50 dark:bg-gray-800/50 max-h-64 overflow-y-auto">
                <div className="flex justify-between items-center mb-2 gap-2">
                  <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
                    {t('groupManager.campaign.selectGroups')}
                  </span>
                  <Button variant="outline" size="xs" type="button" onClick={selectAllAvailable}>
                    {availableGroups.every((g) => selectedIds.has(g.id))
                      ? t('groupManager.campaignDetail.deselectAll')
                      : t('groupManager.campaignDetail.selectAll')}
                  </Button>
                </div>
                <div className="space-y-2">
                  {availableGroups.map((g) => (
                    <label
                      key={g.id}
                      className="flex items-center gap-2 cursor-pointer text-sm text-clerky-backendText dark:text-gray-200"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(g.id)}
                        onChange={() => toggle(g.id)}
                        className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton focus:ring-clerky-backendButton"
                      />
                      <span className="truncate">{g.name ?? g.id}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={handleSubmit}
            disabled={saving || isImportAll || selectedIds.size === 0 || loading}
          >
            {saving ? t('groupManager.addGroupsModal.adding') : t('groupManager.addGroupsModal.add')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default AddGroupsToCampaignModal;
