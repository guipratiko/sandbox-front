import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, Button, Input, PasswordInput, ProfilePictureUpload } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { authAPI, crmAPI, CRMColumn, Label, subscriptionAPI, Subscription } from '../services/api';
import { validators } from '../utils/validators';
import { normalizeName, formatPhone, normalizePhone } from '../utils/formatters';

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

const Settings: React.FC = () => {
  const { t } = useLanguage();
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'kanban' | 'labels'>('profile');
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
    if (activeTab === 'profile' && user?.premiumPlan && user.premiumPlan !== 'free') {
      loadSubscription();
    }
  }, [activeTab, user?.premiumPlan]);

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

  // Carregar colunas do Kanban
  useEffect(() => {
    if (activeTab === 'kanban') {
      loadColumns();
    }
  }, [activeTab]);

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
          <button
            onClick={() => setActiveTab('kanban')}
            className={`px-3 md:px-4 py-2.5 md:py-2 font-medium transition-smooth whitespace-nowrap text-sm md:text-base touch-manipulation ${
              activeTab === 'kanban'
                ? 'text-clerky-backendButton border-b-2 border-clerky-backendButton'
                : 'text-gray-500 dark:text-gray-400 hover:text-clerky-backendText dark:hover:text-gray-200'
            }`}
          >
            Colunas do Kanban
          </button>
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
                  Gerenciar Colunas do Kanban
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 md:mb-6">
                  Edite os nomes das colunas do seu Kanban CRM. As alterações serão aplicadas imediatamente.
                </p>
              </div>

              {isLoadingColumns ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clerky-backendButton mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-300">Carregando colunas...</p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {columns.map((column) => (
                    <div
                      key={column.id}
                      className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 p-3 md:p-4 bg-gray-50 dark:bg-[#091D41] rounded-lg border border-gray-200 dark:border-gray-700"
                    >
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
                          onChange={(e) => handleColumnNameChange(column.id, e.target.value)}
                          placeholder="Nome da coluna"
                          error={columnErrors[column.id]}
                          maxLength={50}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleColumnNameSubmit(column.id);
                            }
                          }}
                        />
                      </div>
                      <Button
                        onClick={() => handleColumnNameSubmit(column.id)}
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
      </div>
    </AppLayout>
  );
};

export default Settings;
