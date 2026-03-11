import React, { useState } from 'react';
import { Modal, Button, Card } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import type {
  CreateOfficialTemplateBody,
  OfficialTemplateComponent,
  OfficialTemplateCategory,
} from '../../services/api';

const CATEGORIES: OfficialTemplateCategory[] = ['utility', 'marketing', 'authentication'];
const LANGUAGES = [
  { code: 'pt_BR', label: 'Português (Brasil)' },
  { code: 'en_US', label: 'English (US)' },
  { code: 'es', label: 'Español' },
  { code: 'pt_PT', label: 'Português (Portugal)' },
];
const HEADER_FORMATS = ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const;
const BUTTON_TYPES = ['quick_reply', 'url', 'copy_code', 'phone_number'] as const;

interface ButtonForm {
  type: (typeof BUTTON_TYPES)[number];
  text: string;
  url: string;
}

interface OfficialTemplateCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (body: CreateOfficialTemplateBody) => Promise<void>;
}

export const OfficialTemplateCreator: React.FC<OfficialTemplateCreatorProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<OfficialTemplateCategory>('utility');
  const [language, setLanguage] = useState('pt_BR');
  const [parameterFormat, setParameterFormat] = useState<'positional' | 'named'>('positional');
  const [bodyText, setBodyText] = useState('');
  const [bodyExample, setBodyExample] = useState('');
  const [headerFormat, setHeaderFormat] = useState<'none' | (typeof HEADER_FORMATS)[number]>('none');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<ButtonForm[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildComponents = (): OfficialTemplateComponent[] => {
    const comps: OfficialTemplateComponent[] = [];

    if (headerFormat !== 'none') {
      const header: OfficialTemplateComponent = {
        type: 'header',
        format: headerFormat,
      };
      if (headerFormat === 'TEXT' && headerText.trim()) {
        header.text = headerText.trim();
        header.example = { header_text: [headerText.trim()] };
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerFormat)) {
        header.example = {
          header_handle: [''],
          ...(headerFormat === 'IMAGE' && { header_image: [''] }),
          ...(headerFormat === 'VIDEO' && { header_video: [''] }),
          ...(headerFormat === 'DOCUMENT' && { header_document: [''] }),
        };
      }
      comps.push(header);
    }

    const body: OfficialTemplateComponent = {
      type: 'body',
      text: bodyText.trim() || ' ',
    };
    if (bodyExample.trim()) {
      const rows = bodyExample
        .split('\n')
        .map((row) => row.split(',').map((s) => s.trim()).filter(Boolean));
      if (rows.length) body.example = { body_text: rows };
    }
    comps.push(body);

    if (buttons.length > 0) {
      buttons.forEach((btn, index) => {
        const comp: OfficialTemplateComponent = {
          type: 'button',
          sub_type: btn.type as 'quick_reply' | 'url' | 'copy_code' | 'phone_number',
          index: String(index),
          text: btn.text || undefined,
          url: btn.type === 'url' ? btn.url || undefined : undefined,
        };
        if (btn.type === 'url' && btn.url) comp.example = { button_url: [btn.url] };
        comps.push(comp);
      });
    }

    if (footerText.trim()) {
      comps.push({ type: 'footer', text: footerText.trim() });
    }

    return comps;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmedName) {
      setError('Nome é obrigatório');
      return;
    }
    if (!bodyText.trim()) {
      setError('Corpo da mensagem é obrigatório');
      return;
    }
    setSubmitting(true);
    try {
      const components = buildComponents();
      await onSubmit({
        name: trimmedName,
        language,
        category,
        components,
        parameter_format: parameterFormat,
      });
      onClose();
      setName('');
      setBodyText('');
      setBodyExample('');
      setHeaderText('');
      setFooterText('');
      setButtons([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dispatchesOfficial.errorCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const addButton = () => {
    setButtons((b) => [...b, { type: 'quick_reply', text: '', url: '' }]);
  };
  const updateButton = (index: number, field: keyof ButtonForm, value: string) => {
    setButtons((b) => {
      const next = [...b];
      (next[index] as any)[field] = value;
      return next;
    });
  };
  const removeButton = (index: number) => {
    setButtons((b) => b.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dispatchesOfficial.createTemplate')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('dispatchesOfficial.templateName')} *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="nome_do_template"
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('dispatchesOfficial.templateCategory')} *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as OfficialTemplateCategory)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`dispatchesOfficial.category.${c}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('dispatchesOfficial.templateLanguage')} *
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('dispatchesOfficial.templateParameterFormat')}
            </label>
            <select
              value={parameterFormat}
              onChange={(e) => setParameterFormat(e.target.value as 'positional' | 'named')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="positional">positional</option>
              <option value="named">named</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('dispatchesOfficial.templateBody')} *
          </label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder={t('dispatchesOfficial.templateBodyPlaceholder')}
            rows={3}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('dispatchesOfficial.templateBodyExample')}
          </p>
          <textarea
            value={bodyExample}
            onChange={(e) => setBodyExample(e.target.value)}
            placeholder="João, 12345"
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 mt-1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('dispatchesOfficial.templateHeader')}
          </label>
          <select
            value={headerFormat}
            onChange={(e) => setHeaderFormat(e.target.value as 'none' | (typeof HEADER_FORMATS)[number])}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
          >
            <option value="none">{t('dispatchesOfficial.headerNone')}</option>
            {HEADER_FORMATS.map((f) => (
              <option key={f} value={f}>
                {t(`dispatchesOfficial.header${f.charAt(0) + f.slice(1).toLowerCase()}`)}
              </option>
            ))}
          </select>
          {headerFormat === 'TEXT' && (
            <input
              type="text"
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              placeholder={t('dispatchesOfficial.templateHeaderText')}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 mt-2"
            />
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('dispatchesOfficial.templateButtons')}
            </label>
            <Button type="button" variant="secondary" size="sm" onClick={addButton}>
              {t('dispatchesOfficial.templateAddButton')}
            </Button>
          </div>
          {buttons.map((btn, i) => (
            <Card key={i} className="p-3 mb-2 flex flex-wrap gap-2 items-end">
              <select
                value={btn.type}
                onChange={(e) => updateButton(i, 'type', e.target.value)}
                className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
              >
                {BUTTON_TYPES.map((tpe) => (
                  <option key={tpe} value={tpe}>
                    {t(`dispatchesOfficial.button.${tpe}`)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={btn.text}
                onChange={(e) => updateButton(i, 'text', e.target.value)}
                placeholder={t('dispatchesOfficial.templateButtonText')}
                className="flex-1 min-w-[120px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
              />
              {btn.type === 'url' && (
                <input
                  type="text"
                  value={btn.url}
                  onChange={(e) => updateButton(i, 'url', e.target.value)}
                  placeholder={t('dispatchesOfficial.templateButtonUrl')}
                  className="flex-1 min-w-[160px] rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm"
                />
              )}
              <Button type="button" variant="secondary" size="sm" onClick={() => removeButton(i)}>
                ×
              </Button>
            </Card>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('dispatchesOfficial.templateFooter')}
          </label>
          <input
            type="text"
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('dispatchesOfficial.loading') : t('dispatchesOfficial.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
