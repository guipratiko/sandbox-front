import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button, Modal, Input, HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { aiAgentAPI, instanceAPI, Instance } from '../services/api';
import type { AIAgent, AIAgentLead, AgentMedia, AgentLocation, BlockDurationUnit } from '../services/api';
import type { AssistedConfig } from '../types/aiAgent';
import AssistedForm from '../components/AIAgent/AssistedForm';
import { getErrorMessage, logError } from '../utils/errorHandler';

const AIAgentPage: React.FC = () => {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const maxAIAgents = user?.maxAIAgents ?? 0;
  const atAIAgentLimit = maxAIAgents > 0 && agents.length >= maxAIAgents;
  const [isLoading, setIsLoading] = useState(true);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [leads, setLeads] = useState<AIAgentLead[]>([]);
  const [showLeadsModal, setShowLeadsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados do formulário
  const [agentName, setAgentName] = useState('');
  const [agentInstanceId, setAgentInstanceId] = useState('');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentWaitTime, setAgentWaitTime] = useState(13);
  const [agentIsActive, setAgentIsActive] = useState(true);
  const [agentTranscribeAudio, setAgentTranscribeAudio] = useState(true);
  const [agentType, setAgentType] = useState<'manual' | 'assisted'>('manual');
  const [assistedConfig, setAssistedConfig] = useState<AssistedConfig>({});
  const [blockWhenUserReplies, setBlockWhenUserReplies] = useState(false);
  const [blockDuration, setBlockDuration] = useState(30);
  const [blockDurationUnit, setBlockDurationUnit] = useState<BlockDurationUnit>('minutes');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [knowledgeCount, setKnowledgeCount] = useState<number | null>(null);
  const [isAddingKnowledge, setIsAddingKnowledge] = useState(false);
  const [agentMedia, setAgentMedia] = useState<AgentMedia[]>([]);
  const [agentLocations, setAgentLocations] = useState<AgentLocation[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [addingLocation, setAddingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({ name: '', address: '', latitude: '', longitude: '', maxUsesPerContact: 1 });
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaMaxUses, setMediaMaxUses] = useState(1);
  const mediaFileInputRef = React.useRef<HTMLInputElement>(null);

  // Carregar agentes
  const loadAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await aiAgentAPI.getAll();
      setAgents(response.agents);
    } catch (error: unknown) {
      logError('AIAgent.loadAgents', error);
      const errorMsg = getErrorMessage(error, t('aiAgent.error.loadAgents'));
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carregar instâncias
  const loadInstances = useCallback(async () => {
    try {
      const response = await instanceAPI.getAll();
      setInstances(response.instances);
    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error);
    }
  }, []);

  // Carregar leads
  const loadLeads = useCallback(async (instanceId?: string) => {
    try {
      const response = await aiAgentAPI.getLeads(instanceId);
      setLeads(response.leads);
    } catch (error: unknown) {
      logError('AIAgent.loadLeads', error);
      const errorMsg = getErrorMessage(error, t('aiAgent.error.loadLeads'));
      alert(errorMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) {
      loadAgents();
      loadInstances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]); // Remover loadAgents e loadInstances das dependências para evitar recarregamentos

  // Carregar contagem da base vetorizada quando seleciona agente
  const loadKnowledgeCount = useCallback(async (agentId: string) => {
    try {
      const res = await aiAgentAPI.getKnowledgeCount(agentId);
      setKnowledgeCount(res.count);
    } catch {
      setKnowledgeCount(null);
    }
  }, []);

  const loadAgentMedia = useCallback(async (agentId: string) => {
    try {
      const res = await aiAgentAPI.getMedia(agentId);
      setAgentMedia(res.media || []);
    } catch {
      setAgentMedia([]);
    }
  }, []);

  const loadAgentLocations = useCallback(async (agentId: string) => {
    try {
      const res = await aiAgentAPI.getLocations(agentId);
      setAgentLocations(res.locations || []);
    } catch {
      setAgentLocations([]);
    }
  }, []);

  // Selecionar agente
  const handleSelectAgent = (agent: AIAgent) => {
    setSelectedAgent(agent);
    setAgentName(agent.name);
    loadKnowledgeCount(agent.id);
    loadAgentMedia(agent.id);
    loadAgentLocations(agent.id);
    setAgentInstanceId(agent.instanceId ?? '');
    setAgentPrompt(agent.prompt);
    setAgentWaitTime(agent.waitTime);
    setAgentIsActive(agent.isActive);
    setAgentTranscribeAudio(agent.transcribeAudio !== undefined ? agent.transcribeAudio : true);
    setAgentType(agent.agentType || 'manual');
    setAssistedConfig(agent.assistedConfig || {});
    setBlockWhenUserReplies(agent.blockWhenUserReplies ?? false);
    setBlockDuration(agent.blockDuration ?? 30);
    setBlockDurationUnit((agent.blockDurationUnit as BlockDurationUnit) || 'minutes');
  };

  // Criar agente (assistido) ao avançar para o passo 11 do formulário assistido; retorna o id do agente.
  const createAgentForAssistedStep11 = useCallback(async (): Promise<string | void> => {
    if (!agentName.trim() || !agentInstanceId) {
      alert(t('aiAgent.validation.fillRequired'));
      return undefined;
    }
    try {
      setIsSaving(true);
      const response = await aiAgentAPI.create({
        name: agentName.trim(),
        instanceId: agentInstanceId,
        prompt: undefined,
        waitTime: agentWaitTime,
        isActive: agentIsActive,
        transcribeAudio: agentTranscribeAudio,
        agentType: 'assisted',
        assistedConfig,
        blockWhenUserReplies,
        blockDuration: blockWhenUserReplies && blockDurationUnit !== 'permanent' ? blockDuration : null,
        blockDurationUnit: blockWhenUserReplies ? blockDurationUnit : null,
      });
      setAgents((prev) => [response.agent, ...prev]);
      setSelectedAgent(response.agent);
      loadKnowledgeCount(response.agent.id);
      loadAgentMedia(response.agent.id);
      loadAgentLocations(response.agent.id);
      setKnowledgeCount(0);
      setAgentMedia([]);
      setAgentLocations([]);
      return response.agent.id;
    } catch (error: unknown) {
      logError('AIAgent.createAgentForAssisted', error);
      const errorMsg = getErrorMessage(error, t('aiAgent.error.createAgent'));
      alert(errorMsg);
      return undefined;
    } finally {
      setIsSaving(false);
    }
  }, [agentName, agentInstanceId, agentWaitTime, agentIsActive, agentTranscribeAudio, assistedConfig, blockWhenUserReplies, blockDuration, blockDurationUnit, t]);

  // Criar novo agente
  const handleCreateAgent = async () => {
    if (!agentName.trim() || !agentInstanceId) {
      alert(t('aiAgent.validation.fillRequired'));
      return;
    }

    if (agentType === 'manual' && !agentPrompt.trim()) {
      alert(t('aiAgent.validation.fillPrompt'));
      return;
    }

    if (agentPrompt && agentPrompt.length > 100000) {
      alert(t('aiAgent.validation.promptMaxLength'));
      return;
    }

    try {
      setIsSaving(true);
      const response = await aiAgentAPI.create({
        name: agentName.trim(),
        instanceId: agentInstanceId,
        prompt: agentType === 'manual' ? agentPrompt : undefined,
        waitTime: agentWaitTime,
        isActive: agentIsActive,
        transcribeAudio: agentTranscribeAudio,
        agentType,
        assistedConfig: agentType === 'assisted' ? assistedConfig : undefined,
        blockWhenUserReplies,
        blockDuration: blockWhenUserReplies && blockDurationUnit !== 'permanent' ? blockDuration : null,
        blockDurationUnit: blockWhenUserReplies ? blockDurationUnit : null,
      });
      setAgents([response.agent, ...agents]);
      setSelectedAgent(response.agent);
      loadKnowledgeCount(response.agent.id);
      loadAgentMedia(response.agent.id);
      loadAgentLocations(response.agent.id);
      setKnowledgeCount(0);
      setAgentMedia([]);
      setAgentLocations([]);
      alert(t('aiAgent.success.createAgent'));
    } catch (error: unknown) {
      logError('AIAgent.createAgent', error);
      const errorMsg = getErrorMessage(error, t('aiAgent.error.createAgent'));
      alert(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Atualizar agente
  const handleUpdateAgent = async () => {
    if (!selectedAgent) return;

    if (!agentName.trim()) {
      alert(t('aiAgent.validation.fillRequired'));
      return;
    }

    if (agentType === 'manual' && !agentPrompt.trim()) {
      alert(t('aiAgent.validation.fillPrompt'));
      return;
    }

    if (agentPrompt && agentPrompt.length > 100000) {
      alert(t('aiAgent.validation.promptMaxLength'));
      return;
    }

    try {
      setIsSaving(true);
      const response = await aiAgentAPI.update(selectedAgent.id, {
        name: agentName.trim(),
        instanceId: agentInstanceId || null,
        prompt: agentType === 'manual' ? agentPrompt : undefined,
        waitTime: agentWaitTime,
        isActive: agentIsActive,
        transcribeAudio: agentTranscribeAudio,
        agentType,
        assistedConfig: agentType === 'assisted' ? assistedConfig : undefined,
        blockWhenUserReplies,
        blockDuration: blockWhenUserReplies && blockDurationUnit !== 'permanent' ? blockDuration : null,
        blockDurationUnit: blockWhenUserReplies ? blockDurationUnit : null,
      });
      setAgents(agents.map((a) => (a.id === response.agent.id ? response.agent : a)));
      setSelectedAgent(response.agent);
      alert(t('aiAgent.success.updateAgent'));
    } catch (error: unknown) {
      logError('AIAgent.updateAgent', error);
      const errorMsg = getErrorMessage(error, t('aiAgent.error.updateAgent'));
      alert(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Adicionar conteúdo à base vetorizada do agente
  const handleAddKnowledge = async () => {
    if (!selectedAgent || !knowledgeContent.trim()) return;
    try {
      setIsAddingKnowledge(true);
      const res = await aiAgentAPI.addKnowledge(selectedAgent.id, knowledgeContent.trim());
      setKnowledgeContent('');
      setKnowledgeCount((c) => (c ?? 0) + res.count);
      alert(t('aiAgent.knowledge.addSuccess', { count: String(res.count) }));
    } catch (error: unknown) {
      logError('AIAgent.addKnowledge', error);
      alert(getErrorMessage(error, t('aiAgent.knowledge.addError')));
    } finally {
      setIsAddingKnowledge(false);
    }
  };

  const handleAddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!selectedAgent || !file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (mediaCaption.trim()) formData.append('caption', mediaCaption.trim());
    formData.append('maxUsesPerContact', String(mediaMaxUses));
    try {
      setUploadingMedia(true);
      const res = await aiAgentAPI.addMedia(selectedAgent.id, formData);
      setAgentMedia((prev) => [...prev, res.media]);
      setMediaCaption('');
      setMediaMaxUses(1);
      if (mediaFileInputRef.current) mediaFileInputRef.current.value = '';
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('aiAgent.media.uploadError')));
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    if (!selectedAgent) return;
    try {
      await aiAgentAPI.deleteMedia(selectedAgent.id, mediaId);
      setAgentMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('aiAgent.media.deleteError')));
    }
  };

  const handleAddLocation = async () => {
    if (!selectedAgent) return;
    const lat = parseFloat(locationForm.latitude);
    const lng = parseFloat(locationForm.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert(t('aiAgent.location.latLngRequired'));
      return;
    }
    try {
      setAddingLocation(true);
      const res = await aiAgentAPI.addLocation(selectedAgent.id, {
        name: locationForm.name.trim() || undefined,
        address: locationForm.address.trim() || undefined,
        latitude: lat,
        longitude: lng,
        maxUsesPerContact: locationForm.maxUsesPerContact,
      });
      setAgentLocations((prev) => [...prev, res.location]);
      setLocationForm({ name: '', address: '', latitude: '', longitude: '', maxUsesPerContact: 1 });
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('aiAgent.location.addError')));
    } finally {
      setAddingLocation(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      alert(t('aiAgent.location.geolocationNotSupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationForm((prev) => ({
          ...prev,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
      },
      () => alert(t('aiAgent.location.geolocationError'))
    );
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!selectedAgent) return;
    try {
      await aiAgentAPI.deleteLocation(selectedAgent.id, locationId);
      setAgentLocations((prev) => prev.filter((l) => l.id !== locationId));
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('aiAgent.location.deleteError')));
    }
  };

  // Deletar agente
  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;

    if (!window.confirm(t('aiAgent.confirm.delete'))) {
      return;
    }

    try {
      await aiAgentAPI.delete(selectedAgent.id);
      setAgents(agents.filter((a) => a.id !== selectedAgent.id));
      setSelectedAgent(null);
      alert(t('aiAgent.success.deleteAgent'));
    } catch (error: unknown) {
      logError('AIAgent.deleteAgent', error);
      const errorMsg = getErrorMessage(error, t('aiAgent.error.deleteAgent'));
      alert(errorMsg);
    }
  };

  // Exportar leads
  const handleExportLeads = (format: 'csv' | 'json') => {
    if (leads.length === 0) {
      alert(t('aiAgent.export.noLeads'));
      return;
    }

    if (format === 'csv') {
      const headers = [t('aiAgent.phone'), t('aiAgent.name'), t('aiAgent.interest'), t('aiAgent.interest'), t('aiAgent.lastInteraction'), t('aiAgent.messages')];
      const rows = leads.map((lead) => [
        lead.phone,
        lead.name || '',
        lead.interest || '',
        lead.detectedInterest ? t('aiAgent.yes') : t('aiAgent.no'),
        lead.lastInteraction || '',
        lead.history.length.toString(),
      ]);

      const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      const jsonContent = JSON.stringify(leads, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `leads_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    }
  };

  // Visualizar leads
  const handleViewLeads = async () => {
    await loadLeads(selectedAgent?.instanceId ?? undefined);
    setShowLeadsModal(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">{t('aiAgent.loading')}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('aiAgent.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
            {t('aiAgent.subtitle')}
            <HelpIcon helpKey="aiAgent" className="ml-1" />
          </p>
        </div>

        {/* Divisor e Botão de Ação */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {selectedAgent && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={handleViewLeads}>
                  {t('aiAgent.viewLeads')} ({leads.length})
                </Button>
                <Button variant="outline" onClick={handleDeleteAgent}>
                  {t('aiAgent.delete')}
                </Button>
              </div>
            )}
            <div className={`flex justify-end ${selectedAgent ? 'w-full sm:w-auto' : 'w-full'}`}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  setSelectedAgent(null);
                  setAgentName('');
                  setAgentInstanceId('');
                  setAgentPrompt('');
                  setAgentWaitTime(13);
                  setAgentIsActive(true);
                  setAgentTranscribeAudio(true);
                  setAgentType('manual');
                  setAssistedConfig({});
                  setKnowledgeContent('');
                  setKnowledgeCount(null);
                }}
                disabled={atAIAgentLimit}
                title={atAIAgentLimit ? `Limite de Agentes de IA do plano atingido (${maxAIAgents} agente(s)). Plano Advance: 1 agente. Plano PRO: até 4 agentes. Faça upgrade para adicionar mais.` : undefined}
              >
                {t('aiAgent.newAgent')}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Agentes */}
          <div className="lg:col-span-1">
            <Card padding="md">
              <h2 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">
                {t('aiAgent.agents')}
              </h2>
              <div className="space-y-2">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    onClick={() => handleSelectAgent(agent)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedAgent?.id === agent.id
                        ? 'border-clerky-backendButton bg-clerky-backendButton/10'
                        : 'border-gray-200 dark:border-gray-700 hover:border-clerky-backendButton/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-clerky-backendText dark:text-gray-200">
                        {agent.name}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          agent.isActive
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-800 dark:bg-[#091D41] dark:text-gray-400'
                        }`}
                      >
                        {agent.isActive ? t('aiAgent.active') : t('aiAgent.inactive')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {agent.instanceId && instances.some((i) => i.id === agent.instanceId)
                        ? instances.find((i) => i.id === agent.instanceId)?.name ?? agent.instanceId
                        : t('aiAgent.noInstance')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {t('aiAgent.waitTime', { time: agent.waitTime.toString() })}
                    </p>
                  </div>
                ))}
                {agents.length === 0 && (
                  <p className="text-gray-500 text-center py-4">{t('aiAgent.noAgents')}</p>
                )}
              </div>
            </Card>
          </div>

          {/* Configuração do Agente */}
          <div className="lg:col-span-2">
            <Card padding="md">
              <h2 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">
                {selectedAgent ? t('aiAgent.editAgent') : t('aiAgent.createAgent')}
              </h2>

              <div className="space-y-4">
                <Input
                  label={t('aiAgent.agentName')}
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder={t('aiAgent.agentNamePlaceholder')}
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('aiAgent.whatsappInstance')} *
                  </label>
                  <select
                    value={agentInstanceId}
                    onChange={(e) => setAgentInstanceId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                    disabled={false}
                  >
                    <option value="">{t('aiAgent.selectInstance')}</option>
                    {instances.map((instance) => (
                      <option key={instance.id} value={instance.id}>
                        {instance.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('aiAgent.waitTimeLabel')} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="999"
                    value={agentWaitTime}
                    onChange={(e) => setAgentWaitTime(parseInt(e.target.value) || 13)}
                    placeholder="13"
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-center"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('aiAgent.waitTimeHelper')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('aiAgent.agentModel')} *
                  </label>
                  <select
                    value={agentType}
                    onChange={(e) => {
                      setAgentType(e.target.value as 'manual' | 'assisted');
                      if (e.target.value === 'manual') {
                        setAssistedConfig({});
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                  >
                    <option value="manual">{t('aiAgent.modelManual')}</option>
                    <option value="assisted">{t('aiAgent.modelAssisted')}</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('aiAgent.modelHelper')}
                  </p>
                </div>

                {agentType === 'manual' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('aiAgent.promptLabel')} * ({agentPrompt.length.toLocaleString()}/100,000 {t('aiAgent.characters')})
                    </label>
                    <textarea
                      value={agentPrompt}
                      onChange={(e) => setAgentPrompt(e.target.value)}
                      placeholder={t('aiAgent.promptPlaceholder')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 min-h-[300px] font-mono text-sm"
                      maxLength={100000}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {t('aiAgent.promptHelper')}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('aiAgent.assistedFormTitle')}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      {t('aiAgent.assistedFormHelper')}
                    </p>
                    <AssistedForm
                      key="assisted-form"
                      config={assistedConfig}
                      onChange={setAssistedConfig}
                      agentId={selectedAgent?.id}
                      onBeforeStep11={createAgentForAssistedStep11}
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={agentIsActive}
                    onChange={(e) => setAgentIsActive(e.target.checked)}
                    className="w-4 h-4 text-clerky-backendButton border-gray-300 rounded focus:ring-clerky-backendButton"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                    {t('aiAgent.isActive')}
                  </label>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      id="blockWhenUserReplies"
                      checked={blockWhenUserReplies}
                      onChange={(e) => setBlockWhenUserReplies(e.target.checked)}
                      className="w-4 h-4 text-clerky-backendButton border-gray-300 rounded focus:ring-clerky-backendButton"
                    />
                    <label htmlFor="blockWhenUserReplies" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('aiAgent.blockWhenUserReplies')}
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 ml-6">
                    {t('aiAgent.blockWhenUserRepliesHelper')}
                  </p>
                  {blockWhenUserReplies && (
                    <div className="ml-6 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="9999"
                        value={blockDurationUnit === 'permanent' ? '' : blockDuration}
                        onChange={(e) => setBlockDuration(parseInt(e.target.value, 10) || 30)}
                        disabled={blockDurationUnit === 'permanent'}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 text-center"
                      />
                      <select
                        value={blockDurationUnit}
                        onChange={(e) => setBlockDurationUnit(e.target.value as BlockDurationUnit)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                      >
                        <option value="minutes">{t('aiAgent.blockUnit.minutes')}</option>
                        <option value="hours">{t('aiAgent.blockUnit.hours')}</option>
                        <option value="days">{t('aiAgent.blockUnit.days')}</option>
                        <option value="permanent">{t('aiAgent.blockUnit.permanent')}</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="transcribeAudio"
                    checked={agentTranscribeAudio}
                    onChange={(e) => setAgentTranscribeAudio(e.target.checked)}
                    className="w-4 h-4 text-clerky-backendButton border-gray-300 rounded focus:ring-clerky-backendButton"
                  />
                  <label htmlFor="transcribeAudio" className="text-sm text-gray-700 dark:text-gray-300">
                    {t('aiAgent.transcribeAudio')}
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                  {t('aiAgent.transcribeAudioHelper')}
                </p>

                <div className="flex gap-2">
                  <Button
                    onClick={selectedAgent ? handleUpdateAgent : handleCreateAgent}
                    disabled={isSaving}
                  >
                    {isSaving ? t('aiAgent.saving') : selectedAgent ? t('aiAgent.update') : t('aiAgent.create')}
                  </Button>
                </div>

                {/* Base de conhecimento vetorizada (visível quando há agente selecionado ou recém-criado) */}
                {selectedAgent && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                    <h3 className="text-base font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                      {t('aiAgent.knowledge.title')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {t('aiAgent.knowledge.helper')}
                    </p>
                    <details className="mb-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                      <summary className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                        {t('aiAgent.knowledge.exampleTitle')}
                      </summary>
                      <pre className="p-3 text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans border-t border-gray-200 dark:border-gray-600">
                        {t('aiAgent.knowledge.exampleBody')}
                      </pre>
                    </details>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                      {t('aiAgent.knowledge.requirements')}
                    </p>
                    {knowledgeCount !== null && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                        {t('aiAgent.knowledge.count', { count: String(knowledgeCount) })}
                      </p>
                    )}
                    <textarea
                      value={knowledgeContent}
                      onChange={(e) => setKnowledgeContent(e.target.value)}
                      placeholder={t('aiAgent.knowledge.placeholder')}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 min-h-[120px] text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={handleAddKnowledge}
                      disabled={isAddingKnowledge || !knowledgeContent.trim()}
                      className="mt-2"
                    >
                      {isAddingKnowledge ? t('aiAgent.knowledge.adding') : t('aiAgent.knowledge.addButton')}
                    </Button>
                  </div>
                )}

                {/* Mídias do agente (imagem, vídeo, arquivo, áudio) — no modo assistido fica no passo 11 */}
                {selectedAgent && agentType !== 'assisted' && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                    <h3 className="text-base font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                      {t('aiAgent.media.title')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {t('aiAgent.media.helper')}
                    </p>
                    <div className="flex flex-wrap items-end gap-2 mb-3">
                      <input
                        ref={mediaFileInputRef}
                        type="file"
                        accept="image/*,video/*,.pdf,.doc,.docx,.mp3,audio/mpeg,audio/mp3"
                        onChange={handleAddMedia}
                        disabled={uploadingMedia}
                        className="text-sm text-gray-600 dark:text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-clerky-backendButton file:text-white"
                      />
                      <input
                        type="text"
                        placeholder={t('aiAgent.media.captionPlaceholder')}
                        value={mediaCaption}
                        onChange={(e) => setMediaCaption(e.target.value)}
                        className="flex-1 min-w-[120px] px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f2744] text-sm"
                      />
                      <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        {t('aiAgent.media.maxUses')}
                        <input
                          type="number"
                          min={1}
                          value={mediaMaxUses}
                          onChange={(e) => setMediaMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-14 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0f2744] text-center"
                        />
                      </label>
                    </div>
                    {agentMedia.length > 0 && (
                      <ul className="space-y-2">
                        {agentMedia.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <span className="text-sm font-mono font-semibold text-clerky-backendButton">{m.id}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{m.mediaType}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[120px]" title={m.caption || ''}>{m.caption || '-'}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{m.maxUsesPerContact}x</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteMedia(m.id)}>
                              {t('aiAgent.media.delete')}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Localizações do agente */}
                {selectedAgent && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mt-4">
                    <h3 className="text-base font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                      {t('aiAgent.location.title')}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {t('aiAgent.location.helper')}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                      <Input
                        label={t('aiAgent.location.name')}
                        value={locationForm.name}
                        onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder={t('aiAgent.location.namePlaceholder')}
                      />
                      <Input
                        label={t('aiAgent.location.address')}
                        value={locationForm.address}
                        onChange={(e) => setLocationForm((p) => ({ ...p, address: e.target.value }))}
                        placeholder={t('aiAgent.location.addressPlaceholder')}
                      />
                      <Input
                        label={t('aiAgent.location.latitude')}
                        value={locationForm.latitude}
                        onChange={(e) => setLocationForm((p) => ({ ...p, latitude: e.target.value }))}
                        placeholder="-16.505"
                      />
                      <Input
                        label={t('aiAgent.location.longitude')}
                        value={locationForm.longitude}
                        onChange={(e) => setLocationForm((p) => ({ ...p, longitude: e.target.value }))}
                        placeholder="-151.742"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <Button type="button" variant="outline" size="sm" onClick={handleUseMyLocation}>
                        {t('aiAgent.location.useMyLocation')}
                      </Button>
                      <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        {t('aiAgent.media.maxUses')}
                        <input
                          type="number"
                          min={1}
                          value={locationForm.maxUsesPerContact}
                          onChange={(e) => setLocationForm((p) => ({ ...p, maxUsesPerContact: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
                          className="w-14 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0f2744] text-center"
                        />
                      </label>
                      <Button type="button" onClick={handleAddLocation} disabled={addingLocation || !locationForm.latitude || !locationForm.longitude}>
                        {addingLocation ? t('aiAgent.location.adding') : t('aiAgent.location.add')}
                      </Button>
                    </div>
                    {agentLocations.length > 0 && (
                      <ul className="space-y-2">
                        {agentLocations.map((loc) => (
                          <li key={loc.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <span className="text-sm font-mono font-semibold text-clerky-backendButton">{loc.id}</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 truncate max-w-[180px]">{loc.name || loc.address || `${loc.latitude}, ${loc.longitude}`}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{loc.maxUsesPerContact}x</span>
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleDeleteLocation(loc.id)}>
                              {t('aiAgent.location.delete')}
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Modal de Leads */}
        <Modal
          isOpen={showLeadsModal}
          onClose={() => setShowLeadsModal(false)}
          title={t('aiAgent.leadsTitle')}
        >
          <div className="space-y-4 text-gray-900 dark:text-gray-100">
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => handleExportLeads('csv')}>
                {t('aiAgent.exportCSV')}
              </Button>
              <Button variant="outline" onClick={() => handleExportLeads('json')}>
                {t('aiAgent.exportJSON')}
              </Button>
            </div>

            <div className="max-h-96 overflow-y-auto text-gray-900 dark:text-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-[#091D41] sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">{t('aiAgent.phone')}</th>
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">{t('aiAgent.name')}</th>
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">{t('aiAgent.interest')}</th>
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">{t('aiAgent.lastInteraction')}</th>
                    <th className="px-4 py-2 text-left text-gray-900 dark:text-gray-100">{t('aiAgent.messages')}</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => (
                    <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{lead.phone}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{lead.name || '-'}</td>
                      <td className="px-4 py-2">
                        {lead.detectedInterest ? (
                          <span className="text-green-600 dark:text-green-400">{t('aiAgent.yes')}</span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">{t('aiAgent.no')}</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-200">
                        {lead.lastInteraction
                          ? new Date(lead.lastInteraction).toLocaleString()
                          : '-'}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-200">{lead.history.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">{t('aiAgent.noLeads')}</p>
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
};

export default AIAgentPage;
