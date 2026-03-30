import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, Button, Input } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { crmAPI, CRMColumn, instanceAPI, Instance } from '../services/api';

const CrmContacts: React.FC = () => {
  const { t } = useLanguage();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const [instanceId, setInstanceId] = useState('');
  const [columnId, setColumnId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [vcfFile, setVcfFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [waRes, colRes] = await Promise.all([
        instanceAPI.getAll(),
        crmAPI.getColumns(),
      ]);
      setInstances(waRes.instances || []);
      const sorted = [...colRes.columns].sort((a, b) => a.order - b.order);
      setColumns(sorted);
      setColumnId((prev) =>
        prev && sorted.some((c) => c.id === prev) ? prev : sorted[0]?.id || ''
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!instanceId || !name.trim() || !phone.trim()) {
      setFormError(t('crmContacts.formRequired'));
      return;
    }
    try {
      setSaving(true);
      await crmAPI.createManualContact({
        instanceId,
        name: name.trim(),
        phone: phone.trim(),
        columnId: columnId || undefined,
      });
      setFormError(null);
      setName('');
      setPhone('');
      setSuccessBanner(t('crmContacts.createSuccess'));
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      setFormError(err.message || t('crmContacts.createError'));
    } finally {
      setSaving(false);
    }
  };

  const handleImportVcf = async () => {
    setSuccessBanner(null);
    setFormError(null);
    if (!instanceId || !vcfFile) {
      setFormError(t('crmContacts.vcfNeedFile'));
      return;
    }
    try {
      setImporting(true);
      const res = await crmAPI.importVcf({
        instanceId,
        columnId: columnId || undefined,
        file: vcfFile,
      });
      setSuccessBanner(
        t('crmContacts.vcfResult', {
          created: String(res.created),
          skipped: String(res.skipped),
          cards: String(res.cardsParsed),
        })
      );
      setFormError(null);
      setVcfFile(null);
    } catch (err: any) {
      setFormError(err.message || t('crmContacts.vcfError'));
    } finally {
      setImporting(false);
    }
  };

  const firstColumnId = columns[0]?.id || '';

  return (
    <AppLayout>
      <div className="animate-fadeIn max-w-3xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('crmContacts.title')}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">{t('crmContacts.subtitle')}</p>
          </div>
          <Link to="/crm">
            <Button variant="secondary" className="w-full sm:w-auto">
              {t('crmContacts.backToCrm')}
            </Button>
          </Link>
        </div>

        {successBanner && (
          <div className="mb-4 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-200">
            {successBanner}
          </div>
        )}

        {loading ? (
          <Card padding="lg" shadow="lg" className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-clerky-backendButton mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-300">{t('crmContacts.loading')}</p>
          </Card>
        ) : instances.length === 0 ? (
          <Card padding="lg" shadow="lg">
            <p className="text-center text-gray-600 dark:text-gray-400">{t('crmContacts.noWhatsappInstance')}</p>
          </Card>
        ) : (
          <>
            <Card padding="md" shadow="lg" className="mb-6 p-4 md:p-8">
              <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
                {t('crmContacts.sharedSettings')}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                    {t('crmContacts.instanceLabel')}
                  </label>
                  <select
                    value={instanceId}
                    onChange={(e) => setInstanceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200"
                  >
                    <option value="">{t('crmContacts.selectInstance')}</option>
                    {instances.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                    {t('crmContacts.columnLabel')}
                  </label>
                  <select
                    value={columnId || firstColumnId}
                    onChange={(e) => setColumnId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-xs text-amber-800 dark:text-amber-200/90 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
                {t('crmContacts.whatsappOnlyHint')}
              </p>
            </Card>

            <Card padding="md" shadow="lg" className="mb-6 p-4 md:p-8">
              <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
                {t('crmContacts.createTitle')}
              </h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <Input
                  id="crm-contact-name"
                  label={t('crmContacts.nameLabel')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('crmContacts.namePlaceholder')}
                  maxLength={255}
                />
                <Input
                  id="crm-contact-phone"
                  label={t('crmContacts.phoneLabel')}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t('crmContacts.phonePlaceholder')}
                />
                {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
                <Button type="submit" variant="primary" isLoading={saving} disabled={!instanceId}>
                  {t('crmContacts.createButton')}
                </Button>
              </form>
            </Card>

            <Card padding="md" shadow="lg" className="p-4 md:p-8">
              <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                {t('crmContacts.vcfTitle')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t('crmContacts.vcfHint')}</p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                    {t('crmContacts.vcfFileLabel')}
                  </label>
                  <input
                    type="file"
                    accept=".vcf,text/vcard"
                    onChange={(e) => setVcfFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-clerky-backendButton file:px-3 file:py-2 file:text-white"
                  />
                </div>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleImportVcf}
                  isLoading={importing}
                  disabled={!instanceId || !vcfFile}
                >
                  {t('crmContacts.vcfImportButton')}
                </Button>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default CrmContacts;
