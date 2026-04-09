import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button, Modal, Input, HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import {
  workflowAPI,
  instanceAPI,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowContact,
  Instance,
  MINDLERKY_API_URL,
} from '../services/api';
import { FlowEditor } from '../components/MindClerky/FlowEditor';
import { NodePalette } from '../components/MindClerky/NodePalette';
import { ContactList } from '../components/MindClerky/ContactList';
import { WebhookTriggerSettings } from '../components/MindClerky/WebhookTriggerSettings';
import { Node } from '@xyflow/react';
import { useSocket } from '../hooks/useSocket';

// Variáveis disponíveis para personalização
const AVAILABLE_VARIABLES = [
  { variable: '$firstName', label: 'Primeiro Nome', description: 'Primeiro nome do contato' },
  { variable: '$lastName', label: 'Último Nome', description: 'Último nome do contato' },
  { variable: '$fullName', label: 'Nome Completo', description: 'Nome completo do contato' },
  { variable: '$formattedPhone', label: 'Número Formatado', description: 'Número formatado (ex: (62) 99844-8536)' },
  { variable: '$originalPhone', label: 'Número Original', description: 'Número original/normalizado' },
];

const MindClerky: React.FC = () => {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const maxManyFlowWorkflows = user?.maxManyFlowWorkflows ?? 0;
  const workflowsWithEdgesCount = workflows.filter((w) => w.edges && w.edges.length > 0).length;
  const atManyFlowLimit = maxManyFlowWorkflows > 0 && workflowsWithEdgesCount >= maxManyFlowWorkflows;
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNodeSettingsModal, setShowNodeSettingsModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [workflowContacts, setWorkflowContacts] = useState<WorkflowContact[]>([]);
  const [isClearingContacts, setIsClearingContacts] = useState(false);
  const [showContactsModal, setShowContactsModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estados do formulário de criação
  const [workflowName, setWorkflowName] = useState('');
  const [workflowNodes, setWorkflowNodes] = useState<WorkflowNode[]>([]);
  const [workflowEdges, setWorkflowEdges] = useState<WorkflowEdge[]>([]);

  // Carregar workflows
  const loadWorkflows = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await workflowAPI.getAll();
      setWorkflows(response.workflows);
    } catch (error: any) {
      console.error('Erro ao carregar workflows:', error);
      setError(error.message || 'Erro ao carregar workflows');
    } finally {
      setIsLoading(false);
    }
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

  // Carregar contatos do workflow
  const loadWorkflowContacts = useCallback(async (workflowId: string) => {
    try {
      const response = await workflowAPI.getContacts(workflowId);
      setWorkflowContacts(response.contacts);
    } catch (error: any) {
      console.error('Erro ao carregar contatos do workflow:', error);
    }
  }, []);

  // Selecionar workflow (definido antes de ser usado)
  const handleSelectWorkflow = useCallback((workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setWorkflowNodes(workflow.nodes);
    setWorkflowEdges(workflow.edges);
  }, []);

  useEffect(() => {
    loadWorkflows();
    loadInstances();
  }, [loadWorkflows, loadInstances]);

  // Restaurar workflow selecionado do localStorage após workflows carregarem
  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflow) {
      const savedWorkflowId = localStorage.getItem('mindClerky_selectedWorkflowId');
      if (savedWorkflowId) {
        const savedWorkflow = workflows.find((w) => w.id === savedWorkflowId);
        if (savedWorkflow) {
          handleSelectWorkflow(savedWorkflow);
        }
      }
    }
  }, [workflows, selectedWorkflow, handleSelectWorkflow]);

  useEffect(() => {
    if (selectedWorkflow) {
      loadWorkflowContacts(selectedWorkflow.id);
      // Salvar workflow selecionado no localStorage
      localStorage.setItem('mindClerky_selectedWorkflowId', selectedWorkflow.id);
    } else {
      // Remover do localStorage quando não há workflow selecionado
      localStorage.removeItem('mindClerky_selectedWorkflowId');
    }
  }, [selectedWorkflow, loadWorkflowContacts]);

  // Socket para atualização em tempo real
  useSocket(
    token,
    undefined, // onStatusUpdate
    undefined, // onNewMessage
    () => {
      // onContactUpdate - recarregar contatos quando houver atualização
      if (selectedWorkflow) {
        loadWorkflowContacts(selectedWorkflow.id);
      }
    },
    undefined, // onDispatchUpdate
    () => {
      // onWorkflowContactUpdate - recarregar contatos quando um contato entra em um workflow
      if (selectedWorkflow) {
        loadWorkflowContacts(selectedWorkflow.id);
      }
    }
  );

  // Criar novo workflow
  const handleCreateWorkflow = async () => {
    if (!workflowName.trim()) {
      alert('Preencha o nome do workflow');
      return;
    }

    try {
      const response = await workflowAPI.create({
        name: workflowName.trim(),
        // instanceId não é necessário - será obtido do nó de gatilho WhatsApp
        nodes: workflowNodes,
        edges: workflowEdges,
        isActive: true,
      });
      setWorkflows([response.workflow, ...workflows]);
      setShowCreateModal(false);
      setWorkflowName('');
      setWorkflowNodes([]);
      setWorkflowEdges([]);
      setSelectedWorkflow(response.workflow);
      setError(null);
    } catch (error: any) {
      console.error('Erro ao criar workflow:', error);
      setError(error.message || 'Erro ao criar workflow');
    }
  };

  // Salvar workflow
  const handleSaveWorkflow = async () => {
    if (!selectedWorkflow) return;

    try {
      setIsSaving(true);
      const response = await workflowAPI.update(selectedWorkflow.id, {
        nodes: workflowNodes,
        edges: workflowEdges,
      });
      setWorkflows(workflows.map((w) => (w.id === response.workflow.id ? response.workflow : w)));
      setSelectedWorkflow(response.workflow);
      
      // Animação de sucesso
      setTimeout(() => {
        setIsSaving(false);
      }, 1000);
      setError(null);
    } catch (error: any) {
      console.error('Erro ao salvar workflow:', error);
      setIsSaving(false);
      setError(error.message || 'Erro ao salvar workflow');
    }
  };

  // Deletar workflow
  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!window.confirm(t('mindFlow.deleteConfirm'))) return;

    try {
      await workflowAPI.delete(workflowId);
      setWorkflows(workflows.filter((w) => w.id !== workflowId));
      if (selectedWorkflow?.id === workflowId) {
        setSelectedWorkflow(null);
      }
      setError(null);
    } catch (error: any) {
      console.error('Erro ao deletar workflow:', error);
      setError(error.message || 'Erro ao deletar workflow');
    }
  };

  // Adicionar nó
  const handleAddNode = (
    type: 'whatsappTrigger' | 'typebotTrigger' | 'webhookTrigger' | 'condition' | 'delay' | 'end' | 'response' | 'spreadsheet' | 'openai'
  ) => {
    const newNode: WorkflowNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data:
        type === 'condition'
          ? { conditions: [] }
          : type === 'delay'
          ? { delay: 0, delayUnit: 'seconds' }
          : type === 'response'
          ? { responseType: 'text', content: '', responseDelay: 1200 } // Delay padrão: 1.2s (1200ms)
          : type === 'typebotTrigger'
          ? { webhookUrl: '', workflowId: selectedWorkflow?.id || '' }
          : type === 'spreadsheet'
          ? { isAuthenticated: false, sheetName: 'Sheet1' }
          : type === 'openai'
          ? { apiKey: '', model: 'gpt-3.5-turbo', prompt: '', responseDelay: 1200 } // Delay padrão: 1.2s (1200ms)
          : type === 'webhookTrigger'
          ? {
              webhookUrl: '',
              workflowId: selectedWorkflow?.id || '',
              selectedFields: [],
              listening: false,
            }
          : {},
    };
    setWorkflowNodes([...workflowNodes, newNode]);
  };

  // Limpar contatos
  const handleClearContacts = async () => {
    if (!selectedWorkflow) return;
    if (!window.confirm(t('mindFlow.contacts.clearConfirm'))) return;

    try {
      setIsClearingContacts(true);
      await workflowAPI.clearContacts(selectedWorkflow.id);
      setWorkflowContacts([]);
      setError(null);
    } catch (error: any) {
      console.error('Erro ao limpar contatos:', error);
      setError(error.message || 'Erro ao limpar contatos');
    } finally {
      setIsClearingContacts(false);
    }
  };

  // Configurar nó selecionado
  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    setShowNodeSettingsModal(true);
  };

  // Atualizar dados do nó
  const handleUpdateNodeData = (nodeId: string, data: any) => {
    setWorkflowNodes(
      workflowNodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node))
    );
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, ...data } });
    }
  };

  // Deletar nó
  const handleDeleteNode = (nodeId: string) => {
    if (!window.confirm('Tem certeza que deseja deletar este nó? Esta ação não pode ser desfeita.')) {
      return;
    }

    // Remover o nó
    setWorkflowNodes(workflowNodes.filter((node) => node.id !== nodeId));
    
    // Remover edges conectadas ao nó
    setWorkflowEdges(
      workflowEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );

    // Fechar modal se o nó deletado era o selecionado
    if (selectedNode && selectedNode.id === nodeId) {
      setShowNodeSettingsModal(false);
      setSelectedNode(null);
    }
  };

  // Se não há workflow selecionado, mostrar lista
  if (!selectedWorkflow) {
    return (
      <AppLayout>
        <div className="animate-fadeIn">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('mindFlow.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 inline-flex items-center gap-2">
              {t('mindFlow.subtitle')}
              <HelpIcon helpKey="mindFlow" className="ml-1" />
            </p>
          </div>

          {/* Divisor e Botão de Ação */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mb-6">
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setShowCreateModal(true)}
                disabled={atManyFlowLimit}
                title={atManyFlowLimit ? `Limite de fluxos ManyFlow do plano atingido (${maxManyFlowWorkflows} fluxo(s) com nós conectados). Plano Advance: até 2 fluxos. Plano PRO: até 4 fluxos. Faça upgrade para adicionar mais.` : undefined}
              >
                {t('mindFlow.createWorkflow')}
              </Button>
            </div>
          </div>

          {error && (
            <Card className="mb-6 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            </Card>
          )}

          {isLoading ? (
            <Card>
              <p className="text-center py-8 text-gray-500 dark:text-gray-400">
                {t('mindFlow.loading')}
              </p>
            </Card>
          ) : workflows.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {t('mindFlow.noWorkflows')}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
                  {t('mindFlow.noWorkflowsDescription')}
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  disabled={atManyFlowLimit}
                  title={atManyFlowLimit ? `Limite de fluxos ManyFlow do plano atingido (${maxManyFlowWorkflows} fluxo(s)). Faça upgrade para adicionar mais.` : undefined}
                >
                  {t('mindFlow.createNewWorkflow')}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  onClick={() => handleSelectWorkflow(workflow)}
                  className="cursor-pointer"
                >
                  <Card hover>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-clerky-backendText dark:text-gray-200">
                      {workflow.name}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWorkflow(workflow.id);
                      }}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {instances.find((i) => i.id === workflow.instanceId)?.name || workflow.instanceId}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>{workflow.nodes.length} nós</span>
                    <span>•</span>
                    <span>{workflow.edges.length} conexões</span>
                  </div>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* Modal de criação */}
          <Modal
            isOpen={showCreateModal}
            onClose={() => {
              setShowCreateModal(false);
              setWorkflowName('');
            }}
            title={t('mindFlow.createNewWorkflow')}
          >
            <div className="space-y-4">
              <Input
                label={t('mindFlow.workflowName')}
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder={t('mindFlow.workflowNamePlaceholder')}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t('mindFlow.instanceNote')}
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  {t('mindFlow.cancel')}
                </Button>
                <Button onClick={handleCreateWorkflow}>
                  {t('mindFlow.createWorkflow')}
                </Button>
              </div>
            </div>
          </Modal>
        </div>
      </AppLayout>
    );
  }

  // Editor de workflow
  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-140px)]">
        {/* Paleta de nós */}
        <NodePalette onAddNode={handleAddNode} />

        {/* Editor central */}
        <div className="flex-1 flex flex-col">
          {/* Header do editor */}
          <div className="bg-white dark:bg-[#091D41] border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => {
                  setSelectedWorkflow(null);
                  setWorkflowNodes([]);
                  setWorkflowEdges([]);
                  localStorage.removeItem('mindClerky_selectedWorkflowId');
                }}
              >
                ←
              </Button>
              <h2 className="font-semibold text-clerky-backendText dark:text-gray-200">
                {selectedWorkflow.name}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                onClick={() => setShowContactsModal(true)}
              >
                {t('mindFlow.contacts.title')} ({workflowContacts.length})
              </Button>
              <Button 
                onClick={handleSaveWorkflow}
                disabled={isSaving}
                className={`transition-all duration-300 ${isSaving ? 'bg-green-500 scale-95' : ''}`}
              >
                {isSaving ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('mindFlow.saving')}
                  </span>
                ) : (
                  t('mindFlow.save')
                )}
              </Button>
            </div>
          </div>

          {/* Mensagem de erro */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Canvas do editor */}
          <div className="flex-1 relative">
            <FlowEditor
              initialNodes={workflowNodes}
              initialEdges={workflowEdges}
              onNodesChange={setWorkflowNodes}
              onEdgesChange={setWorkflowEdges}
              onNodeClick={handleNodeClick}
              selectedNodeId={selectedNode?.id}
            />
          </div>
        </div>

      </div>

      {/* Modal de contatos */}
      <Modal
        isOpen={showContactsModal}
        onClose={() => setShowContactsModal(false)}
        title={t('mindFlow.contacts.title')}
        size="lg"
      >
        <ContactList
          contacts={workflowContacts}
          onClear={handleClearContacts}
          isClearing={isClearingContacts}
        />
      </Modal>

      {/* Modal de configuração de nó */}
      {selectedNode && (
        <Modal
          isOpen={showNodeSettingsModal}
          onClose={() => {
            setShowNodeSettingsModal(false);
            setSelectedNode(null);
          }}
          title={t('mindFlow.nodeSettings')}
        >
          <NodeSettingsPanel
            node={selectedNode}
            instances={instances}
            selectedWorkflow={selectedWorkflow}
            onUpdate={(data) => {
              handleUpdateNodeData(selectedNode.id, data);
            }}
            onShowVariablesModal={() => setShowVariablesModal(true)}
            onDelete={() => handleDeleteNode(selectedNode.id)}
          />
        </Modal>
      )}

      {/* Modal de ajuda sobre variáveis */}
      <Modal
        isOpen={showVariablesModal}
        onClose={() => setShowVariablesModal(false)}
        title={t('mindFlow.nodeSettings.variablesModalTitle')}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              {t('mindFlow.nodeSettings.variablesModalDescription')}
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2">
                {t('mindFlow.nodeSettings.variablesFromTypebot')}
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {t('mindFlow.nodeSettings.variablesFromTypebotDescription')}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {t('mindFlow.nodeSettings.availableVariables')}
              </h4>
              
              <div className="bg-gray-50 dark:bg-[#091D41] rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <code className="text-sm bg-white dark:bg-gray-700 px-2 py-1 rounded font-mono text-blue-600 dark:text-blue-400">
                    $Name
                  </code>
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                    {t('mindFlow.nodeSettings.variableNameDescription')}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <code className="text-sm bg-white dark:bg-gray-700 px-2 py-1 rounded font-mono text-blue-600 dark:text-blue-400">
                    $Telefone
                  </code>
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                    {t('mindFlow.nodeSettings.variableTelefoneDescription')}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <code className="text-sm bg-white dark:bg-gray-700 px-2 py-1 rounded font-mono text-blue-600 dark:text-blue-400">
                    $Idade
                  </code>
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                    {t('mindFlow.nodeSettings.variableIdadeDescription')}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <code className="text-sm bg-white dark:bg-gray-700 px-2 py-1 rounded font-mono text-blue-600 dark:text-blue-400">
                    $submittedAt
                  </code>
                  <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">
                    {t('mindFlow.nodeSettings.variableSubmittedAtDescription')}
                  </span>
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mt-4">
                <h4 className="font-semibold text-green-900 dark:text-green-200 mb-2">
                  {t('mindFlow.nodeSettings.phoneUsageTitle')}
                </h4>
                <p className="text-sm text-green-800 dark:text-green-300">
                  {t('mindFlow.nodeSettings.phoneUsageDescription')}
                </p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>{t('mindFlow.nodeSettings.note')}:</strong>{' '}
                  {t('mindFlow.nodeSettings.variablesNote')}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-[#091D41] rounded-lg p-4 mt-4">
                <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {t('mindFlow.nodeSettings.example')}
                </h5>
                <pre className="text-xs bg-white dark:bg-gray-700 p-3 rounded overflow-x-auto">
                  <code className="text-gray-800 dark:text-gray-200">
                    {t('mindFlow.nodeSettings.examplePrompt')}
                  </code>
                </pre>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={() => setShowVariablesModal(false)}>
              {t('common.close')}
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
};

// Componente de painel de configuração de nó
interface NodeSettingsPanelProps {
  node: Node;
  instances: Instance[];
  selectedWorkflow: Workflow | null;
  onUpdate: (data: any) => void;
  onShowVariablesModal: () => void;
  onDelete: () => void;
}

const NodeSettingsPanel: React.FC<NodeSettingsPanelProps> = ({ node, instances, selectedWorkflow, onUpdate, onShowVariablesModal, onDelete }) => {
  const { t } = useLanguage();
  
  // Hooks para planilha (devem estar no topo do componente)
  const [spreadsheets, setSpreadsheets] = React.useState<Array<{ id: string; name: string; url: string }>>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = React.useState(false);

  // Componente helper para botão de deletar
  const DeleteButton = () => (
    <div className="flex justify-end mb-2 -mt-2">
      <button
        onClick={onDelete}
        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
        title="Deletar nó"
        aria-label="Deletar nó"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4331/api';

  // Função para carregar planilhas
  const loadSpreadsheets = React.useCallback(async () => {
    try {
      setLoadingSpreadsheets(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/google/spreadsheets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar planilhas');
      }

      const data = await response.json();
      setSpreadsheets(data.spreadsheets || []);
    } catch (error: any) {
      console.error('Erro ao carregar planilhas:', error);
      alert(error.message || 'Erro ao carregar planilhas');
    } finally {
      setLoadingSpreadsheets(false);
    }
  }, [API_URL]);

  // Carregar planilhas quando necessário
  React.useEffect(() => {
    if (node.type === 'spreadsheet') {
      const spreadsheetData = node.data as {
        isAuthenticated?: boolean;
        useExisting?: boolean;
      };
      
      if (spreadsheetData.isAuthenticated && spreadsheetData.useExisting) {
        loadSpreadsheets();
      }
    }
  }, [node.type, node.data, loadSpreadsheets]);

  // Função para inserir variável em um campo
  const handleInsertVariable = (variable: string, field: 'content' | 'caption') => {
    const currentValue = (node.data as any)?.[field] || '';
    onUpdate({ [field]: currentValue + variable });
  };

  if (node.type === 'whatsappTrigger') {
    const triggerData = node.data as { instanceId?: string };
    return (
      <div className="space-y-4">
        <DeleteButton />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.instance')}
          </label>
          <select
            value={triggerData.instanceId || ''}
            onChange={(e) => {
              const selectedInstanceId = e.target.value;
              const selectedInstance = instances.find(inst => inst.id === selectedInstanceId);
              onUpdate({ 
                instanceId: selectedInstanceId || undefined,
                instanceName: selectedInstance?.name || undefined
              });
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            <option value="">{t('mindFlow.nodeSettings.selectInstance')}</option>
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  if (node.type === 'webhookTrigger') {
    return (
      <WebhookTriggerSettings
        node={node}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    );
  }

  if (node.type === 'typebotTrigger') {
    const typebotData = node.data as { webhookUrl?: string; workflowId?: string };
    const webhookUrl = typebotData.webhookUrl || `${MINDLERKY_API_URL}/workflows/webhook/typebot/${node.id}`;
    
    return (
      <div className="space-y-4">
        <DeleteButton />
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('mindFlow.nodeSettings.webhookUrl')}
            </label>
            <button
              type="button"
              onClick={onShowVariablesModal}
              className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 transition-colors flex items-center justify-center"
              title={t('mindFlow.nodeSettings.variablesHelp')}
            >
              ?
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                alert(t('mindFlow.nodeSettings.webhookUrlCopied'));
              }}
            >
              {t('mindFlow.nodeSettings.copy')}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('mindFlow.nodeSettings.webhookUrlDescription')}
          </p>
        </div>
      </div>
    );
  }

  if (node.type === 'condition') {
    const conditionData = node.data as { conditions?: Array<{ id: string; text: string; outputId: string }> };
    const conditions = conditionData.conditions || [];
    const maxConditions = 10;

    const addCondition = () => {
      if (conditions.length >= maxConditions) return;
      const newCondition = {
        id: `cond-${Date.now()}`,
        text: '',
        outputId: `output-${Date.now()}`,
      };
      onUpdate({ conditions: [...conditions, newCondition] });
    };

    const removeCondition = (id: string) => {
      onUpdate({ conditions: conditions.filter((c: any) => c.id !== id) });
    };

    const updateCondition = (id: string, text: string) => {
      onUpdate({
        conditions: conditions.map((c: any) => (c.id === id ? { ...c, text } : c)),
      });
    };

    return (
      <div className="space-y-4">
        <DeleteButton />
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('mindFlow.nodeSettings.conditions')}
          </label>
          {conditions.length < maxConditions && (
            <Button variant="outline" size="sm" onClick={addCondition}>
              {t('mindFlow.nodeSettings.addCondition')}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {conditions.map((condition: any) => (
            <div key={condition.id} className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  value={condition.text}
                  onChange={(e) => updateCondition(condition.id, e.target.value)}
                  placeholder={t('mindFlow.nodeSettings.conditionPlaceholder')}
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeCondition(condition.id)}>
                {t('mindFlow.nodeSettings.removeCondition')}
              </Button>
            </div>
          ))}
          {conditions.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              {t('mindFlow.nodeSettings.addCondition')}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (node.type === 'delay') {
    const delayData = node.data as { delay?: number; delayUnit?: 'seconds' | 'minutes' | 'hours' };
    return (
      <div className="space-y-4">
        <DeleteButton />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.delayValue')}
          </label>
          <Input
            type="number"
            min="0"
            value={delayData.delay || 0}
            onChange={(e) => onUpdate({ delay: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.delayUnit')}
          </label>
          <select
            value={delayData.delayUnit || 'seconds'}
            onChange={(e) => onUpdate({ delayUnit: e.target.value as 'seconds' | 'minutes' | 'hours' })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            <option value="seconds">{t('mindFlow.nodeSettings.delaySeconds')}</option>
            <option value="minutes">{t('mindFlow.nodeSettings.delayMinutes')}</option>
            <option value="hours">{t('mindFlow.nodeSettings.delayHours')}</option>
          </select>
        </div>
      </div>
    );
  }

  if (node.type === 'response') {
    const responseData = node.data as {
      responseType?: 'text' | 'image' | 'image_caption' | 'video' | 'video_caption' | 'audio' | 'file';
      content?: string;
      mediaUrl?: string;
      caption?: string;
      fileName?: string;
      responseInstanceId?: string;
      responseDelay?: number; // Delay em milissegundos (armazenado internamente)
    };
    const responseType = responseData.responseType || 'text';
    // Converter delay de milissegundos para segundos para exibição (padrão: 1.2s = 1200ms)
    const delayInSeconds = responseData.responseDelay ? responseData.responseDelay / 1000 : 1.2;

    return (
      <div className="space-y-4">
        <DeleteButton />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.instance')}
          </label>
          <select
            value={responseData.responseInstanceId || ''}
            onChange={(e) => onUpdate({ responseInstanceId: e.target.value || undefined })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            <option value="">{t('mindFlow.nodeSettings.useWorkflowInstance')}</option>
            {instances.map((instance) => (
              <option key={instance.id} value={instance.id}>
                {instance.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('mindFlow.nodeSettings.responseInstanceHelper')}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.responseType')}
          </label>
          <select
            value={responseType}
            onChange={(e) => {
              const newType = e.target.value as typeof responseType;
              const updates: any = { responseType: newType };
              
              // Limpar campos não relevantes ao mudar tipo
              if (newType === 'text') {
                updates.content = responseData.content || '';
                updates.mediaUrl = undefined;
                updates.caption = undefined;
                updates.fileName = undefined;
              } else if (newType === 'image') {
                updates.mediaUrl = responseData.mediaUrl || '';
                updates.content = undefined;
                updates.caption = undefined;
                updates.fileName = undefined;
              } else if (newType === 'image_caption') {
                updates.mediaUrl = responseData.mediaUrl || '';
                updates.caption = responseData.caption || '';
                updates.content = undefined;
                updates.fileName = undefined;
              } else if (newType === 'video') {
                updates.mediaUrl = responseData.mediaUrl || '';
                updates.content = undefined;
                updates.caption = undefined;
                updates.fileName = undefined;
              } else if (newType === 'video_caption') {
                updates.mediaUrl = responseData.mediaUrl || '';
                updates.caption = responseData.caption || '';
                updates.content = undefined;
                updates.fileName = undefined;
              } else if (newType === 'audio') {
                updates.mediaUrl = responseData.mediaUrl || '';
                updates.content = undefined;
                updates.caption = undefined;
                updates.fileName = undefined;
              } else if (newType === 'file') {
                updates.mediaUrl = responseData.mediaUrl || '';
                updates.fileName = responseData.fileName || '';
                updates.content = undefined;
                updates.caption = undefined;
              }
              
              onUpdate(updates);
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            <option value="text">{t('templateBuilder.types.text')}</option>
            <option value="image">{t('templateBuilder.types.image')}</option>
            <option value="image_caption">{t('templateBuilder.types.imageCaption')}</option>
            <option value="video">{t('templateBuilder.types.video')}</option>
            <option value="video_caption">{t('templateBuilder.types.videoCaption')}</option>
            <option value="audio">{t('templateBuilder.types.audio')}</option>
            <option value="file">{t('templateBuilder.types.file')}</option>
          </select>
        </div>

        {/* Campo de Delay (em segundos) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.delay') || 'Delay (segundos)'}
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={delayInSeconds}
            onChange={(e) => {
              const seconds = parseFloat(e.target.value) || 0;
              // Converter segundos para milissegundos ao salvar
              const milliseconds = Math.round(seconds * 1000);
              onUpdate({ responseDelay: milliseconds });
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            placeholder="1.5"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tempo de espera antes de enviar a mensagem para simular digitação (em segundos). Ex: 1.5 = 1 segundo e meio
          </p>
        </div>

        {/* Campos baseados no tipo */}
        {responseType === 'text' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('templateBuilder.textMessage')}
            </label>
            <div className="mb-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.variable}
                    type="button"
                    onClick={() => handleInsertVariable(v.variable, 'content')}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                    title={v.description}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <textarea
                value={responseData.content || ''}
                onChange={(e) => onUpdate({ content: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                rows={4}
                placeholder={t('templateBuilder.messagePlaceholder')}
              />
            </div>
          </div>
        )}

        {(responseType === 'image' || responseType === 'image_caption' || responseType === 'video' || responseType === 'video_caption' || responseType === 'audio' || responseType === 'file') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {responseType === 'image' || responseType === 'image_caption'
                ? t('templateBuilder.imageUrl')
                : responseType === 'video' || responseType === 'video_caption'
                ? t('templateBuilder.videoUrl')
                : responseType === 'audio'
                ? t('templateBuilder.audioUrl')
                : t('templateBuilder.fileUrl')}
            </label>
            <Input
              value={responseData.mediaUrl || ''}
              onChange={(e) => onUpdate({ mediaUrl: e.target.value })}
              placeholder={
                responseType === 'image' || responseType === 'image_caption'
                  ? t('templateBuilder.imageUrlPlaceholder')
                  : responseType === 'video' || responseType === 'video_caption'
                  ? t('templateBuilder.videoUrlPlaceholder')
                  : responseType === 'audio'
                  ? t('templateBuilder.audioUrlPlaceholder')
                  : t('templateBuilder.fileUrlPlaceholder')
              }
            />
          </div>
        )}

        {(responseType === 'image_caption' || responseType === 'video_caption') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('templateBuilder.caption')}
            </label>
            <div className="mb-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.variable}
                    type="button"
                    onClick={() => handleInsertVariable(v.variable, 'caption')}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                    title={v.description}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <textarea
                value={responseData.caption || ''}
                onChange={(e) => onUpdate({ caption: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                rows={3}
                placeholder={t('templateBuilder.captionPlaceholder')}
              />
            </div>
          </div>
        )}

        {responseType === 'file' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('templateBuilder.fileName')}
            </label>
            <Input
              value={responseData.fileName || ''}
              onChange={(e) => onUpdate({ fileName: e.target.value })}
              placeholder={t('templateBuilder.fileNamePlaceholder')}
            />
          </div>
        )}
      </div>
    );
  }

  if (node.type === 'openai') {
    const openaiData = node.data as { 
      apiKey?: string; 
      model?: string; 
      prompt?: string;
      responseDelay?: number; // Delay em milissegundos (armazenado internamente)
    };
    // Converter delay de milissegundos para segundos para exibição (padrão: 1.2s = 1200ms)
    const delayInSeconds = openaiData.responseDelay ? openaiData.responseDelay / 1000 : 1.2;
    const models = [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4-turbo-preview',
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-16k',
    ];

    return (
      <div className="space-y-4">
        <DeleteButton />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.openaiApiKey')}
          </label>
          <Input
            type="password"
            value={openaiData.apiKey || ''}
            onChange={(e) => onUpdate({ apiKey: e.target.value })}
            placeholder={t('mindFlow.nodeSettings.openaiApiKeyPlaceholder')}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('mindFlow.nodeSettings.openaiApiKeyDescription')}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.openaiModel')}
          </label>
          <select
            value={openaiData.model || 'gpt-3.5-turbo'}
            onChange={(e) => onUpdate({ model: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
          >
            {models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.openaiPrompt')}
          </label>
          <textarea
            value={openaiData.prompt || ''}
            onChange={(e) => onUpdate({ prompt: e.target.value })}
            placeholder={t('mindFlow.nodeSettings.openaiPromptPlaceholder')}
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 resize-none"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('mindFlow.nodeSettings.openaiPromptDescription')}
          </p>
        </div>
        
        {/* Campo de Delay (em segundos) - usado quando conectado ao nó de resposta */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('mindFlow.nodeSettings.responseDelay')}
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={delayInSeconds}
            onChange={(e) => {
              const seconds = parseFloat(e.target.value) || 0;
              // Converter segundos para milissegundos ao salvar
              const milliseconds = Math.round(seconds * 1000);
              onUpdate({ responseDelay: milliseconds });
            }}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            placeholder="1.5"
          />
          <p className="text-xs text-gray-600 dark:text-gray-200 mt-1">
            {t('mindFlow.nodeSettings.openaiDelayHelper')}
          </p>
        </div>
      </div>
    );
  }

  if (node.type === 'spreadsheet') {
    const spreadsheetData = node.data as {
      spreadsheetId?: string;
      spreadsheetName?: string;
      isAuthenticated?: boolean;
      sheetName?: string;
      useExisting?: boolean;
      selectedSpreadsheetId?: string;
    };

    const handleGoogleAuth = async () => {
      try {
        // Buscar URL de autenticação do backend
        const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4331/api';
        const token = localStorage.getItem('token');
        
        const response = await fetch(`${API_URL}/google/auth?nodeId=${node.id}&workflowId=${selectedWorkflow?.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Erro ao obter URL de autenticação');
        }

        const data = await response.json();
        const authUrl = data.authUrl;
        
        const width = 500;
        const height = 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          authUrl,
          'Google Auth',
          `width=${width},height=${height},left=${left},top=${top}`
        );

        if (!popup) {
          alert('Popup bloqueado. Por favor, permita popups para este site.');
          return;
        }

        // Escutar mensagem do popup quando autenticação for concluída
        const messageListener = (event: MessageEvent) => {
          // Aceitar mensagens de qualquer origem (o callback pode estar em domínio diferente)
          if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS') {
            onUpdate({
              isAuthenticated: true,
            });
            if (popup && !popup.closed) {
              popup.close();
            }
            window.removeEventListener('message', messageListener);
            clearInterval(checkClosed);
          } else if (event.data && event.data.type === 'GOOGLE_AUTH_ERROR') {
            alert(event.data.message || 'Erro ao autenticar com Google');
            if (popup && !popup.closed) {
              popup.close();
            }
            window.removeEventListener('message', messageListener);
            clearInterval(checkClosed);
          }
        };

        window.addEventListener('message', messageListener);

        // Verificar se popup foi fechado manualmente
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener('message', messageListener);
          }
        }, 1000);
      } catch (error: any) {
        console.error('Erro ao autenticar com Google:', error);
        alert(error.message || 'Erro ao iniciar autenticação com Google');
      }
    };

    return (
      <div className="space-y-4">
        <DeleteButton />
        {!spreadsheetData.isAuthenticated ? (
          <div>
            <Button onClick={handleGoogleAuth} className="w-full">
              {t('mindFlow.nodeSettings.authenticateGoogle')}
            </Button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('mindFlow.nodeSettings.authenticateGoogleDescription')}
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('mindFlow.nodeSettings.spreadsheetMode')}
              </label>
              <select
                value={spreadsheetData.useExisting ? 'existing' : 'new'}
                onChange={(e) => {
                  const useExisting = e.target.value === 'existing';
                  onUpdate({ 
                    useExisting,
                    selectedSpreadsheetId: useExisting ? undefined : spreadsheetData.selectedSpreadsheetId,
                    spreadsheetId: useExisting ? spreadsheetData.selectedSpreadsheetId : undefined,
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              >
                <option value="new">{t('mindFlow.nodeSettings.createNewSpreadsheet')}</option>
                <option value="existing">{t('mindFlow.nodeSettings.useExistingSpreadsheet')}</option>
              </select>
            </div>

            {spreadsheetData.useExisting ? (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('mindFlow.nodeSettings.existingSpreadsheetHint')}
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('mindFlow.nodeSettings.selectSpreadsheet')}
                  </label>
                  {loadingSpreadsheets ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('mindFlow.nodeSettings.loadingSpreadsheets')}</p>
                  ) : (
                    <select
                      value={spreadsheetData.selectedSpreadsheetId || ''}
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        onUpdate({ 
                          selectedSpreadsheetId: selectedId,
                          spreadsheetId: selectedId,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                    >
                      <option value="">{t('mindFlow.nodeSettings.selectSpreadsheetPlaceholder')}</option>
                      {spreadsheets.map((spreadsheet) => (
                        <option key={spreadsheet.id} value={spreadsheet.id}>
                          {spreadsheet.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('mindFlow.nodeSettings.spreadsheetName')}
                </label>
                <Input
                  value={spreadsheetData.spreadsheetName || ''}
                  onChange={(e) => onUpdate({ spreadsheetName: e.target.value })}
                  placeholder={t('mindFlow.nodeSettings.spreadsheetNamePlaceholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('mindFlow.nodeSettings.sheetName')}
              </label>
              <Input
                value={spreadsheetData.sheetName || 'Sheet1'}
                onChange={(e) => onUpdate({ sheetName: e.target.value })}
                placeholder={t('mindFlow.nodeSettings.sheetNamePlaceholder')}
              />
            </div>
            {spreadsheetData.spreadsheetId && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-xs text-green-700 dark:text-green-400">
                  ✅ {t('mindFlow.nodeSettings.authenticated')}
                </p>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  {t('mindFlow.nodeSettings.spreadsheetId')}: {spreadsheetData.spreadsheetId.substring(0, 20)}...
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DeleteButton />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {t('mindFlow.nodes.end.description')}
      </p>
    </div>
  );
};

export default MindClerky;
