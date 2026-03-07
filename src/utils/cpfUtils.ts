/**
 * Utilitários para CPF
 */

/**
 * Remove caracteres não numéricos do CPF
 */
export const cleanCPF = (cpf: string): string => {
  return cpf.replace(/\D/g, '');
};

/**
 * Valida se um CPF é válido
 */
export const isValidCPF = (cpf: string): boolean => {
  if (!cpf || typeof cpf !== 'string') {
    return false;
  }

  const clean = cleanCPF(cpf);

  if (clean.length !== 11) {
    return false;
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(clean)) {
    return false;
  }

  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(clean.charAt(9))) {
    return false;
  }

  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(clean.charAt(10))) {
    return false;
  }

  return true;
};

/**
 * Formata CPF para exibição: 000.000.000-00
 */
export const formatCPF = (cpf: string): string => {
  const clean = cleanCPF(cpf);
  if (clean.length !== 11) {
    return clean;
  }
  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9, 11)}`;
};

/**
 * Normaliza CPF durante digitação (aceita apenas números e formata)
 */
export const normalizeCPFInput = (value: string): string => {
  // Remove tudo que não é número
  const numbers = cleanCPF(value);
  
  // Limita a 11 dígitos
  const limited = numbers.substring(0, 11);
  
  // Formata conforme o usuário digita
  if (limited.length <= 3) {
    return limited;
  } else if (limited.length <= 6) {
    return `${limited.substring(0, 3)}.${limited.substring(3)}`;
  } else if (limited.length <= 9) {
    return `${limited.substring(0, 3)}.${limited.substring(3, 6)}.${limited.substring(6)}`;
  } else {
    return `${limited.substring(0, 3)}.${limited.substring(3, 6)}.${limited.substring(6, 9)}-${limited.substring(9)}`;
  }
};

