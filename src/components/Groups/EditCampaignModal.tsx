import React, { useState, useRef } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';

export interface CampaignEditData {
  campaignName: string;
  photoUrl?: string | null;
  photoFile?: File | null;
}

interface EditCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialName: string;
  initialPhotoUrl?: string | null;
  onSave: (data: CampaignEditData) => void;
}

const EditCampaignModal: React.FC<EditCampaignModalProps> = ({
  isOpen,
  onClose,
  initialName,
  initialPhotoUrl,
  onSave,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialPhotoUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onSave({
      campaignName: name.trim(),
      photoUrl: photoPreview ?? undefined,
      photoFile: photoFile ?? undefined,
    });
    onClose();
  };

  const handleOpen = () => {
    setName(initialName);
    setPhotoPreview(initialPhotoUrl ?? null);
    setPhotoFile(null);
  };

  React.useEffect(() => {
    if (isOpen) handleOpen();
  }, [isOpen, initialName, initialPhotoUrl]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('groupManager.editCampaign.title')} size="md" showCloseButton>
      <div className="space-y-4">
        <Input
          label={t('groupManager.editCampaign.campaignName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-clerky-backendText dark:text-gray-200"
        />
        <div>
          <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
            {t('groupManager.editCampaign.campaignPhoto')}
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
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                {photoPreview || photoFile ? t('groupManager.configureGroup.photo') : t('groupManager.editCampaign.campaignPhoto')}
              </Button>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onClose}>
          {t('groupManager.campaign.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
          {t('groupManager.campaign.finish')}
        </Button>
      </div>
    </Modal>
  );
};

export default EditCampaignModal;
