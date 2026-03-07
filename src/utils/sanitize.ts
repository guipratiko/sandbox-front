/**
 * Utilitário para sanitização de conteúdo HTML/XSS
 */

import DOMPurify from 'dompurify';

/**
 * Sanitiza uma string HTML removendo scripts e conteúdo malicioso
 * @param dirty - String HTML não sanitizada
 * @returns String HTML sanitizada
 */
export const sanitizeHTML = (dirty: string): string => {
  if (typeof window === 'undefined') {
    // SSR: retornar string limpa sem DOMPurify
    return dirty.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * Sanitiza texto simples removendo HTML
 * @param text - Texto que pode conter HTML
 * @returns Texto sem HTML
 */
export const sanitizeText = (text: string): string => {
  if (typeof window === 'undefined') {
    // SSR: remover tags HTML básicas
    return text.replace(/<[^>]*>/g, '');
  }
  
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
};

/**
 * Sanitiza URL removendo javascript: e outros protocolos perigosos
 * @param url - URL a ser sanitizada
 * @returns URL sanitizada ou string vazia se inválida
 */
export const sanitizeURL = (url: string): string => {
  if (!url || typeof url !== 'string') {
    return '';
  }
  
  const trimmed = url.trim();
  
  // Bloquear protocolos perigosos
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = trimmed.toLowerCase();
  
  if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
    return '';
  }
  
  // Permitir apenas http, https, mailto, tel
  if (!/^(https?|mailto|tel):/i.test(trimmed)) {
    return '';
  }
  
  return trimmed;
};

/**
 * Sanitiza objeto removendo propriedades perigosas
 * @param obj - Objeto a ser sanitizado
 * @returns Objeto sanitizado
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized = { ...obj };
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      sanitized[key] = sanitizeText(sanitized[key]) as T[Extract<keyof T, string>];
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeObject(sanitized[key]) as T[Extract<keyof T, string>];
    }
  }
  
  return sanitized;
};
