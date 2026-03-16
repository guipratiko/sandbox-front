import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { groupAPI, Instance, Group } from '../../services/api';

const CONTACTS_MIN = 1;
const CONTACTS_MAX = 1024;
const NON_OFFICIAL = (i: Instance) => i.integration !== 'WHATSAPP-CLOUD';

export interface NewCampaignData {
  campaignName: string;
  contactsPerGroup: number;
  instanceId: string;
  importGroups: 'all' | string[] | null;
}

interface NewCampaignWizardProps {
  isOpen: boolean;
  onClose: () => void;
  instances: Instance[];
  onComplete: (data: NewCampaignData) => void;
}

const NewCampaignWizard: React.FC<NewCampaignWizardProps> = ({
  isOpen,
  onClose,
  instances,
  onComplete,
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [contactsPerGroup, setContactsPerGroup] = useState(1024);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [wantImport, setWantImport] = useState<boolean | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [importAll, setImportAll] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);

  const nonOfficialInstances = instances.filter(NON_OFFICIAL);

  const loadGroups = useCallback(async (instanceId: string) => {
    setLoadingGroups(true);
    try {
      const res = await groupAPI.getAll(instanceId);
      setGroups(res.groups ?? []);
      setSelectedGroupIds(new Set());
      setImportAll(false);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setCampaignName('');
      setContactsPerGroup(1024);
      setSelectedInstanceId('');
      setWantImport(null);
      setGroups([]);
      setSelectedGroupIds(new Set());
      setImportAll(false);
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 3 && selectedInstanceId && wantImport === true) {
      loadGroups(selectedInstanceId);
    }
  }, [step, selectedInstanceId, wantImport, loadGroups]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinish = () => {
    const n = Math.max(CONTACTS_MIN, Math.min(CONTACTS_MAX, contactsPerGroup));
    let importGroups: NewCampaignData['importGroups'] = null;
    if (wantImport === true) {
      importGroups = importAll ? 'all' : Array.from(selectedGroupIds);
    }
    onComplete({
      campaignName: campaignName.trim(),
      contactsPerGroup: n,
      instanceId: selectedInstanceId,
      importGroups,
    });
    onClose();
  };

  const step1Valid = campaignName.trim().length > 0 && contactsPerGroup >= CONTACTS_MIN && contactsPerGroup <= CONTACTS_MAX;
  const step2Valid = !!selectedInstanceId;
  const step3Valid = wantImport === false || (wantImport === true && (importAll || selectedGroupIds.size > 0));

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const title =
    step === 1
      ? t('groupManager.campaign.step1Title')
      : step === 2
        ? t('groupManager.campaign.step2Title')
        : t('groupManager.campaign.step3Title');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md" showCloseButton>
      <div className="space-y-6">
        {step === 1 && (
          <div className="max-w-xs space-y-4">
            <Input
              label={t('groupManager.campaign.step1Name')}
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder=""
              className="text-clerky-backendText dark:text-gray-200"
            />
            <Input
              type="number"
              min={CONTACTS_MIN}
              max={CONTACTS_MAX}
              label={t('groupManager.campaign.contactsPerGroup')}
              value={contactsPerGroup}
              onChange={(e) => setContactsPerGroup(Math.min(CONTACTS_MAX, Math.max(CONTACTS_MIN, parseInt(e.target.value, 10) || CONTACTS_MIN)))}
              helperText={t('groupManager.campaign.contactsPerGroupHint')}
              className="text-clerky-backendText dark:text-gray-200"
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
              {t('groupManager.campaign.step2Instance')}
            </label>
            {nonOfficialInstances.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {t('groupManager.campaign.noNonOfficialInstances')}
              </p>
            ) : (
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-white dark:bg-[#091D41] border border-gray-300 dark:border-gray-600 text-clerky-backendText dark:text-gray-200 focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent"
              >
                <option value="">{t('groupManager.selectInstancePlaceholder')}</option>
                {nonOfficialInstances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
              {t('groupManager.campaign.importGroupsQuestion')}
            </p>
            <div className="flex gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="wantImport"
                  checked={wantImport === true}
                  onChange={() => setWantImport(true)}
                  className="rounded-full border-gray-300 dark:border-gray-600 text-clerky-backendButton focus:ring-clerky-backendButton"
                />
                <span className="text-sm text-clerky-backendText dark:text-gray-200">{t('common.yes')}</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="wantImport"
                  checked={wantImport === false}
                  onChange={() => setWantImport(false)}
                  className="rounded-full border-gray-300 dark:border-gray-600 text-clerky-backendButton focus:ring-clerky-backendButton"
                />
                <span className="text-sm text-clerky-backendText dark:text-gray-200">{t('common.no')}</span>
              </label>
            </div>

            {wantImport === true && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-gray-800/50 max-h-64 overflow-y-auto">
                <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  {t('groupManager.campaign.selectGroups')}
                </p>
                {loadingGroups ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{t('groupManager.loading')}</p>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setImportAll(!importAll);
                        if (!importAll) setSelectedGroupIds(new Set(groups.map((g) => g.id)));
                        else setSelectedGroupIds(new Set());
                      }}
                      className="mb-3"
                    >
                      {t('groupManager.campaign.importAll')}
                    </Button>
                    <div className="space-y-2">
                      {groups.map((g) => (
                        <label
                          key={g.id}
                          className="flex items-center gap-2 cursor-pointer text-sm text-clerky-backendText dark:text-gray-200"
                        >
                          <input
                            type="checkbox"
                            checked={importAll || selectedGroupIds.has(g.id)}
                            onChange={() => toggleGroup(g.id)}
                            disabled={importAll}
                            className="rounded border-gray-300 dark:border-gray-600 text-clerky-backendButton focus:ring-clerky-backendButton"
                          />
                          <span>{g.name ?? g.id}</span>
                        </label>
                      ))}
                      {groups.length === 0 && !loadingGroups && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('groupManager.noGroups')}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onClose}>
          {t('groupManager.campaign.cancel')}
        </Button>
        {step > 1 && (
          <Button variant="outline" onClick={handleBack}>
            {t('groupManager.campaign.back')}
          </Button>
        )}
        {step < 3 ? (
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={
              (step === 1 && !step1Valid) ||
              (step === 2 && !step2Valid) ||
              (step === 2 && nonOfficialInstances.length === 0)
            }
          >
            {t('groupManager.campaign.next')}
          </Button>
        ) : (
          <Button variant="primary" onClick={handleFinish} disabled={!step3Valid}>
            {t('groupManager.campaign.finish')}
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default NewCampaignWizard;
