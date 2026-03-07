import React, { useState, useEffect, useRef } from 'react';
import { Button, Input } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { workflowAPI } from '../../services/api';
import { WorkflowNode } from '../../services/api';
import { Node } from '@xyflow/react';

interface WebhookTriggerSettingsProps {
  node: Node | WorkflowNode;
  onUpdate: (data: any) => void;
  onDelete: () => void;
}

export const WebhookTriggerSettings: React.FC<WebhookTriggerSettingsProps> = ({
  node,
  onUpdate,
  onDelete,
}) => {
  const { t } = useLanguage();
  // Garantir que node tem o tipo correto
  const workflowNode = node as WorkflowNode;
  const webhookData = workflowNode.data as {
    webhookUrl?: string;
    workflowId?: string;
    selectedFields?: string[];
    phoneField?: string;
    nameField?: string;
    lastWebhookData?: any;
    listening?: boolean;
    listenExpiresAt?: string;
  };

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4331/api';
  const webhookUrl = webhookData.webhookUrl || `${API_URL}/workflows/webhook/${workflowNode.id}`;

  const [isListening, setIsListening] = useState(webhookData.listening || false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [webhookReceived, setWebhookReceived] = useState<any>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>(webhookData.selectedFields || []);
  const [phoneField, setPhoneField] = useState<string>(webhookData.phoneField || '');
  const [nameField, setNameField] = useState<string>(webhookData.nameField || '');
  const [webhookBody, setWebhookBody] = useState<any>(null);

  // Usar refs para armazenar os intervalos
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const expiresAtRef = useRef<Date | null>(null);

  // Limpar intervalos quando componente desmontar ou quando isListening mudar
  useEffect(() => {
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Função para limpar intervalos
  const clearIntervals = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Função para iniciar escuta
  const startListening = async () => {
    // Limpar intervalos anteriores se existirem
    clearIntervals();

    setIsListening(true);
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutos
    expiresAtRef.current = expiresAt;
    onUpdate({ listening: true, listenExpiresAt: expiresAt.toISOString() });

    // Polling para verificar se webhook foi recebido
    checkIntervalRef.current = setInterval(async () => {
      try {
        const response = await workflowAPI.checkWebhookReceived(workflowNode.id);
        if (response.received && response.data) {
          clearIntervals();
          setIsListening(false);
          setTimeRemaining(null);
          setWebhookReceived(response.data);
          setWebhookBody(response.data);
          onUpdate({ listening: false, lastWebhookData: response.data });
        }
      } catch (error) {
        console.error('Erro ao verificar webhook:', error);
      }
    }, 2000); // Verificar a cada 2 segundos

    // Timer de 3 minutos
    timerRef.current = setInterval(() => {
      if (!expiresAtRef.current) return;
      
      const now = new Date();
      const diff = expiresAtRef.current.getTime() - now.getTime();

      if (diff <= 0) {
        clearIntervals();
        setIsListening(false);
        setTimeRemaining(null);
        onUpdate({ listening: false });
      } else {
        setTimeRemaining(Math.floor(diff / 1000));
      }
    }, 1000);
  };

  // Função para obter todos os campos de um objeto (recursivo)
  const getAllFields = (obj: any, prefix = ''): string[] => {
    const fields: string[] = [];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        fields.push(fullKey);
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          fields.push(...getAllFields(obj[key], fullKey));
        }
      }
    }
    return fields;
  };

  // Obter campos disponíveis do webhook recebido
  const availableFields = webhookBody ? getAllFields(webhookBody) : [];

  // Função para salvar mapeamento
  const saveMapping = () => {
    onUpdate({
      selectedFields,
      phoneField: phoneField || undefined,
      nameField: nameField || undefined,
      lastWebhookData: webhookBody,
    });
  };

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

  return (
    <div className="space-y-4">
      <DeleteButton />

      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('mindFlow.nodeSettings.webhookUrl')}
          </label>
        </div>
        <div className="flex gap-2">
          <Input value={webhookUrl} readOnly className="flex-1" />
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
          Use esta URL para receber webhooks de qualquer plataforma
        </p>
      </div>

      {!webhookReceived && !isListening && (
        <div>
          <Button onClick={startListening} className="w-full" variant="primary">
            🎧 Escutar Webhook
          </Button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Clique para aguardar um webhook por até 3 minutos
          </p>
        </div>
      )}

      {isListening && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Aguardando webhook...
            </p>
          </div>
          {timeRemaining !== null && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Tempo restante: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
            </p>
          )}
          <Button
            onClick={() => {
              clearIntervals();
              setIsListening(false);
              setTimeRemaining(null);
              onUpdate({ listening: false });
            }}
            variant="outline"
            size="sm"
            className="mt-2"
          >
            Cancelar
          </Button>
        </div>
      )}

      {webhookReceived && (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
              ✅ Webhook recebido!
            </p>
            <details className="text-xs">
              <summary className="cursor-pointer text-green-600 dark:text-green-400 mb-2">
                Ver dados recebidos
              </summary>
              <pre className="mt-2 p-2 bg-white dark:bg-[#091D41] rounded overflow-auto max-h-40 text-xs">
                {JSON.stringify(webhookBody, null, 2)}
              </pre>
            </details>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Selecione os campos que deseja usar como variáveis
            </label>
            <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded p-2">
              {availableFields.length > 0 ? (
                availableFields.map((field) => (
                  <label
                    key={field}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFields([...selectedFields, field]);
                        } else {
                          setSelectedFields(selectedFields.filter((f) => f !== field));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{field}</span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-gray-500 dark:text-gray-400 p-2">
                  Nenhum campo encontrado no webhook
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Campo de nome (opcional)
            </label>
            <select
              value={nameField}
              onChange={(e) => setNameField(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            >
              <option value="">Nenhum</option>
              {availableFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Selecione o campo que contém o nome (se houver)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Campo de telefone (opcional)
            </label>
            <select
              value={phoneField}
              onChange={(e) => setPhoneField(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
            >
              <option value="">Nenhum</option>
              {availableFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Selecione o campo que contém o número de telefone (se houver)
            </p>
          </div>

          <Button onClick={saveMapping} className="w-full" variant="primary">
            Salvar Mapeamento
          </Button>

          <Button
            onClick={async () => {
              await workflowAPI.consumeWebhook(workflowNode.id);
              setWebhookReceived(null);
              setWebhookBody(null);
              setIsListening(false);
              onUpdate({ listening: false, lastWebhookData: null });
            }}
            variant="outline"
            className="w-full"
          >
            Limpar e Escutar Novamente
          </Button>
        </div>
      )}
    </div>
  );
};
