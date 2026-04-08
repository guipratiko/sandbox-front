import type { User } from '../services/api';

/**
 * Alinhado ao `requirePremium` do backend: qualquer plano pago (não `free`).
 * Usado para não chamar rotas /instagram e /dispatches com utilizador free (evita 403 no browser).
 */
export function userHasPremiumPlan(user: User | null | undefined): boolean {
  const p = user?.premiumPlan;
  return Boolean(p && p !== 'free');
}
