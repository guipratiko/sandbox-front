import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../UI';
import { instanceAPI, crmAPI, dispatchAPI, Instance, Template, CRMColumn, CreateDispatchData } from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getTodayDateString } from '../../utils/dateFormatters';

interface DispatchCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateDispatchData) => Promise<void>;
  initialData?: Partial<CreateDispatchData>;
}

const DispatchCreator: React.FC<DispatchCreatorProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const { t, tArray } = useLanguage();
  const { user } = useAuth();
  const [step, setStep] = useState<'basic' | 'contacts' | 'settings' | 'schedule'>('basic');
  const [isLoading, setIsLoading] = useState(false);

  // Dados do formulário
  const [name, setName] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [contactsSource, setContactsSource] = useState<'list' | 'kanban'>('list');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [inputText, setInputText] = useState('');
  const [selectedColumnIds, setSelectedColumnIds] = useState<string[]>([]);
  const [speed, setSpeed] = useState<'fast' | 'normal' | 'slow' | 'randomized'>('normal');
  const [autoDelete, setAutoDelete] = useState(false);
  const [deleteDelay, setDeleteDelay] = useState(0);
  const [deleteDelayUnit, setDeleteDelayUnit] = useState<'seconds' | 'minutes' | 'hours'>('seconds');
  const [showDispatchInChat, setShowDispatchInChat] = useState(false);
  const [defaultName, setDefaultName] = useState('Cliente');
  const [hasSchedule, setHasSchedule] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [suspendedDays, setSuspendedDays] = useState<number[]>([]);
  const [scheduleTimezone, setScheduleTimezone] = useState<string | null>(null); // null = usar timezone do perfil

  // Dados carregados
  const [instances, setInstances] = useState<Instance[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [processedContacts, setProcessedContacts] = useState<Array<{ phone: string; name?: string }>>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationStats, setValidationStats] = useState<{ total: number; valid: number; invalid: number } | null>(null);
  const [pendingValidContacts, setPendingValidContacts] = useState<Array<{ phone: string; name?: string }>>([]);

  // Carregar dados iniciais
  useEffect(() => {
    if (isOpen) {
      loadInstances();
      loadTemplates();
      loadColumns();
      
      // Se tem dados iniciais (edição), preencher formulário
      if (initialData) {
        if (initialData.name) setName(initialData.name);
        if (initialData.instanceId) setSelectedInstanceId(initialData.instanceId);
        if (initialData.templateId) setSelectedTemplateId(initialData.templateId);
        if (initialData.settings) {
          setSpeed(initialData.settings.speed);
          setAutoDelete(initialData.settings.autoDelete || false);
          setDeleteDelay(initialData.settings.deleteDelay || 0);
          setDeleteDelayUnit(initialData.settings.deleteDelayUnit || 'seconds');
          setShowDispatchInChat(initialData.settings.showDispatchInChat === true);
        }
        if (initialData.defaultName) setDefaultName(initialData.defaultName);
        if (initialData.schedule) {
          setHasSchedule(true);
          setStartDate(initialData.schedule.startDate || '');
          setStartTime(initialData.schedule.startTime);
          setEndTime(initialData.schedule.endTime);
          setSuspendedDays(initialData.schedule.suspendedDays || []);
        }
      } else {
        // Resetar formulário ao criar novo
        setName('');
        setSelectedInstanceId('');
        setSelectedTemplateId('');
        setSpeed('normal');
        setAutoDelete(false);
        setDeleteDelay(0);
        setDeleteDelayUnit('seconds');
        setShowDispatchInChat(false);
        setDefaultName('Cliente');
        setHasSchedule(false);
        setStartDate('');
        setStartTime('08:00');
        setEndTime('18:00');
        setSuspendedDays([]);
        setStep('basic');
        setInputText('');
        setProcessedContacts([]);
        setCsvFile(null);
        setSelectedColumnIds([]);
      }
    }
  }, [isOpen, initialData]);

  const loadInstances = async () => {
    try {
      const response = await instanceAPI.getAll();
      setInstances(
        response.instances.filter(
          (i) => i.status === 'connected' && i.integration !== 'WHATSAPP-CLOUD'
        )
      );
    } catch (error) {
      console.error('Erro ao carregar instâncias:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await dispatchAPI.getTemplates();
      setTemplates(response.templates);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
    }
  };

  const loadColumns = async () => {
    try {
      const response = await crmAPI.getColumns();
      setColumns(response.columns);
    } catch (error) {
      console.error('Erro ao carregar colunas:', error);
    }
  };

  // Armazenar arquivo CSV (será processado ao clicar em "próximo")
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    // Limpar contatos processados anteriormente quando novo arquivo é selecionado
    setProcessedContacts([]);
  };

  // Processar texto de entrada
  const handleProcessInput = async () => {
    if (!inputText.trim()) {
      alert('Digite os contatos no campo de texto');
      return;
    }

    try {
      const response = await dispatchAPI.processInput(inputText);
      setProcessedContacts(response.contacts);
    } catch (error: any) {
      alert(error.message || 'Erro ao processar texto');
    }
  };

  // Processar e validar contatos automaticamente
  const handleProcessAndValidateContacts = async (): Promise<boolean> => {
    if (!selectedInstanceId) {
      alert('Selecione uma instância primeiro');
      return false;
    }

    // Se for edição, não precisa processar/validar
    if (initialData) {
      return true;
    }

    setIsValidating(true);
    try {
      let contactsToValidate: Array<{ phone: string; name?: string }> = [];

      if (contactsSource === 'list') {
        // Se tem CSV mas não foi processado, processar primeiro
        if (csvFile && processedContacts.length === 0) {
          try {
            const csvResponse = await dispatchAPI.uploadCSV(csvFile);
            contactsToValidate = csvResponse.contacts;
          } catch (error: any) {
            alert(error.message || 'Erro ao processar CSV');
            setIsValidating(false);
            return false;
          }
        }
        // Se tem texto mas não foi processado, processar primeiro
        else if (inputText.trim() && processedContacts.length === 0) {
          try {
            const processResponse = await dispatchAPI.processInput(inputText);
            contactsToValidate = processResponse.contacts;
          } catch (error: any) {
            alert(error.message || 'Erro ao processar texto');
            setIsValidating(false);
            return false;
          }
        } else {
          contactsToValidate = processedContacts;
        }

        if (contactsToValidate.length === 0) {
          alert('Nenhum contato encontrado. Faça upload de CSV ou cole os contatos.');
          setIsValidating(false);
          return false;
        }
      } else {
        // Kanban
        if (selectedColumnIds.length === 0) {
          alert('Selecione pelo menos uma coluna do Kanban');
          setIsValidating(false);
          return false;
        }

        // Buscar contatos das colunas selecionadas
        for (const columnId of selectedColumnIds) {
          const response = await crmAPI.getContacts();
          const columnContacts = response.contacts.filter((c) => c.columnId === columnId);
          contactsToValidate.push(
            ...columnContacts.map((c) => ({
              phone: c.phone,
              name: c.name,
            }))
          );
        }
      }

      // Validar contatos
      const response = await dispatchAPI.validateContacts(selectedInstanceId, contactsToValidate);
      const validContacts = response.contacts.filter((c) => c.validated);

      // Armazenar estatísticas e contatos válidos
      setValidationStats(response.stats);
      setPendingValidContacts(
        validContacts.map((c) => ({
          phone: c.phone,
          name: c.name,
        }))
      );

      setIsValidating(false);

      // Se não houver contatos válidos, mostrar alerta
      if (validContacts.length === 0) {
        alert('Nenhum número válido encontrado');
        return false;
      }

      // Mostrar modal com estatísticas
      setShowValidationModal(true);
      return false; // Não prosseguir automaticamente, aguardar confirmação do modal
    } catch (error: any) {
      alert(error.message || 'Erro ao processar e validar contatos');
      setIsValidating(false);
      return false;
    }
  };

  // Salvar disparo
  const handleSave = async () => {
    if (!name || !selectedInstanceId || !selectedTemplateId) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }

    // Validar data de início (não pode ser no passado, mas pode ser hoje)
    if (hasSchedule && startDate) {
      const today = getTodayDateString();
      
      // Comparar strings de data (YYYY-MM-DD) - permite hoje ou futuro
      if (startDate < today) {
        alert(t('dispatchCreator.invalidStartDate'));
        return;
      }
    }

    // Na edição, não validar contatos (não podem ser alterados)
    if (!initialData) {
      if (contactsSource === 'list' && processedContacts.length === 0) {
        alert('Nenhum contato válido. Valide os contatos primeiro.');
        return;
      }

      if (contactsSource === 'kanban' && selectedColumnIds.length === 0) {
        alert('Selecione pelo menos uma coluna do Kanban');
        return;
      }
    }

    setIsLoading(true);
    try {
      // Na edição, não incluir contatos (não podem ser alterados)
      const dispatchData: CreateDispatchData = {
        instanceId: selectedInstanceId,
        templateId: selectedTemplateId,
        name,
        settings: {
          speed,
          autoDelete,
          deleteDelay: autoDelete ? deleteDelay : undefined,
          deleteDelayUnit: autoDelete ? deleteDelayUnit : undefined,
          showDispatchInChat: showDispatchInChat || undefined,
        },
        schedule: hasSchedule
          ? {
              startDate: startDate || undefined,
              startTime,
              endTime,
              suspendedDays,
              timezone: scheduleTimezone || undefined, // Se null, usar timezone do perfil no backend
            }
          : null,
        // Só incluir contatos se não estiver editando
        ...(!initialData ? {
          contactsSource,
          contactsData: contactsSource === 'list' ? processedContacts : undefined,
          columnIds: contactsSource === 'kanban' ? selectedColumnIds : undefined,
        } : {
          contactsSource: 'list', // Valor padrão para edição (não será usado)
        }),
        defaultName: defaultName || undefined,
      };

      await onSave(dispatchData);

      // Reset
      setName('');
      setSelectedInstanceId('');
      setSelectedTemplateId('');
      setContactsSource('list');
      setCsvFile(null);
      setInputText('');
      setSelectedColumnIds([]);
      setSpeed('normal');
      setAutoDelete(false);
      setDeleteDelay(0);
      setDeleteDelayUnit('seconds');
      setShowDispatchInChat(false);
      setDefaultName('Cliente');
      setHasSchedule(false);
      setStartTime('08:00');
      setEndTime('18:00');
      setSuspendedDays([]);
      setProcessedContacts([]);
      setStep('basic');
      onClose();
    } catch (error: any) {
      alert(error.message || 'Erro ao criar disparo');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSuspendedDay = (day: number) => {
    if (suspendedDays.includes(day)) {
      setSuspendedDays(suspendedDays.filter((d) => d !== day));
    } else {
      setSuspendedDays([...suspendedDays, day]);
    }
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={t('dispatchCreator.title')} size="xl">
      <div className="max-h-[80vh] overflow-y-auto">
        {/* Step Indicator */}
        <div className="flex gap-2 mb-6">
          {['basic', 'contacts', 'settings', 'schedule'].map((s, index) => (
            <div
              key={s}
              className={`flex-1 h-2 rounded ${
                step === s
                  ? 'bg-blue-600'
                  : ['basic', 'contacts', 'settings', 'schedule'].indexOf(step) > index
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Básico */}
        {step === 'basic' && (
          <div className="space-y-4">
            <Input
              label={t('dispatchCreator.dispatchName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dispatchCreator.dispatchNamePlaceholder')}
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('dispatchCreator.instance')} *
              </label>
              <select
                value={selectedInstanceId}
                onChange={(e) => setSelectedInstanceId(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
              >
                <option value="">{t('dispatchCreator.selectInstance')}</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('dispatchCreator.template')} *
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
              >
                <option value="">{t('dispatchCreator.selectTemplate')}</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={onClose}>
                {t('dispatchCreator.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => setStep('contacts')}
                disabled={!name || !selectedInstanceId || !selectedTemplateId}
              >
                {t('dispatchCreator.next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Contatos */}
        {step === 'contacts' && (
          <>
            {initialData && (
              <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  {t('dispatchCreator.editContactsWarning')}
                </p>
              </div>
            )}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('dispatchCreator.contactSource')}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    value="list"
                    checked={contactsSource === 'list'}
                    onChange={(e) => setContactsSource(e.target.value as 'list')}
                    disabled={!!initialData}
                    className="mr-2"
                  />
                  {t('dispatchCreator.contactList')}
                </label>
                <label className="flex items-center text-gray-700 dark:text-gray-300">
                  <input
                    type="radio"
                    value="kanban"
                    checked={contactsSource === 'kanban'}
                    onChange={(e) => setContactsSource(e.target.value as 'kanban')}
                    disabled={!!initialData}
                    className="mr-2"
                  />
                  {t('dispatchCreator.kanbanColumns')}
                </label>
              </div>
            </div>

            {contactsSource === 'list' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Upload de CSV
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCSVUpload}
                    disabled={!!initialData}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {csvFile && (
                    <p className="text-sm text-gray-600 dark:text-gray-200 mt-1">Arquivo: {csvFile.name}</p>
                  )}
                  {!csvFile && (
                    <p className="text-sm text-gray-600 dark:text-gray-200 mt-1">{t('dispatchCreator.noFileChosen')}</p>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('dispatchCreator.pasteContacts')}
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      // Limpar contatos processados quando o texto for modificado
                      // Isso permite que o usuário edite e reprocesse os contatos
                      if (processedContacts.length > 0) {
                        setProcessedContacts([]);
                      }
                    }}
                    disabled={!!initialData}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={6}
                    placeholder="Guilherme;5511999999999&#10;5511888888888&#10;João;5511777777777"
                  />
                </div>

                {processedContacts.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      {processedContacts.length} {t('dispatchCreator.contactsProcessed')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {contactsSource === 'kanban' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('dispatchCreator.selectColumns')}
                </label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {columns.map((column) => (
                    <label key={column.id} className="flex items-center p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer text-gray-900 dark:text-gray-100">
                      <input
                        type="checkbox"
                        checked={selectedColumnIds.includes(column.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedColumnIds([...selectedColumnIds, column.id]);
                          } else {
                            setSelectedColumnIds(selectedColumnIds.filter((id) => id !== column.id));
                          }
                        }}
                        className="mr-2"
                      />
                      {column.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setStep('basic')}>
                {t('dispatchCreator.back')}
              </Button>
              <Button 
                variant="primary" 
                onClick={async () => {
                  const success = await handleProcessAndValidateContacts();
                  if (success) {
                    setStep('settings');
                  }
                }}
                disabled={isValidating}
              >
                {isValidating ? t('dispatchCreator.processing') : t('dispatchCreator.next')}
              </Button>
            </div>
          </div>
          </>
        )}

        {/* Step 3: Configurações */}
        {step === 'settings' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('dispatchCreator.speed')}
              </label>
              <select
                value={speed}
                onChange={(e) => setSpeed(e.target.value as any)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
              >
                <option value="fast">{t('dispatchCreator.speedFast')}</option>
                <option value="normal">{t('dispatchCreator.speedNormal')}</option>
                <option value="slow">{t('dispatchCreator.speedSlow')}</option>
                <option value="randomized">{t('dispatchCreator.speedRandomized')}</option>
              </select>
            </div>

            <div>
              <label className="flex items-center text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showDispatchInChat}
                  onChange={(e) => setShowDispatchInChat(e.target.checked)}
                  className="mr-2"
                />
                {t('dispatchCreator.showInChat')}
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-6">
                {t('dispatchCreator.showInChatHint')}
              </p>
            </div>

            <div>
              <label className="flex items-center text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={autoDelete}
                  onChange={(e) => setAutoDelete(e.target.checked)}
                  className="mr-2"
                />
                {t('dispatchCreator.autoDelete')}
              </label>
            </div>

            {autoDelete && (
              <div className="grid grid-cols-2 gap-2 ml-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('dispatchCreator.deleteDelay')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={deleteDelay}
                    onChange={(e) => setDeleteDelay(parseInt(e.target.value) || 0)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('dispatchCreator.deleteDelayUnit')}
                  </label>
                  <select
                    value={deleteDelayUnit}
                    onChange={(e) => setDeleteDelayUnit(e.target.value as any)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  >
                    <option value="seconds">{t('dispatchCreator.seconds')}</option>
                    <option value="minutes">{t('dispatchCreator.minutes')}</option>
                    <option value="hours">{t('dispatchCreator.hours')}</option>
                  </select>
                </div>
              </div>
            )}

            <Input
              label={t('dispatchCreator.defaultName')}
              value={defaultName}
              onChange={(e) => setDefaultName(e.target.value)}
              placeholder={t('dispatchCreator.defaultNamePlaceholder')}
              helperText={t('dispatchCreator.defaultNameHelp')}
            />

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setStep('contacts')}>
                {t('dispatchCreator.back')}
              </Button>
              <Button variant="primary" onClick={() => setStep('schedule')}>
                {t('dispatchCreator.next')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Agendamento */}
        {step === 'schedule' && (
          <div className="space-y-4">
            <div>
              <label className="flex items-center text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={hasSchedule}
                  onChange={(e) => {
                    setHasSchedule(e.target.checked);
                    // Se ativando o agendamento e não tem data, preencher com hoje
                    if (e.target.checked && !startDate) {
                      setStartDate(getTodayDateString());
                    }
                  }}
                  className="mr-2"
                />
                {t('dispatchCreator.schedule')}
              </label>
            </div>

            {hasSchedule && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('dispatchCreator.startDate')} {t('dispatchCreator.optional')}
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      const selectedDate = e.target.value;
                      
                      // Permitir data de hoje ou futura
                      if (selectedDate) {
                        const today = getTodayDateString();
                        if (selectedDate < today) {
                          alert(t('dispatchCreator.invalidStartDate'));
                          setStartDate('');
                          return;
                        }
                      }
                      
                      setStartDate(selectedDate);
                    }}
                    min={getTodayDateString()}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('dispatchCreator.startDateHint')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('dispatchCreator.startTime')}
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('dispatchCreator.endTime')}
                    </label>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                    />
                  </div>
                </div>

                {/* Fuso Horário (Opcional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('dispatchCreator.timezone')} (Opcional)
                  </label>
                  <select
                    value={scheduleTimezone || ''}
                    onChange={(e) => setScheduleTimezone(e.target.value || null)}
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200"
                  >
                    <option value="">{t('dispatchCreator.useProfileTimezone')} ({user?.timezone || 'America/Sao_Paulo'})</option>
                    <option value="America/Sao_Paulo">Brasil (São Paulo) - GMT-3</option>
                    <option value="America/Manaus">Brasil (Manaus) - GMT-4</option>
                    <option value="America/Rio_Branco">Brasil (Rio Branco) - GMT-5</option>
                    <option value="America/New_York">EUA (Nova York) - GMT-5/-4</option>
                    <option value="America/Chicago">EUA (Chicago) - GMT-6/-5</option>
                    <option value="America/Los_Angeles">EUA (Los Angeles) - GMT-8/-7</option>
                    <option value="Europe/London">Reino Unido (Londres) - GMT+0/+1</option>
                    <option value="Europe/Paris">França (Paris) - GMT+1/+2</option>
                    <option value="Asia/Tokyo">Japão (Tóquio) - GMT+9</option>
                    <option value="Asia/Shanghai">China (Xangai) - GMT+8</option>
                    <option value="Australia/Sydney">Austrália (Sydney) - GMT+10/+11</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {t('dispatchCreator.timezoneHint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('dispatchCreator.suspendedDays')}
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const days = tArray('dispatchCreator.days');
                      return [
                        { value: 0, label: days[0] },
                        { value: 1, label: days[1] },
                        { value: 2, label: days[2] },
                        { value: 3, label: days[3] },
                        { value: 4, label: days[4] },
                        { value: 5, label: days[5] },
                        { value: 6, label: days[6] },
                      ];
                    })().map((day) => (
                      <button
                        key={day.value}
                        onClick={() => toggleSuspendedDay(day.value)}
                        className={`p-2 rounded-lg border ${
                          suspendedDays.includes(day.value)
                            ? 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300'
                            : 'bg-gray-50 dark:bg-[#091D41] border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setStep('settings')}>
                {t('dispatchCreator.back')}
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={isLoading}>
                {isLoading 
                  ? (initialData ? t('dispatchCreator.saving') : t('dispatchCreator.creating'))
                  : (initialData ? t('dispatchCreator.save') : t('dispatchCreator.create'))
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>

    {/* Modal de Validação de Contatos */}
    <Modal
      isOpen={showValidationModal}
      onClose={() => {
        setShowValidationModal(false);
        setValidationStats(null);
        setPendingValidContacts([]);
      }}
      title={t('dispatchCreator.validationResults')}
    >
      {validationStats && (
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 dark:bg-[#091D41] rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {validationStats.total}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dispatchCreator.totalProcessed')}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {validationStats.valid}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dispatchCreator.validContacts')}
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {validationStats.invalid}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('dispatchCreator.invalidContacts')}
                </p>
              </div>
            </div>
          </div>

          {validationStats.valid > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {t('dispatchCreator.validationContinueMessage')}
            </p>
          )}

          {validationStats.valid === 0 && (
            <p className="text-sm text-red-600 dark:text-red-400 text-center font-medium">
              {t('dispatchCreator.validationNoValidContacts')}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowValidationModal(false);
                setValidationStats(null);
                setPendingValidContacts([]);
              }}
            >
              {t('dispatchCreator.cancel')}
            </Button>
            {validationStats.valid > 0 && (
              <Button
                variant="primary"
                onClick={() => {
                  // Salvar contatos válidos e prosseguir
                  setProcessedContacts(pendingValidContacts);
                  setShowValidationModal(false);
                  setValidationStats(null);
                  setPendingValidContacts([]);
                  setStep('settings');
                }}
              >
                {t('dispatchCreator.continue')}
              </Button>
            )}
          </div>
        </div>
      )}
    </Modal>
    </>
  );
};

export default DispatchCreator;

