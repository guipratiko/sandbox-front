/**
 * URL para upgrade de plano (PremiumRoute, sidebar premium).
 *
 * Ordem de prioridade:
 * 1) window.__ONLYFLOW_UPGRADE_URL__ — definido em public/upgrade-redirect-config.js (vale sem novo build)
 * 2) REACT_APP_UPGRADE_URL no .env — exige `npm run build` de novo (ou apagar pasta `build` e usar só `npm start` em dev)
 */

declare global {
  interface Window {
    __ONLYFLOW_UPGRADE_URL__?: string;
  }
}

const FALLBACK = 'https://onlyflow.com.br/#precos';

export function getUpgradePlanUrl(): string {
  if (typeof window !== 'undefined') {
    const w = window.__ONLYFLOW_UPGRADE_URL__;
    if (typeof w === 'string' && w.trim() !== '') {
      return w.trim();
    }
  }
  const fromEnv = (process.env.REACT_APP_UPGRADE_URL || '').trim();
  if (fromEnv !== '') return fromEnv;
  return FALLBACK;
}
