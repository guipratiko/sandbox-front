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
export const formatLastMessageContent = (message: {
  messageType?: string;
  mediaUrl?: string | null;
  content?: string | null;
}): string => {
  if (!message) return '';

  // Se é mídia, mostrar tipo apropriado
  if (message.mediaUrl) {
    const messageType = message.messageType || '';
    if (messageType === 'imageMessage' || messageType === 'stickerMessage') {
      return '📷 Imagem';
    } else if (messageType === 'videoMessage') {
      return '🎥 Vídeo';
    } else if (messageType === 'audioMessage') {
      return '🎤 Áudio';
    } else if (messageType === 'documentMessage') {
      return '📄 Documento';
    } else {
      return '📎 Mídia';
    }
  }

  // Se tem conteúdo de texto, usar o conteúdo
  if (message.content && message.content.trim()) {
    return message.content;
  }

  return '';
};

