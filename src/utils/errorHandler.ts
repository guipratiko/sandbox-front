/**
 * Utilitários para tratamento de erros padronizado
 */

interface ErrorWithMessage {
  message?: string;
}

/**
 * Extrai mensagem de erro de forma segura
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message || fallback;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const errorWithMessage = error as ErrorWithMessage;
    return errorWithMessage.message || fallback;
  }
  return fallback;
}

/**
 * Loga erro de forma padronizada
 */
export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error, 'Erro desconhecido');
  console.error(`[${context}]`, message, error);
}

