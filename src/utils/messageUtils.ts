/**
 * Utilitários para manipulação de mensagens
 */

import { Message } from '../services/api';

/**
 * Ordena mensagens por timestamp (mais antigas primeiro, como WhatsApp)
 */
export const sortMessagesByTimestamp = (messages: Message[]): Message[] => {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
};

/**
 * Formata o conteúdo da última mensagem para exibição no card de contato
 * @param message - Mensagem a ser formatada
 * @returns String formatada para exibição
 */
function mediaLabelFromMessageType(messageType: string): string | null {
  if (messageType === 'imageMessage' || messageType === 'stickerMessage') return '📷 Imagem';
  if (messageType === 'videoMessage') return '🎥 Vídeo';
  if (messageType === 'audioMessage') return '🎤 Áudio';
  if (messageType === 'documentMessage') return '📄 Documento';
  return null;
}

export const formatLastMessageContent = (message: {
  messageType?: string;
  mediaUrl?: string | null;
  content?: string | null;
}): string => {
  if (!message) return '';

  const messageType = message.messageType || '';

  // Mídia com URL ou só tipo (ex.: placeholder "[Mídia]" no conteúdo)
  if (message.mediaUrl) {
    return mediaLabelFromMessageType(messageType) || '📎 Mídia';
  }

  const c = (message.content || '').trim();
  if (/^\[m[ií]dia\]$/i.test(c)) {
    return mediaLabelFromMessageType(messageType) || '📎 Mídia';
  }

  if (c) {
    return c;
  }

  const fromType = mediaLabelFromMessageType(messageType);
  if (fromType) return fromType;

  return '';
};

