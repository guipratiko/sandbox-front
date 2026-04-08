import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/Layout';
import { Card, HelpIcon } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { dashboardAPI, DashboardStats, RecentActivity, Banner, instagramAPI, newsAPI, SystemNews, dispatchAPI, aiAgentAPI } from '../services/api';
import type { Dispatch } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { getErrorMessage, logError } from '../utils/errorHandler';
import { userHasPremiumPlan } from '../utils/planAccess';
import { formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

const COLORS = ['#0040FF', '#00C0FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const DICAS = [
  'Use disparos em massa para reativar contatos antigos: envie uma mensagem personalizada e acompanhe quem responde.',
  'No tráfego pago, direcione o público para um fluxo do Mindflow que qualifica o lead antes de passar para o atendimento.',
  'Automatize respostas no Instagram com o Gerenciador Instagram: configure mensagens automáticas para stories e DMs.',
  'Crie listas segmentadas antes do disparo em massa para aumentar a taxa de abertura e evitar bloqueios.',
  'Combine tráfego pago com Agente de IA: o lead entra pelo anúncio e já é atendido por um assistente 24h.',
  'Use o Agente de IA para triagem: ele responde dúvidas comuns e só encaminha para humano quando necessário.',
  'No Instagram, use automações para enviar material após o primeiro follow ou comentário na sua publicação.',
  'Agende disparos em massa para horários de maior engajamento da sua audiência e acompanhe no dashboard.',
  'Invista em tráfego para webinars ou lives: capture leads no formulário e nutra com sequência de mensagens.',
  'Configure respostas automáticas no WhatsApp por horário (fora do expediente) para não perder contatos.',
  'Use grupos no Gerenciador de Grupos para divulgar novidades e manter a comunidade engajada sem spam.',
  'No disparo em massa, teste mensagens curtas com call-to-action claro antes de enviar para toda a base.',
  'Automações no Instagram ajudam a responder "como comprar?" e "qual o preço?" sem depender de alguém online.',
  'Integre disparos com o Mindflow: quem completar um fluxo pode entrar em uma lista para campanhas específicas.',
  'Tráfego pago funciona melhor quando a página de destino oferece algo de valor imediato (e-book, cupom).',
  'Use o Agente de IA para qualificar leads de tráfego pago: perguntas certas evitam perda de tempo com indecisos.',
  'No Instagram, automatize o envio de link do catálogo ou WhatsApp quando alguém pedir no direct.',
  'Faça disparos em etapas: primeiro um aviso, depois o conteúdo principal, depois um follow-up para quem não abriu.',
  'Segmentar por tags (ex: "interessado em X") permite disparos mais relevantes e menos cancelamentos.',
  'Automações no Instagram podem enviar uma mensagem quando alguém comenta uma palavra-chave no post.',
  'Combine Mindflow + disparo: quem sai do fluxo em uma etapa pode receber uma mensagem personalizada depois.',
  'Em tráfego pago, use eventos de conversão (clique, envio de formulário) para otimizar campanhas.',
  'Configure o Agente de IA com base de conhecimento da sua empresa para respostas mais precisas e menos alucinações.',
  'Use o Gerenciador de Grupos para enviar uma única mensagem em vários grupos sem precisar abrir cada um.',
  'Disparos em massa com nome do contato (variável) tendem a ter mais abertura; use com moderação para não parecer robótico.',
  'No Instagram, automações de boas-vindas para novos seguidores podem oferecer um link ou cupom.',
  'Tráfego pago + disparo: quem preenche o formulário entra em uma sequência de 3 a 5 mensagens automáticas.',
  'Agente de IA pode ser usado em grupos: ativa quando alguém menciona uma palavra ou pergunta no grupo.',
  'Antes de disparo em massa, teste em uma lista pequena (10–20 contatos) para validar mensagem e horário.',
  'Automações no Instagram permitem enviar áudio ou vídeo curto como resposta automática, humanizando o toque.',
  'Use disparos para lembrar eventos (webinar, promoção) no dia e na hora, aumentando comparecimento.',
  'Em tráfego pago, direcione para uma página que já inicia conversa no WhatsApp via link pré-preenchido.',
  'Mindflow pode encaminhar leads qualificados para um disparo em massa específico (ex: "curso X").',
  'No Gerenciador Instagram, monitore mensagens não lidas e use automações para primeiro contato em massa.',
  'Dica final: revise relatórios de disparos, agentes e automações toda semana para ajustar o que não está convertendo.',
];

const RotatingTip: React.FC = () => {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const updateTip = () => {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDate() + now.getMonth() * 31;
      setTipIndex((hour + day) % DICAS.length);
    };

    updateTip();
    const interval = setInterval(updateTip, 60 * 60 * 1000); // atualiza a cada hora
    return () => clearInterval(interval);
  }, []);

  return (
    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed transition-opacity duration-300">
      {DICAS[tipIndex]}
    </p>
  );
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, color = '#0040FF' }) => {
  // Converter cor hexadecimal para rgba
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 64, b: 255 };
  };

  const rgb = hexToRgb(color);
  const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
  const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`;
  const glowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;

  return (
    <div 
      className="relative rounded-2xl overflow-hidden group cursor-pointer transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl border backdrop-blur-sm"
      style={{
        backgroundColor: `rgba(255, 255, 255, 0.7)`,
        borderColor: borderColor,
        boxShadow: `0 4px 6px -1px ${borderColor}, 0 2px 4px -1px ${borderColor}20`,
      }}
    >
      {/* Dark mode background */}
      <div className="dark:bg-[#091D41]/80 dark:border-gray-700 absolute inset-0 rounded-2xl" />
      
      {/* Gradient accent bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-1.5 opacity-90"
        style={{ 
          background: `linear-gradient(90deg, ${color}, ${color}cc, ${color})`,
          boxShadow: `0 2px 8px ${glowColor}`,
        }}
      />

      {/* Colored background overlay */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at top right, ${bgColor}, transparent 70%)`,
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 p-4 md:p-6">
        <div className="flex flex-col">
          <h3 className="text-[9px] md:text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-3 md:mb-4 uppercase tracking-[0.15em] letter-spacing-wide">
            {title}
          </h3>
          <div className="flex items-baseline gap-2 mb-2">
            <p 
              className="text-3xl md:text-4xl lg:text-5xl font-black leading-none tracking-tight"
              style={{ 
                color: color,
                textShadow: `0 2px 4px ${glowColor}40`,
              }}
            >
              {value}
            </p>
          </div>
          {subtitle && (
            <p className="text-[10px] md:text-xs font-semibold text-gray-500 dark:text-gray-400 mt-1 md:mt-2 opacity-90 line-clamp-2">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Decorative circle gradient */}
      <div
        className="absolute -bottom-12 -right-12 w-32 h-32 rounded-full opacity-20 group-hover:opacity-30 group-hover:scale-110 transition-all duration-500 blur-2xl"
        style={{ backgroundColor: color }}
      />
      
      {/* Shine effect on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ 
          background: `linear-gradient(135deg, transparent 0%, ${glowColor}15 50%, transparent 100%)`,
        }}
      />
    </div>
  );
};

// Componente de Carrossel de Banners
interface BannerCarouselProps {
  banners: Banner[];
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ banners }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeBanners = banners.filter((b) => b.isActive).sort((a, b) => a.order - b.order);

  useEffect(() => {
    if (activeBanners.length <= 1 || isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, 4000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeBanners.length, isPaused]);

  if (activeBanners.length === 0) {
    return null;
  }

  const currentBanner = activeBanners[currentIndex];

  const handleBannerClick = () => {
    if (currentBanner.linkUrl) {
      window.open(currentBanner.linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
      <div
        className="relative w-full h-[312px] overflow-hidden rounded-xl cursor-pointer group"
        style={{ maxWidth: '820px', margin: '0 auto' }}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onClick={handleBannerClick}
      >
        {/* Container de banners com transição */}
        <div className="relative w-full h-full overflow-hidden">
          <div
            className="flex h-full transition-transform duration-700 ease-in-out"
            style={{
              transform: `translateX(-${currentIndex * 100}%)`,
            }}
          >
            {activeBanners.map((banner, index) => (
              <div
                key={banner.id}
                className="flex-shrink-0 w-full h-full relative"
                style={{ minWidth: '100%' }}
              >
                <img
                  src={banner.imageUrl}
                  alt={banner.title || `Banner ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/820x312?text=Banner';
                  }}
                />
                {/* Overlay sutil no hover */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Indicadores de posição */}
        {activeBanners.length > 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
            {activeBanners.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 bg-white shadow-lg'
                    : 'w-2 bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Ir para banner ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Seta de navegação (se houver mais de 1 banner) */}
        {activeBanners.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
              }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
              aria-label="Banner anterior"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 rounded-full p-2 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10"
              aria-label="Próximo banner"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
  );
};

interface RecentActivityListProps {
  activities: RecentActivity;
  runningDispatches: Dispatch[];
  aiAgentsTotal: number;
  aiAgentsActive: number;
  activityLimit?: number;
}

const RecentActivityList: React.FC<RecentActivityListProps> = ({
  activities,
  runningDispatches,
  aiAgentsTotal,
  aiAgentsActive,
  activityLimit = 5,
}) => {
  const { t, language } = useLanguage();
  const locale = language === 'pt' ? ptBR : enUS;

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale });
    } catch {
      return dateString;
    }
  };

  return (
    <Card padding="md" shadow="md" className="h-full flex flex-col p-4 md:p-8 transition-all duration-300 hover:shadow-xl rounded-2xl border border-gray-100 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm">
      <h2 className="text-lg md:text-xl font-semibold text-clerky-backendText dark:text-gray-200 mb-4 md:mb-6">
        {t('dashboard.recentActivity.title')}
      </h2>

      <div className="flex-1 min-h-0 space-y-5 md:space-y-6">
        {/* Disparos em andamento */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('dashboard.recentActivity.dispatchesInProgress')}
          </h3>
          <div className="space-y-2">
            {runningDispatches.length > 0 ? (
              runningDispatches.slice(0, 5).map((dispatch) => (
                <Link
                  key={dispatch.id}
                  to="/disparos"
                  className="block p-3 bg-gray-50 dark:bg-gray-700/80 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600/80 transition-all duration-200 border border-transparent hover:border-clerky-backendButton/20"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 truncate">{dispatch.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {t(`dashboard.dispatches.status.${dispatch.status}`)} • {dispatch.stats?.sent ?? 0}/{dispatch.stats?.total ?? 0} {t('dashboard.dispatches.sent')}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{formatTime(dispatch.createdAt)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                {t('dashboard.recentActivity.noDispatchesInProgress')}
              </p>
            )}
          </div>
        </div>

        {/* Agentes de IA */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('dashboard.recentActivity.aiAgents')}
          </h3>
          <div className="p-3 bg-gray-50 dark:bg-gray-700/80 rounded-xl">
            <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200">
              {t('dashboard.recentActivity.agentsSummary', { active: String(aiAgentsActive), total: String(aiAgentsTotal) })}
            </p>
            <Link
              to="/agente-ia"
              className="inline-block mt-2 text-sm text-clerky-backendButton hover:underline font-medium"
            >
              {t('dashboard.recentActivity.viewLeads')} →
            </Link>
          </div>
        </div>

        {/* Contatos recentes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('dashboard.recentActivity.contacts')}
          </h3>
          <div className="space-y-2">
            {activities.contacts.slice(0, activityLimit).map((contact) => (
              <div
                key={contact.id}
                className="p-3 bg-gray-50 dark:bg-gray-700/80 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 truncate">
                      {contact.name || contact.phone}
                    </p>
                    {contact.name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{contact.phone}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 sm:ml-2 flex-shrink-0">{formatTime(contact.createdAt)}</span>
                </div>
              </div>
            ))}
            {activities.contacts.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                {t('dashboard.recentActivity.noContacts')}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};


const NewsAndPromotions: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [news, setNews] = useState<SystemNews[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      try {
        setIsLoading(true);
        const response = await newsAPI.getLatestNews(5);
        setNews(response.data);
      } catch (err: unknown) {
        logError('Erro ao carregar novidades', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadNews();
  }, []);

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
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const handleNewsClick = (item: SystemNews) => {
    navigate(`/novidades?open=${item.id}`);
  };

  return (
    <Card padding="md" shadow="md" className="h-full flex flex-col transition-all duration-300 hover:shadow-xl p-4 md:p-8 rounded-2xl border border-gray-100 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm">
      <div className="flex flex-col h-full min-h-0">
        <div className="flex justify-between items-center mb-3 md:mb-4 flex-shrink-0">
          <h2 className="text-lg md:text-xl font-semibold text-clerky-backendText dark:text-gray-200">
            {t('dashboard.news.title')}
          </h2>
          <Link
            to="/novidades"
            className="text-sm text-clerky-backendButton hover:underline font-medium"
          >
            Ver todas
          </Link>
        </div>

        {/* Altura para exatamente 3 cards visíveis (cada card ~14rem), scroll a partir do 4º */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 max-h-[42rem]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clerky-backendButton"></div>
            </div>
          ) : news.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>Nenhuma novidade no momento</p>
            </div>
          ) : (
            news.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleNewsClick(item)}
                className="w-full text-left p-0 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-700/80 border border-transparent hover:border-clerky-backendButton/30 hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-clerky-backendButton/50 flex-shrink-0 h-[14rem] flex flex-col"
              >
                {item.imageUrl ? (
                  <div className="w-full h-24 flex-shrink-0 bg-gray-200 dark:bg-gray-600 overflow-hidden">
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
                ) : (
                  <div className="w-full h-24 flex-shrink-0 bg-gray-100 dark:bg-gray-600/50" aria-hidden />
                )}
                <div className="p-3 flex-1 min-h-0 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${getTypeColor(item.type)}`}>
                        {getTypeLabel(item.type)}
                      </span>
                      {item.tool && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300 truncate">
                          {item.tool}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {formatDate(item.publishedAt)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-clerky-backendText dark:text-gray-200 line-clamp-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </Card>
  );
};

const Home: React.FC = () => {
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [instagramStats, setInstagramStats] = useState<{ total: number; connected: number }>({ total: 0, connected: 0 });
  const [runningDispatches, setRunningDispatches] = useState<Dispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const premium = userHasPremiumPlan(user);
      const emptyIg = { status: 'success' as const, data: [] };
      const emptyDisp = { status: 'success' as const, dispatches: [] as Dispatch[] };
      const [statsResponse, bannersResponse, instagramResponse, dispatchesResponse] = await Promise.all([
        dashboardAPI.getStats(),
        dashboardAPI.getBanners().catch(() => ({ status: 'success', data: [] as Banner[] })),
        premium ? instagramAPI.getInstances().catch(() => emptyIg) : Promise.resolve(emptyIg),
        premium ? dispatchAPI.getDispatches().catch(() => emptyDisp) : Promise.resolve(emptyDisp),
      ]);
      
      setStats(statsResponse.stats);
      setRecentActivity(statsResponse.recent);
      setBanners(bannersResponse.data || []);
      
      const instagramInstances = instagramResponse.data || [];
      const connected = instagramInstances.filter((inst: { status: string }) => inst.status === 'connected').length;
      setInstagramStats({ total: instagramInstances.length, connected });

      const allDispatches = dispatchesResponse.dispatches || [];
      const running = allDispatches.filter((d: Dispatch) => d.status === 'running' || d.status === 'pending' || d.status === 'paused');
      setRunningDispatches(running);
    } catch (err: unknown) {
      logError('Erro ao carregar dados do dashboard', err);
      setError(getErrorMessage(err, t('dashboard.error.loadData')));
    } finally {
      setIsLoading(false);
    }
  }, [t, user]);

  // WebSocket para atualizações em tempo real
  useSocket(
    token,
    undefined, // onStatusUpdate
    undefined, // onNewMessage
    () => {
      // onContactUpdate - recarregar dados quando contato atualizar
      loadDashboardData();
    },
    () => {
      // onDispatchUpdate - recarregar dados quando disparo atualizar
      loadDashboardData();
    },
    undefined, // onWorkflowContactUpdate
    undefined // onGroupsUpdate
  );

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token, loadDashboardData]);

  if (isLoading && !stats) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">{t('dashboard.loading')}</p>
        </div>
      </AppLayout>
    );
  }

  if (error && !stats) {
    return (
      <AppLayout>
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-400 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">{t('common.error')}</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </AppLayout>
    );
  }

  if (!stats || !recentActivity) {
    return null;
  }

  return (
    <AppLayout>
      <div className="animate-fadeIn space-y-5 md:space-y-7">
        {/* Boas-vindas + Dica do momento */}
        <Card
          padding="md"
          shadow="lg"
          className="group p-4 md:p-6 relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700/50 bg-white/90 dark:bg-gray-800/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/40 via-transparent to-purple-50/40 dark:from-blue-900/10 dark:via-transparent dark:to-purple-900/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10">
            <h1 className="text-xl md:text-2xl font-bold text-clerky-backendText dark:text-gray-200 mb-1">
              {t('dashboard.welcome', { name: user?.name?.split(' ')[0] || '' })}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 inline-flex items-center gap-2">
              {t('dashboard.welcomeMessage')}
              <HelpIcon helpKey="dashboard" className="ml-1" />
            </p>
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {t('dashboard.tipTitle')}
              </p>
              <RotatingTip />
            </div>
          </div>
        </Card>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 md:gap-5">
          {[
            { title: t('dashboard.stats.instances'), value: stats.instances.total, subtitle: `${stats.instances.connected} ${t('dashboard.instances.connected')}`, color: '#0040FF' },
            { title: t('dashboard.stats.contacts'), value: stats.contacts.total, subtitle: undefined, color: '#00C0FF' },
            { title: t('dashboard.stats.dispatches'), value: stats.dispatches.total, subtitle: `${stats.dispatches.completed} ${t('dashboard.dispatches.status.completed')}`, color: '#10B981' },
            { title: t('dashboard.stats.workflows'), value: stats.workflows.total, subtitle: undefined, color: '#F59E0B' },
            { title: t('dashboard.stats.groups'), value: stats.groups.total, subtitle: undefined, color: '#8B5CF6' },
            { title: t('dashboard.stats.aiAgents'), value: stats.aiAgents.total, subtitle: `${stats.aiAgents.active} ${t('dashboard.stats.active')}`, color: '#EF4444' },
            { title: t('menu.instagramManager'), value: instagramStats.total, subtitle: `${instagramStats.connected} ${t('dashboard.instances.connected')}`, color: '#E91E63' },
          ].map((item, i) => (
            <div key={item.title} className="animate-fadeIn" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'backwards' }}>
              <StatCard title={item.title} value={item.value} subtitle={item.subtitle} color={item.color} />
            </div>
          ))}
        </div>

        {/* Carrossel de Banners */}
        {banners.length > 0 && (
          <div className="flex justify-center">
            <BannerCarousel banners={banners} />
          </div>
        )}

        {/* Atividades Recentes e Novidades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6 items-stretch">
          <div className="min-h-0 transform transition-all duration-300 hover:scale-[1.01] flex flex-col">
            <RecentActivityList
              activities={recentActivity}
              runningDispatches={runningDispatches}
              aiAgentsTotal={stats.aiAgents.total}
              aiAgentsActive={stats.aiAgents.active}
              activityLimit={5}
            />
          </div>
          <div className="min-h-0 transform transition-all duration-300 hover:scale-[1.01] flex flex-col">
            <NewsAndPromotions />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Home;
