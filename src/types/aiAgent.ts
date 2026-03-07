/**
 * Tipos para Agente de IA
 */

export interface AssistedConfig {
  // 1. Empresa
  companyName?: string;
  businessDescription?: string;
  marketTime?: string;
  tone?: 'formal' | 'informal';
  excludedClientTypes?: string;

  // 2. Produtos
  products?: Array<{
    name?: string;
    type?: 'físico' | 'digital' | 'serviço';
    isMain?: boolean;
    shortDescription?: string;
    benefits?: string;
    problemSolved?: string;
    price?: string;
    priceType?: 'fixo' | 'negociável';
    displayType?: 'exato' | 'a partir de';
    hasDiscount?: boolean;
    discountConditions?: string;
    hasCombo?: boolean;
    specialConditions?: string;
    minMargin?: string;
    objectionExpensive?: string;
    objectionThinking?: string;
    objectionComparing?: string;
    cannotPromise?: string;
    cannotSay?: string;
    requiresHuman?: string;
  }>;

  // 3. Público-Alvo
  idealClient?: string;
  clientArrivesDecided?: boolean;
  mainPains?: string;
  problemsSolved?: string;
  comparisonWithCompetitors?: string;

  // 4. Objeções
  commonObjections?: string;
  humanResponses?: string;
  objectionsNotToOvercome?: string;
  insistenceLevel?: string;

  // 5. Valores e Negociação
  canNegotiate?: boolean;
  minMargin?: string;
  variableConditions?: string;
  responseToExpensive?: string;

  // 6. Tom e Personalidade
  style?: 'direto' | 'consultivo' | 'amigável';
  language?: 'simples' | 'técnica';
  useEmojis?: boolean;
  posture?: 'vendedor' | 'consultor';
  useExamples?: boolean;

  // 7. Limites do Agente
  canTalkAboutCompetitors?: boolean;
  canPromiseDeadlines?: boolean;
  forbiddenPhrases?: string;
  whenToEscalate?: string;
  whenToEndConversation?: string;

  // 8. Fluxo da Conversa
  openingForm?: string;
  askNeedOrWait?: boolean;
  canSuggestProducts?: boolean;
  nextStepAfterPrice?: string;
  closingForm?: string;

  // 9. Informações Permitidas
  paymentMethods?: string;
  averageDeadlines?: string;
  returnPolicy?: string;
  mandatoryText?: string;
  identifyAsAI?: boolean;

  // 10. Sucesso do Agente
  successCriteria?: string;
  expectedClientBehavior?: string;
  priority?: 'fechamento' | 'esclarecimento';
  canAskConfirmation?: boolean;
  perfectConversation?: string;
}

