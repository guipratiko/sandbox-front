import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Modal } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { instagramAPI, InstagramAutomation, InstagramInstance, ResponseSequenceItem } from '../../services/api';
import { dispatchAPI } from '../../services/api';
import { getErrorMessage, logError } from '../../utils/errorHandler';

interface InstagramAutomationsProps {
  instanceId?: string;
}

const InstagramAutomations: React.FC<InstagramAutomationsProps> = ({ instanceId }) => {
  const { t } = useLanguage();
  const [automations, setAutomations] = useState<InstagramAutomation[]>([]);
  const [instances, setInstances] = useState<InstagramInstance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    instanceId: instanceId || '',
    name: '',
    type: 'dm' as 'dm' | 'comment',
    triggerType: 'keyword' as 'keyword' | 'all',
    keywords: [] as string[],
    keywordInput: '',
    responseText: '',
    responseTextDM: '', // Texto da DM quando responseType = 'comment_and_dm'
    responseType: 'direct' as 'direct' | 'comment' | 'comment_and_dm',
    responseSequence: [] as ResponseSequenceItem[],
    delaySeconds: 0,
    preventDuplicate: true, // Padrão: true
    isActive: true,
  });
  const [uploadingFile, setUploadingFile] = useState<{ index: number; field: 'content' } | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{ [index: number]: boolean }>({});
  const [wizardStep, setWizardStep] = useState(1);
  const [responseTextRef, setResponseTextRef] = useState<HTMLTextAreaElement | null>(null);
  const [showClearModal, setShowClearModal] = useState<{ type: 'single' | 'all'; automationId?: string } | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [instancesRes, automationsRes] = await Promise.all([
        instagramAPI.getInstances(),
        instagramAPI.getAutomations(instanceId),
      ]);
      setInstances(instancesRes.data);
      setAutomations(automationsRes.data);
      setError(null);
    } catch (error: unknown) {
      logError('InstagramAutomations.loadData', error);
      const errorMsg = getErrorMessage(error, 'Erro ao carregar dados');
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Atualizar formData.instanceId quando instanceId mudar
  useEffect(() => {
    if (instanceId) {
      setFormData((prev) => ({ ...prev, instanceId }));
    }
  }, [instanceId]);

  const handleCreateAutomation = async () => {
    try {
      setIsCreating(true);
      setError(null);
      const keywords = formData.triggerType === 'keyword' ? formData.keywords : undefined;
      
      const automationData: any = {
        instanceId: formData.instanceId,
        name: formData.name,
        type: formData.type,
        triggerType: formData.triggerType,
        keywords,
        responseType: formData.responseType,
        delaySeconds: formData.delaySeconds || 0,
        preventDuplicate: formData.preventDuplicate,
        isActive: formData.isActive,
      };

      // Lógica baseada no tipo de interação e tipo de resposta
      if (formData.type === 'comment') {
        // Automação para comentários
        if (formData.responseType === 'comment') {
          // Responder no comentário: apenas texto
          automationData.responseText = formData.responseText;
        } else if (formData.responseType === 'direct') {
          // Responder via DM quando recebe comentário: apenas texto (não sequência)
          automationData.responseText = formData.responseText || '';
          // Não permitir sequência para comentário → DM
          delete automationData.responseSequence;
        } else if (formData.responseType === 'comment_and_dm') {
          // Responder comentário e depois enviar DM: dois textos separados
          automationData.responseText = formData.responseText || '';
          automationData.responseTextDM = formData.responseTextDM || '';
          // Não permitir sequência para comentário e DM
          delete automationData.responseSequence;
        }
      } else if (formData.type === 'dm') {
        // Automação para DM: sequência obrigatória
        if (formData.responseSequence.length === 0) {
          setError('É necessário adicionar pelo menos uma mensagem na sequência para Direct Messages');
          setIsCreating(false);
          return;
        }
        // Validar que cada mensagem da sequência tem conteúdo preenchido
        for (let i = 0; i < formData.responseSequence.length; i++) {
          const item = formData.responseSequence[i];
          if (!item.content || item.content.trim().length === 0) {
            setError(`A mensagem ${i + 1} está sem conteúdo. Preencha o campo ${item.type === 'text' ? 'texto' : item.type === 'image' ? 'URL da imagem' : item.type === 'video' ? 'URL do vídeo' : 'URL do áudio'}.`);
            setIsCreating(false);
            return;
          }
        }
        automationData.responseSequence = formData.responseSequence;
        automationData.responseText = ''; // Limpar para DM
      }

      // Debug: log dos dados que serão enviados
      console.log('📤 Dados que serão enviados para criar automação:', {
        type: automationData.type,
        responseType: automationData.responseType,
        hasResponseSequence: !!automationData.responseSequence,
        responseSequenceLength: automationData.responseSequence?.length || 0,
        hasResponseText: !!automationData.responseText,
        responseTextLength: automationData.responseText?.length || 0,
        automationData,
      });

      const response = await instagramAPI.createAutomation(automationData);
      setAutomations([...automations, response.data]);
      setShowCreateModal(false);
      setWizardStep(1); // Resetar wizard
      setSuccessMessage('Automação criada com sucesso');
      setFormData({
        instanceId: instanceId || '',
        name: '',
        type: 'dm',
        triggerType: 'keyword',
        keywords: [],
        keywordInput: '',
        responseText: '',
        responseTextDM: '',
        responseType: 'direct',
        responseSequence: [],
        delaySeconds: 0,
        preventDuplicate: true,
        isActive: true,
      });
      setUploadedFiles({}); // Limpar flags de upload
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      logError('InstagramAutomations.createAutomation', error);
      const errorMsg = getErrorMessage(error, 'Erro ao criar automação');
      setError(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleAutomation = async (id: string) => {
    try {
      const response = await instagramAPI.toggleAutomation(id);
      setAutomations(automations.map((a) => (a.id === id ? response.data : a)));
    } catch (error: unknown) {
      logError('InstagramAutomations.toggleAutomation', error);
      const errorMsg = getErrorMessage(error, 'Erro ao alternar automação');
      setError(errorMsg);
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja deletar esta automação?')) {
      return;
    }

    try {
      await instagramAPI.deleteAutomation(id);
      setAutomations(automations.filter((a) => a.id !== id));
      setSuccessMessage('Automação deletada com sucesso');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error: unknown) {
      logError('InstagramAutomations.deleteAutomation', error);
      const errorMsg = getErrorMessage(error, 'Erro ao deletar automação');
      setError(errorMsg);
    }
  };

  const handleClearContacts = async () => {
    if (!showClearModal) return;

    try {
      setIsClearing(true);
      setError(null);

      if (showClearModal.type === 'single' && showClearModal.automationId) {
        const response = await instagramAPI.clearAutomationContacts(showClearModal.automationId);
        setSuccessMessage(`Contatos limpos com sucesso. ${response.deletedCount} registro(s) removido(s).`);
      } else if (showClearModal.type === 'all' && instanceId) {
        const response = await instagramAPI.clearAllAutomationContacts(instanceId);
        setSuccessMessage(`Contatos de todas as automações limpos com sucesso. ${response.deletedCount} registro(s) removido(s).`);
      }

      setShowClearModal(null);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: unknown) {
      logError('InstagramAutomations.clearContacts', error);
      const errorMsg = getErrorMessage(error, 'Erro ao limpar contatos');
      setError(errorMsg);
    } finally {
      setIsClearing(false);
    }
  };

  const addKeyword = () => {
    if (formData.keywordInput.trim()) {
      setFormData({
        ...formData,
        keywords: [...formData.keywords, formData.keywordInput.trim()],
        keywordInput: '',
      });
    }
  };

  const removeKeyword = (index: number) => {
    setFormData({
      ...formData,
      keywords: formData.keywords.filter((_, i) => i !== index),
    });
  };

  const addSequenceItem = () => {
    if (formData.responseSequence.length >= 4) {
      setError('Máximo de 4 mensagens na sequência');
      return;
    }
    setFormData({
      ...formData,
      responseSequence: [
        ...formData.responseSequence,
        { type: 'text', content: '', delay: 0 },
      ],
    });
  };

  const removeSequenceItem = (index: number) => {
    setFormData({
      ...formData,
      responseSequence: formData.responseSequence.filter((_, i) => i !== index),
    });
    // Limpar flag de upload ao remover item
    setUploadedFiles(prev => {
      const newState = { ...prev };
      // Reindexar flags de upload após remoção
      const updated: { [index: number]: boolean } = {};
      Object.keys(newState).forEach(key => {
        const idx = parseInt(key);
        if (idx < index) {
          updated[idx] = newState[idx];
        } else if (idx > index) {
          updated[idx - 1] = newState[idx];
        }
      });
      return updated;
    });
  };

  const updateSequenceItem = (index: number, field: keyof ResponseSequenceItem, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.responseSequence];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, responseSequence: updated };
    });
  };

  const validateMediaUrl = (url: string, type: 'image' | 'video' | 'audio'): { isValid: boolean; error?: string } => {
    if (!url || url.trim().length === 0) {
      return { isValid: false, error: 'URL não pode estar vazia' };
    }
    
    if (!url.startsWith('https://')) {
      return { isValid: false, error: 'URL deve começar com https://' };
    }
    
    const urlLower = url.toLowerCase();
    const validExtensions: Record<string, string[]> = {
      image: ['jpg', 'jpeg', 'png'],
      video: ['mp4', 'ogg', 'avi', 'mov', 'webm'],
      audio: ['aac', 'm4a', 'wav', 'mp4', 'mp3'],
    };
    
    const extensions = validExtensions[type] || [];
    const hasValidExtension = extensions.some((ext) => urlLower.endsWith(`.${ext}`));
    
    if (!hasValidExtension) {
      const extensionsList = extensions.join(', ');
      return { isValid: false, error: `URL deve ter uma extensão válida: ${extensionsList}` };
    }
    
    return { isValid: true };
  };

  const insertUserContactVariable = () => {
    if (responseTextRef) {
      const textarea = responseTextRef;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.responseText;
      const newText = text.substring(0, start) + '$user-contact' + text.substring(end);
      setFormData({ ...formData, responseText: newText });
      // Reposicionar cursor após a variável inserida
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + '$user-contact'.length, start + '$user-contact'.length);
      }, 0);
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.name || formData.name.trim().length < 3) {
          setError(t('instagram.nameMinLength'));
          setTimeout(() => setError(null), 3000);
          return false;
        }
        if (!formData.instanceId) {
          setError(t('instagram.selectInstance'));
          setTimeout(() => setError(null), 3000);
          return false;
        }
        return true;
      case 2:
        if (formData.triggerType === 'keyword' && formData.keywords.length === 0) {
          setError('Adicione pelo menos uma palavra-chave');
          setTimeout(() => setError(null), 3000);
          return false;
        }
        return true;
      case 3:
        if (formData.type === 'comment') {
          // Para comentários, verificar responseType
          if (formData.responseType === 'comment') {
            if (!formData.responseText || formData.responseText.trim().length === 0) {
              setError('Texto da resposta é obrigatório para comentários');
              setTimeout(() => setError(null), 3000);
              return false;
            }
          } else if (formData.responseType === 'direct') {
            // Comentário respondendo via DM: pode ser sequência ou texto
            if (formData.responseSequence.length === 0 && (!formData.responseText || formData.responseText.trim().length === 0)) {
              setError('Adicione pelo menos uma mensagem na sequência ou texto da resposta');
              setTimeout(() => setError(null), 3000);
              return false;
            }
            // Se tem sequência, validar que cada mensagem tem conteúdo preenchido
            if (formData.responseSequence.length > 0) {
              for (let i = 0; i < formData.responseSequence.length; i++) {
                const item = formData.responseSequence[i];
                if (!item.content || item.content.trim().length === 0) {
                  const fieldName = item.type === 'text' ? 'texto' : item.type === 'image' ? 'URL da imagem' : item.type === 'video' ? 'URL do vídeo' : 'URL do áudio';
                  setError(`A mensagem ${i + 1} está sem conteúdo. Preencha o campo ${fieldName}.`);
                  setTimeout(() => setError(null), 3000);
                  return false;
                }
              }
            }
          }
        } else if (formData.type === 'dm') {
          // Para DM, sempre precisa de sequência
          if (formData.responseSequence.length === 0) {
            setError('Adicione pelo menos uma mensagem na sequência');
            setTimeout(() => setError(null), 3000);
            return false;
          }
          // Validar que cada mensagem da sequência tem conteúdo preenchido
          for (let i = 0; i < formData.responseSequence.length; i++) {
            const item = formData.responseSequence[i];
            if (!item.content || item.content.trim().length === 0) {
              setError(`A mensagem ${i + 1} está sem conteúdo. Preencha o campo ${item.type === 'text' ? 'texto' : item.type === 'image' ? 'URL da imagem' : item.type === 'video' ? 'URL do vídeo' : 'URL do áudio'}.`);
              setTimeout(() => setError(null), 3000);
              return false;
            }
          }
        }
        return true;
      default:
        return true;
    }
  };

  const handleNextStep = () => {
    if (validateStep(wizardStep)) {
      setWizardStep(wizardStep + 1);
      setError(null);
    }
  };

  const handlePreviousStep = () => {
    if (wizardStep > 1) {
      setWizardStep(wizardStep - 1);
      setError(null);
    }
  };

  const handleFileUpload = async (file: File, sequenceIndex: number) => {
    try {
      setUploadingFile({ index: sequenceIndex, field: 'content' });
      setError(null);
      
      // Validar tamanho do arquivo
      const fileSizeMB = file.size / (1024 * 1024);
      const item = formData.responseSequence[sequenceIndex];
      
      let maxSize = 0;
      if (item.type === 'image') maxSize = 8;
      else if (item.type === 'video' || item.type === 'audio') maxSize = 25;
      
      if (fileSizeMB > maxSize) {
        throw new Error(`Arquivo muito grande. Tamanho máximo: ${maxSize}MB`);
      }

      const result = await dispatchAPI.uploadTemplateFile(file);
      
      // Corrigir HTTP para HTTPS
      let url = result.fullUrl;
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
      }
      
      // Salvar URL no content (para enviar ao backend) e marcar como upload feito
      updateSequenceItem(sequenceIndex, 'content', url);
      setUploadedFiles(prev => ({ ...prev, [sequenceIndex]: true }));
    } catch (error: unknown) {
      logError('InstagramAutomations.handleFileUpload', error);
      const errorMsg = getErrorMessage(error, 'Erro ao fazer upload do arquivo');
      setError(errorMsg);
    } finally {
      setUploadingFile(null);
    }
  };


  return (
    <div>
      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
          {successMessage}
        </div>
      )}

      <div className="mb-6 flex justify-between items-center">
        <div>
          {instanceId && (
            <Button
              variant="outline"
              size="md"
              onClick={() => setShowClearModal({ type: 'all' })}
              className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
            >
              {t('instagram.clearAllContacts')}
            </Button>
          )}
        </div>
        <Button variant="primary" size="lg" onClick={() => setShowCreateModal(true)}>
          {t('instagram.createAutomation')}
        </Button>
      </div>

      {isLoading ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
          </div>
        </Card>
      ) : automations.length === 0 ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              {t('instagram.noAutomations')}
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('instagram.noAutomationsDescription')}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {automations.map((automation) => {
            const instance = instances.find((i) => i.id === automation.instanceId);
            return (
              <Card key={automation.id} padding="lg" shadow="lg" className="hover:shadow-xl transition-shadow duration-200">
                {/* Header com Status e Nome */}
                <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100 flex-1 line-clamp-1">
                      {automation.name}
                    </h3>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                        automation.isActive
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        automation.isActive ? 'bg-green-500' : 'bg-gray-400'
                      }`}></span>
                      {automation.isActive ? t('instagram.active') : t('instagram.inactive')}
                    </span>
                  </div>
                </div>

                {/* Informações da Automação */}
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-shrink-0 w-20 text-gray-500 dark:text-gray-400 font-medium">
                      {t('instagram.typeLabel')}:
                    </div>
                    <div className="flex-1 text-clerky-backendText dark:text-gray-200">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                        {automation.type === 'dm' ? t('instagram.directMessage') : t('instagram.comment')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-shrink-0 w-20 text-gray-500 dark:text-gray-400 font-medium">
                      {t('instagram.triggerLabel')}:
                    </div>
                    <div className="flex-1 text-clerky-backendText dark:text-gray-200">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-xs font-medium">
                        {automation.triggerType === 'keyword' 
                          ? `${t('instagram.keyword')}${automation.keywords && automation.keywords.length > 0 ? `: ${automation.keywords.join(', ')}` : ''}`
                          : t('instagram.all')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="flex-shrink-0 w-20 text-gray-500 dark:text-gray-400 font-medium">
                      {t('instagram.responseLabel')}:
                    </div>
                    <div className="flex-1 text-clerky-backendText dark:text-gray-200">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                        {automation.responseType === 'comment' ? (
                          t('instagram.commentResponse')
                        ) : automation.responseType === 'comment_and_dm' ? (
                          `${t('instagram.commentResponse')} ${t('common.and')} ${t('instagram.direct')}`
                        ) : automation.responseSequence && automation.responseSequence.length > 0 ? (
                          `${t('instagram.direct')} - ${automation.responseSequence.length} ${t('instagram.message').toLowerCase()}`
                        ) : (
                          `${t('instagram.direct')} - ${t('instagram.text')}`
                        )}
                      </span>
                    </div>
                  </div>

                  {instance && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex-shrink-0 w-20 text-gray-500 dark:text-gray-400 font-medium">
                        {t('instagram.instanceLabel')}:
                      </div>
                      <div className="flex-1 text-clerky-backendText dark:text-gray-200 truncate">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium">
                          {instance.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleAutomation(automation.id)}
                    className="flex-1 min-w-[120px] text-xs font-medium"
                  >
                    {automation.isActive ? t('instagram.deactivate') : t('instagram.activate')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowClearModal({ type: 'single', automationId: automation.id })}
                    className="flex-1 min-w-[120px] text-xs font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-900/20"
                  >
                    {t('instagram.clearContacts')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteAutomation(automation.id)}
                    className="flex-1 min-w-[120px] text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                  >
                    {t('instagram.delete')}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Criação */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setWizardStep(1); // Resetar wizard ao fechar
          setUploadedFiles({}); // Limpar flags de upload ao fechar
        }}
        title={t('instagram.createAutomationTitle')}
        size="md"
      >
        {/* Mensagem de erro dentro do modal */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg relative z-[100]">
            {error}
          </div>
        )}

        {/* Indicador de Etapas */}
        <div className="mb-6 px-2">
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2">
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                wizardStep >= 1 ? 'bg-clerky-backendButton text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                1
              </div>
              <span className={`text-xs sm:text-sm whitespace-nowrap hidden sm:inline ${wizardStep >= 1 ? 'text-clerky-backendButton font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('instagram.step1')}
              </span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 min-w-[15px] sm:min-w-[20px] rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-300 ${
                wizardStep >= 2 ? 'bg-clerky-backendButton' : ''
              }`} style={{ width: wizardStep >= 2 ? '100%' : '0%' }}></div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                wizardStep >= 2 ? 'bg-clerky-backendButton text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                2
              </div>
              <span className={`text-xs sm:text-sm whitespace-nowrap hidden sm:inline ${wizardStep >= 2 ? 'text-clerky-backendButton font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('instagram.step2')}
              </span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 min-w-[15px] sm:min-w-[20px] rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-300 ${
                wizardStep >= 3 ? 'bg-clerky-backendButton' : ''
              }`} style={{ width: wizardStep >= 3 ? '100%' : '0%' }}></div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                wizardStep >= 3 ? 'bg-clerky-backendButton text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                3
              </div>
              <span className={`text-xs sm:text-sm whitespace-nowrap hidden sm:inline ${wizardStep >= 3 ? 'text-clerky-backendButton font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('instagram.step3')}
              </span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 min-w-[15px] sm:min-w-[20px] rounded-full overflow-hidden">
              <div className={`h-full transition-all duration-300 ${
                wizardStep >= 4 ? 'bg-clerky-backendButton' : ''
              }`} style={{ width: wizardStep >= 4 ? '100%' : '0%' }}></div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                wizardStep >= 4 ? 'bg-clerky-backendButton text-white shadow-md' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
              }`}>
                4
              </div>
              <span className={`text-xs sm:text-sm whitespace-nowrap hidden sm:inline ${wizardStep >= 4 ? 'text-clerky-backendButton font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                {t('instagram.step4')}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-5 max-h-[calc(100vh-250px)] overflow-y-auto px-1">
          {/* Etapa 1: Informações Básicas */}
          {wizardStep === 1 && (
            <>
          {!instanceId && (
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    {t('instagram.instance')}
              </label>
              <select
                value={formData.instanceId}
                onChange={(e) => setFormData({ ...formData, instanceId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                required
              >
                <option value="">{t('instagram.selectInstance')}</option>
                {instances.map((instance) => (
                  <option key={instance.id} value={instance.id}>
                    {instance.name} {instance.username && `(@${instance.username})`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  {t('instagram.automationName')}
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('instagram.automationNamePlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  {t('instagram.interactionType')}
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'dm' | 'comment' })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            >
                  <option value="dm">{t('instagram.directMessage')}</option>
                  <option value="comment">{t('instagram.comment')}</option>
            </select>
          </div>
            </>
          )}

          {/* Etapa 2: Trigger */}
          {wizardStep === 2 && (
            <>
          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  {t('instagram.triggerType')}
            </label>
            <select
              value={formData.triggerType}
              onChange={(e) =>
                setFormData({ ...formData, triggerType: e.target.value as 'keyword' | 'all' })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            >
                  <option value="keyword">{t('instagram.keyword')}</option>
                  <option value="all">{t('instagram.all')}</option>
            </select>
          </div>

          {formData.triggerType === 'keyword' && (
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    {t('instagram.keywords')}
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={formData.keywordInput}
                  onChange={(e) => setFormData({ ...formData, keywordInput: e.target.value })}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                      placeholder={t('instagram.keywordPlaceholder')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                />
                <Button variant="outline" size="sm" onClick={addKeyword}>
                      {t('instagram.add')}
                </Button>
              </div>
              {formData.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(index)}
                        className="text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

              {/* Tipo de Resposta - apenas para comentários */}
              {formData.type === 'comment' && (
          <div>
            <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    {t('instagram.responseType')}
            </label>
            <select
              value={formData.responseType}
                    onChange={(e) => {
                      const newResponseType = e.target.value as 'direct' | 'comment' | 'comment_and_dm';
                      setFormData({
                        ...formData,
                        responseType: newResponseType,
                        responseText: newResponseType === 'comment' || newResponseType === 'comment_and_dm' ? formData.responseText : '',
                        responseTextDM: newResponseType === 'comment_and_dm' ? formData.responseTextDM : '',
                        responseSequence: newResponseType === 'direct' ? formData.responseSequence : [],
                      });
                    }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            >
                    <option value="direct">{t('instagram.direct')}</option>
                    <option value="comment">{t('instagram.commentResponse')}</option>
                    <option value="comment_and_dm">{t('instagram.commentAndDM')}</option>
            </select>
          </div>
              )}
            </>
          )}

          {/* Etapa 3: Resposta */}
          {wizardStep === 3 && (
            <>
              {/* Campos para Comentários - apenas quando type === 'comment' e responseType === 'comment' */}
              {formData.type === 'comment' && formData.responseType === 'comment' && (
          <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.responseText')}
            </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={insertUserContactVariable}
                      type="button"
                    >
                      {t('instagram.addContactVariable')}
                    </Button>
                  </div>
            <textarea
                    ref={setResponseTextRef}
              value={formData.responseText}
              onChange={(e) => setFormData({ ...formData, responseText: e.target.value })}
                    placeholder={t('instagram.responseTextPlaceholder')}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
              required
            />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('instagram.contactVariableDescription')}
                  </p>
                </div>
              )}

              {/* Campos para Comentário → DM: apenas texto */}
              {formData.type === 'comment' && formData.responseType === 'direct' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.responseText')}
                    </label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={insertUserContactVariable}
                      type="button"
                    >
                      {t('instagram.addContactVariable')}
                    </Button>
                  </div>
                  <textarea
                    ref={setResponseTextRef}
                    value={formData.responseText}
                    onChange={(e) => setFormData({ ...formData, responseText: e.target.value })}
                    placeholder={t('instagram.responseTextPlaceholder')}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('instagram.contactVariableDescription')}
                  </p>
                  <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    {t('instagram.dmForCommentWarning')}
                  </p>
                </div>
              )}

              {/* Campos para Comentário e DM: dois campos de texto separados */}
              {formData.type === 'comment' && formData.responseType === 'comment_and_dm' && (
                <div className="space-y-4">
                  {/* Texto do comentário */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.commentText')}
                    </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={insertUserContactVariable}
                        type="button"
                      >
                        {t('instagram.addContactVariable')}
                      </Button>
                    </div>
                    <textarea
                      ref={setResponseTextRef}
                      value={formData.responseText}
                      onChange={(e) => setFormData({ ...formData, responseText: e.target.value })}
                      placeholder="Digite o texto que será respondido no comentário..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('instagram.contactVariableDescription')}
                    </p>
                  </div>

                  {/* Texto da DM */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('instagram.dmText')}
                    </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const textarea = document.createElement('textarea');
                          textarea.value = formData.responseTextDM;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const newValue = formData.responseTextDM.substring(0, start) + '$user-contact' + formData.responseTextDM.substring(end);
                          setFormData({ ...formData, responseTextDM: newValue });
                        }}
                        type="button"
                      >
                        {t('instagram.addContactVariable')}
                      </Button>
                    </div>
                    <textarea
                      value={formData.responseTextDM}
                      onChange={(e) => setFormData({ ...formData, responseTextDM: e.target.value })}
                      placeholder={t('instagram.dmTextPlaceholder')}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('instagram.contactVariableDescription')}
                    </p>
                    <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      {t('instagram.commentAndDMInfo')}
                    </p>
                  </div>
                </div>
              )}

              {/* Campos para Direct Messages - Sequência de Mensagens */}
              {formData.type === 'dm' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
                  {t('instagram.messageSequence')}
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                    {t('instagram.maxMessages')}
                  </span>
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addSequenceItem}
                  disabled={formData.responseSequence.length >= 4}
                >
                  {t('instagram.addMessage')}
                </Button>
              </div>

              {formData.responseSequence.length === 0 && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Adicione pelo menos uma mensagem na sequência
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {formData.responseSequence.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-[#091D41]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
                        {t('instagram.message')} {index + 1}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSequenceItem(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {t('instagram.remove')}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                          {t('instagram.messageType')}
                        </label>
                        <select
                          value={item.type}
                          onChange={(e) => {
                            const newType = e.target.value as 'text' | 'image' | 'video' | 'audio';
                            updateSequenceItem(index, 'type', newType);
                            // Limpar conteúdo ao mudar tipo
                            updateSequenceItem(index, 'content', '');
                            // Limpar flag de upload ao mudar tipo
                            setUploadedFiles(prev => {
                              const newState = { ...prev };
                              delete newState[index];
                              return newState;
                            });
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                        >
                          <option value="text">{t('instagram.text')}</option>
                          <option value="image">{t('instagram.image')}</option>
                          <option value="video">{t('instagram.video')}</option>
                          <option value="audio">{t('instagram.audio')}</option>
                        </select>
                      </div>

                      {item.type === 'text' ? (
                        <div>
                          <label className="block text-xs font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                            {t('instagram.text')}
                          </label>
                          <textarea
                            value={item.content}
                            onChange={(e) => updateSequenceItem(index, 'content', e.target.value)}
                            placeholder={t('instagram.textPlaceholder')}
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                            required
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                            {item.type === 'image' ? t('instagram.imageUrl') : item.type === 'video' ? t('instagram.videoUrl') : t('instagram.audioUrl')}
                            <span className="ml-1 text-gray-500">{t('instagram.or')}</span>
                            <span className="ml-1 text-blue-600 dark:text-blue-400 cursor-pointer">
                              {t('instagram.upload')}
                            </span>
                          </label>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={uploadedFiles[index] ? 'Arquivo enviado ✓' : item.content}
                                onChange={(e) => {
                                  // Se estava com upload, limpar a flag ao editar manualmente
                                  if (uploadedFiles[index]) {
                                    setUploadedFiles(prev => {
                                      const newState = { ...prev };
                                      delete newState[index];
                                      return newState;
                                    });
                                  }
                                  updateSequenceItem(index, 'content', e.target.value);
                                  // Validar URL em tempo real (apenas para tipos de mídia)
                                  if (e.target.value && e.target.value.trim().length > 0 && item.type !== 'text') {
                                    const validation = validateMediaUrl(e.target.value, item.type as 'image' | 'video' | 'audio');
                                    if (!validation.isValid) {
                                      setError(validation.error || 'URL inválida');
                                      setTimeout(() => setError(null), 5000);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  // Validar quando o campo perde o foco (apenas para tipos de mídia)
                                  if (e.target.value && e.target.value.trim().length > 0 && item.type !== 'text' && !uploadedFiles[index]) {
                                    const validation = validateMediaUrl(e.target.value, item.type as 'image' | 'video' | 'audio');
                                    if (!validation.isValid) {
                                      setError(validation.error || 'URL inválida');
                                      setTimeout(() => setError(null), 5000);
                                    }
                                  }
                                }}
                                placeholder={`https://exemplo.com/${item.type}.${item.type === 'image' ? 'jpg' : item.type === 'video' ? 'mp4' : 'mp3'}`}
                                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200 ${
                                  uploadedFiles[index]
                                    ? 'border-green-300 dark:border-green-700'
                                    : item.content && item.content.trim().length > 0
                                    ? validateMediaUrl(item.content, item.type as 'image' | 'video' | 'audio').isValid
                                      ? 'border-green-300 dark:border-green-700'
                                      : 'border-red-300 dark:border-red-700'
                                    : 'border-gray-300 dark:border-gray-600'
                                }`}
                                required
                              />
                              {!uploadedFiles[index] && item.content && item.content.trim().length > 0 && !validateMediaUrl(item.content, item.type as 'image' | 'video' | 'audio').isValid && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                                  {validateMediaUrl(item.content, item.type as 'image' | 'video' | 'audio').error}
                                </p>
                              )}
                            </div>
                            <input
                              type="file"
                              accept={
                                item.type === 'image'
                                  ? 'image/jpeg,image/png'
                                  : item.type === 'video'
                                  ? 'video/mp4,video/ogg,video/avi,video/mov,video/webm'
                                  : 'audio/aac,audio/m4a,audio/wav,audio/mp4,audio/mpeg'
                              }
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handleFileUpload(file, index);
                                }
                                e.target.value = '';
                              }}
                              className="hidden"
                              id={`file-upload-${index}`}
                            />
                            <label
                              htmlFor={`file-upload-${index}`}
                              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                            >
                              {uploadingFile?.index === index ? t('instagram.uploading') : t('instagram.upload')}
                            </label>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {item.type === 'image' && 'Formatos: PNG, JPEG | Tamanho máximo: 8 MB'}
                            {item.type === 'video' && 'Formatos: MP4, OGG, AVI, MOV, WEBM | Tamanho máximo: 25 MB'}
                            {item.type === 'audio' && 'Formatos: AAC, M4A, WAV, MP4, MP3 | Tamanho máximo: 25 MB'}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                          {t('instagram.delay')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.delay}
                          onChange={(e) => updateSequenceItem(index, 'delay', parseInt(e.target.value) || 0)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                        />
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {t('instagram.delayDescription')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
              )}
            </>
          )}

          {/* Etapa 4: Finalizar */}
          {wizardStep === 4 && (
            <>
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  {t('instagram.globalDelay')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.delaySeconds}
                  onChange={(e) => setFormData({ ...formData, delaySeconds: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('instagram.globalDelayDescription')}
                </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-[#091D41]/50 border border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-5 h-5 mt-0.5 text-clerky-backendButton rounded focus:ring-clerky-backendButton flex-shrink-0"
              />
              <label 
                htmlFor="isActive"
                className="text-sm text-clerky-backendText dark:text-gray-200 cursor-pointer flex-1"
              >
                {t('instagram.activateAutomatically')}
              </label>
            </div>
            <div className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-[#091D41]/50 border border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                id="preventDuplicate"
                checked={formData.preventDuplicate}
                onChange={(e) => setFormData({ ...formData, preventDuplicate: e.target.checked })}
                className="w-5 h-5 mt-0.5 text-clerky-backendButton rounded focus:ring-clerky-backendButton flex-shrink-0"
              />
              <label 
                htmlFor="preventDuplicate"
                className="text-sm text-clerky-backendText dark:text-gray-200 cursor-pointer flex-1"
              >
                {t('instagram.preventDuplicateDescription')}
              </label>
            </div>
          </div>

              {/* Resumo da Automação */}
              <div className="p-4 sm:p-5 bg-gray-50 dark:bg-[#091D41] rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
                  {t('instagram.automationSummary')}
                </h4>
                <div className="space-y-2.5 text-sm text-gray-600 dark:text-gray-400">
                  <div><span className="font-medium">{t('instagram.summaryName')}</span> {formData.name}</div>
                  <div><span className="font-medium">{t('instagram.summaryType')}</span> {formData.type === 'dm' ? t('instagram.directMessage') : t('instagram.comment')}</div>
                  <div><span className="font-medium">{t('instagram.summaryTrigger')}</span> {formData.triggerType === 'keyword' ? t('instagram.keyword') : t('instagram.all')}</div>
                  {formData.triggerType === 'keyword' && formData.keywords.length > 0 && (
                    <div><span className="font-medium">{t('instagram.summaryKeywords')}</span> {formData.keywords.join(', ')}</div>
                  )}
                  <div><span className="font-medium">{t('instagram.summaryResponseType')}</span> {formData.responseType === 'comment' ? t('instagram.commentResponse') : t('instagram.direct')}</div>
                  {formData.responseType === 'comment' && (
                    <div><span className="font-medium">{t('instagram.summaryText')}</span> {formData.responseText.substring(0, 50)}{formData.responseText.length > 50 ? '...' : ''}</div>
                  )}
                  {formData.responseType === 'direct' && formData.responseSequence.length > 0 && (
                    <div><span className="font-medium">{t('instagram.summaryMessages')}</span> {formData.responseSequence.length}</div>
                  )}
                  <div><span className="font-medium">{t('instagram.summaryDelay')}</span> {formData.delaySeconds}s</div>
                  <div><span className="font-medium">{t('instagram.summaryStatus')}</span> {formData.isActive ? t('instagram.active') : t('instagram.inactive')}</div>
                </div>
              </div>
            </>
          )}

          {/* Botões de Navegação */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              {/* Botão Voltar - lado esquerdo */}
              <div className="flex justify-start">
                {wizardStep > 1 && (
                  <Button 
                    variant="outline" 
                    onClick={handlePreviousStep}
                    className="w-full sm:w-auto min-w-[100px]"
                  >
                    {t('instagram.back')}
                  </Button>
                )}
              </div>
              
              {/* Botões Cancelar e Próximo/Criar - lado direito */}
              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setWizardStep(1);
                    setUploadedFiles({}); // Limpar flags de upload ao cancelar
                  }}
                  className="flex-1 sm:flex-none min-w-[100px]"
                >
                  {t('instagram.cancel')}
                </Button>
                {wizardStep < 4 ? (
                  <Button 
                    variant="primary" 
                    onClick={handleNextStep}
                    className="flex-1 sm:flex-none min-w-[100px]"
                  >
                    {t('instagram.next')}
                  </Button>
                ) : (
                  <Button 
                    variant="primary" 
                    onClick={handleCreateAutomation} 
                    isLoading={isCreating}
                    className="flex-1 sm:flex-none min-w-[120px]"
                  >
                    {isCreating ? t('instagram.creating') : t('instagram.create')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmação para Limpar Contatos */}
      <Modal
        isOpen={showClearModal !== null}
        onClose={() => setShowClearModal(null)}
        title={showClearModal?.type === 'all' ? t('instagram.clearContactsModalTitle') : t('instagram.clearContactsModalTitleSingle')}
      >
        <div className="space-y-4">
          <p className="text-clerky-backendText dark:text-gray-200">
            {showClearModal?.type === 'all'
              ? t('instagram.clearContactsModalMessage')
              : t('instagram.clearContactsModalMessageSingle')}
          </p>
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowClearModal(null)}
              disabled={isClearing}
            >
              {t('instagram.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleClearContacts}
              disabled={isClearing}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isClearing ? t('common.loading') : t('common.confirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InstagramAutomations;
