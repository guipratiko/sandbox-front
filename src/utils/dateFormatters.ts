/**
 * Utilitários para formatação de datas
 * Respeitam o locale configurado no LanguageContext
 */

import { format, formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Obtém o locale baseado no idioma
 */
const getLocale = (language: 'pt' | 'en') => {
  return language === 'pt' ? ptBR : enUS;
};

/**
 * Formata uma data para exibição (DD/MM/YYYY)
 * @param dateString - Data em formato ISO string ou Date
 * @param language - Idioma ('pt' ou 'en')
 * @returns Data formatada (ex: "26/12/2025" ou "12/26/2025")
 */
export const formatDate = (dateString: string | Date, language: 'pt' | 'en' = 'pt'): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const locale = getLocale(language);
    return format(date, 'dd/MM/yyyy', { locale });
  } catch {
    return String(dateString);
  }
};

/**
 * Formata uma data para exibição completa (DD/MM/YYYY HH:mm)
 * @param dateString - Data em formato ISO string ou Date
 * @param language - Idioma ('pt' ou 'en')
 * @returns Data e hora formatada (ex: "26/12/2025 17:39" ou "12/26/2025 5:39 PM")
 */
export const formatDateTime = (dateString: string | Date, language: 'pt' | 'en' = 'pt'): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const locale = getLocale(language);
    if (language === 'pt') {
      return format(date, 'dd/MM/yyyy HH:mm', { locale });
    } else {
      return format(date, 'MM/dd/yyyy h:mm a', { locale });
    }
  } catch {
    return String(dateString);
  }
};

/**
 * Formata apenas a hora (HH:mm)
 * @param dateString - Data em formato ISO string ou Date
 * @param language - Idioma ('pt' ou 'en')
 * @returns Hora formatada (ex: "17:39" ou "5:39 PM")
 */
export const formatTime = (dateString: string | Date, language: 'pt' | 'en' = 'pt'): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const locale = getLocale(language);
    if (language === 'pt') {
      return format(date, 'HH:mm', { locale });
    } else {
      return format(date, 'h:mm a', { locale });
    }
  } catch {
    return String(dateString);
  }
};

/**
 * Formata uma data de forma relativa (ex: "há 2 horas", "2 hours ago")
 * @param dateString - Data em formato ISO string ou Date
 * @param language - Idioma ('pt' ou 'en')
 * @returns Data relativa formatada
 */
export const formatRelativeTime = (dateString: string | Date, language: 'pt' | 'en' = 'pt'): string => {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const locale = getLocale(language);
    return formatDistanceToNow(date, { addSuffix: true, locale });
  } catch {
    return String(dateString);
  }
};

/**
 * Cria uma data local a partir de uma string no formato YYYY-MM-DD
 * Evita problemas de timezone ao criar datas
 * @param dateString - Data no formato YYYY-MM-DD
 * @returns Date criado no timezone local
 */
export const createLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month é 0-indexed
};

/**
 * Formata uma data de agendamento (data + hora)
 * @param dateString - Data no formato YYYY-MM-DD
 * @param timeString - Hora no formato HH:mm
 * @param language - Idioma ('pt' ou 'en')
 * @returns Data e hora formatada (ex: "26/12/2025 às 17:39" ou "12/26/2025 at 5:39 PM")
 */
export const formatScheduleDateTime = (
  dateString: string,
  timeString: string,
  language: 'pt' | 'en' = 'pt'
): string => {
  try {
    const date = createLocalDate(dateString);
    const formattedDate = formatDate(date, language);
    if (language === 'pt') {
      return `${formattedDate} às ${timeString}`;
    } else {
      return `${formattedDate} at ${timeString}`;
    }
  } catch {
    return timeString;
  }
};

/**
 * Obtém a data de hoje no formato YYYY-MM-DD
 * @returns String no formato YYYY-MM-DD
 */
export const getTodayDateString = (): string => {
  return new Date().toISOString().split('T')[0];
};

/** IANA válido ou fallback (alinhado ao perfil em Settings). */
export function resolveUserDisplayTimeZone(raw?: string | null): string {
  const fallback = 'America/Sao_Paulo';
  const tz = (raw && String(raw).trim()) || fallback;
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return fallback;
  }
}

/** Chave calendário YYYY-MM-DD da data instantânea no fuso do utilizador. */
export function calendarDayKeyInUserTimeZone(date: Date, timeZone: string): string {
  const tz = resolveUserDisplayTimeZone(timeZone);
  return formatInTimeZone(date, tz, 'yyyy-MM-dd');
}

/** Dia civil anterior ao “hoje” no mesmo fuso (robusto com DST). */
export function yesterdayCalendarKeyInUserTimeZone(timeZone: string): string {
  const tz = resolveUserDisplayTimeZone(timeZone);
  const todayKey = calendarDayKeyInUserTimeZone(new Date(), tz);
  let t = new Date();
  for (let i = 0; i < 96; i++) {
    t = new Date(t.getTime() - 60 * 60 * 1000);
    const k = calendarDayKeyInUserTimeZone(t, tz);
    if (k !== todayKey) return k;
  }
  return formatInTimeZone(new Date(Date.now() - 86400000), tz, 'yyyy-MM-dd');
}

/**
 * Texto do separador flutuante (Hoje / Ontem / data longa) no fuso do perfil.
 */
export function formatChatDaySeparatorLabel(
  messageDate: Date,
  userTimeZone: string | undefined | null,
  language: 'pt' | 'en' = 'pt'
): string {
  const tz = resolveUserDisplayTimeZone(userTimeZone);
  const msgKey = calendarDayKeyInUserTimeZone(messageDate, tz);
  const todayKey = calendarDayKeyInUserTimeZone(new Date(), tz);
  const yestKey = yesterdayCalendarKeyInUserTimeZone(tz);
  if (msgKey === todayKey) {
    return language === 'pt' ? 'Hoje' : 'Today';
  }
  if (msgKey === yestKey) {
    return language === 'pt' ? 'Ontem' : 'Yesterday';
  }
  const locale = getLocale(language);
  if (language === 'pt') {
    return formatInTimeZone(messageDate, tz, "d 'de' MMMM 'de' yyyy", { locale });
  }
  return formatInTimeZone(messageDate, tz, 'MMMM d, yyyy', { locale });
}

export type CrmChatDayGroup<T extends { timestamp: string | Date }> = { dayKey: string; messages: T[] };

/** Agrupa mensagens já ordenadas (antigas → novas) por dia civil no fuso do utilizador. */
export function groupCrmChatMessagesByUserCalendarDay<T extends { timestamp: string | Date }>(
  messages: T[],
  userTimeZone: string | undefined | null
): CrmChatDayGroup<T>[] {
  const tz = resolveUserDisplayTimeZone(userTimeZone);
  const groups: CrmChatDayGroup<T>[] = [];
  for (const msg of messages) {
    const d = typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp;
    const key = calendarDayKeyInUserTimeZone(d, tz);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === key) {
      last.messages.push(msg);
    } else {
      groups.push({ dayKey: key, messages: [msg] });
    }
  }
  return groups;
}

