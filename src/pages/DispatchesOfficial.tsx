import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, HelpIcon, Button, Modal } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { instanceAPI } from '../services/api';
import type { Instance, OfficialTemplate, CreateOfficialTemplateBody } from '../services/api';
import { OfficialTemplateCreator } from '../components/Dispatches/OfficialTemplateCreator';
import { OfficialDispatchComposer } from '../components/Dispatches/OfficialDispatchComposer';

const DispatchesOfficial: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'templates' | 'dispatches'>('templates');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<OfficialTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const officialInstances = instances.filter(
    (i) => i.integration === 'WHATSAPP-CLOUD' && i.waba_id && i.status === 'connected'
  );

  const loadInstances = useCallback(async () => {
    try {
      const res = await instanceAPI.getAll();
      setInstances(res.instances || []);
      if (!selectedInstanceId && (res.instances?.length ?? 0) > 0) {
        const first = (res.instances as Instance[]).find(
          (i) => i.integration === 'WHATSAPP-CLOUD' && i.waba_id && i.status === 'connected'
        );
        if (first) setSelectedInstanceId(first.id);
      }
    } catch {
      setInstances([]);
    }
  }, [selectedInstanceId]);

  const loadTemplates = useCallback(async () => {
    if (!selectedInstanceId) {
      setTemplates([]);
      return;
    }
    setLoadingTemplates(true);
    setError(null);
    try {
      const res = await instanceAPI.listOfficialTemplates(selectedInstanceId);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError(t('dispatchesOfficial.errorLoadTemplates'));
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [selectedInstanceId, t]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateSubmit = async (
    body: CreateOfficialTemplateBody
  ): Promise<{ id: string; templateStatus?: string } | void> => {
    if (!selectedInstanceId) throw new Error(t('dispatchesOfficial.selectInstance'));
    const res = await instanceAPI.createOfficialTemplate(selectedInstanceId, body);
    await loadTemplates();
    return res.data;
  };

  const handleDelete = async (name: string) => {
    if (!selectedInstanceId || !name) return;
    if (!window.confirm(`${t('dispatches.delete')} "${name}"?`)) return;
    try {
      await instanceAPI.deleteOfficialTemplate(selectedInstanceId, name);
      await loadTemplates();
    } catch {
      setError(t('dispatchesOfficial.errorDelete'));
    }
  };

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('dispatchesOfficial.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
            {t('dispatchesOfficial.subtitle')}
            <HelpIcon helpKey="dispatchesOfficial" className="ml-1" />
          </p>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'templates'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('dispatchesOfficial.templatesTab')}
          </button>
          <button
            onClick={() => setActiveTab('dispatches')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'dispatches'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t('dispatchesOfficial.dispatchesTab')}
          </button>
        </div>

        {activeTab === 'templates' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('dispatchesOfficial.selectInstance')}
              </label>
              <select
                value={selectedInstanceId ?? ''}
                onChange={(e) => setSelectedInstanceId(e.target.value || null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 min-w-[200px]"
              >
                <option value="">—</option>
                {officialInstances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.display_phone_number ? `(${i.display_phone_number})` : ''}
                  </option>
                ))}
              </select>
              {selectedInstanceId && (
                <Button onClick={() => setShowCreateModal(true)}>{t('dispatchesOfficial.createTemplate')}</Button>
              )}
            </div>

            {!selectedInstanceId && (
              <Card className="p-6 text-center text-gray-500 dark:text-gray-400">
                {officialInstances.length === 0
                  ? t('dispatchesOfficial.noOfficialInstances')
                  : t('dispatchesOfficial.selectInstance')}
              </Card>
            )}

            {selectedInstanceId && (
              <Card className="p-4">
                {error && (
                  <div className="mb-3 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
                    {error}
                  </div>
                )}
                {loadingTemplates ? (
                  <p className="text-gray-500 dark:text-gray-400">{t('dispatchesOfficial.loading')}</p>
                ) : templates.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    Nenhum template. Clique em “{t('dispatchesOfficial.createTemplate')}” para criar.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-600">
                          <th className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">Nome</th>
                          <th className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">
                            {t('dispatchesOfficial.templateStatus')}
                          </th>
                          <th className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">Categoria</th>
                          <th className="py-2 pr-4 font-medium text-gray-700 dark:text-gray-300">Idioma</th>
                          <th className="py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {templates.map((tmpl) => (
                          <tr key={tmpl.id ?? tmpl.name ?? ''} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2 pr-4 font-mono text-sm">{tmpl.name ?? '—'}</td>
                            <td className="py-2 pr-4">
                              <span
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  tmpl.status === 'APPROVED'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                    : tmpl.status === 'PENDING'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                      : tmpl.status === 'REJECTED'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {['APPROVED', 'PENDING', 'REJECTED', 'DISABLED'].includes(tmpl.status || '')
                                  ? t(`dispatchesOfficial.status.${tmpl.status}`)
                                  : (tmpl.status ?? '—')}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-sm">{tmpl.category ?? '—'}</td>
                            <td className="py-2 pr-4 text-sm">{tmpl.language ?? '—'}</td>
                            <td className="py-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => tmpl.name && handleDelete(tmpl.name)}
                              >
                                {t('dispatchesOfficial.deleteTemplate')}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {selectedInstanceId && templates.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    {t('dispatchesOfficial.templatesMetaNote')}
                  </p>
                )}
              </Card>
            )}

            <OfficialTemplateCreator
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onSubmit={handleCreateSubmit}
            />
          </>
        )}

        {activeTab === 'dispatches' && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('dispatchesOfficial.selectInstance')}
              </label>
              <select
                value={selectedInstanceId ?? ''}
                onChange={(e) => setSelectedInstanceId(e.target.value || null)}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 min-w-[200px]"
              >
                <option value="">—</option>
                {officialInstances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.display_phone_number ? `(${i.display_phone_number})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <OfficialDispatchComposer instanceId={selectedInstanceId} templates={templates} />
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default DispatchesOfficial;
