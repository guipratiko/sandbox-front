import type { AssistedConfig } from '../types/aiAgent';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4331/api';
const MINDLERKY_API_URL = process.env.REACT_APP_MINDLERKY_URL || 'http://localhost:4333/api';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  cpf: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  profilePicture?: string | null;
  companyName?: string | null;
  phone?: string | null;
  timezone?: string;
  premiumPlan?: 'free' | 'start' | 'advance' | 'pro';
  maxWhatsAppInstances?: number;
  maxInstagramInstances?: number;
  admin?: boolean;
  cpf?: string;
}

export interface AuthResponse {
  status: string;
  token?: string;
  user: User;
  message?: string;
}

export interface UpdateProfileData {
  name?: string;
  profilePicture?: string | null;
  companyName?: string | null;
  phone?: string | null;
  timezone?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface ResetPasswordData {
  token: string;
  password: string;
}

export interface DeleteAccountData {
  password: string;
}

export interface ApiError {
  status: string;
  message: string;
}

// Instâncias
export interface Instance {
  id: string;
  name: string; // Nome escolhido pelo usuário
  instanceName: string; // Nome interno gerado automaticamente
  instanceId?: string | null;
  token?: string; // Token para API externa
  qrcode: boolean;
  qrcodeBase64?: string | null;
  status: 'created' | 'connecting' | 'connected' | 'disconnected' | 'error';
  integration: string;
  webhook: {
    url: string;
    events: string[];
  };
  settings: {
    rejectCall: boolean;
    groupsIgnore: boolean;
    alwaysOnline: boolean;
    readMessages: boolean;
    readStatus: boolean;
    syncFullHistory: boolean;
  };
  phone_number_id?: string | null;
  display_phone_number?: string | null;
  connectionLink?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfficialInstanceData {
  name: string;
  code?: string;
  redirect_uri?: string;
  waba_id: string;
  phone_number_id: string;
}

export interface CreateInstanceData {
  name: string; // Nome escolhido pelo usuário
  rejectCall?: boolean;
  groupsIgnore?: boolean;
  alwaysOnline?: boolean;
  readMessages?: boolean;
  readStatus?: boolean;
}

export interface UpdateInstanceSettingsData {
  rejectCall?: boolean;
  groupsIgnore?: boolean;
  alwaysOnline?: boolean;
  readMessages?: boolean;
  readStatus?: boolean;
  syncFullHistory?: boolean;
}

export interface CreateInstanceResponse {
  status: string;
  message: string;
  instance: Instance;
}

export interface GetInstancesResponse {
  status: string;
  count: number;
  instances: Instance[];
}

export interface GetInstanceResponse {
  status: string;
  instance: Instance;
}

export interface UpdateInstanceSettingsResponse {
  status: string;
  message: string;
  instance: {
    id: string;
    instanceName: string;
    settings: Instance['settings'];
  };
}

export interface DeleteInstanceResponse {
  status: string;
  message: string;
}


// Função auxiliar para fazer requisições
export const request = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem('token');
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    let response: Response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, config);
    } catch (fetchError: any) {
      // Se o fetch falhar completamente (servidor parado), é um erro de rede
      const networkError: ApiError = {
        status: 'error',
        message: 'Serviço temporariamente indisponível',
      };
      throw networkError;
    }
    
    // Se não conseguir fazer a requisição (servidor parado, erro de rede)
    if (!response.ok) {
      // Se for status 503 (Service Unavailable) ou 502 (Bad Gateway), é serviço indisponível
      if (response.status === 503 || response.status === 502 || response.status === 504) {
        const error: ApiError = {
          status: 'error',
          message: 'Serviço temporariamente indisponível',
        };
        throw error;
      }
      
      let data: any;
      try {
        data = await response.json();
      } catch {
        // Se não conseguir parsear JSON, pode ser erro de conexão
        const error: ApiError = {
          status: 'error',
          message: 'Serviço temporariamente indisponível',
        };
        throw error;
      }

      const error: ApiError = {
        status: data.status || 'error',
        message: data.message || 'Erro ao processar requisição. Tente novamente.',
      };
      throw error;
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    // Se o erro já for um ApiError com mensagem de serviço indisponível, re-lançar
    if (error.status && error.message === 'Serviço temporariamente indisponível') {
      throw error;
    }
    
    // Se for erro de rede (servidor parado, CORS, etc)
    // Verificar vários tipos de erros de rede
    const isNetworkError = 
      error instanceof TypeError ||
      error instanceof DOMException ||
      error?.name === 'NetworkError' ||
      error?.name === 'TypeError' ||
      error?.message?.includes('fetch') ||
      error?.message?.includes('Failed to fetch') ||
      error?.message?.includes('NetworkError') ||
      error?.message?.includes('Network request failed') ||
      error?.message?.includes('ERR_INTERNET_DISCONNECTED') ||
      error?.message?.includes('ERR_CONNECTION_REFUSED') ||
      error?.message?.includes('ERR_CONNECTION_RESET') ||
      error?.message?.includes('ERR_CONNECTION_CLOSED') ||
      error?.message?.includes('ERR_CONNECTION_TIMED_OUT') ||
      (!error?.status && !error?.message); // Erro sem estrutura pode ser erro de rede
    
    if (isNetworkError) {
      const networkError: ApiError = {
        status: 'error',
        message: 'Serviço temporariamente indisponível',
      };
      throw networkError;
    }
    
    // Se o erro já for um ApiError, re-lançar
    if (error.status && error.message) {
      throw error;
    }
    
    // Para outros erros, criar um ApiError
    const apiError: ApiError = {
      status: 'error',
      message: error.message || 'Erro ao processar requisição. Tente novamente.',
    };
    throw apiError;
  }
};

// Função auxiliar para fazer requisições ao MindClerky
const requestMindClerky = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const token = localStorage.getItem('token');
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    let response: Response;
    try {
      response = await fetch(`${MINDLERKY_API_URL}${endpoint}`, config);
    } catch (fetchError: any) {
      // Se o fetch falhar completamente (servidor parado), é um erro de rede
      const networkError: ApiError = {
        status: 'error',
        message: 'Serviço MindFlow temporariamente indisponível',
      };
      throw networkError;
    }

    // Se a resposta não for ok, tentar parsear JSON
  if (!response.ok) {
      // Se for status 503 (Service Unavailable) ou 502 (Bad Gateway), é serviço indisponível
      if (response.status === 503 || response.status === 502 || response.status === 504 || response.status === 0) {
        const error: ApiError = {
          status: 'error',
          message: 'Serviço temporariamente indisponível',
        };
        throw error;
      }
      
      let data: any;
      try {
        data = await response.json();
      } catch {
        // Se não conseguir parsear JSON, pode ser erro de conexão
        const error: ApiError = {
          status: 'error',
          message: 'Serviço temporariamente indisponível',
        };
        throw error;
      }

    const error: ApiError = {
      status: data.status || 'error',
      message: data.message || 'Erro ao processar requisição. Tente novamente.',
    };
    throw error;
  }

    const data = await response.json();
  return data;
  } catch (error: any) {
    // Se for erro de rede (serviço não está rodando)
    if (error instanceof TypeError || error.message?.includes('fetch') || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.message?.includes('Network request failed')) {
      const networkError: ApiError = {
        status: 'error',
        message: 'Serviço temporariamente indisponível',
      };
      throw networkError;
    }
    
    // Se já for um ApiError, verificar se é erro de conexão
    if (error.status && error.message) {
      // Se a mensagem indica erro de conexão, substituir
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('Network request failed')) {
        const networkError: ApiError = {
          status: 'error',
          message: 'Serviço temporariamente indisponível',
        };
        throw networkError;
      }
      throw error;
    }

    // Para outros erros, verificar se é erro de rede
    if (error.message?.includes('fetch') || error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError') || error.message?.includes('Network request failed')) {
      const networkError: ApiError = {
        status: 'error',
        message: 'Serviço temporariamente indisponível',
      };
      throw networkError;
    }

    // Erro genérico
    const genericError: ApiError = {
      status: 'error',
      message: error.message || 'Erro ao processar requisição. Tente novamente.',
    };
    throw genericError;
  }
};

// API de Autenticação
export const authAPI = {
  login: async (data: LoginData): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  register: async (data: RegisterData): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getMe: async (): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/me');
  },

  updateProfile: async (data: UpdateProfileData): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  changePassword: async (data: ChangePasswordData): Promise<AuthResponse> => {
    return request<AuthResponse>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  forgotPassword: async (data: ForgotPasswordData): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  resetPassword: async (data: ResetPasswordData): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteAccount: async (data: DeleteAccountData): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>('/auth/account', {
      method: 'DELETE',
      body: JSON.stringify(data),
    });
  },
};

// Subscription Interfaces
export interface Subscription {
  id: string;
  productId: string;
  status: 'active' | 'expired' | 'cancelled' | 'refunded';
  expiresAt: string;
  purchasedAt: string;
  cancelledAt?: string | null;
  source: 'apple' | 'appmax' | 'google';
  transactionId: string;
}

// API de Assinaturas
export const subscriptionAPI = {
  getActive: async (): Promise<{ status: string; subscription: Subscription | null }> => {
    return request<{ status: string; subscription: Subscription | null }>('/subscriptions/active');
  },

  cancel: async (): Promise<{ status: string; message: string; subscription: Subscription }> => {
    return request<{ status: string; message: string; subscription: Subscription }>('/subscriptions/cancel', {
      method: 'DELETE',
    });
  },
};

// API de Instâncias
export const instanceAPI = {
  create: async (data: CreateInstanceData): Promise<CreateInstanceResponse> => {
    return request<CreateInstanceResponse>('/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createOfficial: async (data: CreateOfficialInstanceData): Promise<CreateInstanceResponse> => {
    return request<CreateInstanceResponse>('/instances/official', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAll: async (): Promise<GetInstancesResponse> => {
    return request<GetInstancesResponse>('/instances');
  },

  getById: async (id: string): Promise<GetInstanceResponse> => {
    return request<GetInstanceResponse>(`/instances/${id}`);
  },

  updateSettings: async (
    id: string,
    data: UpdateInstanceSettingsData
  ): Promise<UpdateInstanceSettingsResponse> => {
    return request<UpdateInstanceSettingsResponse>(`/instances/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<DeleteInstanceResponse> => {
    return request<DeleteInstanceResponse>(`/instances/${id}`, {
      method: 'DELETE',
    });
  },

  /** Registra o número na API Oficial (sai do status Pendente). PIN = 6 dígitos da verificação em duas etapas. */
  registerOfficialPhone: async (id: string, pin: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/instances/${id}/register-phone`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },
};

// CRM Interfaces
export interface CRMColumn {
  id: string;
  name: string;
  order: number;
  shortId: number;
  color?: string | null;
}

export interface Label {
  id: string;
  shortId?: number;
  name: string;
  color: string;
  order: number;
}

export interface Contact {
  id: string;
  instanceId: string;
  remoteJid: string;
  phone: string;
  name: string;
  profilePicture?: string | null;
  columnId: string | null;
  columnName: string | null;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  labels?: Label[];
}

export interface Message {
  id: string;
  messageId: string;
  fromMe: boolean;
  messageType: string;
  content: string;
  mediaUrl?: string | null;
  timestamp: string;
  read: boolean;
}

export interface GetColumnsResponse {
  status: string;
  columns: CRMColumn[];
}

export interface GetLabelsResponse {
  status: string;
  labels: Label[];
}

export interface GetContactsResponse {
  status: string;
  count: number;
  contacts: Contact[];
}

export interface GetMessagesResponse {
  status: string;
  count: number;
  messages: Message[];
}

export interface MoveContactData {
  columnId: string;
}

export interface SendMessageData {
  text: string;
}

// API de CRM
export const crmAPI = {
  getColumns: async (): Promise<GetColumnsResponse> => {
    return request<GetColumnsResponse>('/crm/columns');
  },

  updateColumn: async (id: string, name: string): Promise<{ status: string; column: CRMColumn }> => {
    return request<{ status: string; column: CRMColumn }>(`/crm/columns/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  },

  getContacts: async (): Promise<GetContactsResponse> => {
    return request<GetContactsResponse>('/crm/contacts');
  },

  searchContacts: async (query: string): Promise<GetContactsResponse> => {
    return request<GetContactsResponse>(`/crm/contacts/search?q=${encodeURIComponent(query)}`);
  },

  moveContact: async (contactId: string, data: MoveContactData): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/crm/contacts/${contactId}/move`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  getMessages: async (contactId: string): Promise<GetMessagesResponse> => {
    return request<GetMessagesResponse>(`/crm/contacts/${contactId}/messages`);
  },

  sendMessage: async (contactId: string, data: SendMessageData): Promise<{ status: string; message: string; data: Message }> => {
    return request<{ status: string; message: string; data: Message }>(`/crm/contacts/${contactId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  sendMedia: async (contactId: string, file: File, caption?: string): Promise<{ status: string; message: string; data: Message }> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);
    if (caption) {
      formData.append('caption', caption);
    }

    const response = await fetch(`${API_URL}/crm/contacts/${contactId}/messages/media`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        status: data.status || 'error',
        message: data.message || 'Erro ao enviar mídia. Tente novamente.',
      };
      throw error;
    }

    return data;
  },

  sendAudio: async (contactId: string, file: File): Promise<{ status: string; message: string; data: Message }> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/crm/contacts/${contactId}/messages/audio`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        status: data.status || 'error',
        message: data.message || 'Erro ao enviar áudio. Tente novamente.',
      };
      throw error;
    }

    return data;
  },

  // Labels
  getLabels: async (): Promise<GetLabelsResponse> => {
    return request<GetLabelsResponse>('/crm/labels');
  },

  updateLabel: async (id: string, name: string, color: string): Promise<{ status: string; label: Label }> => {
    return request<{ status: string; label: Label }>(`/crm/labels/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ name, color }),
    });
  },

  addLabelToContact: async (contactId: string, labelId: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/crm/contacts/${contactId}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelId }),
    });
  },

  removeLabelFromContact: async (contactId: string, labelId: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/crm/contacts/${contactId}/labels/${labelId}`, {
      method: 'DELETE',
    });
  },
};

// ============================================
// DISPATCHES API
// ============================================

export type TemplateType =
  | 'text'
  | 'image'
  | 'image_caption'
  | 'video'
  | 'video_caption'
  | 'audio'
  | 'file'
  | 'sequence';

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  content: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateData {
  name: string;
  type: TemplateType;
  content: any;
}

export interface UpdateTemplateData {
  name?: string;
  content?: any;
}

export type DispatchStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed';

export interface Dispatch {
  id: string;
  name: string;
  status: DispatchStatus;
  instanceId?: string;
  templateId?: string | null;
  settings: {
    speed: 'fast' | 'normal' | 'slow' | 'randomized';
    autoDelete?: boolean;
    deleteDelay?: number;
    deleteDelayUnit?: 'seconds' | 'minutes' | 'hours';
  };
  schedule?: {
    startDate?: string;
    startTime: string;
    endTime: string;
    suspendedDays: number[];
  } | null;
  stats: {
    sent: number;
    failed: number;
    invalid: number;
    total: number;
  };
  defaultName?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface CreateDispatchData {
  instanceId: string;
  templateId?: string | null;
  name: string;
  settings: {
    speed: 'fast' | 'normal' | 'slow' | 'randomized';
    autoDelete?: boolean;
    deleteDelay?: number;
    deleteDelayUnit?: 'seconds' | 'minutes' | 'hours';
  };
  schedule?: {
    startDate?: string;
    startTime: string;
    endTime: string;
    suspendedDays: number[];
    timezone?: string; // Fuso horário opcional para o agendamento
  } | null;
  contactsSource: 'list' | 'kanban';
  contactsData?: Array<{ phone: string; name?: string }>;
  columnIds?: string[];
  defaultName?: string | null;
}

export interface ContactValidationResult {
  phone: string;
  name?: string;
  validated: boolean;
  validationResult?: {
    exists: boolean;
    name?: string;
  } | null;
}

export interface ValidateContactsResponse {
  status: string;
  contacts: ContactValidationResult[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
  };
}

export const dispatchAPI = {
  // Templates
  createTemplate: async (data: CreateTemplateData): Promise<{ status: string; template: Template }> => {
    return request<{ status: string; template: Template }>('/dispatches/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getTemplates: async (type?: TemplateType): Promise<{ status: string; templates: Template[] }> => {
    const url = type ? `/dispatches/templates?type=${type}` : '/dispatches/templates';
    return request<{ status: string; templates: Template[] }>(url);
  },

  getTemplate: async (id: string): Promise<{ status: string; template: Template }> => {
    return request<{ status: string; template: Template }>(`/dispatches/templates/${id}`);
  },

  updateTemplate: async (id: string, data: UpdateTemplateData): Promise<{ status: string; template: Template }> => {
    return request<{ status: string; template: Template }>(`/dispatches/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTemplate: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/dispatches/templates/${id}`, {
      method: 'DELETE',
    });
  },

  uploadTemplateFile: async (file: File): Promise<{ status: string; url: string; fullUrl: string; fileName: string }> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/dispatches/templates/upload`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        status: data.status || 'error',
        message: data.message || 'Erro ao fazer upload do arquivo. Tente novamente.',
      };
      throw error;
    }

    return data;
  },

  // Validação
  validateContacts: async (instanceId: string, contacts: Array<{ phone: string; name?: string }>): Promise<ValidateContactsResponse> => {
    return request<ValidateContactsResponse>('/dispatches/validate-contacts', {
      method: 'POST',
      body: JSON.stringify({ instanceId, contacts }),
    });
  },

  // Upload/Processamento
  uploadCSV: async (file: File): Promise<{ status: string; contacts: Array<{ phone: string; name?: string }>; count: number }> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/dispatches/upload-csv`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        status: data.status || 'error',
        message: data.message || 'Erro ao processar CSV',
      };
      throw error;
    }

    return data;
  },

  processInput: async (inputText: string): Promise<{ status: string; contacts: Array<{ phone: string; name?: string }>; count: number }> => {
    return request<{ status: string; contacts: Array<{ phone: string; name?: string }>; count: number }>('/dispatches/process-input', {
      method: 'POST',
      body: JSON.stringify({ inputText }),
    });
  },

  // Disparos
  createDispatch: async (data: CreateDispatchData): Promise<{ status: string; dispatch: Dispatch }> => {
    return request<{ status: string; dispatch: Dispatch }>('/dispatches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getDispatches: async (status?: DispatchStatus): Promise<{ status: string; dispatches: Dispatch[] }> => {
    const url = status ? `/dispatches?status=${status}` : '/dispatches';
    return request<{ status: string; dispatches: Dispatch[] }>(url);
  },

  getDispatch: async (id: string): Promise<{ status: string; dispatch: Dispatch }> => {
    return request<{ status: string; dispatch: Dispatch }>(`/dispatches/${id}`);
  },

  updateDispatch: async (id: string, data: Partial<CreateDispatchData>): Promise<{ status: string; dispatch: Dispatch }> => {
    return request<{ status: string; dispatch: Dispatch }>(`/dispatches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  startDispatch: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/dispatches/${id}/start`, {
      method: 'POST',
    });
  },

  pauseDispatch: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/dispatches/${id}/pause`, {
      method: 'POST',
    });
  },

  resumeDispatch: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/dispatches/${id}/resume`, {
      method: 'POST',
    });
  },

  deleteDispatch: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/dispatches/${id}`, {
      method: 'DELETE',
    });
  },
};

// Workflow Interfaces
export interface WorkflowNode {
  id: string;
  type:
    | 'whatsappTrigger'
    | 'typebotTrigger'
    | 'webhookTrigger'
    | 'condition'
    | 'delay'
    | 'end'
    | 'response'
    | 'spreadsheet'
    | 'openai';
  position: { x: number; y: number };
  data: {
    instanceId?: string;
    instanceName?: string; // Nome da instância para exibição no card (apenas para whatsappTrigger)
    webhookUrl?: string;
    workflowId?: string;
    spreadsheetId?: string;
    spreadsheetName?: string;
    sheetName?: string;
    authStatus?: 'authenticated' | 'not_authenticated';
    isAuthenticated?: boolean;
    apiKey?: string;
    model?: string;
    prompt?: string;
    responseDelay?: number; // Delay em milissegundos (usado em openai para resposta e em response para envio)
    conditions?: Array<{ id: string; text: string; outputId: string }>;
    delay?: number;
    delayUnit?: 'seconds' | 'minutes' | 'hours';
    responseType?: 'text' | 'image' | 'image_caption' | 'video' | 'video_caption' | 'audio' | 'file';
    content?: string;
    mediaUrl?: string;
    caption?: string;
    fileName?: string;
    responseInstanceId?: string; // Instância de onde enviar a resposta (diferente do instanceId do trigger)
    // Campos específicos do webhookTrigger
    selectedFields?: string[];
    phoneField?: string;
    nameField?: string;
    lastWebhookData?: any;
    listening?: boolean;
    listenExpiresAt?: string;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  instanceId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkflowData {
  name: string;
  instanceId?: string; // Opcional - será obtido do nó de gatilho WhatsApp se não fornecido
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive?: boolean;
}

export interface UpdateWorkflowData {
  name?: string;
  instanceId?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  isActive?: boolean;
}

export interface WorkflowContact {
  id: string;
  contactPhone: string;
  instanceId: string;
  enteredAt: string;
}

// API de Workflows (usa MindClerky microserviço)
export const workflowAPI = {
  getAll: async (): Promise<{ status: string; workflows: Workflow[] }> => {
    return requestMindClerky<{ status: string; workflows: Workflow[] }>('/workflows');
  },

  getById: async (id: string): Promise<{ status: string; workflow: Workflow }> => {
    return requestMindClerky<{ status: string; workflow: Workflow }>(`/workflows/${id}`);
  },

  create: async (data: CreateWorkflowData): Promise<{ status: string; message: string; workflow: Workflow }> => {
    return requestMindClerky<{ status: string; message: string; workflow: Workflow }>('/workflows', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: UpdateWorkflowData): Promise<{ status: string; message: string; workflow: Workflow }> => {
    return requestMindClerky<{ status: string; message: string; workflow: Workflow }>(`/workflows/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<{ status: string; message: string }> => {
    return requestMindClerky<{ status: string; message: string }>(`/workflows/${id}`, {
      method: 'DELETE',
    });
  },

  getContacts: async (id: string): Promise<{ status: string; contacts: WorkflowContact[] }> => {
    return requestMindClerky<{ status: string; contacts: WorkflowContact[] }>(`/workflows/${id}/contacts`);
  },

  clearContacts: async (id: string): Promise<{ status: string; message: string; deletedCount: number }> => {
    return requestMindClerky<{ status: string; message: string; deletedCount: number }>(`/workflows/${id}/contacts/clear`, {
      method: 'POST',
    });
  },

  // Escuta de webhooks para nós do tipo webhookTrigger
  checkWebhookReceived: async (
    nodeId: string
  ): Promise<{
    status: string;
    received: boolean;
    data: any;
    receivedAt?: string | null;
  }> => {
    return requestMindClerky<{
      status: string;
      received: boolean;
      data: any;
      receivedAt?: string | null;
    }>(`/workflows/webhook/listen/${nodeId}`);
  },

  consumeWebhook: async (
    nodeId: string
  ): Promise<{
    status: string;
    data: any;
    receivedAt?: string | null;
  }> => {
    return requestMindClerky<{
      status: string;
      data: any;
      receivedAt?: string | null;
    }>(`/workflows/webhook/consume/${nodeId}`, {
      method: 'POST',
    });
  },
};

// Agente de IA
export type BlockDurationUnit = 'minutes' | 'hours' | 'days' | 'permanent';

export interface AIAgent {
  id: string;
  userId: string;
  instanceId: string;
  name: string;
  prompt: string;
  waitTime: number;
  isActive: boolean;
  transcribeAudio: boolean;
  agentType: 'manual' | 'assisted';
  assistedConfig?: AssistedConfig;
  blockWhenUserReplies?: boolean;
  blockDuration?: number | null;
  blockDurationUnit?: BlockDurationUnit | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAIAgentData {
  instanceId: string;
  name: string;
  prompt?: string;
  waitTime?: number;
  isActive?: boolean;
  transcribeAudio?: boolean;
  agentType?: 'manual' | 'assisted';
  assistedConfig?: AssistedConfig;
  blockWhenUserReplies?: boolean;
  blockDuration?: number | null;
  blockDurationUnit?: BlockDurationUnit | null;
}

export interface UpdateAIAgentData {
  name?: string;
  prompt?: string;
  waitTime?: number;
  isActive?: boolean;
  transcribeAudio?: boolean;
  agentType?: 'manual' | 'assisted';
  assistedConfig?: AssistedConfig;
  blockWhenUserReplies?: boolean;
  blockDuration?: number | null;
  blockDurationUnit?: BlockDurationUnit | null;
}

export interface AIAgentLead {
  phone: string;
  name?: string;
  interest?: string;
  detectedInterest?: boolean;
  lastInteraction?: string;
  history: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

// API de Agente de IA
export const aiAgentAPI = {
  getAll: async (): Promise<{ status: string; agents: AIAgent[] }> => {
    return request<{ status: string; agents: AIAgent[] }>('/ai-agent');
  },

  getById: async (id: string): Promise<{ status: string; agent: AIAgent }> => {
    return request<{ status: string; agent: AIAgent }>(`/ai-agent/${id}`);
  },

  create: async (data: CreateAIAgentData): Promise<{ status: string; message: string; agent: AIAgent }> => {
    return request<{ status: string; message: string; agent: AIAgent }>('/ai-agent', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: async (id: string, data: UpdateAIAgentData): Promise<{ status: string; message: string; agent: AIAgent }> => {
    return request<{ status: string; message: string; agent: AIAgent }>(`/ai-agent/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/ai-agent/${id}`, {
      method: 'DELETE',
    });
  },

  getLeads: async (instanceId?: string): Promise<{ status: string; leads: AIAgentLead[]; count: number }> => {
    const url = instanceId ? `/ai-agent/leads?instanceId=${instanceId}` : '/ai-agent/leads';
    return request<{ status: string; leads: AIAgentLead[]; count: number }>(url);
  },

  addKnowledge: async (agentId: string, content: string): Promise<{ status: string; message: string; count: number }> => {
    return request<{ status: string; message: string; count: number }>(`/ai-agent/${agentId}/knowledge`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  getKnowledgeCount: async (agentId: string): Promise<{ status: string; count: number }> => {
    return request<{ status: string; count: number }>(`/ai-agent/${agentId}/knowledge/count`);
  },

  getMedia: async (agentId: string): Promise<{ status: string; media: AgentMedia[] }> => {
    return request<{ status: string; media: AgentMedia[] }>(`/ai-agent/${agentId}/media`);
  },

  addMedia: async (agentId: string, formData: FormData): Promise<{ status: string; media: AgentMedia }> => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/ai-agent/${agentId}/media`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'Erro ao enviar mídia');
    }
    return response.json();
  },

  deleteMedia: async (agentId: string, mediaId: string): Promise<{ status: string }> => {
    return request<{ status: string }>(`/ai-agent/${agentId}/media/${mediaId}`, { method: 'DELETE' });
  },

  getLocations: async (agentId: string): Promise<{ status: string; locations: AgentLocation[] }> => {
    return request<{ status: string; locations: AgentLocation[] }>(`/ai-agent/${agentId}/locations`);
  },

  addLocation: async (agentId: string, data: { name?: string; address?: string; latitude: number; longitude: number; maxUsesPerContact?: number }): Promise<{ status: string; location: AgentLocation }> => {
    return request<{ status: string; location: AgentLocation }>(`/ai-agent/${agentId}/locations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteLocation: async (agentId: string, locationId: string): Promise<{ status: string }> => {
    return request<{ status: string }>(`/ai-agent/${agentId}/locations/${locationId}`, { method: 'DELETE' });
  },
};

export interface AgentMedia {
  id: string;
  agentId: string;
  mediaType: 'image' | 'video' | 'file' | 'audio';
  url: string;
  caption: string | null;
  maxUsesPerContact: number;
  createdAt: string;
}

export interface AgentLocation {
  id: string;
  agentId: string;
  name: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  maxUsesPerContact: number;
  createdAt: string;
}

// Group Interfaces
export interface GroupParticipant {
  id: string;
  name?: string;
  isAdmin?: boolean;
}

export interface Group {
  id: string;
  name?: string;
  description?: string;
  creation?: number;
  participants?: GroupParticipant[];
  pictureUrl?: string;
  announcement?: boolean;
  locked?: boolean;
}

// Dashboard API
export interface DashboardStats {
  instances: {
    total: number;
    connected: number;
    disconnected: number;
    connecting: number;
    error: number;
  };
        contacts: {
          total: number;
          byColumn: Array<{ columnId: string; columnName: string; count: number }>;
        };
  dispatches: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    paused: number;
  };
  workflows: {
    total: number;
  };
  groups: {
    total: number;
  };
  aiAgents: {
    total: number;
    active: number;
  };
}

export interface RecentActivity {
  messages: Array<{
    id: string;
    contactId: string;
    contactName: string;
    contactPhone: string;
    content: string;
    messageType: string;
    timestamp: string;
  }>;
  contacts: Array<{
    id: string;
    name: string | null;
    phone: string;
    createdAt: string;
  }>;
  dispatches: Array<{
    id: string;
    name: string;
    status: string;
    stats: {
      total: number;
      sent: number;
      failed: number;
      invalid: number;
    };
    createdAt: string;
  }>;
}

export const dashboardAPI = {
  getStats: async (): Promise<{
    status: string;
    stats: DashboardStats;
    recent: RecentActivity;
  }> => {
    return request<{
      status: string;
      stats: DashboardStats;
      recent: RecentActivity;
    }>('/dashboard/stats');
  },
  getBanners: async (): Promise<{
    status: string;
    data: Banner[];
  }> => {
    return request<{
      status: string;
      data: Banner[];
    }>('/dashboard/banners');
  },
};

// Group API
export const groupAPI = {
  getAll: async (instanceId: string): Promise<{ status: string; groups: Group[] }> => {
    return request<{ status: string; groups: Group[] }>(`/groups?instanceId=${instanceId}`);
  },

  leave: async (instanceId: string, groupId: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/groups/leave`, {
      method: 'POST',
      body: JSON.stringify({ instanceId, groupId }),
    });
  },

  leaveBulk: async (
    instanceId: string,
    groupIds: string[]
  ): Promise<{
    status: string;
    message: string;
    data?: { results: Array<{ groupId: string; success: boolean; error?: string }>; successCount: number; failCount: number };
  }> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 min (operações em lote)
    try {
      const result = await request<{
        status: string;
        message: string;
        data?: { results: Array<{ groupId: string; success: boolean; error?: string }>; successCount: number; failCount: number };
      }>(`/groups/leave-bulk`, {
        method: 'POST',
        body: JSON.stringify({ instanceId, groupIds }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  },

  validateParticipants: async (
    instanceId: string,
    participants: string[]
  ): Promise<{
    status: string;
    valid: Array<{ phone: string; name?: string }>;
    invalid: Array<{ phone: string; reason: string }>;
    validCount: number;
    invalidCount: number;
    totalCount: number;
  }> => {
    return request<{
      status: string;
      valid: Array<{ phone: string; name?: string }>;
      invalid: Array<{ phone: string; reason: string }>;
      validCount: number;
      invalidCount: number;
      totalCount: number;
    }>(`/groups/validate-participants`, {
      method: 'POST',
      body: JSON.stringify({ instanceId, participants }),
    });
  },

  create: async (
    instanceId: string,
    subject: string,
    description: string,
    participants: string[]
  ): Promise<{ status: string; message: string; group: Group }> => {
    return request<{ status: string; message: string; group: Group }>(`/groups/create`, {
      method: 'POST',
      body: JSON.stringify({ instanceId, subject, description, participants }),
    });
  },

  updatePicture: async (
    instanceId: string,
    groupId: string,
    file: File
  ): Promise<{ status: string; message: string; imageUrl: string }> => {
    const token = localStorage.getItem('token');
    const formData = new FormData();
    formData.append('image', file);
    formData.append('instanceId', instanceId);
    formData.append('groupId', groupId);

    const response = await fetch(`${API_URL}/groups/update-picture`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        status: data.status || 'error',
        message: data.message || 'Erro ao atualizar imagem do grupo',
      };
      throw error;
    }

    return data;
  },

  updateSubject: async (
    instanceId: string,
    groupId: string,
    subject: string
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/groups/update-subject`, {
      method: 'POST',
      body: JSON.stringify({ instanceId, groupId, subject }),
    });
  },

  updateDescription: async (
    instanceId: string,
    groupId: string,
    description: string
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/groups/update-description`, {
      method: 'POST',
      body: JSON.stringify({ instanceId, groupId, description }),
    });
  },

  getInviteCode: async (
    instanceId: string,
    groupId: string
  ): Promise<{ status: string; code: string; url: string }> => {
    return request<{ status: string; code: string; url: string }>(
      `/groups/invite-code?instanceId=${instanceId}&groupId=${encodeURIComponent(groupId)}`
    );
  },

  updateSettings: async (
    instanceId: string,
    groupId: string,
    action: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/groups/update-settings`, {
      method: 'POST',
      body: JSON.stringify({ instanceId, groupId, action }),
    });
  },

  mentionEveryone: async (
    instanceId: string,
    groupId: string,
    text: string
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/groups/mention-everyone`, {
      method: 'POST',
      body: JSON.stringify({ instanceId, groupId, text }),
    });
  },

  getParticipants: async (
    instanceId: string,
    groupId: string
  ): Promise<{ status: string; participants: Array<{ id: string; name: string; phone: string; isAdmin: boolean }> }> => {
    return request<{ status: string; participants: Array<{ id: string; name: string; phone: string; isAdmin: boolean }> }>(
      `/groups/participants?instanceId=${instanceId}&groupId=${encodeURIComponent(groupId)}`
    );
  },

  updateParticipants: async (
    instanceId: string,
    groupId: string,
    action: 'add' | 'remove' | 'promote' | 'demote',
    participants: string[]
  ): Promise<{ status: string; message: string; action: string; participantsCount: number }> => {
    return request<{ status: string; message: string; action: string; participantsCount: number }>(
      `/groups/participants/update`,
      {
        method: 'POST',
        body: JSON.stringify({ instanceId, groupId, action, participants }),
      }
    );
  },

  getGroupInfo: async (
    instanceId: string,
    groupId: string
  ): Promise<{ status: string; restrict: boolean; announce: boolean }> => {
    return request<{ status: string; restrict: boolean; announce: boolean }>(
      `/groups/info?instanceId=${instanceId}&groupId=${encodeURIComponent(groupId)}`
    );
  },

  // Mensagens Automáticas
  getAutoMessages: async (
    instanceId: string
  ): Promise<{ status: string; data: Array<{
    id: string;
    userId: string;
    instanceId: string;
    groupId: string | null;
    isActive: boolean;
    messageType: 'welcome' | 'goodbye';
    messageText: string;
    delaySeconds: number;
    createdAt: string;
    updatedAt: string;
  }> }> => {
    return request<{ status: string; data: Array<any> }>(
      `/groups/auto-messages?instanceId=${instanceId}`
    );
  },

  upsertAutoMessage: async (data: {
    instanceId: string;
    groupId?: string | null;
    messageType: 'welcome' | 'goodbye';
    messageText: string;
    isActive?: boolean;
    delaySeconds?: number;
  }): Promise<{ status: string; message: string; data: any }> => {
    return request<{ status: string; message: string; data: any }>(`/groups/auto-messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateAutoMessage: async (
    id: string,
    data: { messageText?: string; isActive?: boolean; delaySeconds?: number }
  ): Promise<{ status: string; message: string; data: any }> => {
    return request<{ status: string; message: string; data: any }>(`/groups/auto-messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteAutoMessage: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/groups/auto-messages/${id}`, {
      method: 'DELETE',
    });
  },

  // Histórico de Movimentações
  getMovements: async (params: {
    instanceId?: string;
    groupId?: string;
    participantId?: string;
    movementType?: 'join' | 'leave' | 'promote' | 'demote';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    status: string;
    data: {
      movements: Array<{
        id: string;
        userId: string;
        instanceId: string;
        groupId: string;
        groupName: string | null;
        participantId: string;
        participantPhone: string | null;
        participantName: string | null;
        movementType: 'join' | 'leave' | 'promote' | 'demote';
        isAdmin: boolean;
        actionBy: string | null;
        actionByPhone: string | null;
        actionByName: string | null;
        createdAt: string;
      }>;
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params.instanceId) queryParams.append('instanceId', params.instanceId);
    if (params.groupId) queryParams.append('groupId', params.groupId);
    if (params.participantId) queryParams.append('participantId', params.participantId);
    if (params.movementType) queryParams.append('movementType', params.movementType);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());

    return request<{ status: string; data: any }>(`/groups/movements?${queryParams.toString()}`);
  },

  getMovementsStatistics: async (params: {
    instanceId?: string;
    groupId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    status: string;
    data: {
      totalJoins: number;
      totalLeaves: number;
      totalPromotes: number;
      totalDemotes: number;
      uniqueParticipants: number;
      uniqueGroups: number;
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params.instanceId) queryParams.append('instanceId', params.instanceId);
    if (params.groupId) queryParams.append('groupId', params.groupId);
    if (params.startDate) queryParams.append('startDate', params.startDate);
    if (params.endDate) queryParams.append('endDate', params.endDate);

    return request<{ status: string; data: any }>(`/groups/movements/statistics?${queryParams.toString()}`);
  },

  replaceGroupAutoMessages: async (instanceId: string): Promise<{ status: string; message: string; data: { replaced: number } }> => {
    return request<{ status: string; message: string; data: { replaced: number } }>(`/groups/auto-messages/replace-groups`, {
      method: 'POST',
      body: JSON.stringify({ instanceId }),
    });
  },

  // Templates e envios de mensagens de grupos
  getMessageTemplates: async (
    instanceId: string
  ): Promise<{ status: string; data: any[] }> => {
    return request<{ status: string; data: any[] }>(
      `/groups/message-templates?instanceId=${instanceId}`
    );
  },

  createMessageTemplate: async (data: {
    instanceId: string;
    name: string;
    description?: string;
    messageType: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
    contentJson: any;
  }): Promise<{ status: string; message: string; data: any }> => {
    return request<{ status: string; message: string; data: any }>(
      `/groups/message-templates`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  updateMessageTemplate: async (
    id: string,
    data: {
      name?: string;
      description?: string;
      contentJson?: any;
    }
  ): Promise<{ status: string; message: string; data: any }> => {
    return request<{ status: string; message: string; data: any }>(
      `/groups/message-templates/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  deleteMessageTemplate: async (
    id: string
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(
      `/groups/message-templates/${id}`,
      {
        method: 'DELETE',
      }
    );
  },

  sendGroupMessageNow: async (data: {
    instanceId: string;
    messageType: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
    contentJson: any;
    targetType: 'all' | 'specific';
    groupIds: string[];
    templateId?: string;
  }): Promise<{
    status: string;
    message: string;
    data: { templateId: string | null; results: any[] };
  }> => {
    return request<{
      status: string;
      message: string;
      data: { templateId: string | null; results: any[] };
    }>(`/groups/messages/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  scheduleGroupMessage: async (data: {
    instanceId: string;
    messageType: 'text' | 'media' | 'poll' | 'contact' | 'location' | 'audio';
    contentJson: any;
    targetType: 'all' | 'specific';
    groupIds: string[];
    templateId?: string;
    scheduledAt: string;
  }): Promise<{
    status: string;
    message: string;
    data: any;
  }> => {
    return request<{
      status: string;
      message: string;
      data: any;
    }>(`/groups/messages/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getScheduledGroupMessages: async (
    instanceId: string
  ): Promise<{ status: string; data: any[] }> => {
    return request<{ status: string; data: any[] }>(
      `/groups/messages/scheduled?instanceId=${instanceId}`
    );
  },

  cancelScheduledGroupMessage: async (
    id: string
  ): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(
      `/groups/messages/scheduled/${id}/cancel`,
      {
        method: 'POST',
      }
    );
  },
};

// Admin API
export interface SendPromotionData {
  title: string;
  body: string;
  data?: Record<string, any>;
  filters?: {
    platform?: 'ios' | 'android';
    isPremium?: boolean;
  };
}

export interface SendPromotionResponse {
  status: string;
  message: string;
  result: {
    totalDevices: number;
    successCount: number;
    failedCount: number;
    errors: string[];
  };
}

export interface Banner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
  title: string | null;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBannerData {
  imageUrl: string;
  linkUrl?: string | null;
  title?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface UpdateBannerData {
  imageUrl?: string;
  linkUrl?: string | null;
  title?: string | null;
  order?: number;
  isActive?: boolean;
}

export interface SystemNews {
  id: string;
  type: 'system_update' | 'tool_update' | 'announcement';
  tool: string | null;
  title: string;
  description: string;
  fullContent: string | null;
  imageUrl: string | null;
  publishedAt: string;
  isActive: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateNewsData {
  type: 'system_update' | 'tool_update' | 'announcement';
  tool?: string | null;
  title: string;
  description: string;
  fullContent?: string | null;
  imageUrl?: string | null;
  publishedAt?: string;
  isActive?: boolean;
  priority?: number;
}

export interface UpdateNewsData {
  type?: 'system_update' | 'tool_update' | 'announcement';
  tool?: string | null;
  title?: string;
  description?: string;
  fullContent?: string | null;
  imageUrl?: string | null;
  publishedAt?: string;
  isActive?: boolean;
  priority?: number;
}

export const adminAPI = {
  sendPromotion: async (data: SendPromotionData): Promise<SendPromotionResponse> => {
    return request<SendPromotionResponse>('/admin/send-promotion', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  // Banners
  getAllBanners: async (): Promise<{ status: string; data: Banner[] }> => {
    return request<{ status: string; data: Banner[] }>('/admin/banners');
  },
  createBanner: async (data: CreateBannerData): Promise<{ status: string; data: Banner }> => {
    return request<{ status: string; data: Banner }>('/admin/banners', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateBanner: async (id: string, data: UpdateBannerData): Promise<{ status: string; data: Banner }> => {
    return request<{ status: string; data: Banner }>(`/admin/banners/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteBanner: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/admin/banners/${id}`, {
      method: 'DELETE',
    });
  },
  // Novidades
  getAllNews: async (): Promise<{ status: string; data: SystemNews[] }> => {
    return request<{ status: string; data: SystemNews[] }>('/admin/news');
  },
  createNews: async (data: CreateNewsData): Promise<{ status: string; data: SystemNews }> => {
    return request<{ status: string; data: SystemNews }>('/admin/news', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateNews: async (id: string, data: UpdateNewsData): Promise<{ status: string; data: SystemNews }> => {
    return request<{ status: string; data: SystemNews }>(`/admin/news/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteNews: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/admin/news/${id}`, {
      method: 'DELETE',
    });
  },
};

// API pública de novidades (para usuários autenticados)
export const newsAPI = {
  getLatestNews: async (limit: number = 5): Promise<{ status: string; data: SystemNews[] }> => {
    return request<{ status: string; data: SystemNews[] }>(`/dashboard/news/latest?limit=${limit}`);
  },
  getAllNews: async (): Promise<{ status: string; data: SystemNews[] }> => {
    return request<{ status: string; data: SystemNews[] }>('/dashboard/news');
  },
  getNewsById: async (id: string): Promise<{ status: string; data: SystemNews }> => {
    return request<{ status: string; data: SystemNews }>(`/dashboard/news/${id}`);
  },
};

// Instagram Interfaces
export interface InstagramInstance {
  id: string;
  instanceName: string;
  name: string;
  username?: string;
  profilePictureUrl?: string;
  status: 'created' | 'connecting' | 'connected' | 'disconnected' | 'error';
  tokenExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstagramInstanceData {
  // name removido - será preenchido com username após OAuth
}

export interface UpdateInstagramInstanceData {
  name?: string;
}

export interface ResponseSequenceItem {
  type: 'text' | 'image' | 'video' | 'audio';
  content: string; // texto ou URL da mídia
  delay: number; // delay em segundos antes de enviar esta mensagem
}

export interface InstagramAutomation {
  id: string;
  userId: string;
  instanceId: string;
  name: string;
  type: 'dm' | 'comment';
  triggerType: 'keyword' | 'all';
  keywords?: string[];
  responseText: string; // Para comentários (sempre texto)
  responseType: 'direct' | 'comment' | 'comment_and_dm';
  responseTextDM?: string; // Texto da DM quando responseType = 'comment_and_dm'
  responseSequence?: ResponseSequenceItem[]; // Para DM (sequência de mensagens)
  delaySeconds: number;
  preventDuplicate: boolean; // Evitar que o mesmo contato entre novamente no mesmo fluxo
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInstagramAutomationData {
  instanceId: string;
  name: string;
  type: 'dm' | 'comment';
  triggerType: 'keyword' | 'all';
  keywords?: string[];
  responseText: string; // Obrigatório para comentários
  responseType: 'direct' | 'comment' | 'comment_and_dm';
  responseTextDM?: string; // Texto da DM quando responseType = 'comment_and_dm'
  responseSequence?: ResponseSequenceItem[]; // Obrigatório para DM quando responseType === 'direct'
  delaySeconds?: number;
  preventDuplicate?: boolean; // Padrão: true
  isActive?: boolean;
}

export interface UpdateInstagramAutomationData {
  name?: string;
  triggerType?: 'keyword' | 'all';
  keywords?: string[];
  responseText?: string;
  responseType?: 'direct' | 'comment' | 'comment_and_dm';
  responseTextDM?: string; // Texto da DM quando responseType = 'comment_and_dm'
  responseSequence?: ResponseSequenceItem[];
  delaySeconds?: number;
  preventDuplicate?: boolean;
  isActive?: boolean;
}

export interface InstagramReport {
  id: string;
  userId: string;
  instanceId: string;
  interactionType: 'dm' | 'comment';
  username: string;
  interactionText: string;
  responseText?: string | null;
  responseStatus: 'sent' | 'failed' | 'pending';
  timestamp: number;
  createdAt: string;
}

export interface InstagramStatistics {
  totalInteractions: number;
  totalDMs: number;
  totalComments: number;
  totalResponses: number;
  successfulResponses: number;
  failedResponses: number;
  byType: {
    dm: number;
    comment: number;
  };
  byStatus: {
    sent: number;
    failed: number;
    pending: number;
  };
}

// API de Instagram
export const instagramAPI = {
  // Instâncias
  createInstance: async (data: CreateInstagramInstanceData): Promise<{ status: string; data: InstagramInstance }> => {
    return request<{ status: string; data: InstagramInstance }>('/instagram/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getInstances: async (): Promise<{ status: string; data: InstagramInstance[] }> => {
    return request<{ status: string; data: InstagramInstance[] }>('/instagram/instances');
  },

  getInstanceById: async (id: string): Promise<{ status: string; data: InstagramInstance }> => {
    return request<{ status: string; data: InstagramInstance }>(`/instagram/instances/${id}`);
  },

  updateInstance: async (id: string, data: UpdateInstagramInstanceData): Promise<{ status: string; data: InstagramInstance }> => {
    return request<{ status: string; data: InstagramInstance }>(`/instagram/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteInstance: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/instagram/instances/${id}`, {
      method: 'DELETE',
    });
  },

  initiateOAuth: async (id: string): Promise<{ status: string; data: { authUrl: string; instanceId: string } }> => {
    return request<{ status: string; data: { authUrl: string; instanceId: string } }>(`/instagram/instances/${id}/oauth`);
  },

  refreshToken: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/instagram/instances/${id}/refresh-token`, {
      method: 'POST',
    });
  },

  // Automações
  createAutomation: async (data: CreateInstagramAutomationData): Promise<{ status: string; data: InstagramAutomation }> => {
    return request<{ status: string; data: InstagramAutomation }>('/instagram/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getAutomations: async (instanceId?: string): Promise<{ status: string; data: InstagramAutomation[] }> => {
    const url = instanceId ? `/instagram/automations?instanceId=${instanceId}` : '/instagram/automations';
    return request<{ status: string; data: InstagramAutomation[] }>(url);
  },

  getAutomationById: async (id: string): Promise<{ status: string; data: InstagramAutomation }> => {
    return request<{ status: string; data: InstagramAutomation }>(`/instagram/automations/${id}`);
  },

  updateAutomation: async (id: string, data: UpdateInstagramAutomationData): Promise<{ status: string; data: InstagramAutomation }> => {
    return request<{ status: string; data: InstagramAutomation }>(`/instagram/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteAutomation: async (id: string): Promise<{ status: string; message: string }> => {
    return request<{ status: string; message: string }>(`/instagram/automations/${id}`, {
      method: 'DELETE',
    });
  },

  toggleAutomation: async (id: string): Promise<{ status: string; data: InstagramAutomation }> => {
    return request<{ status: string; data: InstagramAutomation }>(`/instagram/automations/${id}/toggle`, {
      method: 'POST',
    });
  },

  clearAutomationContacts: async (id: string): Promise<{ status: string; message: string; deletedCount: number }> => {
    return request<{ status: string; message: string; deletedCount: number }>(`/instagram/automations/${id}/clear-contacts`, {
      method: 'DELETE',
    });
  },

  clearAllAutomationContacts: async (instanceId: string): Promise<{ status: string; message: string; deletedCount: number }> => {
    return request<{ status: string; message: string; deletedCount: number }>(`/instagram/automations/clear-all-contacts?instanceId=${instanceId}`, {
      method: 'DELETE',
    });
  },

  // Relatórios
  getReports: async (params?: {
    instanceId?: string;
    interactionType?: 'dm' | 'comment';
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    status: string;
    data: InstagramReport[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const queryParams = new URLSearchParams();
    if (params?.instanceId) queryParams.append('instanceId', params.instanceId);
    if (params?.interactionType) queryParams.append('interactionType', params.interactionType);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const url = queryParams.toString() ? `/instagram/reports?${queryParams.toString()}` : '/instagram/reports';
    return request<{
      status: string;
      data: InstagramReport[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>(url);
  },

  exportReports: async (params?: {
    instanceId?: string;
    interactionType?: 'dm' | 'comment';
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> => {
    const queryParams = new URLSearchParams();
    if (params?.instanceId) queryParams.append('instanceId', params.instanceId);
    if (params?.interactionType) queryParams.append('interactionType', params.interactionType);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const token = localStorage.getItem('token');
    const url = queryParams.toString() ? `/instagram/reports/export?${queryParams.toString()}` : '/instagram/reports/export';

    const response = await fetch(`${API_URL}${url}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      const error: ApiError = {
        status: 'error',
        message: 'Erro ao exportar relatórios',
      };
      throw error;
    }

    return response.blob();
  },

  getStatistics: async (params?: {
    instanceId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ status: string; data: InstagramStatistics }> => {
    const queryParams = new URLSearchParams();
    if (params?.instanceId) queryParams.append('instanceId', params.instanceId);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const url = queryParams.toString() ? `/instagram/reports/stats?${queryParams.toString()}` : '/instagram/reports/stats';
    return request<{ status: string; data: InstagramStatistics }>(url);
  },
};

// Scraping (busca de lugares)
export interface ScrapingSearchRecord {
  id: string;
  text_query: string;
  language_code: string;
  package_size: number;
  total_results: number;
  created_at: string;
}

export const scrapingAPI = {
  search: async (data: {
    textQuery: string;
    languageCode?: string;
    maxResults: number;
  }): Promise<{ status: string; data: ScrapingSearchRecord }> => {
    return request<{ status: string; data: ScrapingSearchRecord }>('/scraping-flow/search', {
      method: 'POST',
      body: JSON.stringify({
        textQuery: data.textQuery,
        languageCode: data.languageCode || 'pt-BR',
        maxResults: data.maxResults,
      }),
    });
  },

  getCredits: async (): Promise<{ status: string; data: { credits: number } }> => {
    return request<{ status: string; data: { credits: number } }>('/scraping-flow/credits');
  },

  createCheckout: async (packageKey: '25' | '50'): Promise<{ status: string; data: { link: string; checkoutId?: string } }> => {
    return request<{ status: string; data: { link: string; checkoutId?: string } }>('/scraping-flow/checkout', {
      method: 'POST',
      body: JSON.stringify({ package: packageKey }),
    });
  },

  getSearches: async (): Promise<{ status: string; data: ScrapingSearchRecord[] }> => {
    return request<{ status: string; data: ScrapingSearchRecord[] }>('/scraping-flow/searches');
  },

  exportCsv: async (searchId: string): Promise<Blob> => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/scraping-flow/searches/${searchId}/export`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const error: ApiError = {
        status: (err as ApiError).status || 'error',
        message: (err as ApiError).message || 'Erro ao exportar CSV',
      };
      throw error;
    }
    return response.blob();
  },
};

const api = { authAPI, instanceAPI, crmAPI, dispatchAPI, workflowAPI, aiAgentAPI, groupAPI, dashboardAPI, adminAPI, instagramAPI, scrapingAPI };

export default api;

