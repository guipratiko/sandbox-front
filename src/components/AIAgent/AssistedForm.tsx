import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { aiAgentAPI } from '../../services/api';
import type { AgentMedia } from '../../services/api';
import { Button } from '../UI';
import { getErrorMessage } from '../../utils/errorHandler';
import type { AssistedConfig } from '../../types/aiAgent';

interface AssistedFormProps {
  config: AssistedConfig;
  onChange: (config: AssistedConfig) => void;
  /** Quando no passo 11 (mídias), usar este id para carregar/enviar mídias. */
  agentId?: string;
  /** Chamado ao avançar do passo 10 para o 11. Pode criar o agente e retornar o id para o passo de mídias. */
  onBeforeStep11?: () => Promise<string | void>;
}

const AssistedForm: React.FC<AssistedFormProps> = ({ config, onChange, agentId, onBeforeStep11 }) => {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 11;
  const [step11AgentId, setStep11AgentId] = useState<string | null>(null);
  const [agentMedia, setAgentMedia] = useState<AgentMedia[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaMaxUses, setMediaMaxUses] = useState(1);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const agentIdForStep11 = step11AgentId || agentId;

  const updateConfig = (path: string, value: any) => {
    const newConfig = { ...config };
    const keys = path.split('.');
    let current: any = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    onChange(newConfig);
  };

  const addProduct = () => {
    const products = config.products || [];
    onChange({ ...config, products: [...products, {}] });
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const products = [...(config.products || [])];
    products[index] = { ...products[index], [field]: value };
    onChange({ ...config, products });
  };

  const removeProduct = (index: number) => {
    const products = [...(config.products || [])];
    products.splice(index, 1);
    onChange({ ...config, products });
  };

  const loadStep11Media = useCallback(async (id: string) => {
    try {
      const res = await aiAgentAPI.getMedia(id);
      setAgentMedia(res.media || []);
    } catch {
      setAgentMedia([]);
    }
  }, []);

  useEffect(() => {
    if (currentStep === 11 && agentIdForStep11) loadStep11Media(agentIdForStep11);
  }, [currentStep, agentIdForStep11, loadStep11Media]);

  const handleStep11AddMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!agentIdForStep11 || !file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (mediaCaption.trim()) formData.append('caption', mediaCaption.trim());
    formData.append('maxUsesPerContact', String(mediaMaxUses));
    try {
      setUploadingMedia(true);
      const res = await aiAgentAPI.addMedia(agentIdForStep11, formData);
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

  const handleStep11DeleteMedia = async (mediaId: string) => {
    if (!agentIdForStep11) return;
    try {
      await aiAgentAPI.deleteMedia(agentIdForStep11, mediaId);
      setAgentMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } catch (err: unknown) {
      alert(getErrorMessage(err, t('aiAgent.media.deleteError')));
    }
  };

  const nextStep = async () => {
    if (currentStep < totalSteps) {
      if (currentStep === 10 && onBeforeStep11) {
        const newId = await onBeforeStep11();
        if (newId) setStep11AgentId(newId);
        setCurrentStep(11);
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step1.title')}</h3>
            <div className="space-y-4">
              <Input
                label={t('aiAgent.assisted.step1.companyName')}
                value={config.companyName || ''}
                onChange={(e) => updateConfig('companyName', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step1.businessDescription')}
                value={config.businessDescription || ''}
                onChange={(e) => updateConfig('businessDescription', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step1.marketTime')}
                value={config.marketTime || ''}
                onChange={(e) => updateConfig('marketTime', e.target.value)}
                placeholder={t('aiAgent.assisted.step1.marketTimePlaceholder')}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiAgent.assisted.step1.tone')}
                </label>
                <select
                  value={config.tone || 'informal'}
                  onChange={(e) => updateConfig('tone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                >
                  <option value="formal">{t('aiAgent.assisted.step1.toneFormal')}</option>
                  <option value="informal">{t('aiAgent.assisted.step1.toneInformal')}</option>
                </select>
              </div>
              <Input
                label={t('aiAgent.assisted.step1.excludedClientTypes')}
                value={config.excludedClientTypes || ''}
                onChange={(e) => updateConfig('excludedClientTypes', e.target.value)}
                placeholder={t('aiAgent.assisted.step1.excludedClientTypesPlaceholder')}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step2.title')}</h3>
              <button
                onClick={addProduct}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t('aiAgent.assisted.step2.addProduct')}
              </button>
            </div>
            {(config.products || []).map((product: any, index: number) => (
              <div key={index} className="mb-4 p-4 bg-gray-50 dark:bg-[#091D41] rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step2.product', { index: (index + 1).toString() })}</h4>
                  <button
                    onClick={() => removeProduct(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    {t('aiAgent.assisted.step2.remove')}
                  </button>
                </div>
                <div className="space-y-3">
                  <Input
                    label={t('aiAgent.assisted.step2.productName')}
                    value={product.name || ''}
                    onChange={(e) => updateProduct(index, 'name', e.target.value)}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('aiAgent.assisted.step2.type')}
                    </label>
                    <select
                      value={product.type || ''}
                      onChange={(e) => updateProduct(index, 'type', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                    >
                      <option value="">{t('aiAgent.assisted.step2.select')}</option>
                      <option value="físico">{t('aiAgent.assisted.step2.typePhysical')}</option>
                      <option value="digital">{t('aiAgent.assisted.step2.typeDigital')}</option>
                      <option value="serviço">{t('aiAgent.assisted.step2.typeService')}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={product.isMain || false}
                      onChange={(e) => updateProduct(index, 'isMain', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step2.isMain')}</label>
                  </div>
                  <Input
                    label={t('aiAgent.assisted.step2.shortDescription')}
                    value={product.shortDescription || ''}
                    onChange={(e) => updateProduct(index, 'shortDescription', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.benefits')}
                    value={product.benefits || ''}
                    onChange={(e) => updateProduct(index, 'benefits', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.problemSolved')}
                    value={product.problemSolved || ''}
                    onChange={(e) => updateProduct(index, 'problemSolved', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.price')}
                    value={product.price || ''}
                    onChange={(e) => updateProduct(index, 'price', e.target.value)}
                    placeholder={t('aiAgent.assisted.step2.pricePlaceholder')}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('aiAgent.assisted.step2.priceType')}
                    </label>
                    <select
                      value={product.priceType || ''}
                      onChange={(e) => updateProduct(index, 'priceType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                    >
                      <option value="">{t('aiAgent.assisted.step2.select')}</option>
                      <option value="fixo">{t('aiAgent.assisted.step2.priceTypeFixed')}</option>
                      <option value="negociável">{t('aiAgent.assisted.step2.priceTypeNegotiable')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('aiAgent.assisted.step2.displayType')}
                    </label>
                    <select
                      value={product.displayType || ''}
                      onChange={(e) => updateProduct(index, 'displayType', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                    >
                      <option value="">{t('aiAgent.assisted.step2.select')}</option>
                      <option value="exato">{t('aiAgent.assisted.step2.displayTypeExact')}</option>
                      <option value="a partir de">{t('aiAgent.assisted.step2.displayTypeFrom')}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={product.hasDiscount || false}
                      onChange={(e) => updateProduct(index, 'hasDiscount', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step2.hasDiscount')}</label>
                  </div>
                  {product.hasDiscount && (
                    <Input
                      label={t('aiAgent.assisted.step2.discountConditions')}
                      value={product.discountConditions || ''}
                      onChange={(e) => updateProduct(index, 'discountConditions', e.target.value)}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={product.hasCombo || false}
                      onChange={(e) => updateProduct(index, 'hasCombo', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step2.hasCombo')}</label>
                  </div>
                  {product.hasCombo && (
                    <Input
                      label={t('aiAgent.assisted.step2.specialConditions')}
                      value={product.specialConditions || ''}
                      onChange={(e) => updateProduct(index, 'specialConditions', e.target.value)}
                    />
                  )}
                  <Input
                    label={t('aiAgent.assisted.step2.minMargin')}
                    value={product.minMargin || ''}
                    onChange={(e) => updateProduct(index, 'minMargin', e.target.value)}
                    placeholder={t('aiAgent.assisted.step2.minMarginPlaceholder')}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.objectionExpensive')}
                    value={product.objectionExpensive || ''}
                    onChange={(e) => updateProduct(index, 'objectionExpensive', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.objectionThinking')}
                    value={product.objectionThinking || ''}
                    onChange={(e) => updateProduct(index, 'objectionThinking', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.objectionComparing')}
                    value={product.objectionComparing || ''}
                    onChange={(e) => updateProduct(index, 'objectionComparing', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.cannotPromise')}
                    value={product.cannotPromise || ''}
                    onChange={(e) => updateProduct(index, 'cannotPromise', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.cannotSay')}
                    value={product.cannotSay || ''}
                    onChange={(e) => updateProduct(index, 'cannotSay', e.target.value)}
                  />
                  <Input
                    label={t('aiAgent.assisted.step2.requiresHuman')}
                    value={product.requiresHuman || ''}
                    onChange={(e) => updateProduct(index, 'requiresHuman', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        );

      case 3:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step3.title')}</h3>
            <div className="space-y-4">
              <Input
                label={t('aiAgent.assisted.step3.idealClient')}
                value={config.idealClient || ''}
                onChange={(e) => updateConfig('idealClient', e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiAgent.assisted.step3.clientArrives')}
                </label>
                <select
                  value={config.clientArrivesDecided ? 'true' : 'false'}
                  onChange={(e) => updateConfig('clientArrivesDecided', e.target.value === 'true')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                >
                  <option value="false">{t('aiAgent.assisted.step3.clientArrivesDoubtful')}</option>
                  <option value="true">{t('aiAgent.assisted.step3.clientArrivesDecided')}</option>
                </select>
              </div>
              <Input
                label={t('aiAgent.assisted.step3.mainPains')}
                value={config.mainPains || ''}
                onChange={(e) => updateConfig('mainPains', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step3.problemsSolved')}
                value={config.problemsSolved || ''}
                onChange={(e) => updateConfig('problemsSolved', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step3.comparisonWithCompetitors')}
                value={config.comparisonWithCompetitors || ''}
                onChange={(e) => updateConfig('comparisonWithCompetitors', e.target.value)}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step4.title')}</h3>
            <div className="space-y-4">
              <Input
                label={t('aiAgent.assisted.step4.commonObjections')}
                value={config.commonObjections || ''}
                onChange={(e) => updateConfig('commonObjections', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step4.humanResponses')}
                value={config.humanResponses || ''}
                onChange={(e) => updateConfig('humanResponses', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step4.objectionsNotToOvercome')}
                value={config.objectionsNotToOvercome || ''}
                onChange={(e) => updateConfig('objectionsNotToOvercome', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step4.insistenceLevel')}
                value={config.insistenceLevel || ''}
                onChange={(e) => updateConfig('insistenceLevel', e.target.value)}
                placeholder={t('aiAgent.assisted.step4.insistenceLevelPlaceholder')}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step5.title')}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.canNegotiate || false}
                  onChange={(e) => updateConfig('canNegotiate', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step5.canNegotiate')}</label>
              </div>
              <Input
                label={t('aiAgent.assisted.step5.minMargin')}
                value={config.minMargin || ''}
                onChange={(e) => updateConfig('minMargin', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step5.variableConditions')}
                value={config.variableConditions || ''}
                onChange={(e) => updateConfig('variableConditions', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step5.responseToExpensive')}
                value={config.responseToExpensive || ''}
                onChange={(e) => updateConfig('responseToExpensive', e.target.value)}
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step6.title')}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiAgent.assisted.step6.style')}
                </label>
                <select
                  value={config.style || ''}
                  onChange={(e) => updateConfig('style', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                >
                  <option value="">{t('aiAgent.assisted.step2.select')}</option>
                  <option value="direto">{t('aiAgent.assisted.step6.styleDirect')}</option>
                  <option value="consultivo">{t('aiAgent.assisted.step6.styleConsultive')}</option>
                  <option value="amigável">{t('aiAgent.assisted.step6.styleFriendly')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiAgent.assisted.step6.language')}
                </label>
                <select
                  value={config.language || ''}
                  onChange={(e) => updateConfig('language', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                >
                  <option value="">{t('aiAgent.assisted.step2.select')}</option>
                  <option value="simples">{t('aiAgent.assisted.step6.languageSimple')}</option>
                  <option value="técnica">{t('aiAgent.assisted.step6.languageTechnical')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.useEmojis || false}
                  onChange={(e) => updateConfig('useEmojis', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step6.useEmojis')}</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiAgent.assisted.step6.posture')}
                </label>
                <select
                  value={config.posture || ''}
                  onChange={(e) => updateConfig('posture', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                >
                  <option value="">{t('aiAgent.assisted.step2.select')}</option>
                  <option value="vendedor">{t('aiAgent.assisted.step6.postureSeller')}</option>
                  <option value="consultor">{t('aiAgent.assisted.step6.postureConsultant')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.useExamples || false}
                  onChange={(e) => updateConfig('useExamples', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step6.useExamples')}</label>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step7.title')}</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.canTalkAboutCompetitors || false}
                  onChange={(e) => updateConfig('canTalkAboutCompetitors', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step7.canTalkAboutCompetitors')}</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.canPromiseDeadlines || false}
                  onChange={(e) => updateConfig('canPromiseDeadlines', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step7.canPromiseDeadlines')}</label>
              </div>
              <Input
                label={t('aiAgent.assisted.step7.forbiddenPhrases')}
                value={config.forbiddenPhrases || ''}
                onChange={(e) => updateConfig('forbiddenPhrases', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step7.whenToEscalate')}
                value={config.whenToEscalate || ''}
                onChange={(e) => updateConfig('whenToEscalate', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step7.whenToEndConversation')}
                value={config.whenToEndConversation || ''}
                onChange={(e) => updateConfig('whenToEndConversation', e.target.value)}
              />
            </div>
          </div>
        );

      case 8:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step8.title')}</h3>
            <div className="space-y-4">
              <Input
                label={t('aiAgent.assisted.step8.openingForm')}
                value={config.openingForm || ''}
                onChange={(e) => updateConfig('openingForm', e.target.value)}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.askNeedOrWait || false}
                  onChange={(e) => updateConfig('askNeedOrWait', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step8.askNeedOrWait')}</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.canSuggestProducts || false}
                  onChange={(e) => updateConfig('canSuggestProducts', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step8.canSuggestProducts')}</label>
              </div>
              <Input
                label={t('aiAgent.assisted.step8.nextStepAfterPrice')}
                value={config.nextStepAfterPrice || ''}
                onChange={(e) => updateConfig('nextStepAfterPrice', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step8.closingForm')}
                value={config.closingForm || ''}
                onChange={(e) => updateConfig('closingForm', e.target.value)}
              />
            </div>
          </div>
        );

      case 9:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step9.title')}</h3>
            <div className="space-y-4">
              <Input
                label={t('aiAgent.assisted.step9.paymentMethods')}
                value={config.paymentMethods || ''}
                onChange={(e) => updateConfig('paymentMethods', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step9.averageDeadlines')}
                value={config.averageDeadlines || ''}
                onChange={(e) => updateConfig('averageDeadlines', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step9.returnPolicy')}
                value={config.returnPolicy || ''}
                onChange={(e) => updateConfig('returnPolicy', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step9.mandatoryText')}
                value={config.mandatoryText || ''}
                onChange={(e) => updateConfig('mandatoryText', e.target.value)}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.identifyAsAI || false}
                  onChange={(e) => updateConfig('identifyAsAI', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step9.identifyAsAI')}</label>
              </div>
            </div>
          </div>
        );

      case 10:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">{t('aiAgent.assisted.step10.title')}</h3>
            <div className="space-y-4">
              <Input
                label={t('aiAgent.assisted.step10.successCriteria')}
                value={config.successCriteria || ''}
                onChange={(e) => updateConfig('successCriteria', e.target.value)}
              />
              <Input
                label={t('aiAgent.assisted.step10.expectedClientBehavior')}
                value={config.expectedClientBehavior || ''}
                onChange={(e) => updateConfig('expectedClientBehavior', e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('aiAgent.assisted.step10.priority')}
                </label>
                <select
                  value={config.priority || ''}
                  onChange={(e) => updateConfig('priority', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
                >
                  <option value="">{t('aiAgent.assisted.step2.select')}</option>
                  <option value="fechamento">{t('aiAgent.assisted.step10.priorityClosing')}</option>
                  <option value="esclarecimento">{t('aiAgent.assisted.step10.priorityClarification')}</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.canAskConfirmation || false}
                  onChange={(e) => updateConfig('canAskConfirmation', e.target.checked)}
                  className="w-4 h-4"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">{t('aiAgent.assisted.step10.canAskConfirmation')}</label>
              </div>
              <Input
                label={t('aiAgent.assisted.step10.perfectConversation')}
                value={config.perfectConversation || ''}
                onChange={(e) => updateConfig('perfectConversation', e.target.value)}
              />
            </div>
          </div>
        );

      case 11:
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-4 text-clerky-backendText dark:text-gray-200">
              {t('aiAgent.assisted.step11.title')}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {t('aiAgent.assisted.step11.helper')}
            </p>
            {agentIdForStep11 ? (
              <>
                <div className="flex flex-wrap items-end gap-2 mb-3">
                  <input
                    ref={mediaFileInputRef}
                    type="file"
                    accept="image/*,video/*,.pdf,.doc,.docx,.mp3,audio/mpeg,audio/mp3"
                    onChange={handleStep11AddMedia}
                    disabled={uploadingMedia}
                    className="text-sm text-gray-600 dark:text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:bg-clerky-backendButton file:text-white"
                  />
                  <input
                    type="text"
                    placeholder={t('aiAgent.media.captionPlaceholder')}
                    value={mediaCaption}
                    onChange={(e) => setMediaCaption(e.target.value)}
                    className="flex-1 min-w-[120px] px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f2744] text-sm text-clerky-backendText dark:text-gray-200"
                  />
                  <label className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                    {t('aiAgent.media.maxUses')}
                    <input
                      type="number"
                      min={1}
                      value={mediaMaxUses}
                      onChange={(e) => setMediaMaxUses(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-14 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-[#0f2744] text-center text-clerky-backendText dark:text-gray-200"
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
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleStep11DeleteMedia(m.id)}>
                          {t('aiAgent.media.delete')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('aiAgent.assisted.step11.noAgent')}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Indicador de progresso */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('aiAgent.assisted.step', { current: currentStep.toString(), total: totalSteps.toString() })}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-clerky-backendButton h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo da etapa atual */}
      <div className="min-h-[400px]">
        {renderStep()}
      </div>

      {/* Botões de navegação */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            currentStep === 1
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {t('aiAgent.assisted.previous')}
        </button>
        <button
          onClick={nextStep}
          disabled={currentStep === totalSteps}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            currentStep === totalSteps
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'bg-clerky-backendButton text-white hover:opacity-90'
          }`}
        >
          {currentStep === totalSteps ? t('aiAgent.assisted.finished') : t('aiAgent.assisted.next')}
        </button>
      </div>
    </div>
  );
};

// Componente Input auxiliar
const Input: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  type?: string;
}> = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {label}
    </label>
    {type === 'textarea' ? (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
        rows={3}
      />
    ) : (
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-clerky-backendText dark:text-gray-200"
      />
    )}
  </div>
);

export default AssistedForm;
