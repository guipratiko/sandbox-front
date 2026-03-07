/**
 * Utilitários de validação reutilizáveis
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validators = {
  email: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, error: 'validation.emailRequired' };
    }
    if (!/\S+@\S+\.\S+/.test(value)) {
      return { isValid: false, error: 'validation.emailInvalid' };
    }
    return { isValid: true };
  },

  password: (value: string, minLength: number = 6): ValidationResult => {
    if (!value) {
      return { isValid: false, error: 'validation.passwordRequired' };
    }
    if (value.length < minLength) {
      return { isValid: false, error: 'validation.passwordMinLength' };
    }
    return { isValid: true };
  },

  name: (value: string, minLength: number = 3): ValidationResult => {
    if (!value?.trim()) {
      return { isValid: false, error: 'validation.nameRequired' };
    }
    if (value.trim().length < minLength) {
      return { isValid: false, error: 'validation.nameMinLength' };
    }
    return { isValid: true };
  },

  confirmPassword: (value: string, password: string): ValidationResult => {
    if (!value) {
      return { isValid: false, error: 'validation.confirmPasswordRequired' };
    }
    if (value !== password) {
      return { isValid: false, error: 'validation.passwordsNotMatch' };
    }
    return { isValid: true };
  },

  required: (value: any, errorKey: string = 'validation.required'): ValidationResult => {
    if (!value || (typeof value === 'string' && !value.trim())) {
      return { isValid: false, error: errorKey };
    }
    return { isValid: true };
  },

  cpf: (value: string): ValidationResult => {
    if (!value) {
      return { isValid: false, error: 'validation.cpfRequired' };
    }
    const clean = value.replace(/\D/g, '');
    if (clean.length !== 11) {
      return { isValid: false, error: 'validation.cpfInvalid' };
    }
    // Validação básica de CPF (verificar dígitos verificadores)
    if (/^(\d)\1{10}$/.test(clean)) {
      return { isValid: false, error: 'validation.cpfInvalid' };
    }
    // Validação completa dos dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(clean.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) {
      remainder = 0;
    }
    if (remainder !== parseInt(clean.charAt(9))) {
      return { isValid: false, error: 'validation.cpfInvalid' };
    }
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(clean.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) {
      remainder = 0;
    }
    if (remainder !== parseInt(clean.charAt(10))) {
      return { isValid: false, error: 'validation.cpfInvalid' };
    }
    return { isValid: true };
  },
};

