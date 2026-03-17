import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  GroupMessageTemplate,
  GroupMessageType,
  groupMessageTemplatesAPI,
  groupAPI,
} from '../../services/api';

const MESSAGE_TYPES: GroupMessageType[] = ['text', 'media', 'poll', 'contact', 'location', 'audio'];

interface GroupMessageTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
  template?: GroupMessageTemplate | null;
  onSaved: () => void;
}

export const GroupMessageTemplateModal: React.FC<GroupMessageTemplateModalProps> = ({
  isOpen,
  onClose,
  instanceId,
  template,
  onSaved,
}) => {
  const { t } = useLanguage();
  const isEdit = !!template?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [messageType, setMessageType] = useState<GroupMessageType>('text');
  const [contentJson, setContentJson] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setMessageType((template?.messageType as GroupMessageType) ?? 'text');
    setContentJson(template?.contentJson && typeof template.contentJson === 'object' ? (template.contentJson as Record<string, unknown>) : {});
  }, [isOpen, template]);

  const buildContentFromForm = (): Record<string, unknown> => {
    switch (messageType) {
      case 'text':
        return {
          text: (contentJson.text as string) ?? '',
          ...(contentJson.mentionsEveryone === true || contentJson.mentionsEveryOne === true
            ? { mentionsEveryone: true, mentionsEveryOne: true }
            : {}),
        };
      case 'media':
        return {
          media: contentJson.media ?? '',
          mediatype: contentJson.mediatype ?? 'image',
          caption: contentJson.caption ?? '',
          fileName: contentJson.fileName ?? '',
        };
      case 'poll':
        return {
          name: contentJson.name ?? '',
          values: Array.isArray(contentJson.values) ? contentJson.values : [],
          selectableCount: contentJson.selectableCount ?? 1,
        };
      case 'contact':
        return { contact: Array.isArray(contentJson.contact) ? contentJson.contact : [] };
      case 'location':
        return {
          name: contentJson.name ?? '',
          address: contentJson.address ?? '',
          latitude: contentJson.latitude ?? 0,
          longitude: contentJson.longitude ?? 0,
        };
      case 'audio':
        return { audio: contentJson.audio ?? '' };
      default:
        return contentJson;
    }
  };

  const handleFileUpload = async (file: File, field: 'media' | 'audio') => {
    try {
      setUploading(true);
      const res = await groupAPI.uploadImage(file);
      const url = res.fullUrl ?? res.url;
      if (field === 'media') {
        setContentJson((prev) => ({
          ...prev,
          media: url,
          mediatype: file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image',
          fileName: file.name,
        }));
      } else {
        setContentJson((prev) => ({ ...prev, audio: url }));
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert(t('groupManager.templates.namePlaceholder'));
      return;
    }
    const payload = buildContentFromForm();
    try {
      setSaving(true);
      if (isEdit && template) {
        await groupMessageTemplatesAPI.update(template.id, {
          name: trimmedName,
          description: description.trim() || null,
          contentJson: payload,
        });
      } else {
        await groupMessageTemplatesAPI.create({
          instanceId,
          name: trimmedName,
          description: description.trim() || null,
          messageType,
          contentJson: payload,
        });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Erro ao salvar';
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  const renderContentFields = () => {
    switch (messageType) {
      case 'text':
        return (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.text')}</label>
              <textarea
                value={(contentJson.text as string) ?? ''}
                onChange={(e) => setContentJson((p) => ({ ...p, text: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                rows={4}
                placeholder={t('groupManager.templates.fields.textPlaceholder')}
              />
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={contentJson.mentionsEveryone === true || contentJson.mentionsEveryOne === true}
                onChange={(e) =>
                  setContentJson((p) => ({
                    ...p,
                    mentionsEveryone: e.target.checked,
                    mentionsEveryOne: e.target.checked,
                  }))
                }
                className="rounded border-gray-300 text-clerky-backendButton focus:ring-clerky-backendButton"
              />
              <span className="text-sm text-clerky-backendText dark:text-gray-200">{t('groupManager.templates.fields.mentionsEveryone')}</span>
            </label>
          </div>
        );
      case 'media':
        return (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.mediaType')}</label>
              <select
                value={(contentJson.mediatype as string) ?? 'image'}
                onChange={(e) => setContentJson((p) => ({ ...p, mediatype: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
              >
                <option value="image">{t('groupManager.templates.fields.image')}</option>
                <option value="video">{t('groupManager.templates.fields.video')}</option>
                <option value="audio">Áudio</option>
                <option value="document">Documento</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.uploadFile')}</label>
              <input
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileUpload(f, 'media');
                }}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-clerky-backendButton file:text-white hover:file:bg-opacity-90"
              />
              {(contentJson.media as string) && (
                <p className="mt-1 text-xs text-gray-500 truncate">{contentJson.media as string}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.caption')}</label>
              <input
                type="text"
                value={(contentJson.caption as string) ?? ''}
                onChange={(e) => setContentJson((p) => ({ ...p, caption: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
                placeholder={t('groupManager.templates.fields.captionPlaceholder')}
              />
            </div>
          </div>
        );
      case 'poll':
        const values = (Array.isArray(contentJson.values) ? contentJson.values : []) as string[];
        return (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.pollName')}</label>
              <input
                type="text"
                value={(contentJson.name as string) ?? ''}
                onChange={(e) => setContentJson((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
                placeholder={t('groupManager.templates.fields.pollNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.selectableCount')}</label>
              <input
                type="number"
                min={1}
                value={(contentJson.selectableCount as number) ?? 1}
                onChange={(e) => setContentJson((p) => ({ ...p, selectableCount: parseInt(e.target.value, 10) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.pollOptions')}</label>
              {values.map((v, i) => (
                <div key={i} className="flex gap-2 mb-1">
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => {
                      const next = [...values];
                      next[i] = e.target.value;
                      setContentJson((p) => ({ ...p, values: next }));
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
                    placeholder={t('groupManager.templates.fields.option')}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setContentJson((p) => ({ ...p, values: values.filter((_, j) => j !== i) }))}
                  >
                    {t('groupManager.templates.fields.remove')}
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setContentJson((p) => ({ ...p, values: [...values, ''] }))}
                className="mt-1"
              >
                {t('groupManager.templates.fields.addOption')}
              </Button>
            </div>
          </div>
        );
      case 'contact': {
        const contacts = (Array.isArray(contentJson.contact) ? contentJson.contact : []) as Array<{ fullName?: string; wuid?: string; phoneNumber?: string }>;
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('groupManager.templates.fields.contacts')}</label>
            {contacts.map((c, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                <input
                  placeholder={t('groupManager.templates.fields.fullName')}
                  value={c.fullName ?? ''}
                  onChange={(e) => {
                    const next = [...contacts];
                    next[i] = { ...next[i], fullName: e.target.value };
                    setContentJson((p) => ({ ...p, contact: next }));
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText text-sm"
                />
                <input
                  placeholder={t('groupManager.templates.fields.phoneNumber')}
                  value={c.phoneNumber ?? ''}
                  onChange={(e) => {
                    const next = [...contacts];
                    next[i] = { ...next[i], phoneNumber: e.target.value };
                    setContentJson((p) => ({ ...p, contact: next }));
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setContentJson((p) => ({ ...p, contact: contacts.filter((_, j) => j !== i) }))}
                >
                  {t('groupManager.templates.fields.remove')}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setContentJson((p) => ({ ...p, contact: [...contacts, { fullName: '', phoneNumber: '' }] }))}
            >
              {t('groupManager.templates.fields.addContact')}
            </Button>
          </div>
        );
      }
      case 'location':
        return (
          <div className="space-y-2">
            <Input
              label={t('groupManager.templates.fields.locationName')}
              value={(contentJson.name as string) ?? ''}
              onChange={(e) => setContentJson((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('groupManager.templates.fields.locationNamePlaceholder')}
            />
            <Input
              label={t('groupManager.templates.fields.address')}
              value={(contentJson.address as string) ?? ''}
              onChange={(e) => setContentJson((p) => ({ ...p, address: e.target.value }))}
              placeholder={t('groupManager.templates.fields.addressPlaceholder')}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t('groupManager.templates.fields.latitude')}
                type="number"
                step="any"
                value={String(contentJson.latitude ?? '')}
                onChange={(e) => setContentJson((p) => ({ ...p, latitude: parseFloat(e.target.value) || 0 }))}
              />
              <Input
                label={t('groupManager.templates.fields.longitude')}
                type="number"
                step="any"
                value={String(contentJson.longitude ?? '')}
                onChange={(e) => setContentJson((p) => ({ ...p, longitude: parseFloat(e.target.value) || 0 }))}
              />
            </div>
          </div>
        );
      case 'audio':
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.fields.audioUrl')}</label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f, 'audio');
              }}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-clerky-backendButton file:text-white"
            />
            {(contentJson.audio as string) && <p className="mt-1 text-xs text-gray-500 truncate">{contentJson.audio as string}</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? t('groupManager.templates.editTitle') : t('groupManager.templates.createTitle')} size="lg">
      <div className="space-y-4">
        <Input
          label={t('groupManager.templates.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groupManager.templates.namePlaceholder')}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.descriptionLabel')}</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
            placeholder={t('groupManager.templates.descriptionPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('groupManager.templates.type')}</label>
          <select
            value={messageType}
            onChange={(e) => setMessageType(e.target.value as GroupMessageType)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText"
          >
            {MESSAGE_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`groupManager.templates.types.${type}`)}
              </option>
            ))}
          </select>
        </div>
        {renderContentFields()}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t('groupManager.templates.saving') : isEdit ? t('groupManager.templates.update') : t('groupManager.templates.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default GroupMessageTemplateModal;
