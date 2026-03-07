import React, { useState, useRef } from 'react';
import { Button, Input } from '../UI';
import { dispatchAPI } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';

interface Contact {
  fullName: string;
  wuid: string;
  phoneNumber: string;
  organization?: string;
  email?: string;
  url?: string;
}

interface GroupMessageTemplateFormProps {
  messageType: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
  contentJson: Record<string, any>;
  onContentChange: (content: Record<string, any>) => void;
}

const GroupMessageTemplateForm: React.FC<GroupMessageTemplateFormProps> = ({
  messageType,
  contentJson,
  onContentChange,
}) => {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'https://back.onlyflow.com.br/api'}/groups/upload`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao fazer upload');
      }

      let url = data.fullUrl;
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
      }
      
      if (messageType === 'media') {
        // Armazenar URL do upload em uma propriedade separada
        onContentChange({
          ...contentJson,
          media: url, // URL será usada internamente, mas não mostrada no campo
          uploadedMediaUrl: url, // Flag para indicar que foi feito upload
        });
      } else if (messageType === 'audio') {
        onContentChange({
          ...contentJson,
          audio: url,
          uploadedAudioUrl: url,
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload';
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Tipo: Texto
  if (messageType === 'text') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.text')} *
          </label>
          <textarea
            value={contentJson.text || ''}
            onChange={(e) => onContentChange({ ...contentJson, text: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 min-h-[120px]"
            placeholder={t('groupManager.templates.fields.textPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.delay')} ({t('groupManager.templates.fields.seconds')})
          </label>
          <Input
            type="number"
            min="0"
            max="300"
            value={contentJson.delay || ''}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = value ? parseInt(value, 10) : undefined;
              // Limitar a 300 segundos (5 minutos)
              const finalValue = numValue !== undefined && numValue > 300 ? 300 : numValue;
              onContentChange({ ...contentJson, delay: finalValue });
            }}
            placeholder="2"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('groupManager.templates.fields.delayHelp')}
          </p>
        </div>
      </div>
    );
  }

  // Tipo: Mídia (Imagem/Video)
  if (messageType === 'media') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.mediaType')} *
          </label>
          <select
            value={contentJson.mediatype || 'image'}
            onChange={(e) => onContentChange({ ...contentJson, mediatype: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            <option value="image">{t('groupManager.templates.fields.image')}</option>
            <option value="video">{t('groupManager.templates.fields.video')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.uploadFile')}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept={contentJson.mediatype === 'image' ? 'image/*' : 'video/*'}
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? t('groupManager.templates.fields.uploading') : t('groupManager.templates.fields.selectFile')}
            </Button>
            {contentJson.media && (
              <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                {t('groupManager.templates.fields.fileSelected')}
              </span>
            )}
          </div>
        </div>
        <div className="mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.templates.fields.or')}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.mediaUrl')} *
          </label>
          <Input
            value={contentJson.uploadedMediaUrl ? '' : (contentJson.media || '')}
            onChange={(e) => {
              // Se o usuário digitar uma URL manualmente, limpar qualquer URL de upload anterior
              onContentChange({ 
                ...contentJson, 
                media: e.target.value,
                uploadedMediaUrl: undefined, // Limpar flag de upload
              });
            }}
            placeholder={contentJson.uploadedMediaUrl ? t('groupManager.templates.fields.fileUploaded') : t('groupManager.templates.fields.mediaUrlPlaceholder')}
            disabled={!!contentJson.uploadedMediaUrl}
          />
          {contentJson.uploadedMediaUrl && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              ✓ {t('groupManager.templates.fields.fileUploaded')}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.caption')}
          </label>
          <textarea
            value={contentJson.caption || ''}
            onChange={(e) => onContentChange({ ...contentJson, caption: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 min-h-[80px]"
            placeholder={t('groupManager.templates.fields.captionPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.delay')} ({t('groupManager.templates.fields.seconds')})
          </label>
          <Input
            type="number"
            min="0"
            max="300"
            value={contentJson.delay || ''}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = value ? parseInt(value, 10) : undefined;
              // Limitar a 300 segundos (5 minutos)
              const finalValue = numValue !== undefined && numValue > 300 ? 300 : numValue;
              onContentChange({ ...contentJson, delay: finalValue });
            }}
            placeholder="2"
          />
        </div>
      </div>
    );
  }

  // Tipo: Enquete
  if (messageType === 'poll') {
    const values = contentJson.values || [''];
    
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.pollName')} *
          </label>
          <Input
            value={contentJson.name || ''}
            onChange={(e) => onContentChange({ ...contentJson, name: e.target.value })}
            placeholder={t('groupManager.templates.fields.pollNamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.selectableCount')} *
          </label>
          <Input
            type="number"
            min="1"
            value={contentJson.selectableCount || 1}
            onChange={(e) => onContentChange({ ...contentJson, selectableCount: parseInt(e.target.value, 10) || 1 })}
            placeholder="1"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('groupManager.templates.fields.selectableCountHelp')}
          </p>
        </div>
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('groupManager.templates.fields.pollOptions')} *
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onContentChange({ ...contentJson, values: [...values, ''] })}
            >
              {t('groupManager.templates.fields.addOption')}
            </Button>
          </div>
          {values.map((value: string, index: number) => (
            <div key={index} className="flex gap-2 mb-2">
              <Input
                value={value}
                onChange={(e) => {
                  const newValues = [...values];
                  newValues[index] = e.target.value;
                  onContentChange({ ...contentJson, values: newValues });
                }}
                placeholder={`${t('groupManager.templates.fields.option')} ${index + 1}`}
              />
              {values.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newValues = values.filter((_: any, i: number) => i !== index);
                    onContentChange({ ...contentJson, values: newValues });
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  {t('groupManager.templates.fields.remove')}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Tipo: Contato
  if (messageType === 'contact') {
    const contacts: Contact[] = contentJson.contact || [{ fullName: '', wuid: '', phoneNumber: '' }];
    
    const updateContact = (index: number, field: keyof Contact, value: string) => {
      const newContacts = [...contacts];
      newContacts[index] = { ...newContacts[index], [field]: value };
      onContentChange({ ...contentJson, contact: newContacts });
    };

    const addContact = () => {
      onContentChange({
        ...contentJson,
        contact: [...contacts, { fullName: '', wuid: '', phoneNumber: '' }],
      });
    };

    const removeContact = (index: number) => {
      const newContacts = contacts.filter((_, i) => i !== index);
      onContentChange({ ...contentJson, contact: newContacts });
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('groupManager.templates.fields.contacts')} *
          </label>
          <Button variant="outline" size="sm" onClick={addContact}>
            {t('groupManager.templates.fields.addContact')}
          </Button>
        </div>
        {contacts.map((contact, index) => (
          <div key={index} className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('groupManager.templates.fields.contact')} {index + 1}
              </span>
              {contacts.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeContact(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  {t('groupManager.templates.fields.remove')}
                </Button>
              )}
            </div>
            <Input
              label={`${t('groupManager.templates.fields.fullName')} *`}
              value={contact.fullName}
              onChange={(e) => updateContact(index, 'fullName', e.target.value)}
              placeholder="Nome Completo"
            />
            <Input
              label={`${t('groupManager.templates.fields.wuid')} *`}
              value={contact.wuid}
              onChange={(e) => updateContact(index, 'wuid', e.target.value)}
              placeholder="559999999999"
            />
            <Input
              label={`${t('groupManager.templates.fields.phoneNumber')} *`}
              value={contact.phoneNumber}
              onChange={(e) => updateContact(index, 'phoneNumber', e.target.value)}
              placeholder="+55 99 9 9999-9999"
            />
            <Input
              label={t('groupManager.templates.fields.organization')}
              value={contact.organization || ''}
              onChange={(e) => updateContact(index, 'organization', e.target.value)}
              placeholder="Nome da Empresa"
            />
            <Input
              label={t('groupManager.templates.fields.email')}
              value={contact.email || ''}
              onChange={(e) => updateContact(index, 'email', e.target.value)}
              placeholder="email@exemplo.com"
            />
            <Input
              label={t('groupManager.templates.fields.url')}
              value={contact.url || ''}
              onChange={(e) => updateContact(index, 'url', e.target.value)}
              placeholder="https://exemplo.com"
            />
          </div>
        ))}
      </div>
    );
  }

  // Tipo: Localização
  if (messageType === 'location') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.locationName')} *
          </label>
          <Input
            value={contentJson.name || ''}
            onChange={(e) => onContentChange({ ...contentJson, name: e.target.value })}
            placeholder={t('groupManager.templates.fields.locationNamePlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.address')} *
          </label>
          <Input
            value={contentJson.address || ''}
            onChange={(e) => onContentChange({ ...contentJson, address: e.target.value })}
            placeholder={t('groupManager.templates.fields.addressPlaceholder')}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.templates.fields.latitude')} *
            </label>
            <Input
              type="number"
              step="any"
              value={contentJson.latitude || ''}
              onChange={(e) => onContentChange({ ...contentJson, latitude: parseFloat(e.target.value) || undefined })}
              placeholder="-16.505538"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('groupManager.templates.fields.longitude')} *
            </label>
            <Input
              type="number"
              step="any"
              value={contentJson.longitude || ''}
              onChange={(e) => onContentChange({ ...contentJson, longitude: parseFloat(e.target.value) || undefined })}
              placeholder="-151.742277"
            />
          </div>
        </div>
      </div>
    );
  }

  // Tipo: Áudio
  if (messageType === 'audio') {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.uploadFile')}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? t('groupManager.templates.fields.uploading') : t('groupManager.templates.fields.selectFile')}
            </Button>
            {contentJson.audio && (
              <span className="text-sm text-gray-500 dark:text-gray-400 self-center">
                {t('groupManager.templates.fields.fileSelected')}
              </span>
            )}
          </div>
        </div>
        <div className="mb-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">{t('groupManager.templates.fields.or')}</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.audioUrl')} *
          </label>
          <Input
            value={contentJson.audio || ''}
            onChange={(e) => onContentChange({ ...contentJson, audio: e.target.value })}
            placeholder={t('groupManager.templates.fields.audioUrlPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('groupManager.templates.fields.delay')} ({t('groupManager.templates.fields.seconds')})
          </label>
          <Input
            type="number"
            min="0"
            max="300"
            value={contentJson.delay || ''}
            onChange={(e) => {
              const value = e.target.value;
              const numValue = value ? parseInt(value, 10) : undefined;
              // Limitar a 300 segundos (5 minutos)
              const finalValue = numValue !== undefined && numValue > 300 ? 300 : numValue;
              onContentChange({ ...contentJson, delay: finalValue });
            }}
            placeholder="2"
          />
        </div>
      </div>
    );
  }

  return null;
};

export default GroupMessageTemplateForm;
