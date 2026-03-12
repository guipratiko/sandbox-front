/**
 * Composer para disparo em massa de templates oficiais: instância, template (nome+idioma),
 * colar/CSV, mapa de variáveis e envio com cota por tier.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { instanceAPI } from '../../services/api';
import type { OfficialTemplate } from '../../services/api';

/** Extrai número de variáveis do body do template ({{1}}, {{2}}, ...). */
function getBodyVariableCount(template: OfficialTemplate): number {
  for (const c of template.components || []) {
    if ((c.type || '').toLowerCase() !== 'body') continue;
    const text = String(c.text || '');
    const matches = text.match(/\{\{\d+\}\}/g);
    if (!matches?.length) return 0;
    return Math.max(...matches.map((m) => parseInt(m.replace(/\D/g, ''), 10)));
  }
  return 0;
}

/** Normaliza telefone: só dígitos; se 10 ou 11 dígitos, adiciona 55. */
function normalizePhone(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) return '55' + digits;
  return digits;
}

/** Parse texto ou CSV para linhas e colunas. Detecta delimitador (vírgula ou ponto-e-vírgula) pela primeira linha. */
function parsePasteOrCsv(text: string): string[][] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const first = lines[0];
  const delim = first.includes(';') && first.split(';').length > (first.split(',').length || 0) ? ';' : ',';
  const re = new RegExp(`\\s*${delim === ';' ? ';' : ','}\\s*`);
  return lines.map((line) => line.split(re).map((c) => c.trim()));
}

interface QuotaData {
  tier: string | null;
  tierNumber: number;
  usedToday: number;
  remaining: number;
}

interface OfficialDispatchComposerProps {
  instanceId: string | null;
  templates: OfficialTemplate[];
  onSent?: () => void;
}

export const OfficialDispatchComposer: React.FC<OfficialDispatchComposerProps> = ({
  instanceId,
  templates,
  onSent,
}) => {
  const { t } = useLanguage();
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [templateChoice, setTemplateChoice] = useState<string>('');
  const [pasteText, setPasteText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [phoneCol, setPhoneCol] = useState(0);
  const [varMapping, setVarMapping] = useState<Record<number, { type: 'col'; col: number } | { type: 'fixed'; value: string }>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; results: Array<{ to: string; success: boolean; error?: string }> } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const approvedTemplates = templates.filter((tm) => (tm.status || '').toUpperCase() === 'APPROVED');
  const templateOptions = approvedTemplates.map((tm) => ({
    key: `${tm.name ?? ''}__${tm.language ?? ''}`,
    name: tm.name ?? '',
    language: tm.language ?? '',
    template: tm,
  }));

  const selectedOption = templateOptions.find((o) => o.key === templateChoice);
  const selectedTemplate = selectedOption?.template;
  const numVariables = selectedTemplate ? getBodyVariableCount(selectedTemplate) : 0;

  const loadQuota = useCallback(async () => {
    if (!instanceId) {
      setQuota(null);
      return;
    }
    setLoadingQuota(true);
    try {
      const res = await instanceAPI.getOfficialDispatchQuota(instanceId);
      const d = res.data;
      setQuota({
        tier: d.tier ?? null,
        tierNumber: d.tierNumber ?? 0,
        usedToday: d.usedToday ?? 0,
        remaining: d.remaining ?? 0,
      });
    } catch {
      setQuota(null);
    } finally {
      setLoadingQuota(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota]);

  useEffect(() => {
    if (!pasteText && !csvFile) {
      setParsedRows([]);
      return;
    }
    if (csvFile) {
      const reader = new FileReader();
      reader.onload = () => {
        const text = (reader.result as string) || '';
        setParsedRows(parsePasteOrCsv(text));
      };
      reader.readAsText(csvFile, 'UTF-8');
    } else {
      setParsedRows(parsePasteOrCsv(pasteText));
    }
  }, [pasteText, csvFile]);

  const maxCol = parsedRows.length ? Math.max(...parsedRows.map((r) => r.length)) : 0;
  const columnOptions = Array.from({ length: Math.max(maxCol, 2) }, (_, i) => i);

  const buildRecipients = useCallback((): Array<{ to: string; body_params: string[] }> => {
    const rec: Array<{ to: string; body_params: string[] }> = [];
    for (const row of parsedRows) {
      const to = normalizePhone((row[phoneCol] ?? '').trim());
      if (!to) continue;
      const params: string[] = [];
      for (let i = 1; i <= numVariables; i++) {
        const m = varMapping[i];
        if (m?.type === 'fixed') params.push(m.value ?? '');
        else if (m?.type === 'col') params.push((row[m.col] ?? '').trim());
        else params.push((row[i - 1] ?? '').trim());
      }
      rec.push({ to, body_params: params });
    }
    return rec;
  }, [parsedRows, phoneCol, numVariables, varMapping]);

  const handleSend = async () => {
    if (!instanceId || !selectedOption) return;
    const recipients = buildRecipients();
    if (recipients.length === 0) return;
    if (quota && recipients.length > quota.remaining) return;
    setSending(true);
    setResult(null);
    try {
      const res = await instanceAPI.sendOfficialDispatches(instanceId, {
        template_name: selectedOption.name,
        language_code: selectedOption.language,
        recipients,
      });
      setResult({
        sent: res.data.sent,
        failed: res.data.failed,
        results: res.data.results,
      });
      onSent?.();
      loadQuota();
    } catch (e) {
      setResult({
        sent: 0,
        failed: recipients.length,
        results: recipients.map((r) => ({ to: r.to, success: false, error: (e as Error).message })),
      });
    } finally {
      setSending(false);
    }
  };

  const canSend =
    instanceId &&
    selectedOption &&
    buildRecipients().length > 0 &&
    (!quota || buildRecipients().length <= quota.remaining) &&
    !sending;

  return (
    <div className="space-y-4">
      {!instanceId && (
        <Card className="p-6 text-center text-gray-500 dark:text-gray-400">
          {t('dispatchesOfficial.selectInstance')}
        </Card>
      )}

      {instanceId && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('dispatchesOfficial.dispatchQuota')}
                </span>
                {loadingQuota ? (
                  <p className="text-sm text-gray-500">{t('dispatchesOfficial.loading')}</p>
                ) : quota ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('dispatchesOfficial.dispatchQuotaUsed', {
                      n: String(quota.usedToday),
                      total: String(quota.tierNumber),
                    })}
                    {' · '}
                    {t('dispatchesOfficial.dispatchQuotaRemaining', { n: String(quota.remaining) })}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t('dispatchesOfficial.dispatchSelectTemplate')} / {t('dispatchesOfficial.dispatchSelectLanguage')}
            </h3>
            <select
              value={templateChoice}
              onChange={(e) => setTemplateChoice(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 w-full max-w-md"
            >
              <option value="">—</option>
              {templateOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.name} ({opt.language})
                </option>
              ))}
            </select>
            {approvedTemplates.length === 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
                {t('dispatchesOfficial.dispatchNoTemplate')}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('dispatchesOfficial.dispatchContacts')}
            </h3>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t('dispatchesOfficial.dispatchPastePlaceholder')}
              rows={5}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              />
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                {t('dispatchesOfficial.dispatchUploadCsv')}
              </Button>
              {csvFile && (
                <span className="text-sm text-gray-500">
                  {csvFile.name}
                  <button
                    type="button"
                    onClick={() => setCsvFile(null)}
                    className="ml-2 text-red-600 hover:underline"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            {parsedRows.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                {parsedRows.length} linhas, até {maxCol} colunas
              </p>
            )}
          </Card>

          {selectedTemplate && numVariables > 0 && parsedRows.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('dispatchesOfficial.dispatchVariableMapping')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {t('dispatchesOfficial.dispatchVariableMappingHint')}
              </p>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-sm">{t('dispatchesOfficial.dispatchColPhone')}</label>
                  <select
                    value={phoneCol}
                    onChange={(e) => setPhoneCol(Number(e.target.value))}
                    className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                  >
                    {columnOptions.map((c) => (
                      <option key={c} value={c}>
                        Col {c + 1}
                      </option>
                    ))}
                  </select>
                </div>
                {Array.from({ length: numVariables }, (_, i) => i + 1).map((n) => {
                  const mapping = varMapping[n];
                  return (
                  <div key={n} className="flex flex-wrap items-center gap-2">
                    <label className="text-sm w-24">{t('dispatchesOfficial.dispatchColVar', { n: String(n) })}</label>
                    <select
                      value={mapping?.type === 'col' ? `col_${mapping.col}` : 'fixed'}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'fixed') {
                          setVarMapping((prev) => ({ ...prev, [n]: { type: 'fixed', value: (prev[n] as { type: 'fixed'; value: string })?.value ?? '' } }));
                        } else {
                          const col = parseInt(v.replace('col_', ''), 10);
                          setVarMapping((prev) => ({ ...prev, [n]: { type: 'col', col } }));
                        }
                      }}
                      className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm"
                    >
                      <option value="fixed">{t('dispatchesOfficial.dispatchFixedValue')}</option>
                      {columnOptions.map((c) => (
                        <option key={c} value={`col_${c}`}>
                          Col {c + 1}
                        </option>
                      ))}
                    </select>
                    {mapping?.type === 'fixed' && (
                      <input
                        type="text"
                        value={mapping.value}
                        onChange={(e) =>
                          setVarMapping((prev) => ({ ...prev, [n]: { type: 'fixed', value: e.target.value } }))
                        }
                        placeholder={t('dispatchesOfficial.dispatchFixedValue')}
                        className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-sm min-w-[120px]"
                      />
                    )}
                  </div>
                  );
                })}
              </div>
            </Card>
          )}

          {parsedRows.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('dispatchesOfficial.dispatchPreview')}
              </h3>
              <div className="overflow-x-auto max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded">
                <table className="w-full text-sm">
                  <tbody>
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        {row.map((cell, j) => (
                          <td key={j} className="px-2 py-1">
                            {cell || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <div className="flex items-center gap-4">
            <Button onClick={handleSend} disabled={!canSend}>
              {sending ? t('dispatchesOfficial.dispatchSending') : t('dispatchesOfficial.dispatchSend')}
            </Button>
            {quota && buildRecipients().length > quota.remaining && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {t('dispatchesOfficial.dispatchErrorQuota')}
              </span>
            )}
          </div>

          {result && (
            <Card className="p-4 border-green-200 dark:border-green-800">
              <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('dispatchesOfficial.dispatchDone')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('dispatchesOfficial.dispatchDoneSummary', {
                  sent: String(result.sent),
                  failed: String(result.failed),
                })}
              </p>
              {result.results.some((r) => !r.success) && (
                <ul className="mt-2 text-xs text-red-600 dark:text-red-400 max-h-32 overflow-y-auto">
                  {result.results.filter((r) => !r.success).map((r, i) => (
                    <li key={i}>
                      {r.to}: {r.error}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};
