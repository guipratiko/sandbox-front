/**
 * Utilitários compartilhados para funcionalidades de grupos
 */

import { cleanPhone, formatPhone, getInitials, normalizeName } from './formatters';

/** Nome do participante é só número / igual ao JID → não usar como título amigável. */
function nameIsRedundantPhoneName(name: string, jidUserPart: string, phoneField?: string): boolean {
  const nd = cleanPhone(name);
  if (!nd || nd.length < 10) return false;
  const jd = cleanPhone(jidUserPart);
  const pd = phoneField ? cleanPhone(phoneField) : '';
  if (nd === jd || (pd && nd === pd)) return true;
  if (jd.length >= nd.length && jd.endsWith(nd)) return true;
  if (nd.length >= jd.length && nd.endsWith(jd)) return true;
  return false;
}

export type GroupParticipantLike = {
  id: string;
  phoneNumber?: string;
  name?: string | null;
};

/**
 * Título (nome ou telefone formatado), subtítulo (telefone quando o título é nome) e inicial para avatar.
 * Telefone: remove DDI 55 e sufixo @s.whatsapp.net via `formatPhone` (padrão (DDD) 9 9999-9999).
 */
export function getGroupParticipantCardDisplay(pe: GroupParticipantLike): {
  title: string;
  subtitle: string | null;
  avatarInitial: string;
} {
  const id = pe.id || '';
  const jidUser = id.split('@')[0] || '';
  const isLid = /@lid$/i.test(id);
  const phoneField = pe.phoneNumber && pe.phoneNumber.trim() ? pe.phoneNumber.trim() : '';
  /** Para @lid o trecho antes de @ não é telefone; só formatar se a API mandou `phoneNumber`. */
  const phoneSource = phoneField || (isLid ? '' : jidUser);
  const formatted = phoneSource ? formatPhone(phoneSource) : '';

  const nameTrim = pe.name != null && String(pe.name).trim() ? String(pe.name).trim() : '';
  const redundant = nameTrim ? nameIsRedundantPhoneName(nameTrim, jidUser, phoneField) : false;
  const looksLikeJidName = nameTrim.includes('@');

  let title: string;
  let subtitle: string | null;

  if (isLid) {
    if (nameTrim && !redundant && !looksLikeJidName) {
      title = normalizeName(nameTrim);
      subtitle = formatted || null;
    } else {
      title = formatted || nameTrim || `…${jidUser.slice(-8)}`;
      subtitle = null;
    }
  } else if (nameTrim && !redundant && !looksLikeJidName) {
    title = normalizeName(nameTrim);
    subtitle = formatted || null;
  } else {
    title = formatted || nameTrim || jidUser || id;
    subtitle = null;
  }

  const nat = cleanPhone(phoneSource || jidUser);
  const natStripped = nat.startsWith('55') && nat.length > 11 ? nat.slice(2) : nat;
  const useNameAvatar = nameTrim && !redundant && !looksLikeJidName && !isLid;
  const avatarInitial = useNameAvatar
    ? (getInitials(title).slice(0, 2) || (title[0]?.toUpperCase() ?? '?'))
    : natStripped.slice(-2) || (jidUser ? jidUser.slice(-2) : '?');

  return { title, subtitle, avatarInitial: avatarInitial.toUpperCase() };
}

/**
 * Obtém o label do tipo de movimentação
 */
export const getMovementTypeLabel = (type: string, t: (key: string) => string): string => {
  const labels: Record<string, string> = {
    join: t('groupManager.history.entry'),
    leave: t('groupManager.history.exit'),
    promote: t('groupManager.history.promotes'),
    demote: t('groupManager.history.demotes'),
  };
  return labels[type] || type;
};

/**
 * Obtém o ícone do tipo de movimentação
 */
export const getMovementTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    join: '✅',
    leave: '👋',
    promote: '⬆️',
    demote: '⬇️',
  };
  return icons[type] || '📋';
};
