import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, Button, Modal, ImageCrop } from '../UI';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { instanceAPI, Instance, CreateOfficialInstanceData, WhatsAppBusinessProfile, WhatsAppPhoneSettings, BusinessHoursConfig } from '../../services/api';
import { useSocket } from '../../hooks/useSocket';
import { getErrorMessage, logError } from '../../utils/errorHandler';

/** Converte data URL (base64) em File para upload */
function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = (arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg') as string;
  const bstr = atob(arr[1]);
  const u8arr = new Uint8Array(bstr.length);
  for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}

declare global {
  interface Window {
    FB?: {
      init: (params: { appId: string; autoLogAppEvents?: boolean; xfbml?: boolean; version: string }) => void;
      login: (callback: (r: { authResponse?: { code?: string } }) => void, opts: { config_id: string; response_type: string; override_default_response_type: boolean; extras: object }) => void;
    };
  }
}

const META_APP_ID = process.env.REACT_APP_META_APP_ID || '';
const META_CONFIG_ID = process.env.REACT_APP_META_EMBEDDED_SIGNUP_CONFIG_ID || '';
const OAUTH_CALLBACK_URL = process.env.REACT_APP_OAUTH_WHATSAPP_CALLBACK_URL || window.location.origin + '/oauth/whatsapp/callback';

const DAY_LABELS: Record<string, string> = {
  sun: 'Dom',
  mon: 'Seg',
  tue: 'Ter',
  wed: 'Qua',
  thu: 'Qui',
  fri: 'Sex',
  sat: 'Sáb',
};

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const SettingsBusinessHoursDisplay: React.FC<{ data: BusinessHoursConfig }> = ({ data }) => {
  const config = data.config;
  if (!config?.length) {
    return <span className="text-xs text-gray-500 dark:text-gray-400">Não configurado</span>;
  }
  return (
    <div className="text-xs space-y-1">
      {data.timezone && <p className="text-gray-500 dark:text-gray-400">Fuso: {data.timezone}</p>}
      <ul className="list-disc list-inside">
        {config.map((day, i) => (
          <li key={i}>
            {DAY_LABELS[(day.day || '').toLowerCase()] || day.day}:{' '}
            {day.mode === 'open_24h' ? '24h' : day.openTime != null && day.closeTime != null ? `${minutesToTime(day.openTime)} – ${minutesToTime(day.closeTime)}` : '—'}
          </li>
        ))}
      </ul>
    </div>
  );
};

interface SettingsProfileFormProps {
  profile: WhatsAppBusinessProfile | null;
  verticalOptions: { value: string; label: string }[];
  onSave: (data: Partial<WhatsAppBusinessProfile>) => Promise<void>;
  saving: boolean;
  instanceId?: string;
  onUploadPicture?: (file: File) => Promise<void>;
  uploadingPicture?: boolean;
}

const SettingsProfileForm: React.FC<SettingsProfileFormProps> = ({
  profile,
  verticalOptions,
  onSave,
  saving,
  instanceId,
  onUploadPicture,
  uploadingPicture,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [about, setAbout] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [vertical, setVertical] = useState('');
  const [website0, setWebsite0] = useState('');
  const [website1, setWebsite1] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  /** Preview local após upload (evita "Sem foto" enquanto a API não devolve profile_picture_url) */
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setAbout(profile.about ?? '');
    setDescription(profile.description ?? '');
    setAddress(profile.address ?? '');
    setEmail(profile.email ?? '');
    setVertical(profile.vertical ?? '');
    const sites = profile.websites ?? [];
    setWebsite0(sites[0] ?? '');
    setWebsite1(sites[1] ?? '');
  }, [profile]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const websites: string[] = [];
    if (website0.trim()) websites.push(website0.trim());
    if (website1.trim()) websites.push(website1.trim());
    onSave({
      about: about.trim() || undefined,
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      email: email.trim() || undefined,
      vertical: vertical || undefined,
      websites: websites.length ? websites : undefined,
    });
  };

  const photoDisplayUrl = profile?.profile_picture_url || uploadedPreviewUrl;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCropImageSrc(url);
    setShowCropModal(true);
  };

  const handleCropConfirm = useCallback(
    async (croppedBase64: string) => {
      if (!onUploadPicture || !cropImageSrc) return;
      if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
      setShowCropModal(false);
      const file = dataURLtoFile(croppedBase64, 'profile.jpg');
      try {
        await onUploadPicture(file);
        setUploadedPreviewUrl(croppedBase64);
      } catch {
        // Erro já tratado no parent; não reabre o modal
      }
    },
    [onUploadPicture, cropImageSrc]
  );

  const handleCropCancel = useCallback(() => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(null);
    setShowCropModal(false);
  }, [cropImageSrc]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showCropModal && cropImageSrc && (
        <Modal
          isOpen={showCropModal}
          onClose={handleCropCancel}
          title="Ajustar foto"
        >
          <div className="min-h-[400px]">
            <ImageCrop
              imageSrc={cropImageSrc}
              onCrop={handleCropConfirm}
              onCancel={handleCropCancel}
              aspectRatio={1}
              circular={true}
            />
          </div>
        </Modal>
      )}
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Perfil do negócio</h3>
      <div className="flex items-center gap-4 flex-wrap">
        {photoDisplayUrl ? (
          <img
            src={photoDisplayUrl}
            alt="Foto do perfil"
            className="h-20 w-20 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700"
          />
        ) : (
          <div className="h-20 w-20 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center px-1">
            Sem foto
          </div>
        )}
        <div className="flex flex-col gap-1">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {photoDisplayUrl ? 'Foto do perfil WhatsApp' : 'Adicione uma foto (JPEG ou PNG, até 5 MB)'}
          </span>
          {instanceId && onUploadPicture && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingPicture}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadingPicture ? 'Enviando...' : 'Alterar foto'}
              </Button>
            </>
          )}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sobre (até 139 caracteres)</label>
        <input
          type="text"
          maxLength={139}
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição (até 512 caracteres)</label>
        <textarea
          rows={3}
          maxLength={512}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Endereço (até 256 caracteres)</label>
        <input
          type="text"
          maxLength={256}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">E-mail (até 128 caracteres)</label>
        <input
          type="email"
          maxLength={128}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria (vertical)</label>
        <select
          value={vertical}
          onChange={(e) => setVertical(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          {verticalOptions.map((opt) => (
            <option key={opt.value || 'empty'} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sites (até 2, com http:// ou https://)</label>
        <input
          type="url"
          placeholder="https://..."
          value={website0}
          onChange={(e) => setWebsite0(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-2"
        />
        <input
          type="url"
          placeholder="https://..."
          value={website1}
          onChange={(e) => setWebsite1(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar perfil'}
        </Button>
      </div>
    </form>
  );
};

const WhatsAppOfficialInstances: React.FC = () => {
  const { t } = useLanguage();
  const { token, user } = useAuth();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<Instance | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [instanceToRegister, setInstanceToRegister] = useState<Instance | null>(null);
  const [registerPin, setRegisterPin] = useState('');
  const [registerPinConfirm, setRegisterPinConfirm] = useState('');
  const [registerPinVisible, setRegisterPinVisible] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [settingsProfile, setSettingsProfile] = useState<WhatsAppBusinessProfile | null>(null);
  const [settingsPhone, setSettingsPhone] = useState<WhatsAppPhoneSettings | null>(null);
  const [settingsProfileLoading, setSettingsProfileLoading] = useState(false);
  const [settingsProfileSaving, setSettingsProfileSaving] = useState(false);
  const [settingsProfileError, setSettingsProfileError] = useState<string | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const pendingSignup = useRef<{ name: string; waba_id?: string; phone_number_id?: string; code?: string; redirect_uri?: string } | null>(null);

  const VERTICAL_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: '— Selecione —' },
    { value: 'OTHER', label: 'Outro' },
    { value: 'AUTO', label: 'Automotivo' },
    { value: 'BEAUTY', label: 'Beleza, spa e salão' },
    { value: 'APPAREL', label: 'Vestuário' },
    { value: 'EDU', label: 'Educação' },
    { value: 'ENTERTAIN', label: 'Entretenimento' },
    { value: 'EVENT_PLAN', label: 'Eventos' },
    { value: 'FINANCE', label: 'Finanças e bancos' },
    { value: 'GROCERY', label: 'Alimentos e supermercado' },
    { value: 'GOVT', label: 'Serviço público' },
    { value: 'HOTEL', label: 'Hotéis e hospedagem' },
    { value: 'HEALTH', label: 'Saúde' },
    { value: 'NONPROFIT', label: 'Sem fins lucrativos' },
    { value: 'PROF_SERVICES', label: 'Serviços profissionais' },
    { value: 'RETAIL', label: 'Varejo' },
    { value: 'TRAVEL', label: 'Viagens e transporte' },
    { value: 'RESTAURANT', label: 'Restaurante' },
    { value: 'ALCOHOL', label: 'Bebidas alcoólicas' },
    { value: 'ONLINE_GAMBLING', label: 'Jogos online' },
    { value: 'PHYSICAL_GAMBLING', label: 'Jogos (físico)' },
    { value: 'OTC_DRUGS', label: 'Medicamentos sem receita' },
    { value: 'MATRIMONY_SERVICE', label: 'Serviços matrimoniais' },
  ];

  const maxWhatsApp = user?.maxWhatsAppInstances ?? 0;
  const officialOnly = instances.filter((i) => i.integration === 'WHATSAPP-CLOUD');
  const atLimit = maxWhatsApp > 0 && instances.length >= maxWhatsApp;

  const handleStatusUpdate = useCallback((data: { instanceId: string; status: string }) => {
    setInstances((prev) =>
      prev.map((inst) =>
        inst.id === data.instanceId ? { ...inst, status: data.status as Instance['status'] } : inst
      )
    );
  }, []);

  useSocket(token, handleStatusUpdate);

  const loadInstances = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await instanceAPI.getAll();
      setInstances(response.instances);
      setError(null);
    } catch (err: unknown) {
      logError('WhatsAppOfficialInstances.loadInstances', err);
      setError(getErrorMessage(err, 'Falha ao carregar instâncias'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const submitPendingOfficial = useCallback(async () => {
    const p = pendingSignup.current;
    if (!p || !p.name || !p.waba_id || !p.phone_number_id) return;
    try {
      setIsCreating(true);
      setError(null);
      const data: CreateOfficialInstanceData = {
        name: p.name.trim(),
        waba_id: p.waba_id,
        phone_number_id: p.phone_number_id,
      };
      if (p.code && p.redirect_uri) {
        data.code = p.code;
        data.redirect_uri = p.redirect_uri;
      }
      const response = await instanceAPI.createOfficial(data);
      setInstances((prev) => [...prev, response.instance]);
      setShowCreateModal(false);
      setCreateName('');
      pendingSignup.current = null;
      await loadInstances();
      setRegisterPin('');
      setRegisterPinConfirm('');
      setRegisterPinVisible(false);
      setInstanceToRegister(response.instance);
      setShowRegisterModal(true);
    } catch (err: unknown) {
      logError('WhatsAppOfficialInstances.createOfficial', err);
      setError(getErrorMessage(err, 'Falha ao criar instância oficial'));
    } finally {
      setIsCreating(false);
    }
  }, [loadInstances]);


  useEffect(() => {
    if (!META_APP_ID || typeof window.FB === 'undefined') return;
    window.FB.init({
      appId: META_APP_ID,
      autoLogAppEvents: true,
      xfbml: true,
      version: 'v25.0',
    });
  }, []);

  useEffect(() => {
    if (!showSettingsModal || !selectedInstance?.id) return;
    setSettingsProfileError(null);
    setSettingsProfile(null);
    setSettingsPhone(null);
    let cancelled = false;
    (async () => {
      setSettingsProfileLoading(true);
      try {
        const [profileRes, settingsRes] = await Promise.all([
          instanceAPI.getWhatsAppProfile(selectedInstance.id),
          instanceAPI.getWhatsAppSettings(selectedInstance.id),
        ]);
        if (!cancelled) {
          setSettingsProfile(profileRes.data ?? null);
          setSettingsPhone(settingsRes.data ?? null);
        }
      } catch (err: unknown) {
        if (!cancelled) setSettingsProfileError(getErrorMessage(err, 'Erro ao carregar configurações'));
      } finally {
        if (!cancelled) setSettingsProfileLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showSettingsModal, selectedInstance?.id]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com' && event.origin !== 'https://web.facebook.com') return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (data.event === 'FINISH' && data.data?.phone_number_id && data.data?.waba_id) {
          const name = pendingSignup.current?.name || 'WhatsApp Oficial';
          if (!pendingSignup.current) pendingSignup.current = { name };
          pendingSignup.current.waba_id = data.data.waba_id;
          pendingSignup.current.phone_number_id = data.data.phone_number_id;
          submitPendingOfficial();
        } else if (data.event === 'ERROR') {
          setError(data.data?.error_message || 'Erro no cadastro incorporado');
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [submitPendingOfficial]);

  const launchEmbeddedSignup = () => {
    const name = createName.trim() || 'WhatsApp Oficial';
    pendingSignup.current = { name };
    if (typeof window.FB === 'undefined') {
      setError('SDK do Facebook não carregado. Recarregue a página.');
      return;
    }
    window.FB.login(
      (response) => {
        if (response.authResponse?.code && pendingSignup.current) {
          pendingSignup.current.code = response.authResponse.code;
          pendingSignup.current.redirect_uri = OAUTH_CALLBACK_URL;
        }
      },
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { version: 'v3', setup: {} },
      }
    );
  };

  const handleRegisterPhone = async () => {
    const pin = registerPin.trim();
    const pinConfirm = registerPinConfirm.trim();
    if (!instanceToRegister) return;
    if (!/^\d{6}$/.test(pin)) {
      setError('Informe o PIN de 6 dígitos.');
      return;
    }
    if (pin !== pinConfirm) {
      setError('A confirmação não confere. Digite os 6 dígitos iguais nos dois campos.');
      return;
    }
    try {
      setIsRegistering(true);
      setError(null);
      await instanceAPI.registerOfficialPhone(instanceToRegister.id, pin);
      setSuccessMessage('Número registrado. O status deve sair de Pendente em instantes.');
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowRegisterModal(false);
      setInstanceToRegister(null);
      setRegisterPin('');
      setRegisterPinConfirm('');
      setRegisterPinVisible(false);
      await loadInstances();
    } catch (err: unknown) {
      logError('WhatsAppOfficialInstances.registerPhone', err);
      setError(getErrorMessage(err, 'Falha ao registrar número'));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeleteInstance = async (id: string) => {
    if (!window.confirm('Excluir esta instância oficial?')) return;
    try {
      await instanceAPI.delete(id);
      setInstances((prev) => prev.filter((inst) => inst.id !== id));
      setSuccessMessage('Instância excluída.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Falha ao excluir'));
    }
  };

  const getStatusText = (status: Instance['status']) => {
    switch (status) {
      case 'connected': return 'Conectada';
      case 'connecting': return 'Conectando';
      case 'disconnected': return 'Desconectada';
      case 'error': return 'Erro';
      default: return status;
    }
  };

  return (
    <div>
      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-lg">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="mb-6 flex justify-end">
        <Button
          variant="primary"
          size="lg"
          onClick={() => { setCreateName(''); setShowCreateModal(true); setError(null); }}
          disabled={atLimit}
        >
          Conectar número (API Oficial)
        </Button>
      </div>

      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setCreateName(''); pendingSignup.current = null; }}
          title="Conectar WhatsApp (API Oficial)"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da instância</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Ex: Atendimento"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ao clicar em Conectar, será aberta a janela do Facebook para vincular seu número ao OnlyFlow.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={launchEmbeddedSignup} disabled={isCreating}>
                {isCreating ? 'Conectando...' : 'Conectar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isLoading ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-300">Carregando...</p>
          </div>
        </Card>
      ) : officialOnly.length === 0 ? (
        <Card padding="lg" shadow="lg">
          <div className="text-center py-12">
            <p className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
              Nenhuma instância da API Oficial
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Conecte um número pelo botão acima para usar a WhatsApp Cloud API (Meta).
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {officialOnly.map((instance) => (
            <Card key={instance.id} padding="lg" shadow="lg" className="hover:shadow-xl transition-shadow">
              <div className="mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-100 truncate">
                    {instance.name}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    instance.status === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {getStatusText(instance.status)}
                  </span>
                </div>
              </div>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">Internal Name:</span>
                  <span className="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium truncate">
                    {instance.instanceName}
                  </span>
                </div>
                {instance.token && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">Token API:</span>
                    <code className="flex-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-xs font-mono rounded truncate">
                      {instance.token}
                    </code>
                  </div>
                )}
                {(instance.display_phone_number || instance.connectionLink) && (
                  <div className="flex items-start gap-3 text-sm">
                    <span className="w-24 flex-shrink-0 text-gray-500 dark:text-gray-400 font-medium">Link:</span>
                    <a
                      href={instance.connectionLink || `https://wa.me/${(instance.display_phone_number || '').replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-clerky-backendButton hover:underline truncate"
                    >
                      {instance.display_phone_number || instance.connectionLink}
                    </a>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setSelectedInstance(instance); setShowSettingsModal(true); }}>
                  Configurações
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDeleteInstance(instance.id)}>
                  Excluir
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showSettingsModal && selectedInstance && (
        <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Configurações">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Instância: <strong>{selectedInstance.name}</strong>
          </p>
          {settingsProfileError && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">{settingsProfileError}</p>
          )}
          {settingsProfileLoading ? (
            <p className="text-gray-500 dark:text-gray-400">Carregando...</p>
          ) : (
            <>
              {settingsPhone && (
                <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Configurações do número</h3>
                  <dl className="grid grid-cols-1 gap-2 text-sm">
                    {settingsPhone.display_phone_number && (
                      <div><dt className="text-gray-500 dark:text-gray-400">Número</dt><dd className="font-medium">{settingsPhone.display_phone_number}</dd></div>
                    )}
                    {settingsPhone.verified_name && (
                      <div><dt className="text-gray-500 dark:text-gray-400">Nome verificado</dt><dd className="font-medium">{settingsPhone.verified_name}</dd></div>
                    )}
                    {settingsPhone.quality_rating && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Qualidade</dt>
                        <dd className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor:
                                settingsPhone.quality_rating === 'GREEN'
                                  ? '#22c55e'
                                  : settingsPhone.quality_rating === 'YELLOW'
                                  ? '#eab308'
                                  : settingsPhone.quality_rating === 'RED'
                                  ? '#ef4444'
                                  : '#9ca3af',
                            }}
                            title={settingsPhone.quality_rating}
                            aria-hidden
                          />
                        </dd>
                      </div>
                    )}
                    {settingsPhone.messaging_limit_tier && (
                      <div>
                        <dt className="text-gray-500 dark:text-gray-400">Limites diários de conversas iniciadas</dt>
                        <dd>
                          {(() => {
                            const tier = settingsPhone.messaging_limit_tier;
                            const match = /TIER_(\d+)/i.exec(tier);
                            const num = match ? match[1] : tier;
                            return <>{num}</>;
                          })()}
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-gray-500 dark:text-gray-400 mb-1">Horário de funcionamento</dt>
                      <dd className="text-gray-700 dark:text-gray-300">
                        {settingsPhone.business_hours ? (
                          <SettingsBusinessHoursDisplay data={settingsPhone.business_hours} />
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Configure no app WhatsApp Business ou no{' '}
                            <a
                              href="https://business.facebook.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-clerky-backendButton hover:underline"
                            >
                              Meta Business Suite
                            </a>
                            .
                          </p>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              <SettingsProfileForm
                profile={settingsProfile}
                verticalOptions={VERTICAL_OPTIONS}
                instanceId={selectedInstance?.id}
                onUploadPicture={async (file) => {
                  if (!selectedInstance?.id) return;
                  setUploadingPicture(true);
                  setSettingsProfileError(null);
                  try {
                    await instanceAPI.uploadWhatsAppProfilePicture(selectedInstance.id, file);
                    const res = await instanceAPI.getWhatsAppProfile(selectedInstance.id);
                    setSettingsProfile(res.data ?? null);
                  } catch (err: unknown) {
                    setSettingsProfileError(getErrorMessage(err, 'Erro ao enviar foto'));
                  } finally {
                    setUploadingPicture(false);
                  }
                }}
                uploadingPicture={uploadingPicture}
                onSave={async (data) => {
                  if (!selectedInstance?.id) return;
                  setSettingsProfileSaving(true);
                  setSettingsProfileError(null);
                  try {
                    await instanceAPI.patchWhatsAppProfile(selectedInstance.id, data);
                    setSettingsProfile((prev) => (prev ? { ...prev, ...data } : data));
                  } catch (err: unknown) {
                    setSettingsProfileError(getErrorMessage(err, 'Erro ao salvar perfil'));
                  } finally {
                    setSettingsProfileSaving(false);
                  }
                }}
                saving={settingsProfileSaving}
              />
            </>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={() => setShowSettingsModal(false)}>Fechar</Button>
          </div>
        </Modal>
      )}

      {showRegisterModal && instanceToRegister && (
        <Modal
          isOpen={showRegisterModal}
          onClose={() => {
            setShowRegisterModal(false);
            setInstanceToRegister(null);
            setRegisterPin('');
            setRegisterPinConfirm('');
            setRegisterPinVisible(false);
          }}
          title="Definir confirmação em 2 etapas"
        >
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Para ativar o número na API Oficial, defina o <strong>PIN de 6 dígitos</strong> da verificação em duas etapas da sua conta WhatsApp Business (configurado no app ou no Meta Business Suite).
          </p>
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIN (6 dígitos)</label>
              <input
                type={registerPinVisible ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={registerPin}
                onChange={(e) => setRegisterPin(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar (6 dígitos)</label>
              <input
                type={registerPinVisible ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={6}
                value={registerPinConfirm}
                onChange={(e) => setRegisterPinConfirm(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setRegisterPinVisible((v) => !v)}
              >
                {registerPinVisible ? 'Ocultar' : 'Mostrar'} dígitos
              </Button>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowRegisterModal(false);
                setInstanceToRegister(null);
                setRegisterPin('');
                setRegisterPinConfirm('');
                setRegisterPinVisible(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleRegisterPhone}
              disabled={
                isRegistering ||
                registerPin.length !== 6 ||
                registerPinConfirm.length !== 6 ||
                registerPin !== registerPinConfirm
              }
            >
              {isRegistering ? 'Registrando...' : 'Confirmar'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default WhatsAppOfficialInstances;
