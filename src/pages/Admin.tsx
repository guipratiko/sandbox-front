import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button, Input, Modal } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { adminAPI, SendPromotionData, Banner, CreateBannerData, UpdateBannerData, SystemNews, CreateNewsData, UpdateNewsData } from '../services/api';
import { getErrorMessage, logError } from '../utils/errorHandler';

type TabType = 'notifications' | 'banners' | 'news';

/** Identificadores salvos em `tool` nas novidades (dashboard / API). */
const NEWS_TOOL_PRESETS: { value: string; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'crm', label: 'CRM' },
  { value: 'dispatches', label: 'Disparos' },
  { value: 'workflows', label: 'Workflows' },
  { value: 'ai_agent', label: 'Agente de IA' },
  { value: 'groups', label: 'Grupos' },
  { value: 'scrapingflow', label: 'Scraping Flow' },
];
const NEWS_TOOL_PRESET_SET = new Set(NEWS_TOOL_PRESETS.map((p) => p.value));

function labelForNewsTool(tool: string | null | undefined): string {
  if (!tool) return '';
  const preset = NEWS_TOOL_PRESETS.find((p) => p.value === tool);
  return preset ? preset.label : tool;
}

const Admin: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('notifications');
  
  // Estados para Notificações
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'all'>('all');
  const [isPremium, setIsPremium] = useState<string>('all');
  const [promoId, setPromoId] = useState('');
  const [promoUrl, setPromoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    totalDevices: number;
    successCount: number;
    failedCount: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Estados para Banners
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = useState(false);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [bannerFormData, setBannerFormData] = useState<CreateBannerData>({
    imageUrl: '',
    linkUrl: '',
    title: '',
    order: 0,
    isActive: true,
  });

  // Estados para Novidades
  const [news, setNews] = useState<SystemNews[]>([]);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [editingNews, setEditingNews] = useState<SystemNews | null>(null);
  const [showDeleteNewsModal, setShowDeleteNewsModal] = useState<string | null>(null);
  const [newsFormData, setNewsFormData] = useState<CreateNewsData>({
    type: 'system_update',
    tool: null,
    title: '',
    description: '',
    fullContent: null,
    imageUrl: null,
    isActive: true,
    priority: 5,
  });
  /** true = opção "Outro (texto livre)" no select de ferramenta */
  const [newsToolUseCustom, setNewsToolUseCustom] = useState(false);

  // Carregar banners
  const loadBanners = useCallback(async () => {
    try {
      setIsLoadingBanners(true);
      const response = await adminAPI.getAllBanners();
      setBanners(response.data);
    } catch (err: unknown) {
      logError('Erro ao carregar banners', err);
      setError(getErrorMessage(err, 'Erro ao carregar banners'));
    } finally {
      setIsLoadingBanners(false);
    }
  }, []);

  // Carregar novidades
  const loadNews = useCallback(async () => {
    try {
      setIsLoadingNews(true);
      const response = await adminAPI.getAllNews();
      setNews(response.data);
    } catch (err: unknown) {
      logError('Erro ao carregar novidades', err);
      setError(getErrorMessage(err, 'Erro ao carregar novidades'));
    } finally {
      setIsLoadingNews(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'banners') {
      loadBanners();
    } else if (activeTab === 'news') {
      loadNews();
    }
  }, [activeTab, loadBanners, loadNews]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const data: SendPromotionData = {
        title: title.trim(),
        body: body.trim(),
        data: {
          ...(promoId && { promoId: promoId.trim() }),
          ...(promoUrl && { url: promoUrl.trim() }),
        },
        filters: {
          ...(platform !== 'all' && { platform }),
          ...(isPremium !== 'all' && { isPremium: isPremium === 'true' }),
        },
      };

      const response = await adminAPI.sendPromotion(data);
      setResult(response.result);
    } catch (err: any) {
      setError(err.message || 'Erro ao enviar notificação');
    } finally {
      setIsLoading(false);
    }
  };

  // Handlers para Banners
  const handleOpenBannerModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setBannerFormData({
        imageUrl: banner.imageUrl,
        linkUrl: banner.linkUrl || '',
        title: banner.title || '',
        order: banner.order,
        isActive: banner.isActive,
      });
    } else {
      setEditingBanner(null);
      setBannerFormData({
        imageUrl: '',
        linkUrl: '',
        title: '',
        order: banners.length > 0 ? Math.max(...banners.map(b => b.order)) + 1 : 0,
        isActive: true,
      });
    }
    setShowBannerModal(true);
  };

  const handleCloseBannerModal = () => {
    setShowBannerModal(false);
    setEditingBanner(null);
    setBannerFormData({
      imageUrl: '',
      linkUrl: '',
      title: '',
      order: 0,
      isActive: true,
    });
  };

  const handleSaveBanner = async () => {
    try {
      setError(null);
      if (editingBanner) {
        await adminAPI.updateBanner(editingBanner.id, bannerFormData);
      } else {
        await adminAPI.createBanner(bannerFormData);
      }
      handleCloseBannerModal();
      loadBanners();
    } catch (err: unknown) {
      logError('Erro ao salvar banner', err);
      setError(getErrorMessage(err, 'Erro ao salvar banner'));
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      setError(null);
      await adminAPI.deleteBanner(id);
      setShowDeleteModal(null);
      loadBanners();
    } catch (err: unknown) {
      logError('Erro ao deletar banner', err);
      setError(getErrorMessage(err, 'Erro ao deletar banner'));
    }
  };

  const handleToggleBannerStatus = async (banner: Banner) => {
    try {
      setError(null);
      await adminAPI.updateBanner(banner.id, { isActive: !banner.isActive });
      loadBanners();
    } catch (err: unknown) {
      logError('Erro ao atualizar status do banner', err);
      setError(getErrorMessage(err, 'Erro ao atualizar status do banner'));
    }
  };

  // Handlers para Novidades
  const handleOpenNewsModal = (newsItem?: SystemNews) => {
    if (newsItem) {
      setEditingNews(newsItem);
      const t = newsItem.tool || null;
      setNewsToolUseCustom(Boolean(t && !NEWS_TOOL_PRESET_SET.has(t)));
      setNewsFormData({
        type: newsItem.type,
        tool: t,
        title: newsItem.title,
        description: newsItem.description,
        fullContent: newsItem.fullContent || null,
        imageUrl: newsItem.imageUrl || null,
        publishedAt: newsItem.publishedAt,
        isActive: newsItem.isActive,
        priority: newsItem.priority,
      });
    } else {
      setEditingNews(null);
      setNewsToolUseCustom(false);
      setNewsFormData({
        type: 'system_update',
        tool: null,
        title: '',
        description: '',
        fullContent: null,
        imageUrl: null,
        isActive: true,
        priority: 5,
      });
    }
    setShowNewsModal(true);
  };

  const handleCloseNewsModal = () => {
    setShowNewsModal(false);
    setEditingNews(null);
    setNewsToolUseCustom(false);
    setNewsFormData({
      type: 'system_update',
      tool: null,
      title: '',
      description: '',
      fullContent: null,
      imageUrl: null,
      isActive: true,
      priority: 5,
    });
  };

  const handleSaveNews = async () => {
    try {
      setError(null);
      const toolNormalized =
        newsToolUseCustom
          ? newsFormData.tool && String(newsFormData.tool).trim()
            ? String(newsFormData.tool).trim()
            : null
          : newsFormData.tool ?? null;
      const payload: CreateNewsData = { ...newsFormData, tool: toolNormalized };
      if (editingNews) {
        await adminAPI.updateNews(editingNews.id, payload);
      } else {
        await adminAPI.createNews(payload);
      }
      handleCloseNewsModal();
      loadNews();
    } catch (err: unknown) {
      logError('Erro ao salvar novidade', err);
      setError(getErrorMessage(err, 'Erro ao salvar novidade'));
    }
  };

  const handleDeleteNews = async (id: string) => {
    try {
      setError(null);
      await adminAPI.deleteNews(id);
      setShowDeleteNewsModal(null);
      loadNews();
    } catch (err: unknown) {
      logError('Erro ao deletar novidade', err);
      setError(getErrorMessage(err, 'Erro ao deletar novidade'));
    }
  };

  const handleToggleNewsStatus = async (newsItem: SystemNews) => {
    try {
      setError(null);
      await adminAPI.updateNews(newsItem.id, { isActive: !newsItem.isActive });
      loadNews();
    } catch (err: unknown) {
      logError('Erro ao atualizar status da novidade', err);
      setError(getErrorMessage(err, 'Erro ao atualizar status da novidade'));
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            Painel Administrativo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie notificações promocionais e banners do dashboard
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'notifications'
                  ? 'border-clerky-backendButton text-clerky-backendButton'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Notificações
            </button>
            <button
              onClick={() => setActiveTab('banners')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'banners'
                  ? 'border-clerky-backendButton text-clerky-backendButton'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Banners
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'news'
                  ? 'border-clerky-backendButton text-clerky-backendButton'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Novidades
            </button>
          </nav>
        </div>

        {/* Conteúdo das Tabs */}
        {activeTab === 'notifications' && (
          <div className="max-w-4xl mx-auto">

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Título */}
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Título da Notificação *
              </label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: 🎉 Promoção Especial!"
                required
                className="w-full"
              />
            </div>

            {/* Corpo/Mensagem */}
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Mensagem *
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ex: Aproveite nossa oferta especial por tempo limitado!"
                required
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
              />
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Plataforma */}
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Plataforma
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as 'ios' | 'android' | 'all')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
                >
                  <option value="all">Todas (iOS + Android)</option>
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                </select>
              </div>

              {/* Premium */}
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Usuários Premium
                </label>
                <select
                  value={isPremium}
                  onChange={(e) => setIsPremium(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
                >
                  <option value="all">Todos</option>
                  <option value="true">Apenas Premium</option>
                  <option value="false">Apenas Não-Premium</option>
                </select>
              </div>
            </div>

            {/* Dados Extras (Opcional) */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h3 className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-4">
                Dados Extras (Opcional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    ID da Promoção
                  </label>
                  <Input
                    type="text"
                    value={promoId}
                    onChange={(e) => setPromoId(e.target.value)}
                    placeholder="Ex: promo-123456"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    URL da Promoção
                  </label>
                  <Input
                    type="url"
                    value={promoUrl}
                    onChange={(e) => setPromoUrl(e.target.value)}
                    placeholder="Ex: https://onlyflow.com.br/promo"
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {/* Botão Enviar */}
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={isLoading || !title.trim() || !body.trim()}
                className="min-w-[120px]"
              >
                {isLoading ? 'Enviando...' : 'Enviar Notificação'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Resultado */}
        {result && (
          <Card className="mt-6 p-6">
            <h2 className="text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
              Resultado do Envio
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Total de dispositivos:</span>
                <span className="font-semibold text-clerky-backendText dark:text-gray-200">
                  {result.totalDevices}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">✅ Sucessos:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">
                  {result.successCount}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">❌ Falhas:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">
                  {result.failedCount}
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                    Erros encontrados:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-red-600 dark:text-red-400">
                    {result.errors.map((err, index) => (
                      <li key={index}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Erro */}
        {error && (
          <Card className="mt-6 p-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Erro</h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </Card>
        )}
          </div>
        )}

        {activeTab === 'banners' && (
          <div>
            {/* Header com botão de criar */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-clerky-backendText dark:text-gray-200">
                  Gerenciar Banners
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Gerencie os banners exibidos no dashboard (tamanho recomendado: 820x312px)
                </p>
              </div>
              <Button onClick={() => handleOpenBannerModal()} variant="primary">
                + Criar Banner
              </Button>
            </div>

            {/* Lista de Banners */}
            {isLoadingBanners ? (
              <Card className="p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Carregando banners...</p>
                </div>
              </Card>
            ) : banners.length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Nenhum banner cadastrado</p>
                  <Button onClick={() => handleOpenBannerModal()} variant="primary">
                    Criar Primeiro Banner
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {banners.map((banner) => (
                  <Card key={banner.id} className="overflow-hidden hover:shadow-xl transition-shadow duration-200">
                    {/* Preview do Banner */}
                    <div className="relative w-full h-48 bg-gray-100 dark:bg-[#091D41] overflow-hidden">
                      <img
                        src={banner.imageUrl}
                        alt={banner.title || 'Banner'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://via.placeholder.com/820x312?text=Banner';
                        }}
                      />
                      {!banner.isActive && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <span className="bg-gray-800 text-white px-3 py-1 rounded-full text-sm font-medium">
                            Inativo
                          </span>
                        </div>
                      )}
                      <div className="absolute top-2 right-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          banner.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          Ordem: {banner.order}
                        </span>
                      </div>
                    </div>

                    {/* Informações */}
                    <div className="p-4">
                      <h3 className="font-semibold text-clerky-backendText dark:text-gray-200 mb-2 truncate">
                        {banner.title || 'Sem título'}
                      </h3>
                      {banner.linkUrl && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 truncate">
                          Link: {banner.linkUrl}
                        </p>
                      )}
                      
                      {/* Botões de Ação */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleBannerStatus(banner)}
                          className="flex-1 min-w-[100px] text-xs"
                        >
                          {banner.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenBannerModal(banner)}
                          className="flex-1 min-w-[100px] text-xs"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowDeleteModal(banner.id)}
                          className="flex-1 min-w-[100px] text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                        >
                          Deletar
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'news' && (
          <div>
            {/* Header com botão de criar */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-semibold text-clerky-backendText dark:text-gray-200">
                  Gerenciar Novidades
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Gerencie as novidades e atualizações exibidas no dashboard
                </p>
              </div>
              <Button onClick={() => handleOpenNewsModal()} variant="primary">
                + Criar Novidade
              </Button>
            </div>

            {/* Lista de Novidades */}
            {isLoadingNews ? (
              <Card className="p-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Carregando novidades...</p>
                </div>
              </Card>
            ) : news.length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">Nenhuma novidade cadastrada</p>
                  <Button onClick={() => handleOpenNewsModal()} variant="primary">
                    Criar Primeira Novidade
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {news.map((newsItem) => (
                  <Card key={newsItem.id} className="hover:shadow-xl transition-shadow duration-200">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              newsItem.type === 'system_update'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : newsItem.type === 'tool_update'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            }`}>
                              {newsItem.type === 'system_update' ? 'Atualização do Sistema' : 
                               newsItem.type === 'tool_update' ? 'Atualização de Ferramenta' : 'Anúncio'}
                            </span>
                            {newsItem.tool && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                                {labelForNewsTool(newsItem.tool)}
                              </span>
                            )}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              newsItem.isActive
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              Prioridade: {newsItem.priority}
                            </span>
                            {!newsItem.isActive && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                Inativo
                              </span>
                            )}
                          </div>
                          <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-2">
                            {newsItem.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                            {newsItem.description}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Publicado em: {new Date(newsItem.publishedAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      
                      {/* Botões de Ação */}
                      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleNewsStatus(newsItem)}
                          className="flex-1 min-w-[100px] text-xs"
                        >
                          {newsItem.isActive ? 'Desativar' : 'Ativar'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenNewsModal(newsItem)}
                          className="flex-1 min-w-[100px] text-xs"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowDeleteNewsModal(newsItem.id)}
                          className="flex-1 min-w-[100px] text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                        >
                          Deletar
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal de Criar/Editar Banner */}
        <Modal
          isOpen={showBannerModal}
          onClose={handleCloseBannerModal}
          title={editingBanner ? 'Editar Banner' : 'Criar Banner'}
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                URL da Imagem *
              </label>
              <Input
                type="url"
                value={bannerFormData.imageUrl}
                onChange={(e) => setBannerFormData({ ...bannerFormData, imageUrl: e.target.value })}
                placeholder="https://exemplo.com/banner.jpg"
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Tamanho recomendado: 820x312px
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                URL de Destino (opcional)
              </label>
              <Input
                type="url"
                value={bannerFormData.linkUrl || ''}
                onChange={(e) => setBannerFormData({ ...bannerFormData, linkUrl: e.target.value })}
                placeholder="https://exemplo.com/promocao"
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Título (opcional)
              </label>
              <Input
                type="text"
                value={bannerFormData.title || ''}
                onChange={(e) => setBannerFormData({ ...bannerFormData, title: e.target.value })}
                placeholder="Título do banner"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Ordem
                </label>
                <Input
                  type="number"
                  value={bannerFormData.order}
                  onChange={(e) => setBannerFormData({ ...bannerFormData, order: parseInt(e.target.value) || 0 })}
                  min="0"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Menor número = aparece primeiro
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Status
                </label>
                <select
                  value={bannerFormData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setBannerFormData({ ...bannerFormData, isActive: e.target.value === 'active' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            {/* Preview */}
            {bannerFormData.imageUrl && (
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Preview
                </label>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  <img
                    src={bannerFormData.imageUrl}
                    alt="Preview"
                    className="w-full h-auto max-h-48 object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/820x312?text=Imagem+inválida';
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleCloseBannerModal}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveBanner}
                disabled={!bannerFormData.imageUrl.trim()}
              >
                {editingBanner ? 'Salvar Alterações' : 'Criar Banner'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de Criar/Editar Novidade */}
        <Modal
          isOpen={showNewsModal}
          onClose={handleCloseNewsModal}
          title={editingNews ? 'Editar Novidade' : 'Criar Novidade'}
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Tipo *
              </label>
              <select
                value={newsFormData.type}
                onChange={(e) => setNewsFormData({ ...newsFormData, type: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
                required
              >
                <option value="system_update">Atualização do Sistema</option>
                <option value="tool_update">Atualização de Ferramenta</option>
                <option value="announcement">Anúncio</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Ferramenta (opcional)
              </label>
              <select
                value={
                  newsToolUseCustom
                    ? '__custom__'
                    : newsFormData.tool && NEWS_TOOL_PRESET_SET.has(newsFormData.tool)
                      ? newsFormData.tool
                      : ''
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setNewsToolUseCustom(false);
                    setNewsFormData({ ...newsFormData, tool: null });
                  } else if (v === '__custom__') {
                    setNewsToolUseCustom(true);
                    setNewsFormData({
                      ...newsFormData,
                      tool:
                        newsFormData.tool && !NEWS_TOOL_PRESET_SET.has(newsFormData.tool)
                          ? newsFormData.tool
                          : null,
                    });
                  } else {
                    setNewsToolUseCustom(false);
                    setNewsFormData({ ...newsFormData, tool: v });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
              >
                <option value="">Nenhuma (atualização geral)</option>
                {NEWS_TOOL_PRESETS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="__custom__">Outro (texto livre)</option>
              </select>
              {newsToolUseCustom && (
                <Input
                  type="text"
                  value={newsFormData.tool || ''}
                  onChange={(e) =>
                    setNewsFormData({
                      ...newsFormData,
                      tool: e.target.value ? e.target.value : null,
                    })
                  }
                  placeholder="Identificador (ex.: nome interno da ferramenta)"
                  className="w-full mt-2"
                />
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Inclui Scraping Flow (<code className="text-[11px]">scrapingflow</code>). Deixe em branco para novidade geral.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Título *
              </label>
              <Input
                type="text"
                value={newsFormData.title}
                onChange={(e) => setNewsFormData({ ...newsFormData, title: e.target.value })}
                placeholder="Título da novidade"
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Descrição *
              </label>
              <textarea
                value={newsFormData.description}
                onChange={(e) => setNewsFormData({ ...newsFormData, description: e.target.value })}
                placeholder="Descrição resumida da novidade"
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                Conteúdo Completo (opcional)
              </label>
              <textarea
                value={newsFormData.fullContent || ''}
                onChange={(e) => setNewsFormData({ ...newsFormData, fullContent: e.target.value || null })}
                placeholder="Conteúdo completo da novidade (para página de detalhes)"
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                URL da Imagem (opcional)
              </label>
              <Input
                type="url"
                value={newsFormData.imageUrl || ''}
                onChange={(e) => setNewsFormData({ ...newsFormData, imageUrl: e.target.value || null })}
                placeholder="https://exemplo.com/imagem.jpg"
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Prioridade (1-10)
                </label>
                <Input
                  type="number"
                  value={newsFormData.priority}
                  onChange={(e) => setNewsFormData({ ...newsFormData, priority: parseInt(e.target.value) || 5 })}
                  min="1"
                  max="10"
                  className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maior número = mais importante
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Status
                </label>
                <select
                  value={newsFormData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setNewsFormData({ ...newsFormData, isActive: e.target.value === 'active' })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#091D41] text-clerky-backendText dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton"
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            </div>

            {editingNews && (
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-2">
                  Data de Publicação
                </label>
                <Input
                  type="datetime-local"
                  value={newsFormData.publishedAt ? new Date(newsFormData.publishedAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setNewsFormData({ ...newsFormData, publishedAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full"
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={handleCloseNewsModal}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveNews}
                disabled={!newsFormData.title.trim() || !newsFormData.description.trim()}
              >
                {editingNews ? 'Salvar Alterações' : 'Criar Novidade'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de Confirmação de Exclusão de Banner */}
        <Modal
          isOpen={showDeleteModal !== null}
          onClose={() => setShowDeleteModal(null)}
          title="Confirmar Exclusão"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Tem certeza que deseja deletar este banner? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowDeleteModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => showDeleteModal && handleDeleteBanner(showDeleteModal)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Deletar
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal de Confirmação de Exclusão de Novidade */}
        <Modal
          isOpen={showDeleteNewsModal !== null}
          onClose={() => setShowDeleteNewsModal(null)}
          title="Confirmar Exclusão"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              Tem certeza que deseja deletar esta novidade? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" onClick={() => setShowDeleteNewsModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={() => showDeleteNewsModal && handleDeleteNews(showDeleteNewsModal)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Deletar
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
};

export default Admin;

