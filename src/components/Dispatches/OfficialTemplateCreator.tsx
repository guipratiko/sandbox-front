import React, { useState, useRef, useCallback } from 'react';
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

const LIMITS = {
  NAME_MAX: 512,
  NAME_REGEX: /^[a-z0-9_]+$/,
  BODY_MAX: 1024,
  HEADER_TEXT_MAX: 60,
  FOOTER_MAX: 60,
  BUTTON_TEXT_MAX: 25,
  MIN_CHARS_PER_VARIABLE: 20,
} as const;

/** Normaliza nome do template: minúsculas, só a-z 0-9 _ */
function normalizeTemplateName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/** Valida nome: retorna mensagem de erro ou null */
function validateTemplateName(name: string): string | null {
  const n = normalizeTemplateName(name);
  if (!n) return 'Nome do template é obrigatório.';
  if (n.length > LIMITS.NAME_MAX) return `Nome deve ter no máximo ${LIMITS.NAME_MAX} caracteres.`;
  if (!LIMITS.NAME_REGEX.test(n)) return 'Use apenas letras minúsculas, números e underscore (ex: meu_template).';
  return null;
}

/** Valida corpo: tamanho e proporção variáveis/texto */
function validateBodyText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return 'Corpo da mensagem é obrigatório.';
  if (trimmed.length > LIMITS.BODY_MAX) return `Corpo deve ter no máximo ${LIMITS.BODY_MAX} caracteres.`;
  const variableMatches = trimmed.match(/\{\{\s*\d+\s*\}\}/g);
  const numVariables = variableMatches
    ? Math.max(...variableMatches.map((m) => parseInt(m.replace(/\D/g, ''), 10)))
    : 0;
  if (numVariables > 0) {
    const textWithoutVars = trimmed.replace(/\{\{\s*\d+\s*\}\}/g, '').trim();
    const minRequired = numVariables * LIMITS.MIN_CHARS_PER_VARIABLE;
    if (textWithoutVars.length < minRequired) {
      return `Para ${numVariables} variável(is), use pelo menos ${minRequired} caracteres de texto (além das variáveis).`;
    }
  }
  return null;
}

interface ButtonForm {
  type: (typeof BUTTON_TYPES)[number];
  text: string;
  url: string;
}

interface OfficialTemplateCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (body: CreateOfficialTemplateBody) => Promise<{ id: string; templateStatus?: string } | void>;
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
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = useCallback((variable: string) => {
    const ta = bodyTextareaRef.current;
    if (!ta) {
      setBodyText((prev) => prev + variable);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = bodyText.slice(0, start);
    const after = bodyText.slice(end);
    setBodyText(before + variable + after);
    setTimeout(() => ta.focus(), 0);
    setTimeout(() => ta.setSelectionRange(start + variable.length, start + variable.length), 10);
  }, [bodyText]);

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
      const firstRow = bodyExample
        .split('\n')[0]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (firstRow.length) body.example = { body_text: [firstRow] };
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
    const trimmedName = normalizeTemplateName(name);
    const nameErr = validateTemplateName(name);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    const bodyErr = validateBodyText(bodyText);
    if (bodyErr) {
      setError(bodyErr);
      return;
    }
    const matches = bodyText.match(/\{\{\s*\d+\s*\}\}/g) || [];
    const numVars = matches.length === 0 ? 0 : Math.max(...matches.map((m) => parseInt(m.replace(/\D/g, ''), 10)));
    if (numVars > 0) {
      const exampleRow = bodyExample.trim().split('\n')[0].split(',').map((s) => s.trim()).filter(Boolean);
      if (exampleRow.length < numVars) {
        setError(`Informe um valor de exemplo para cada variável ({{1}} a {{${numVars}}}). Ex.: ${Array.from({ length: numVars }, (_, i) => `Exemplo ${i + 1}`).join(', ')}`);
        return;
      }
    }
    if (headerFormat === 'TEXT' && headerText.trim().length > LIMITS.HEADER_TEXT_MAX) {
      setError(`Cabeçalho deve ter no máximo ${LIMITS.HEADER_TEXT_MAX} caracteres.`);
      return;
    }
    if (footerText.trim().length > LIMITS.FOOTER_MAX) {
      setError(`Rodapé deve ter no máximo ${LIMITS.FOOTER_MAX} caracteres.`);
      return;
    }
    for (let i = 0; i < buttons.length; i++) {
      if (!buttons[i].text.trim()) {
        setError(`Texto do botão ${i + 1} é obrigatório.`);
        return;
      }
      if (buttons[i].text.trim().length > LIMITS.BUTTON_TEXT_MAX) {
        setError(`Texto do botão ${i + 1}: máximo ${LIMITS.BUTTON_TEXT_MAX} caracteres.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const components = buildComponents();
      const result = await onSubmit({
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
      if (result?.templateStatus?.toUpperCase() === 'REJECTED') {
        setTimeout(
          () =>
            window.alert(
              t('dispatchesOfficial.createdRejected') ||
                'Template criado, mas foi rejeitado na revisão da Meta. Verifique o motivo no Meta Business Suite (Message Templates) ou no e-mail da Meta.'
            ),
          100
        );
      }
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

  /** Gera o texto do body com {{1}}, {{2}} substituídos pelo exemplo (primeira linha) ou placeholders */
  const getPreviewBodyText = (): string => {
    const text = bodyText.trim() || '';
    if (!text) return '';
    const firstRow = bodyExample.trim().split('\n')[0];
    const values = firstRow ? firstRow.split(',').map((s) => s.trim()).filter(Boolean) : [];
    return text.replace(/\{\{(\d+)\}\}/g, (_, num) => {
      const idx = parseInt(num, 10) - 1;
      return values[idx] ?? `{{${num}}}`;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dispatchesOfficial.createTemplate')} size="xl">
      <div className="flex flex-col lg:flex-row gap-6">
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 space-y-4">
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
            placeholder="meu_template_exemplo"
            maxLength={LIMITS.NAME_MAX + 50}
            onBlur={() => setName((prev) => normalizeTemplateName(prev) || prev)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Só letras minúsculas, números e _ (máx. {LIMITS.NAME_MAX})
          </p>
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
          <div className="flex flex-wrap gap-1 mb-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button
                key={n}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => insertVariable(`{{${n}}}`)}
              >
                {`{{${n}}}`}
              </Button>
            ))}
          </div>
          <textarea
            ref={bodyTextareaRef}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Olá! Use os botões acima para inserir variáveis como {{1}}, {{2}}..."
            rows={4}
            maxLength={LIMITS.BODY_MAX + 100}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 font-mono text-sm"
            required
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {bodyText.length} / {LIMITS.BODY_MAX} caracteres
            {bodyText.match(/\{\{\s*\d+\s*\}\}/g) && (
              <> · Variáveis: {bodyText.match(/\{\{\s*\d+\s*\}\}/g)?.join(', ')}</>
            )}
          </p>
          {/\{\{\d+\}\}/.test(bodyText) && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              {t('dispatchesOfficial.bodyVariableRatioHint')}
            </p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('dispatchesOfficial.templateBodyExample')}
          </p>
          <textarea
            value={bodyExample}
            onChange={(e) => setBodyExample(e.target.value)}
            placeholder="João (para {{1}}), 12345 (para {{2}})..."
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
            <>
              <input
                type="text"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
                placeholder={t('dispatchesOfficial.templateHeaderText')}
                maxLength={LIMITS.HEADER_TEXT_MAX}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 mt-2"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {headerText.length} / {LIMITS.HEADER_TEXT_MAX}
              </p>
            </>
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
                maxLength={LIMITS.BUTTON_TEXT_MAX}
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
            maxLength={LIMITS.FOOTER_MAX}
            placeholder="Máx. 60 caracteres"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {footerText.length} / {LIMITS.FOOTER_MAX}
          </p>
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

        {/* Preview à direita */}
        <div className="w-full lg:w-[320px] flex-shrink-0">
          <div className="sticky top-4 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              {t('dispatchesOfficial.previewTitle')}
            </p>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              {headerFormat === 'TEXT' && headerText.trim() && (
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {headerText.trim()}
                </div>
              )}
              {headerFormat !== 'none' && headerFormat !== 'TEXT' && (
                <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 text-xs text-gray-500 dark:text-gray-400">
                  [{headerFormat}]
                </div>
              )}
              <div className="p-3">
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                  {getPreviewBodyText() || (bodyText ? '…' : '—')}
                </p>
              </div>
              {buttons.length > 0 && (
                <div className="px-3 pb-3 space-y-1.5">
                  {buttons.map((btn, i) => (
                    <div
                      key={i}
                      className="text-center py-1.5 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm border border-green-200 dark:border-green-800"
                    >
                      {btn.text || '…'}
                    </div>
                  ))}
                </div>
              )}
              {footerText.trim() && (
                <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  {footerText.trim()}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t('dispatchesOfficial.previewHint')}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
