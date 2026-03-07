import React, { useRef, useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { compressImage } from '../../utils/formatters';
import Modal from './Modal';
import ImageCrop from './ImageCrop';

interface ProfilePictureUploadProps {
  currentPicture?: string | null;
  onPictureChange: (base64: string | null) => void;
  className?: string;
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  currentPicture,
  onPictureChange,
  className = '',
}) => {
  const { t } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentPicture || null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  // Atualizar preview quando currentPicture mudar
  useEffect(() => {
    setPreview(currentPicture || null);
  }, [currentPicture]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.match(/^image\/(jpeg|jpg|png|gif)$/)) {
      alert(t('settings.invalidImageFormat'));
      return;
    }

    // Validar tamanho (5MB antes da compressão)
    if (file.size > 5 * 1024 * 1024) {
      alert(t('settings.imageTooLarge'));
      return;
    }

    try {
      // Comprimir imagem antes de abrir modal de crop
      // Usar tamanho maior para garantir qualidade no crop
      const compressedBase64 = await compressImage(file, 1600, 1600, 0.85);
      setImageToCrop(compressedBase64);
      setShowCropModal(true);
    } catch (error) {
      alert(t('error.formProcessing'));
    }
  };

  const handleCropComplete = (croppedBase64: string) => {
    setPreview(croppedBase64);
    onPictureChange(croppedBase64);
    setShowCropModal(false);
    setImageToCrop(null);
  };

  const handleCropCancel = () => {
    setShowCropModal(false);
    setImageToCrop(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onPictureChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        <div
          className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-90 transition-smooth border-4 border-white dark:border-gray-800 shadow-lg"
          onClick={handleClick}
        >
          {preview ? (
            <img
              src={preview}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-clerky-backendButton text-white">
              <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
        </div>
        {preview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-smooth shadow-md"
            title={t('settings.removePicture')}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        onClick={handleClick}
        className="mt-4 px-4 py-2 text-sm text-clerky-backendButton hover:bg-clerky-backendButton/10 dark:hover:bg-gray-700 rounded-lg transition-smooth"
      >
        {preview ? t('settings.changePicture') : t('settings.selectImage')}
      </button>

      {/* Modal de Crop */}
      {showCropModal && imageToCrop && (
        <Modal
          isOpen={showCropModal}
          onClose={handleCropCancel}
          title={t('settings.cropImage')}
          size="xl"
        >
          <ImageCrop
            imageSrc={imageToCrop}
            onCrop={handleCropComplete}
            onCancel={handleCropCancel}
            aspectRatio={1}
            circular={true}
          />
        </Modal>
      )}
    </div>
  );
};

export default ProfilePictureUpload;

