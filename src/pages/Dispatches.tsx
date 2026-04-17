import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button, HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket, DispatchUpdateData } from '../hooks/useSocket';
import { dispatchAPI, instanceAPI, Template, Dispatch, CreateTemplateData, CreateDispatchData, Instance } from '../services/api';
import TemplateBuilder from '../components/Dispatches/TemplateBuilder';
import DispatchCreator from '../components/Dispatches/DispatchCreator';
import { formatScheduleDateTime } from '../utils/dateFormatters';

const Dispatches: React.FC = () => {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'templates' | 'dispatches'>('templates');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingDispatches, setIsLoadingDispatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingDispatch, setEditingDispatch] = useState<Dispatch | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);

  // Carregar templates
  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      setError(null);
      const response = await dispatchAPI.getTemplates();
      setTemplates(response.templates);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar templates');
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Carregar disparos
  const loadDispatches = async () => {
    try {
      setIsLoadingDispatches(true);
      setError(null);
      const response = await dispatchAPI.getDispatches();
      // Garantir que todos os dispatches tenham stats e settings válidos
      const validatedDispatches = response.dispatches.map((dispatch) => ({
        ...dispatch,
        stats: dispatch.stats || {
          sent: 0,
          failed: 0,
          invalid: 0,
          total: 0,
        },
        settings: dispatch.settings || {
          speed: 'normal' as const,
        },
      }));
      setDispatches(validatedDispatches);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar disparos');
    } finally {
      setIsLoadingDispatches(false);
    }
  };

  // Carregar instâncias
  const loadInstances = async () => {
    try {
      const response = await instanceAPI.getAll();
      setInstances(response.instances);
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    } else {
      loadTemplates(); // Carregar templates também para exibir no card
      loadDispatches();
      loadInstances();
    }
  }, [activeTab]);

  // WebSocket para atualizações em tempo real
  useSocket(
    token,
    undefined, // onStatusUpdate
    undefined, // onNewMessage
    undefined, // onContactUpdate
    (data: DispatchUpdateData) => {
      // Atualizar disparo na lista quando receber atualização via WebSocket
      setDispatches((prevDispatches) => {
        const index = prevDispatches.findIndex((d) => d.id === data.dispatch.id);
        if (index >= 0) {
          // Atualizar disparo existente, preservando stats e settings existentes se não vierem na atualização
          const updated = [...prevDispatches];
          updated[index] = {
            ...updated[index],
            ...data.dispatch,
            // Garantir que stats sempre exista
            stats: data.dispatch.stats || updated[index].stats || {
              sent: 0,
              failed: 0,
              invalid: 0,
              total: 0,
            },
            // Garantir que settings sempre exista
            settings: data.dispatch.settings || updated[index].settings || {
              speed: 'normal',
            },
          };
          return updated;
        } else {
          // Se não encontrou, pode ser um novo disparo, recarregar lista
          if (activeTab === 'dispatches') {
            loadDispatches();
          }
          return prevDispatches;
        }
      });
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined
  );

  const handleCreateTemplate = async (data: CreateTemplateData) => {
    try {
      if (editingTemplate) {
        await dispatchAPI.updateTemplate(editingTemplate.id, data);
      } else {
        await dispatchAPI.createTemplate(data);
      }
      await loadTemplates();
      setShowTemplateModal(false);
      setEditingTemplate(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar template');
    }
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm(t('dispatches.deleteTemplateConfirm'))) {
      return;
    }

    try {
      await dispatchAPI.deleteTemplate(id);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Erro ao deletar template');
    }
  };

  const handleCreateDispatch = async (data: CreateDispatchData) => {
    try {
      if (editingDispatch) {
        await dispatchAPI.updateDispatch(editingDispatch.id, data);
      } else {
        await dispatchAPI.createDispatch(data);
      }
      await loadDispatches();
      setShowDispatchModal(false);
      setEditingDispatch(null);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar disparo');
    }
  };

  const handleEditDispatch = async (dispatch: Dispatch) => {
    // Buscar dados completos do disparo
    try {
      const response = await dispatchAPI.getDispatch(dispatch.id);
      setEditingDispatch(response.dispatch);
      setShowDispatchModal(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar disparo');
    }
  };

  const handlePauseDispatch = async (id: string) => {
    try {
      await dispatchAPI.pauseDispatch(id);
      await loadDispatches();
    } catch (err: any) {
      setError(err.message || 'Erro ao pausar disparo');
    }
  };

  const handleStartDispatch = async (id: string) => {
    try {
      await dispatchAPI.startDispatch(id);
      await loadDispatches();
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar disparo');
    }
  };

  const handleResumeDispatch = async (id: string) => {
    try {
      await dispatchAPI.resumeDispatch(id);
      await loadDispatches();
    } catch (err: any) {
      setError(err.message || 'Erro ao retomar disparo');
    }
  };

  const handleDeleteDispatch = async (id: string) => {
    if (!window.confirm(t('dispatches.deleteConfirm'))) {
      return;
    }

    try {
      await dispatchAPI.deleteDispatch(id);
      await loadDispatches();
    } catch (err: any) {
      setError(err.message || 'Erro ao deletar disparo');
    }
  };

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('dispatches.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
            {t('dispatches.subtitle')}
            <HelpIcon helpKey="dispatches" className="ml-1" />
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'templates'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t('dispatches.templates')}
            </button>
            <button
              onClick={() => setActiveTab('dispatches')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'dispatches'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t('dispatches.dispatches')}
            </button>
          </div>

        {/* Conteúdo das Tabs */}
        {activeTab === 'templates' ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-clerky-backendText dark:text-gray-200">
                {t('dispatches.myTemplates')}
              </h2>
              <Button variant="primary" onClick={() => setShowTemplateModal(true)}>
                {t('dispatches.createTemplate')}
              </Button>
            </div>

            {isLoadingTemplates ? (
              <div className="text-center py-8 text-gray-500">{t('dispatches.loadingTemplates')}</div>
            ) : error ? (
              <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              </Card>
            ) : templates.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {t('dispatches.noTemplates')}
                </p>
                <Button variant="primary" onClick={() => setShowTemplateModal(true)}>
                  {t('dispatches.createFirstTemplate')}
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <Card key={template.id} className="p-4">
                    <h3 className="font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                      {template.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {t('dispatches.type')}: {template.type}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                      >
                        {t('dispatches.edit')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        {t('dispatches.delete')}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-clerky-backendText dark:text-gray-200">
                {t('dispatches.myDispatches')}
              </h2>
              <Button variant="primary" onClick={() => setShowDispatchModal(true)}>
                {t('dispatches.createDispatch')}
              </Button>
            </div>

            {isLoadingDispatches ? (
              <div className="text-center py-8 text-gray-500">{t('dispatches.loadingDispatches')}</div>
            ) : error ? (
              <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              </Card>
            ) : dispatches.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {t('dispatches.noDispatches')}
                </p>
                <Button variant="primary" onClick={() => setShowDispatchModal(true)}>
                  {t('dispatches.createFirstDispatch')}
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {dispatches.map((dispatch) => {
                  const instance = instances.find((i) => i.id === dispatch.instanceId);
                  const template = templates.find((t) => t.id === dispatch.templateId);
                  
                  // Formatar data e hora do agendamento
                  const formatSchedule = () => {
                    if (!dispatch.schedule) return null;
                    if (dispatch.schedule.startDate) {
                      // Formatar data diretamente sem usar new Date() para evitar problemas de timezone
                      // startDate vem no formato "YYYY-MM-DD"
                      const [year, month, day] = dispatch.schedule.startDate.split('-');
                      const date = `${day}/${month}/${year}`;
                      const time = dispatch.schedule.startTime || '';
                      return `${date} às ${time}`;
                    }
                    return dispatch.schedule.startTime || '';
                  };

                  // Formatar velocidade
                  const getSpeedLabel = () => {
                    const speed = dispatch.settings?.speed || 'normal';
                    const speedKey = `dispatchCreator.speed${speed.charAt(0).toUpperCase() + speed.slice(1)}`;
                    const fullLabel = t(speedKey);
                    // Extrair apenas o nome da velocidade (antes do parêntese)
                    return fullLabel.split('(')[0].trim();
                  };

                  return (
                    <Card key={dispatch.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                            {dispatch.name}
                          </h3>
                          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex gap-4 flex-wrap">
                              <span className="font-medium">{t('dispatches.status')}:</span>
                              <span className="capitalize">{dispatch.status}</span>
                            </div>
                            <div className="flex gap-4 flex-wrap">
                              <span className="font-medium">{t('dispatches.sent')}:</span>
                              <span>{dispatch.stats?.sent ?? 0}/{dispatch.stats?.total ?? 0}</span>
                            </div>
                            {instance && (
                              <div className="flex gap-4 flex-wrap">
                                <span className="font-medium">{t('dispatches.instance')}:</span>
                                <span>{instance.name}</span>
                              </div>
                            )}
                            {template && (
                              <div className="flex gap-4 flex-wrap">
                                <span className="font-medium">{t('dispatches.template')}:</span>
                                <span>{template.name}</span>
                              </div>
                            )}
                            <div className="flex gap-4 flex-wrap">
                              <span className="font-medium">{t('dispatches.speed')}:</span>
                              <span>{getSpeedLabel()}</span>
                            </div>
                            {dispatch.schedule && (
                              <div className="flex gap-4 flex-wrap">
                                <span className="font-medium">{t('dispatches.scheduledFor')}:</span>
                                <span>{formatSchedule()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {dispatch.status === 'pending' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleStartDispatch(dispatch.id)}
                            >
                              {t('dispatches.start')}
                            </Button>
                          )}
                          {dispatch.status === 'running' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePauseDispatch(dispatch.id)}
                            >
                              {t('dispatches.pause')}
                            </Button>
                          )}
                          {dispatch.status === 'paused' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleResumeDispatch(dispatch.id)}
                            >
                              {t('dispatches.resume')}
                            </Button>
                          )}
                          {(dispatch.status === 'pending' || dispatch.status === 'paused') && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleEditDispatch(dispatch)}
                            >
                              {t('dispatches.edit')}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDispatch(dispatch.id)}
                          >
                            {t('dispatches.delete')}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal de Criação/Edição de Template */}
        <TemplateBuilder
          isOpen={showTemplateModal}
          onClose={() => {
            setShowTemplateModal(false);
            setEditingTemplate(null);
          }}
          onSave={handleCreateTemplate}
          initialData={editingTemplate ? { name: editingTemplate.name, type: editingTemplate.type, content: editingTemplate.content } : undefined}
        />

        {/* Modal de Criação/Edição de Disparo */}
        <DispatchCreator
          isOpen={showDispatchModal}
          onClose={() => {
            setShowDispatchModal(false);
            setEditingDispatch(null);
          }}
          onSave={handleCreateDispatch}
          initialData={editingDispatch ? {
            instanceId: editingDispatch.instanceId || '',
            templateId: editingDispatch.templateId || null,
            name: editingDispatch.name,
            settings: editingDispatch.settings,
            schedule: editingDispatch.schedule,
            defaultName: editingDispatch.defaultName || null,
          } : undefined}
        />
      </div>
    </AppLayout>
  );
};

export default Dispatches;
