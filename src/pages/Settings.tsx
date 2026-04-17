import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, Button, Input, PasswordInput, ProfilePictureUpload, Modal } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import {
  authAPI,
  crmAPI,
  CRM_MAX_KANBAN_COLUMNS,
  CRM_MIN_KANBAN_COLUMNS,
  CRMColumn,
  Label,
  subscriptionAPI,
  Subscription,
  instanceAPI,
  instagramAPI,
  Instance,
  InstagramInstance,
} from '../services/api';
import {
  CrmInstancePicker,
  CRMInstanceOption,
  CrmSelectedInstance,
} from '../components/crm/CrmInstancePicker';
import TeamEnterpriseSection from '../components/Settings/TeamEnterpriseSection';
import { validators } from '../utils/validators';
import { normalizeName, formatPhone, normalizePhone } from '../utils/formatters';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProfileFormData {
  name: string;
  companyName: string;
  phone: string;
  profilePicture: string | null;
  timezone: string;
}

interface PasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

const SortableKanbanColumnSettingsRow: React.FC<{
  column: CRMColumn;
  columnNames: Record<string, string>;
  columnErrors: Record<string, string>;
  columnsLength: number;
  onNameChange: (id: string, value: string) => void;
  onNameSubmit: (id: string) => void;
  onDelete: (column: CRMColumn) => void;
  reorderDisabled: boolean;
}> = ({
  column,
  columnNames,
  columnErrors,
  columnsLength,
  onNameChange,
  onNameSubmit,
  onDelete,
  reorderDisabled,
}) => {
  const { t } = useLanguage();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, disabled: reorderDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 md:p-4 bg-gray-50 dark:bg-[#091D41] rounded-lg border border-gray-200 dark:border-gray-700 ${
        isDragging ? 'shadow-lg ring-2 ring-clerky-backendButton/25 z-[1]' : ''
      }`}
    >
      <button
        type="button"
        className="flex-shrink-0 self-start md:self-center mt-0 md:mt-6 p-2 rounded-md text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 dark:text-gray-400 cursor-grab active:cursor-grabbing touch-manipulation disabled:opacity-40 disabled:cursor-not-allowed"
        aria-label={t('settings.kanbanDragHandleAria')}
        disabled={reorderDisabled}
        {...attributes}
        {...listeners}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <circle cx="7" cy="5" r="1.5" />
          <circle cx="13" cy="5" r="1.5" />
          <circle cx="7" cy="10" r="1.5" />
          <circle cx="13" cy="10" r="1.5" />
          <circle cx="7" cy="15" r="1.5" />
          <circle cx="13" cy="15" r="1.5" />
        </svg>
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
            Coluna {column.order + 1}
          </label>
          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded font-mono">
            ID: {column.shortId}
          </span>
        </div>
        <Input
          id={`column-${column.id}`}
          type="text"
          value={columnNames[column.id] || ''}
          onChange={(e) => onNameChange(column.id, e.target.value)}
          placeholder="Nome da coluna"
          error={columnErrors[column.id]}
          maxLength={50}
          disabled={reorderDisabled}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onNameSubmit(column.id);
            }
          }}
        />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto mt-0 md:mt-6">
        <Button
          onClick={() => onNameSubmit(column.id)}
          variant="primary"
          size="md"
          className="w-full sm:w-auto py-2.5 md:py-2 touch-manipulation"
          disabled={reorderDisabled}
        >
          Salvar
        </Button>
        {columnsLength > CRM_MIN_KANBAN_COLUMNS && (
          <Button
            type="button"
            onClick={() => onDelete(column)}
            variant="secondary"
            size="md"
            className="w-full sm:w-auto py-2.5 md:py-2 touch-manipulation border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            disabled={reorderDisabled}
          >
            {t('settings.kanbanDeleteColumnButton')}
          </Button>
        )}
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const { t } = useLanguage();
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'kanban' | 'labels' | 'team'>('profile');
  const showTeamTab = user?.premiumPlan === 'enterprise' && !user?.isSubuser;
  const showKanbanLabels = !user?.isSubuser;

  useEffect(() => {
    if (user?.isSubuser && (activeTab === 'kanban' || activeTab === 'labels' || activeTab === 'team')) {
      setActiveTab('profile');
    }
  }, [user?.isSubuser, activeTab]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados do formulário de perfil
  const [profileData, setProfileData] = useState<ProfileFormData>({
    name: '',
    companyName: '',
    phone: '',
    profilePicture: null,
    timezone: 'America/Sao_Paulo',
  });

  // Estados do formulário de senha
  const [passwordData, setPasswordData] = useState<PasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });

  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof ProfileFormData, string>> & { general?: string }>({});
  const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof PasswordFormData, string>> & { general?: string }>({});
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  
  // Estados para colunas do Kanban
  const [columns, setColumns] = useState<CRMColumn[]>([]);
  const [columnNames, setColumnNames] = useState<Record<string, string>>({});
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [columnErrors, setColumnErrors] = useState<Record<string, string>>({});
  const [allowDeleteCard, setAllowDeleteCard] = useState(false);
  const [showDeleteCardPasswordModal, setShowDeleteCardPasswordModal] = useState(false);
  const [deleteCardPassword, setDeleteCardPassword] = useState('');
  const [deleteCardPasswordError, setDeleteCardPasswordError] = useState('');
  const [isSavingDeleteCardPref, setIsSavingDeleteCardPref] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [isCreatingColumn, setIsCreatingColumn] = useState(false);
  const [createColumnError, setCreateColumnError] = useState<string | null>(null);
  const [isSavingKanbanOrder, setIsSavingKanbanOrder] = useState(false);

  const [exportInstances, setExportInstances] = useState<CRMInstanceOption[]>([]);
  const [exportSelectedInstances, setExportSelectedInstances] = useState<CrmSelectedInstance[]>([]);
  const [exportInstanceScope, setExportInstanceScope] = useState<'all' | 'selected'>('all');
  const [exportColumnId, setExportColumnId] = useState<string>('');
  const [isLoadingExportInstances, setIsLoadingExportInstances] = useState(false);
  const [isExportingLeads, setIsExportingLeads] = useState(false);

  const kanbanColumnReorderSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Estados para labels
  const [labels, setLabels] = useState<Label[]>([]);
  const [labelNames, setLabelNames] = useState<Record<string, string>>({});
  const [labelColors, setLabelColors] = useState<Record<string, string>>({});
  const [isLoadingLabels, setIsLoadingLabels] = useState(false);
  const [labelErrors, setLabelErrors] = useState<Record<string, string>>({});

  // Estados para assinatura premium
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  // Carregar dados do usuário
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        companyName: user.companyName || '',
        phone: user.phone ? formatPhone(user.phone) : '',
        profilePicture: user.profilePicture || null,
        timezone: user.timezone || 'America/Sao_Paulo',
      });
    }
  }, [user]);

  // Carregar assinatura premium
  useEffect(() => {
    if (
      activeTab === 'profile' &&
      user?.premiumPlan &&
      user.premiumPlan !== 'free' &&
      !user?.isSubuser
    ) {
      loadSubscription();
    }
  }, [activeTab, user?.premiumPlan, user?.isSubuser]);

  const loadSubscription = async () => {
    try {
      setIsLoadingSubscription(true);
      setSubscriptionError(null);
      const response = await subscriptionAPI.getActive();
      setSubscription(response.subscription);
    } catch (error: any) {
      console.error('Erro ao carregar assinatura:', error);
      setSubscriptionError(error.message || 'Erro ao carregar informações da assinatura');
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    const confirmMessage = subscription.status === 'active' && subscription.expiresAt
      ? `Tem certeza que deseja cancelar sua assinatura?\n\nVocê manterá o acesso premium até ${new Date(subscription.expiresAt).toLocaleDateString('pt-BR')}.`
      : 'Tem certeza que deseja cancelar sua assinatura?';

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setIsCancelling(true);
      setSubscriptionError(null);
      const response = await subscriptionAPI.cancel();
      setSubscription(response.subscription);
      setSuccessMessage(response.message);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error: any) {
      console.error('Erro ao cancelar assinatura:', error);
      setSubscriptionError(error.message || 'Erro ao cancelar assinatura');
    } finally {
      setIsCancelling(false);
    }
  };

  // Carregar colunas do Kanban e preferências do CRM
  useEffect(() => {
    if (activeTab === 'kanban') {
      loadColumns();
      loadCrmPreferencesForKanban();
      loadKanbanExportInstances();
    }
  }, [activeTab]);

  const loadCrmPreferencesForKanban = async () => {
    try {
      const res = await crmAPI.getPreferences();
      setAllowDeleteCard(!!res.preferences?.allowDeleteConversationCard);
    } catch (error: any) {
      console.error('Erro ao carregar preferências do CRM:', error);
    }
  };

  const loadKanbanExportInstances = async () => {
    try {
      setIsLoadingExportInstances(true);
      const [waResponse, igResponse] = await Promise.all([
        instanceAPI.getAll(),
        instagramAPI.getInstances(),
      ]);
      const whatsappInstances: CRMInstanceOption[] = (waResponse.instances || []).map((inst: Instance) => ({
        id: inst.id,
        name: inst.name,
        status: inst.status,
        channel: 'whatsapp',
      }));
      const instagramInstances: CRMInstanceOption[] = (igResponse.data || []).map((inst: InstagramInstance) => ({
        id: inst.id,
        name: inst.name || inst.username || inst.instanceName,
        status: inst.status,
        channel: 'instagram',
      }));
      setExportInstances([...whatsappInstances, ...instagramInstances]);
    } catch (error: any) {
      console.error('Erro ao carregar instâncias para exportação:', error);
    } finally {
      setIsLoadingExportInstances(false);
    }
  };

  const toggleExportInstanceSelection = useCallback((inst: CRMInstanceOption) => {
    setExportSelectedInstances((prev) => {
      const key = `${inst.channel}:${inst.id}`;
      const exists = prev.some((p) => `${p.channel}:${p.id}` === key);
      if (exists) {
        return prev.filter((p) => `${p.channel}:${p.id}` !== key);
      }
      return [...prev, { id: inst.id, channel: inst.channel }];
    });
  }, []);

  const selectAllExportInstances = useCallback(() => {
    setExportSelectedInstances(exportInstances.map((i) => ({ id: i.id, channel: i.channel })));
  }, [exportInstances]);

  const clearExportInstanceSelection = useCallback(() => {
    setExportSelectedInstances([]);
  }, []);

  const handleExportLeadsCsv = async () => {
    if (exportInstanceScope === 'selected' && exportSelectedInstances.length === 0) {
      alert(t('settings.kanbanExportNeedInstances'));
      return;
    }
    try {
      setIsExportingLeads(true);
      const blob = await crmAPI.exportContactsCsv({
        allInstances: exportInstanceScope === 'all',
        instanceIds:
          exportInstanceScope === 'selected'
            ? exportSelectedInstances.map((s) => s.id)
            : undefined,
        columnId: exportColumnId || null,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-crm-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccessMessage(t('settings.kanbanExportSuccess'));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      alert(error?.message || t('settings.kanbanExportError'));
    } finally {
      setIsExportingLeads(false);
    }
  };

  // Carregar labels
  useEffect(() => {
    if (activeTab === 'labels') {
      loadLabels();
    }
  }, [activeTab]);

  const loadColumns = async () => {
    try {
      setIsLoadingColumns(true);
      const response = await crmAPI.getColumns();
      const sortedColumns = [...response.columns].sort((a, b) => a.order - b.order);
      setColumns(sortedColumns);
      
      // Inicializar nomes das colunas
      const names: Record<string, string> = {};
      sortedColumns.forEach((col) => {
        names[col.id] = col.name;
      });
      setColumnNames(names);
    } catch (error: any) {
      console.error('Erro ao carregar colunas:', error);
    } finally {
      setIsLoadingColumns(false);
    }
  };

  const handleColumnNameChange = (columnId: string, value: string) => {
    setColumnNames((prev) => ({ ...prev, [columnId]: value }));
    if (columnErrors[columnId]) {
      setColumnErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[columnId];
        return newErrors;
      });
    }
  };

  const handleColumnNameSubmit = async (columnId: string) => {
    const newName = columnNames[columnId]?.trim();
    
    if (!newName || newName.length === 0) {
      setColumnErrors((prev) => ({ ...prev, [columnId]: 'Nome da coluna é obrigatório' }));
      return;
    }

    if (newName.length > 50) {
      setColumnErrors((prev) => ({ ...prev, [columnId]: 'Nome deve ter no máximo 50 caracteres' }));
      return;
    }

    try {
      await crmAPI.updateColumn(columnId, newName);
      
      // Atualizar coluna localmente
      setColumns((prev) =>
        prev.map((col) => (col.id === columnId ? { ...col, name: newName } : col))
      );
      
      setSuccessMessage('Nome da coluna atualizado com sucesso!');
    } catch (error: any) {
      setColumnErrors((prev) => ({
        ...prev,
        [columnId]: error.message || 'Erro ao atualizar nome da coluna',
      }));
    }
  };

  const handleCreateColumn = async () => {
    const name = newColumnName.trim();
    if (!name) {
      setCreateColumnError(t('settings.kanbanNewColumnNameRequired'));
      return;
    }
    if (columns.length >= CRM_MAX_KANBAN_COLUMNS) {
      setCreateColumnError(t('settings.kanbanMaxColumnsHint'));
      return;
    }
    try {
      setIsCreatingColumn(true);
      setCreateColumnError(null);
      const res = await crmAPI.createColumn(name);
      const col = res.column;
      setColumns((prev) => [...prev, col].sort((a, b) => a.order - b.order));
      setColumnNames((prev) => ({ ...prev, [col.id]: col.name }));
      setNewColumnName('');
      setSuccessMessage(t('settings.kanbanColumnCreated'));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      setCreateColumnError(error.message || 'Erro ao criar coluna');
    } finally {
      setIsCreatingColumn(false);
    }
  };

  const handleDeleteColumn = async (column: CRMColumn) => {
    if (columns.length <= CRM_MIN_KANBAN_COLUMNS) return;
    if (!window.confirm(t('settings.kanbanDeleteColumnConfirm'))) return;
    try {
      await crmAPI.deleteColumn(column.id);
      setColumns((prev) => prev.filter((c) => c.id !== column.id));
      setColumnNames((prev) => {
        const next = { ...prev };
        delete next[column.id];
        return next;
      });
      setSuccessMessage(t('settings.kanbanColumnDeleted'));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      alert(error.message || t('settings.kanbanDeleteColumnError'));
    }
  };

  const handleKanbanColumnDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const snapshot = columns;
      const oldIndex = snapshot.findIndex((c) => c.id === active.id);
      const newIndex = snapshot.findIndex((c) => c.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const withOrder = arrayMove(snapshot, oldIndex, newIndex).map((c, i) => ({
        ...c,
        order: i,
      }));
      setColumns(withOrder);

      setIsSavingKanbanOrder(true);
      try {
        const res = await crmAPI.reorderColumns(withOrder.map((c) => c.id));
        const sorted = [...res.columns].sort((a, b) => a.order - b.order);
        setColumns(sorted);
        setSuccessMessage(t('settings.kanbanOrderUpdated'));
        setTimeout(() => setSuccessMessage(null), 4000);
      } catch (error: any) {
        setColumns(snapshot);
        alert(error.message || t('settings.kanbanReorderError'));
      } finally {
        setIsSavingKanbanOrder(false);
      }
    },
    [columns, t]
  );

  const loadLabels = async () => {
    try {
      setIsLoadingLabels(true);
      const response = await crmAPI.getLabels();
      const sortedLabels = [...response.labels].sort((a, b) => a.order - b.order);
      setLabels(sortedLabels);
      
      // Inicializar nomes e cores das labels
      const names: Record<string, string> = {};
      const colors: Record<string, string> = {};
      sortedLabels.forEach((label) => {
        names[label.id] = label.name;
        colors[label.id] = label.color;
      });
      setLabelNames(names);
      setLabelColors(colors);
    } catch (error: any) {
      console.error('Erro ao carregar labels:', error);
    } finally {
      setIsLoadingLabels(false);
    }
  };

  const handleLabelNameChange = (labelId: string, value: string) => {
    setLabelNames((prev) => ({ ...prev, [labelId]: value }));
    if (labelErrors[labelId]) {
      setLabelErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[labelId];
        return newErrors;
      });
    }
  };

  const handleLabelColorChange = (labelId: string, value: string) => {
    setLabelColors((prev) => ({ ...prev, [labelId]: value }));
    if (labelErrors[labelId]) {
      setLabelErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[labelId];
        return newErrors;
      });
    }
  };

  const handleLabelSubmit = async (labelId: string) => {
    const newName = labelNames[labelId]?.trim();
    const newColor = labelColors[labelId];
    
    if (!newName || newName.length === 0) {
      setLabelErrors((prev) => ({ ...prev, [labelId]: 'Nome da label é obrigatório' }));
      return;
    }

    if (newName.length > 50) {
      setLabelErrors((prev) => ({ ...prev, [labelId]: 'Nome deve ter no máximo 50 caracteres' }));
      return;
    }

    if (!newColor || !/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      setLabelErrors((prev) => ({ ...prev, [labelId]: 'Cor deve ser um código hexadecimal válido (ex: #FF5733)' }));
      return;
    }

    try {
      await crmAPI.updateLabel(labelId, newName, newColor);
      
      // Atualizar label localmente
      setLabels((prev) =>
        prev.map((label) => (label.id === labelId ? { ...label, name: newName, color: newColor } : label))
      );
      
      setSuccessMessage('Label atualizada com sucesso!');
    } catch (error: any) {
      setLabelErrors((prev) => ({
        ...prev,
        [labelId]: error.message || 'Erro ao atualizar label',
      }));
    }
  };

  // Limpar mensagem de sucesso após 5 segundos
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Aplicar formatação conforme o campo
    let formattedValue = value;
    if (name === 'phone') {
      formattedValue = formatPhone(value);
    } else if (name === 'name' || name === 'companyName') {
      // Não aplicar normalização enquanto digita, apenas ao salvar
      formattedValue = value;
    }
    
    setProfileData((prev) => ({ ...prev, [name]: formattedValue }));
    if (profileErrors[name as keyof ProfileFormData]) {
      setProfileErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handlePictureChange = (base64: string | null) => {
    setProfileData((prev) => ({ ...prev, profilePicture: base64 }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    if (passwordErrors[name as keyof PasswordFormData]) {
      setPasswordErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validateProfile = (): boolean => {
    const errors: Partial<Record<keyof ProfileFormData, string>> = {};

    const nameResult = validators.name(profileData.name);
    if (!nameResult.isValid && nameResult.error) {
      errors.name = t(nameResult.error);
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePassword = (): boolean => {
    const errors: Partial<Record<keyof PasswordFormData, string>> = {};

    if (!passwordData.currentPassword) {
      errors.currentPassword = t('validation.passwordRequired');
    }

    const newPasswordResult = validators.password(passwordData.newPassword);
    if (!newPasswordResult.isValid && newPasswordResult.error) {
      errors.newPassword = t(newPasswordResult.error);
    }

    const confirmPasswordResult = validators.confirmPassword(
      passwordData.confirmNewPassword,
      passwordData.newPassword
    );
    if (!confirmPasswordResult.isValid && confirmPasswordResult.error) {
      errors.confirmNewPassword = t(confirmPasswordResult.error);
    }

    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    if (!validateProfile()) {
      return;
    }

    setIsLoadingProfile(true);
    try {
      // Normalizar dados antes de enviar
      const normalizedName = normalizeName(profileData.name);
      const normalizedPhone = profileData.phone ? normalizePhone(profileData.phone) : null;
      const normalizedCompanyName = profileData.companyName ? normalizeName(profileData.companyName) : null;
      
      const response = await authAPI.updateProfile({
        name: normalizedName,
        companyName: normalizedCompanyName,
        phone: normalizedPhone,
        profilePicture: profileData.profilePicture,
        timezone: profileData.timezone,
      });

      updateUser(response.user);
      setSuccessMessage(t('settings.profileUpdated'));
    } catch (error: any) {
      setProfileErrors({
        general: error.message || t('error.updateProfileFailed'),
      });
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);

    if (!validatePassword()) {
      return;
    }

    setIsLoadingPassword(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setSuccessMessage(t('settings.passwordUpdated'));
    } catch (error: any) {
      setPasswordErrors({
        general: error.message || t('error.changePasswordFailed'),
      });
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const handleConfirmEnableDeleteCard = async () => {
    setDeleteCardPasswordError('');
    if (!deleteCardPassword.trim()) {
      setDeleteCardPasswordError(t('settings.allowDeleteCardPasswordRequired'));
      return;
    }
    try {
      setIsSavingDeleteCardPref(true);
      await crmAPI.updateAllowDeleteCard({ enabled: true, password: deleteCardPassword });
      setAllowDeleteCard(true);
      setShowDeleteCardPasswordModal(false);
      setDeleteCardPassword('');
      setSuccessMessage(t('settings.allowDeleteCardEnabled'));
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (error: any) {
      setDeleteCardPasswordError(error.message || t('settings.allowDeleteCardWrongPassword'));
    } finally {
      setIsSavingDeleteCardPref(false);
    }
  };

  return (
    <AppLayout>
      <div className="animate-fadeIn max-w-4xl mx-auto p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('settings.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Mensagem de sucesso */}
        {successMessage && (
          <div className="mb-4 md:mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-lg animate-slideIn text-sm md:text-base">
            {successMessage}
          </div>
        )}

        {/* Tabs - Scroll horizontal em mobile */}
        <div className="flex gap-2 md:gap-4 mb-4 md:mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-3 md:px-4 py-2.5 md:py-2 font-medium transition-smooth whitespace-nowrap text-sm md:text-base touch-manipulation ${
              activeTab === 'profile'
                ? 'text-clerky-backendButton border-b-2 border-clerky-backendButton'
                : 'text-gray-500 dark:text-gray-400 hover:text-clerky-backendText dark:hover:text-gray-200'
            }`}
          >
            {t('settings.profile')}
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`px-3 md:px-4 py-2.5 md:py-2 font-medium transition-smooth whitespace-nowrap text-sm md:text-base touch-manipulation ${
              activeTab === 'password'
                ? 'text-clerky-backendButton border-b-2 border-clerky-backendButton'
                : 'text-gray-500 dark:text-gray-400 hover:text-clerky-backendText dark:hover:text-gray-200'
            }`}
          >
            {t('settings.password')}
          </button>
          {showKanbanLabels && (
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-3 md:px-4 py-2.5 md:py-2 font-medium transition-smooth whitespace-nowrap text-sm md:text-base touch-manipulation ${
                activeTab === 'kanban'
                  ? 'text-clerky-backendButton border-b-2 border-clerky-backendButton'
                  : 'text-gray-500 dark:text-gray-400 hover:text-clerky-backendText dark:hover:text-gray-200'
              }`}
            >
              {t('settings.kanbanTab')}
            </button>
          )}
          {showKanbanLabels && (
            <button
              onClick={() => setActiveTab('labels')}
              className={`px-3 md:px-4 py-2.5 md:py-2 font-medium transition-smooth whitespace-nowrap text-sm md:text-base touch-manipulation ${
                activeTab === 'labels'
                  ? 'text-clerky-backendButton border-b-2 border-clerky-backendButton'
                  : 'text-gray-500 dark:text-gray-400 hover:text-clerky-backendText dark:hover:text-gray-200'
              }`}
            >
              Etiquetas
            </button>
          )}
          {showTeamTab && (
            <button
              onClick={() => setActiveTab('team')}
              className={`px-3 md:px-4 py-2.5 md:py-2 font-medium transition-smooth whitespace-nowrap text-sm md:text-base touch-manipulation ${
                activeTab === 'team'
                  ? 'text-clerky-backendButton border-b-2 border-clerky-backendButton'
                  : 'text-gray-500 dark:text-gray-400 hover:text-clerky-backendText dark:hover:text-gray-200'
              }`}
            >
              Equipe
            </button>
          )}
        </div>

        {/* Formulário de Perfil */}
        {activeTab === 'profile' && (
          <Card padding="md" shadow="lg" className="p-4 md:p-8">
            <form onSubmit={handleProfileSubmit} className="space-y-4 md:space-y-6">
              {profileErrors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {profileErrors.general}
                </div>
              )}

              {/* Foto de Perfil */}
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-4">
                  {t('settings.profilePicture')}
                </label>
                <ProfilePictureUpload
                  currentPicture={profileData.profilePicture}
                  onPictureChange={handlePictureChange}
                />
              </div>

              {/* Nome */}
              <Input
                id="name"
                name="name"
                type="text"
                label={t('settings.name')}
                value={profileData.name}
                onChange={handleProfileChange}
                placeholder={t('settings.namePlaceholder')}
                error={profileErrors.name}
                required
              />

              {/* Email (readonly) */}
              <Input
                id="email"
                name="email"
                type="email"
                label={t('settings.email')}
                value={user?.email || ''}
                disabled
                className="bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
              />

              {/* Nome da Empresa */}
              <Input
                id="companyName"
                name="companyName"
                type="text"
                label={t('settings.companyName')}
                value={profileData.companyName}
                onChange={handleProfileChange}
                placeholder={t('settings.companyNamePlaceholder')}
                error={profileErrors.companyName}
              />

              {/* Telefone */}
              <Input
                id="phone"
                name="phone"
                type="tel"
                label={t('settings.phone')}
                value={profileData.phone}
                onChange={handleProfileChange}
                placeholder={t('settings.phonePlaceholder')}
                error={profileErrors.phone}
              />

              {/* Fuso Horário */}
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  {t('settings.timezone')}
                </label>
                <select
                  name="timezone"
                  value={profileData.timezone}
                  onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                  className="w-full p-3 md:p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200 text-base md:text-sm touch-manipulation"
                >
                  <option value="America/Sao_Paulo">Brasil (São Paulo) - GMT-3</option>
                  <option value="America/Manaus">Brasil (Manaus) - GMT-4</option>
                  <option value="America/Rio_Branco">Brasil (Rio Branco) - GMT-5</option>
                  <option value="America/New_York">EUA (Nova York) - GMT-5/-4</option>
                  <option value="America/Chicago">EUA (Chicago) - GMT-6/-5</option>
                  <option value="America/Denver">EUA (Denver) - GMT-7/-6</option>
                  <option value="America/Los_Angeles">EUA (Los Angeles) - GMT-8/-7</option>
                  <option value="Europe/London">Reino Unido (Londres) - GMT+0/+1</option>
                  <option value="Europe/Paris">França (Paris) - GMT+1/+2</option>
                  <option value="Europe/Madrid">Espanha (Madrid) - GMT+1/+2</option>
                  <option value="Europe/Rome">Itália (Roma) - GMT+1/+2</option>
                  <option value="Europe/Berlin">Alemanha (Berlim) - GMT+1/+2</option>
                  <option value="Asia/Tokyo">Japão (Tóquio) - GMT+9</option>
                  <option value="Asia/Shanghai">China (Xangai) - GMT+8</option>
                  <option value="Asia/Dubai">Emirados Árabes (Dubai) - GMT+4</option>
                  <option value="Australia/Sydney">Austrália (Sydney) - GMT+10/+11</option>
                  <option value="America/Argentina/Buenos_Aires">Argentina (Buenos Aires) - GMT-3</option>
                  <option value="America/Mexico_City">México (Cidade do México) - GMT-6/-5</option>
                  <option value="America/Lima">Peru (Lima) - GMT-5</option>
                  <option value="America/Bogota">Colômbia (Bogotá) - GMT-5</option>
                  <option value="America/Santiago">Chile (Santiago) - GMT-3/-4</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('settings.timezoneHint')}
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoadingProfile}
                className="w-full py-3 md:py-2.5 touch-manipulation"
              >
                {isLoadingProfile ? t('settings.saving') : t('settings.saveProfile')}
              </Button>
            </form>

            {/* Seção de Assinatura Premium */}
            {user?.premiumPlan && user.premiumPlan !== 'free' && (
              <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
                  Assinatura Premium
                </h3>

                {isLoadingSubscription ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400">Carregando informações da assinatura...</p>
                  </div>
                ) : subscriptionError ? (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                    {subscriptionError}
                  </div>
                ) : subscription ? (
                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-[#091D41] rounded-lg p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status:</span>
                        <span className={`text-sm font-semibold ${
                          subscription.status === 'active' 
                            ? 'text-green-600 dark:text-green-400' 
                            : subscription.status === 'cancelled'
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {subscription.status === 'active' ? 'Ativa' : 
                           subscription.status === 'cancelled' ? 'Cancelada' :
                           subscription.status === 'expired' ? 'Expirada' : 'Reembolsada'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Data de Assinatura:</span>
                        <span className="text-sm text-gray-900 dark:text-gray-200">
                          {subscription.purchasedAt && !isNaN(new Date(subscription.purchasedAt).getTime())
                            ? new Date(subscription.purchasedAt).toLocaleDateString('pt-BR')
                            : 'N/A'}
                        </span>
                      </div>
                      {subscription.expiresAt && !isNaN(new Date(subscription.expiresAt).getTime()) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {subscription.status === 'cancelled' ? 'Expira em:' : 'Próxima Renovação:'}
                          </span>
                          <span className="text-sm text-gray-900 dark:text-gray-200">
                            {new Date(subscription.expiresAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                      {subscription.cancelledAt && !isNaN(new Date(subscription.cancelledAt).getTime()) && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Cancelada em:</span>
                          <span className="text-sm text-gray-900 dark:text-gray-200">
                            {new Date(subscription.cancelledAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>

                    {subscription.status === 'active' && (
                      <div className="flex justify-end mt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancelSubscription}
                          isLoading={isCancelling}
                          className="text-red-600 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-600 dark:hover:bg-red-900/20"
                        >
                          {isCancelling ? 'Cancelando...' : 'Cancelar Assinatura'}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500 dark:text-gray-400">Nenhuma assinatura encontrada.</p>
                  </div>
                )}
              </div>
            )}

            {/* Excluir conta */}
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('deleteAccount.warning')}
              </p>
              <Link
                to="/excluir-conta"
                className="inline-flex items-center text-red-600 dark:text-red-400 hover:underline font-medium text-sm"
              >
                {t('deleteAccount.title')}
              </Link>
            </div>
          </Card>
        )}

        {/* Formulário de Senha */}
        {activeTab === 'password' && (
          <Card padding="md" shadow="lg" className="p-4 md:p-8">
            <form onSubmit={handlePasswordSubmit} className="space-y-4 md:space-y-6">
              {passwordErrors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {passwordErrors.general}
                </div>
              )}

              <h2 className="text-lg md:text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-3 md:mb-4">
                {t('settings.changePassword')}
              </h2>

              {/* Senha Atual */}
              <PasswordInput
                id="currentPassword"
                name="currentPassword"
                label={t('settings.currentPassword')}
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                placeholder={t('settings.currentPasswordPlaceholder')}
                error={passwordErrors.currentPassword}
                required
              />

              {/* Nova Senha */}
              <PasswordInput
                id="newPassword"
                name="newPassword"
                label={t('settings.newPassword')}
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                placeholder={t('settings.newPasswordPlaceholder')}
                error={passwordErrors.newPassword}
                required
              />

              {/* Confirmar Nova Senha */}
              <PasswordInput
                id="confirmNewPassword"
                name="confirmNewPassword"
                label={t('settings.confirmNewPassword')}
                value={passwordData.confirmNewPassword}
                onChange={handlePasswordChange}
                placeholder={t('settings.confirmNewPasswordPlaceholder')}
                error={passwordErrors.confirmNewPassword}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoadingPassword}
                className="w-full py-3 md:py-2.5 touch-manipulation"
              >
                {isLoadingPassword ? t('settings.updating') : t('settings.updatePassword')}
              </Button>
            </form>
          </Card>
        )}

        {/* Formulário de Colunas do Kanban */}
        {activeTab === 'kanban' && (
          <Card padding="md" shadow="lg" className="p-4 md:p-8">
            <div className="space-y-4 md:space-y-6">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                  {t('settings.kanbanColumnsHeading')}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('settings.kanbanColumnsDescription')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                  {t('settings.kanbanDragHint')}
                </p>
              </div>

              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0d1f3c]">
                <h3 className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 mb-3">
                  {t('settings.kanbanAddColumnTitle')}
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                  <div className="flex-1 min-w-0">
                    <Input
                      id="new-kanban-column-name"
                      type="text"
                      value={newColumnName}
                      onChange={(e) => {
                        setNewColumnName(e.target.value);
                        if (createColumnError) setCreateColumnError(null);
                      }}
                      placeholder={t('settings.kanbanNewColumnPlaceholder')}
                      error={createColumnError || undefined}
                      maxLength={50}
                      disabled={isCreatingColumn || columns.length >= CRM_MAX_KANBAN_COLUMNS}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateColumn();
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleCreateColumn}
                    variant="primary"
                    size="md"
                    isLoading={isCreatingColumn}
                    disabled={columns.length >= CRM_MAX_KANBAN_COLUMNS}
                    className="w-full sm:w-auto shrink-0 touch-manipulation"
                  >
                    {isCreatingColumn ? t('settings.kanbanAddingColumn') : t('settings.kanbanAddColumnButton')}
                  </Button>
                </div>
                {columns.length >= CRM_MAX_KANBAN_COLUMNS && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{t('settings.kanbanMaxColumnsHint')}</p>
                )}
              </div>

              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#091D41]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-clerky-backendButton focus:ring-clerky-backendButton"
                    checked={allowDeleteCard}
                    disabled={isSavingDeleteCardPref}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        setDeleteCardPassword('');
                        setDeleteCardPasswordError('');
                        setShowDeleteCardPasswordModal(true);
                        return;
                      }
                      try {
                        setIsSavingDeleteCardPref(true);
                        await crmAPI.updateAllowDeleteCard({ enabled: false });
                        setAllowDeleteCard(false);
                        setSuccessMessage(t('settings.allowDeleteCardDisabled'));
                        setTimeout(() => setSuccessMessage(null), 4000);
                      } catch (err: any) {
                        setSuccessMessage(null);
                        alert(err.message || t('settings.allowDeleteCardSaveError'));
                      } finally {
                        setIsSavingDeleteCardPref(false);
                      }
                    }}
                  />
                  <span>
                    <span className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
                      {t('settings.allowDeleteCard')}
                    </span>
                    <span className="block text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {t('settings.allowDeleteCardHint')}
                    </span>
                  </span>
                </label>
              </div>

              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#071428] space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-clerky-backendText dark:text-gray-200">
                    {t('settings.kanbanExportHeading')}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {t('settings.kanbanExportDescription')}
                  </p>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    {t('settings.kanbanExportScopeLabel')}
                  </legend>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-scope"
                      className="h-4 w-4 text-clerky-backendButton focus:ring-clerky-backendButton"
                      checked={exportInstanceScope === 'all'}
                      onChange={() => setExportInstanceScope('all')}
                    />
                    <span className="text-sm text-clerky-backendText dark:text-gray-200">
                      {t('settings.kanbanExportScopeAll')}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="export-scope"
                      className="h-4 w-4 text-clerky-backendButton focus:ring-clerky-backendButton"
                      checked={exportInstanceScope === 'selected'}
                      onChange={() => setExportInstanceScope('selected')}
                    />
                    <span className="text-sm text-clerky-backendText dark:text-gray-200">
                      {t('settings.kanbanExportScopeSelected')}
                    </span>
                  </label>
                </fieldset>

                {exportInstanceScope === 'selected' && (
                  <div className="flex flex-wrap items-center gap-3">
                    {isLoadingExportInstances ? (
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('crm.instancesLoading')}</span>
                    ) : exportInstances.length > 0 ? (
                      <CrmInstancePicker
                        instances={exportInstances}
                        selected={exportSelectedInstances}
                        isLoading={isLoadingExportInstances}
                        onToggle={toggleExportInstanceSelection}
                        onSelectAll={selectAllExportInstances}
                        onClear={clearExportInstanceSelection}
                        t={t}
                      />
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">{t('crm.instancesNone')}</span>
                    )}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="export-kanban-column"
                    className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1"
                  >
                    {t('settings.kanbanExportColumnLabel')}
                  </label>
                  <select
                    id="export-kanban-column"
                    value={exportColumnId}
                    onChange={(e) => setExportColumnId(e.target.value)}
                    disabled={isLoadingColumns}
                    className="w-full max-w-md p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-[#091D41] dark:text-gray-200 text-base md:text-sm"
                  >
                    <option value="">{t('settings.kanbanExportColumnAll')}</option>
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={handleExportLeadsCsv}
                  isLoading={isExportingLeads}
                  disabled={
                    isExportingLeads ||
                    (exportInstanceScope === 'selected' && exportSelectedInstances.length === 0)
                  }
                  className="touch-manipulation"
                >
                  {isExportingLeads ? t('settings.kanbanExporting') : t('settings.kanbanExportButton')}
                </Button>
              </div>

              {isLoadingColumns ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clerky-backendButton mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-300">Carregando colunas...</p>
                </div>
              ) : (
                <DndContext sensors={kanbanColumnReorderSensors} onDragEnd={handleKanbanColumnDragEnd}>
                  <SortableContext
                    items={columns.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3 md:space-y-4">
                      {columns.map((column) => (
                        <SortableKanbanColumnSettingsRow
                          key={column.id}
                          column={column}
                          columnNames={columnNames}
                          columnErrors={columnErrors}
                          columnsLength={columns.length}
                          onNameChange={handleColumnNameChange}
                          onNameSubmit={handleColumnNameSubmit}
                          onDelete={handleDeleteColumn}
                          reorderDisabled={isSavingKanbanOrder}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </Card>
        )}

        {/* Formulário de Labels */}
        {activeTab === 'labels' && (
          <Card padding="md" shadow="lg" className="p-4 md:p-8">
            <div className="space-y-4 md:space-y-6">
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                  Gerenciar Etiquetas
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                  Configure até 5 etiquetas com nomes e cores personalizadas para categorizar seus contatos.
                </p>
              </div>

              {isLoadingLabels ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clerky-backendButton mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-300">Carregando etiquetas...</p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {labels.map((label) => (
                    <div
                      key={label.id}
                      className="flex flex-col md:flex-row md:items-start gap-3 md:gap-4 p-3 md:p-4 bg-gray-50 dark:bg-[#091D41] rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex-1 space-y-3 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200">
                            Etiqueta {label.order + 1}
                          </label>
                          <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded font-mono">
                            ID: {label.shortId}
                          </span>
                          <div
                            className="w-6 h-6 rounded border-2 border-gray-300 dark:border-gray-600 flex-shrink-0"
                            style={{ backgroundColor: labelColors[label.id] || label.color }}
                          ></div>
                        </div>
                        <Input
                          id={`label-name-${label.id}`}
                          type="text"
                          value={labelNames[label.id] || ''}
                          onChange={(e) => handleLabelNameChange(label.id, e.target.value)}
                          placeholder="Nome da etiqueta"
                          error={labelErrors[label.id]}
                          maxLength={50}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleLabelSubmit(label.id);
                            }
                          }}
                        />
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                          <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 whitespace-nowrap">
                            Cor:
                          </label>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input
                            type="color"
                            value={labelColors[label.id] || label.color}
                            onChange={(e) => handleLabelColorChange(label.id, e.target.value)}
                              className="w-12 h-10 md:h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer touch-manipulation flex-shrink-0"
                          />
                          <Input
                            id={`label-color-${label.id}`}
                            type="text"
                            value={labelColors[label.id] || label.color}
                            onChange={(e) => handleLabelColorChange(label.id, e.target.value)}
                            placeholder="#FF5733"
                              className="flex-1 min-w-0"
                            maxLength={7}
                            pattern="^#[0-9A-Fa-f]{6}$"
                          />
                          </div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleLabelSubmit(label.id)}
                        variant="primary"
                        size="md"
                        className="w-full md:w-auto mt-0 md:mt-6 py-2.5 md:py-2 touch-manipulation"
                      >
                        Salvar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'team' && showTeamTab && <TeamEnterpriseSection />}
      </div>

      <Modal
        isOpen={showDeleteCardPasswordModal}
        onClose={() => {
          if (!isSavingDeleteCardPref) {
            setShowDeleteCardPasswordModal(false);
            setDeleteCardPassword('');
            setDeleteCardPasswordError('');
          }
        }}
        title={t('settings.allowDeleteCardPasswordTitle')}
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t('settings.allowDeleteCardPasswordDescription')}
        </p>
        <PasswordInput
          id="allow-delete-card-password"
          name="allowDeleteCardPassword"
          label={t('settings.currentPassword')}
          value={deleteCardPassword}
          onChange={(e) => setDeleteCardPassword(e.target.value)}
          placeholder={t('settings.currentPasswordPlaceholder')}
          error={deleteCardPasswordError}
          autoComplete="current-password"
        />
        <div className="flex flex-col-reverse sm:flex-row gap-2 mt-6 justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isSavingDeleteCardPref}
            onClick={() => {
              setShowDeleteCardPasswordModal(false);
              setDeleteCardPassword('');
              setDeleteCardPasswordError('');
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            isLoading={isSavingDeleteCardPref}
            onClick={handleConfirmEnableDeleteCard}
          >
            {t('common.confirm')}
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
};

export default Settings;
