import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/Layout';
import { Card, Button, HelpIcon } from '../components/UI';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { scrapingAPI, ScrapingSearchRecord } from '../services/api';
import { SCRAPING_COUNTRIES, SCRAPING_STATES_BR } from '../data/scrapingLocations';

const ScrapingFlow: React.FC = () => {
  const { t, language } = useLanguage();
  const { token } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [pais, setPais] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [setor, setSetor] = useState('');
  const [segmento, setSegmento] = useState('');
  const [searches, setSearches] = useState<ScrapingSearchRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<'25' | '50' | null>(null);

  const loadCredits = useCallback(async () => {
    if (!token) return;
    try {
      const res = await scrapingAPI.getCredits();
      setCredits(res.data?.credits ?? 0);
    } catch {
      setCredits(0);
    }
  }, [token]);

  useSocket(
    token,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    (data) => setCredits(data.credits)
  );

  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  useEffect(() => {
    setPais(SCRAPING_COUNTRIES[0]?.value ?? '');
    setEstado('');
  }, []);

  const loadSearches = async () => {
    try {
      setLoadingList(true);
      setError(null);
      const res = await scrapingAPI.getSearches();
      setSearches(res.data ?? []);
    } catch (err: any) {
      setError(err.message ?? t('scraping.erroCarregar'));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadSearches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paisVal = pais.trim();
    const estadoVal = estado.trim();
    const cidadeVal = cidade.trim();
    const setorVal = setor.trim();
    const segmentoVal = segmento.trim();
    if (!cidadeVal || !segmentoVal) {
      setError(t('scraping.preencherCidadeSegmento'));
      return;
    }
    if (!estadoVal) {
      setError(t('scraping.selecioneEstado'));
      return;
    }
    if (!paisVal) {
      setError(t('scraping.selecionePais'));
      return;
    }
    const textQuery = setorVal
      ? `${segmentoVal} em ${cidadeVal}, ${setorVal}, ${estadoVal}, ${paisVal}`
      : `${segmentoVal} em ${cidadeVal}, ${estadoVal}, ${paisVal}`;
    try {
      setLoading(true);
      setError(null);
      await scrapingAPI.search({
        textQuery,
        languageCode: 'pt-BR',
        maxResults: 60,
      });
      await loadSearches();
      await loadCredits();
      setSegmento('');
      setCidade('');
      setSetor('');
    } catch (err: any) {
      setError(err.message ?? t('scraping.erroBusca'));
    } finally {
      setLoading(false);
    }
  };

  const handleBuyCredits = async (packageKey: '25' | '50') => {
    try {
      setCheckoutLoading(packageKey);
      setError(null);
      const res = await scrapingAPI.createCheckout(packageKey);
      const link = res.data?.link;
      if (link) {
        window.location.href = link;
      } else {
        setError(t('scraping.erroCheckout'));
      }
    } catch (err: any) {
      setError(err.message ?? t('scraping.erroCheckout'));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleExport = async (searchId: string) => {
    try {
      setExportingId(searchId);
      const blob = await scrapingAPI.exportCsv(searchId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scraping-${searchId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message ?? t('scraping.erroExportar'));
    } finally {
      setExportingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const locale = language === 'en' ? 'en-US' : 'pt-BR';
      return new Date(dateStr).toLocaleDateString(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <AppLayout>
      <div className="animate-fadeIn">
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold text-clerky-backendText dark:text-gray-200">
                  {t('menu.scraping')}
                </h1>
                <HelpIcon helpKey="scraping" className="ml-1" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                {t('scraping.description')}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-clerky-backendButton/10 dark:bg-clerky-backendButton/20 px-4 py-3 border border-clerky-backendButton/30">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{t('scraping.saldoAtual')}</p>
                <p className="text-2xl font-bold text-clerky-backendText dark:text-gray-200">
                  {credits === null ? '...' : `${credits} ${t('scraping.credits')}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex flex-col items-center gap-1.5">
                  <Button
                    type="button"
                    size="md"
                    variant="primary"
                    disabled={checkoutLoading !== null}
                    onClick={() => handleBuyCredits('25')}
                    className="min-w-[7rem] shadow-md hover:shadow-lg"
                  >
                    {checkoutLoading === '25' ? t('scraping.redirecionando') : 'R$ 25'}
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    250 {t('scraping.credits')}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <Button
                    type="button"
                    size="md"
                    variant="primary"
                    disabled={checkoutLoading !== null}
                    onClick={() => handleBuyCredits('50')}
                    className="min-w-[7rem] shadow-md hover:shadow-lg"
                  >
                    {checkoutLoading === '50' ? t('scraping.redirecionando') : 'R$ 50'}
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    500 {t('scraping.credits')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nova busca */}
        <Card padding="lg" shadow="lg" className="mb-6">
          <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
            {t('scraping.novaBusca')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                  {t('scraping.pais')}
                </label>
                <select
                  value={pais}
                  onChange={(e) => setPais(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f2744] text-clerky-backendText dark:text-gray-200 focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent"
                >
                  {SCRAPING_COUNTRIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                  {t('scraping.estado')}
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f2744] text-clerky-backendText dark:text-gray-200 focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent"
                >
                  <option value="">{t('scraping.selecione')}</option>
                  {SCRAPING_STATES_BR.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                  {t('scraping.cidade')}
                </label>
                <input
                  type="text"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder={t('scraping.cidadePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f2744] text-clerky-backendText dark:text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                  {t('scraping.setorOpcional')}
                </label>
                <input
                  type="text"
                  value={setor}
                  onChange={(e) => setSetor(e.target.value)}
                  placeholder={t('scraping.setorPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f2744] text-clerky-backendText dark:text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-clerky-backendText dark:text-gray-200 mb-1">
                {t('scraping.segmento')}
              </label>
              <input
                type="text"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                placeholder={t('scraping.segmentoPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#0f2744] text-clerky-backendText dark:text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-clerky-backendButton focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('scraping.maxResultadosInfo')}
            </p>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="bg-clerky-backendButton text-white hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t('scraping.buscando') : t('scraping.iniciarBusca')}
            </Button>
          </form>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            {setor.trim()
              ? `${t('scraping.consulta')}: "${segmento || 'segmento'} em ${cidade || 'cidade'}, ${setor}, ${estado || 'UF'}, ${pais || 'país'}"`
              : `${t('scraping.consulta')}: "${segmento || 'segmento'} em ${cidade || 'cidade'}, ${estado || 'UF'}, ${pais || 'país'}"`}
          </p>
        </Card>

        {/* Histórico de buscas */}
        <Card padding="lg" shadow="lg">
          <h2 className="text-lg font-semibold text-clerky-backendText dark:text-gray-200 mb-4">
            {t('scraping.suasBuscas')}
          </h2>
          {loadingList ? (
            <p className="text-gray-500 dark:text-gray-400">{t('scraping.carregando')}</p>
          ) : searches.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">{t('scraping.nenhumaBusca')}</p>
          ) : (
            <ul className="space-y-3">
              {searches.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 border-b border-gray-200 dark:border-gray-700 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-clerky-backendText dark:text-gray-200 truncate">
                      {s.text_query}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {s.total_results} {s.total_results === 1 ? t('scraping.resultado') : t('scraping.resultados')} · {formatDate(s.created_at)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={exportingId === s.id}
                    onClick={() => handleExport(s.id)}
                  >
                    {exportingId === s.id ? t('scraping.exportando') : t('scraping.exportarCsv')}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};

export default ScrapingFlow;
