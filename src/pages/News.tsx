import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { newsAPI, SystemNews } from '../services/api';
import { getErrorMessage, logError } from '../utils/errorHandler';

const News: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const openId = searchParams.get('open');
  const [news, setNews] = useState<SystemNews[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNews, setSelectedNews] = useState<SystemNews | null>(null);

  useEffect(() => {
    const loadNews = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await newsAPI.getAllNews();
        setNews(response.data);
      } catch (err: unknown) {
        logError('Erro ao carregar novidades', err);
        setError(getErrorMessage(err, 'Erro ao carregar novidades'));
      } finally {
        setIsLoading(false);
      }
    };

    loadNews();
  }, []);

  useEffect(() => {
    if (!openId || news.length === 0) return;
    const found = news.find((n) => n.id === openId);
    if (found) {
      setSelectedNews(found);
      return;
    }
    newsAPI
      .getNewsById(openId)
      .then((res) => setSelectedNews(res.data))
      .catch(() => {});
  }, [openId, news]);

  const closeModal = () => {
    setSelectedNews(null);
    if (searchParams.has('open')) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'system_update':
        return 'Atualização do Sistema';
      case 'tool_update':
        return 'Atualização de Ferramenta';
      case 'announcement':
        return 'Anúncio';
      default:
        return 'Novidade';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'system_update':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'tool_update':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'announcement':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clerky-backendButton mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400 ml-4">Carregando novidades...</p>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">{t('common.error')}</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200 mb-2">
            {t('dashboard.news.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Fique por dentro das últimas atualizações e funcionalidades do OnlyFlow
          </p>
        </div>

        {news.length === 0 ? (
          <Card className="p-8">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400">Nenhuma novidade no momento</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {news.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#091D41] rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden"
                onClick={() => setSelectedNews(item)}
              >
                {item.imageUrl && (
                  <div className="w-full h-48 bg-gray-100 dark:bg-[#091D41] overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(item.type)}`}>
                      {getTypeLabel(item.type)}
                    </span>
                    {item.tool && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                        {item.tool}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-2 line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                    {item.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {formatDate(item.publishedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal de Detalhes */}
        {selectedNews && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <Card
              className="max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(selectedNews.type)}`}>
                      {getTypeLabel(selectedNews.type)}
                    </span>
                    {selectedNews.tool && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300">
                        {selectedNews.tool}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {selectedNews.imageUrl && (
                  <div className="w-full h-64 bg-gray-100 dark:bg-[#091D41] rounded-lg overflow-hidden mb-4">
                    <img
                      src={selectedNews.imageUrl}
                      alt={selectedNews.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                )}

                <h2 className="text-2xl font-bold text-clerky-backendText dark:text-gray-200 mb-3">
                  {selectedNews.title}
                </h2>

                <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
                  {formatDate(selectedNews.publishedAt)}
                </p>

                <div className="prose dark:prose-invert max-w-none">
                  {selectedNews.fullContent ? (
                    <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {selectedNews.fullContent}
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300">
                      {selectedNews.description}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default News;
