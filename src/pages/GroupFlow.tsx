import React, { useCallback, useEffect, useState } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import {
  instanceAPI,
  groupFlowAPI,
  grupoCampaignAPI,
  type Instance,
  type GrupoCampaignRow,
  type GrupoCampaignInclusionRule,
} from '../services/api';
import { getErrorMessage } from '../utils/errorHandler';

function extractGroupFields(item: unknown): { id: string; subject: string; size?: number } {
  if (!item || typeof item !== 'object') return { id: '-', subject: '-' };
  const o = item as Record<string, unknown>;
  const id = String(o.id ?? o.jid ?? o.groupJid ?? '-');
  const subject = String(o.subject ?? o.name ?? '-');
  let size: number | undefined;
  if (typeof o.size === 'number') size = o.size;
  else if (Array.isArray(o.participants)) size = o.participants.length;
  return { id, subject, size };
}

const GroupFlow: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'groups' | 'campaigns'>('groups');
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [selectedInstanceName, setSelectedInstanceName] = useState('');
  const [connectedOnly, setConnectedOnly] = useState(true);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<unknown[]>([]);
  const [detailJson, setDetailJson] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<GrupoCampaignRow[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRule, setNewRule] = useState<GrupoCampaignInclusionRule>('empty');
  const [newJidsText, setNewJidsText] = useState('');
  const [newContactsHint, setNewContactsHint] = useState(0);
  const [openCampaign, setOpenCampaign] = useState<{ campaign: GrupoCampaignRow; groupJids: string[] } | null>(null);
  const [addJidsText, setAddJidsText] = useState('');

  const loadInstances = useCallback(async () => {
    try {
      setLoadingInstances(true);
      setError(null);
      const res = await instanceAPI.getAll();
      const list = res.instances || [];
      setInstances(list);
      const filtered = connectedOnly ? list.filter((i) => i.status === 'connected') : list;
      const preferred = filtered[0] ?? list[0];
      if (preferred?.instanceName) {
        setSelectedInstanceName((prev) =>
          prev && filtered.some((i) => i.instanceName === prev) ? prev : preferred.instanceName
        );
      } else {
        setSelectedInstanceName('');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingInstances(false);
    }
  }, [connectedOnly, t]);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const loadCampaigns = useCallback(async () => {
    try {
      setLoadingCampaigns(true);
      setError(null);
      const res = await grupoCampaignAPI.list();
      setCampaigns(res.campaigns || []);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingCampaigns(false);
    }
  }, [t]);

  useEffect(() => {
    if (tab === 'campaigns') loadCampaigns();
  }, [tab, loadCampaigns]);

  const visibleInstances = connectedOnly ? instances.filter((i) => i.status === 'connected') : instances;

  const handleQueryGroups = async () => {
    if (!selectedInstanceName.trim()) {
      setError(t('groupFlow.noInstances'));
      return;
    }
    try {
      setLoadingQuery(true);
      setError(null);
      setDetailJson(null);
      const res = await groupFlowAPI.listGroups(selectedInstanceName.trim(), false);
      const list = res.data?.groups;
      setGroups(Array.isArray(list) ? list : []);
    } catch (e: unknown) {
      setGroups([]);
      setError(getErrorMessage(e, t('groupFlow.error')));
    } finally {
      setLoadingQuery(false);
    }
  };

  const openDetails = async (groupJid: string) => {
    if (!selectedInstanceName) return;
    try {
      setError(null);
      const res = await groupFlowAPI.getGroupInfo(selectedInstanceName, groupJid);
      setDetailJson(JSON.stringify(res.data, null, 2));
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const fetchInvite = async (groupJid: string) => {
    if (!selectedInstanceName) return;
    try {
      setError(null);
      const res = await groupFlowAPI.getInvite(selectedInstanceName, groupJid);
      setDetailJson(JSON.stringify(res.data, null, 2));
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const handleCreateCampaign = async () => {
    if (!newName.trim() || !selectedInstanceName) {
      setError(t('groupFlow.campaignName'));
      return;
    }
    const groupJids =
      newRule === 'explicit'
        ? newJidsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    try {
      setError(null);
      await grupoCampaignAPI.create({
        name: newName.trim(),
        evolutionInstanceName: selectedInstanceName,
        inclusionRule: newRule,
        contactsPerGroupHint: newContactsHint,
        groupJids,
      });
      setShowCreate(false);
      setNewName('');
      setNewJidsText('');
      await loadCampaigns();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const openCampaignById = async (id: string) => {
    try {
      setError(null);
      const res = await grupoCampaignAPI.get(id);
      setOpenCampaign({ campaign: res.campaign as GrupoCampaignRow, groupJids: res.groupJids });
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!window.confirm('OK?')) return;
    try {
      await grupoCampaignAPI.delete(id);
      setOpenCampaign(null);
      await loadCampaigns();
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  const handleAddJidsToCampaign = async () => {
    if (!openCampaign) return;
    const jids = addJidsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!jids.length) return;
    try {
      await grupoCampaignAPI.addGroups(openCampaign.campaign.id, jids);
      setAddJidsText('');
      await openCampaignById(openCampaign.campaign.id);
    } catch (e: unknown) {
      setError(getErrorMessage(e, t('groupFlow.error')));
    }
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'groups'
                ? 'bg-clerky-backendButton text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => setTab('groups')}
          >
            {t('groupFlow.tabGroups')}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'campaigns'
                ? 'bg-clerky-backendButton text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            onClick={() => setTab('campaigns')}
          >
            {t('groupFlow.tabCampaigns')}
          </button>
        </div>

        <Card padding="lg" shadow="md">
          <h1 className="text-xl font-semibold text-clerky-backendText dark:text-gray-100 mb-2">{t('groupFlow.title')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-6">{t('groupFlow.helpIntro')}</p>

          {loadingInstances ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('groupFlow.loadingInstances')}</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('groupFlow.noInstances')}</p>
          ) : visibleInstances.length === 0 ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">{t('groupFlow.noneConnected')}</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 min-w-0">
                  <label htmlFor="groupflow-instance" className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                    {t('groupFlow.selectInstance')}
                  </label>
                  <select
                    id="groupflow-instance"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-clerky-backendText dark:text-gray-100 px-3 py-2 text-sm"
                    value={selectedInstanceName}
                    onChange={(e) => setSelectedInstanceName(e.target.value)}
                  >
                    {visibleInstances.map((inst) => (
                      <option key={inst.id} value={inst.instanceName}>
                        {inst.name} — {inst.instanceName} ({inst.status})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{t('groupFlow.selectHint')}</p>
                </div>
                {tab === 'groups' && (
                  <Button type="button" variant="primary" onClick={handleQueryGroups} disabled={loadingQuery}>
                    {loadingQuery ? t('groupFlow.loading') : t('groupFlow.queryButton')}
                  </Button>
                )}
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={connectedOnly}
                  onChange={(e) => setConnectedOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {t('groupFlow.onlyConnected')}
              </label>
            </div>
          )}

          {error && (
            <div
              className="mt-4 rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-200"
              role="alert"
            >
              <strong className="font-semibold">{t('groupFlow.error')}: </strong>
              {error}
            </div>
          )}
        </Card>

        {tab === 'groups' && groups.length > 0 && (
          <Card padding="lg" shadow="md">
            <h2 className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 mb-3">{t('groupFlow.tabGroups')}</h2>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/80 text-left text-gray-600 dark:text-gray-300">
                  <tr>
                    <th className="px-3 py-2">{t('groupFlow.groupsTableSubject')}</th>
                    <th className="px-3 py-2">{t('groupFlow.groupsTableId')}</th>
                    <th className="px-3 py-2">{t('groupFlow.groupsTableSize')}</th>
                    <th className="px-3 py-2 w-40" />
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, idx) => {
                    const row = extractGroupFields(g);
                    return (
                      <tr key={`${row.id}-${idx}`} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 text-clerky-backendText dark:text-gray-100 max-w-[12rem] truncate">{row.subject}</td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[14rem] truncate">{row.id}</td>
                        <td className="px-3 py-2">{row.size ?? '—'}</td>
                        <td className="px-3 py-2 flex flex-wrap gap-1">
                          <Button type="button" variant="secondary" size="sm" onClick={() => openDetails(row.id)}>
                            {t('groupFlow.btnDetails')}
                          </Button>
                          <Button type="button" variant="secondary" size="sm" onClick={() => fetchInvite(row.id)}>
                            {t('groupFlow.btnInvite')}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'groups' && detailJson && (
          <Card padding="lg" shadow="md">
            <h2 className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 mb-2">{t('groupFlow.detailTitle')}</h2>
            <pre className="text-xs overflow-x-auto rounded-lg bg-gray-50 dark:bg-gray-900/80 p-4 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto">
              {detailJson}
            </pre>
          </Card>
        )}

        {tab === 'campaigns' && (
          <Card padding="lg" shadow="md">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100">{t('groupFlow.campaignsTitle')}</h2>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => loadCampaigns()} disabled={loadingCampaigns}>
                  {t('groupFlow.refreshCampaigns')}
                </Button>
                <Button type="button" variant="primary" onClick={() => setShowCreate(true)}>
                  {t('groupFlow.newCampaign')}
                </Button>
              </div>
            </div>
            {loadingCampaigns ? (
              <p className="text-sm text-gray-500">{t('groupFlow.loading')}</p>
            ) : (
              <ul className="space-y-2">
                {campaigns.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-clerky-backendText dark:text-gray-100">{c.name}</p>
                      <p className="text-xs text-gray-500">
                        {c.evolution_instance_name} · {c.inclusion_rule}
                      </p>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={() => openCampaignById(c.id)}>
                      {t('groupFlow.campaignOpen')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
            <Card padding="lg" shadow="lg" className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-100">{t('groupFlow.newCampaign')}</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.campaignName')}</label>
                  <input
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.campaignRule')}</label>
                  <select
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    value={newRule}
                    onChange={(e) => setNewRule(e.target.value as GrupoCampaignInclusionRule)}
                  >
                    <option value="all">{t('groupFlow.ruleAll')}</option>
                    <option value="explicit">{t('groupFlow.ruleExplicit')}</option>
                    <option value="empty">{t('groupFlow.ruleEmpty')}</option>
                  </select>
                </div>
                {newRule === 'explicit' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">JIDs</label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono min-h-[100px]"
                      placeholder={t('groupFlow.jidsPlaceholder')}
                      value={newJidsText}
                      onChange={(e) => setNewJidsText(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">{t('groupFlow.contactsPerGroup')}</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    value={newContactsHint}
                    onChange={(e) => setNewContactsHint(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                  {t('groupFlow.cancel')}
                </Button>
                <Button type="button" variant="primary" onClick={handleCreateCampaign}>
                  {t('groupFlow.createCampaign')}
                </Button>
              </div>
            </Card>
          </div>
        )}

        {openCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
            <Card padding="lg" shadow="lg" className="max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-2 text-clerky-backendText dark:text-gray-100">{openCampaign.campaign.name}</h3>
              <p className="text-xs text-gray-500 mb-4">
                {openCampaign.campaign.evolution_instance_name} · {openCampaign.campaign.inclusion_rule}
              </p>
              <p className="text-sm font-medium mb-1">{t('groupFlow.campaignJids')}</p>
              <ul className="text-xs font-mono max-h-32 overflow-y-auto mb-4 space-y-1">
                {openCampaign.groupJids.length === 0 ? <li className="text-gray-500">—</li> : openCampaign.groupJids.map((j) => <li key={j}>{j}</li>)}
              </ul>
              <label className="block text-sm font-medium mb-1">{t('groupFlow.addJids')}</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono min-h-[80px] mb-3"
                placeholder={t('groupFlow.jidsPlaceholder')}
                value={addJidsText}
                onChange={(e) => setAddJidsText(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" size="sm" onClick={handleAddJidsToCampaign}>
                  {t('groupFlow.addJids')}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setOpenCampaign(null)}>
                  {t('groupFlow.cancel')}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => handleDeleteCampaign(openCampaign.campaign.id)}>
                  {t('groupFlow.campaignDelete')}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default GroupFlow;
