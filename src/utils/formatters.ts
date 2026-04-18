/**
 * Utilitários para formatação e normalização de dados
 */

/**
 * Normaliza nome: primeira letra maiúscula, demais minúsculas
 * Ex: "joão silva" -> "João Silva"
 */
export const normalizeName = (name: string): string => {
  if (!name) return '';
  
  return name
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
};

/**
 * Remove caracteres não numéricos do telefone
 */
export const cleanPhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Formata telefone no padrão (DDD) 9 9999-9999
 * Formata parcialmente enquanto o usuário digita
 * Remove DDI 55 se presente (formato internacional brasileiro)
 */
/**
 * Normaliza só dígitos para E.164-like: 10–11 dígitos sem DDI recebem 55 (Brasil), como no disparo em massa.
 */
export const normalizePhoneWithDefaultCountry = (digits: string, defaultDdi = '55'): string | null => {
  const d = cleanPhone(digits);
  if (!d) return null;
  if (d.length >= 12 && d.length <= 15) return d;
  if (d.length === 10 || d.length === 11) return `${defaultDdi}${d}`;
  return null;
};

/**
 * Celular BR com DDI 55: insere o 9 após o DDD quando vier só 10 dígitos nacionais (legado), depois formata (ex.: 556298448536 → (62) 9 9844-8536).
 */
export const formatBrazilWhatsappDigitsForDisplay = (digitsWith55: string): string => {
  const full = cleanPhone(digitsWith55);
  if (!full.startsWith('55')) {
    return formatPhone(full.length === 10 || full.length === 11 ? `55${full}` : full);
  }
  let national = full.slice(2);
  if (national.length === 10) {
    national = `${national.slice(0, 2)}9${national.slice(2)}`;
  }
  return formatPhone(`55${national}`);
};

/**
 * Formata identificador de usuário WhatsApp (parte antes de @) para exibição: BR com formatação nacional; demais +digits.
 */
export const formatWhatsAppUserForDisplay = (userPartOrJid: string): string => {
  const raw = userPartOrJid.includes('@') ? userPartOrJid.split('@')[0]! : userPartOrJid;
  const digits = cleanPhone(raw);
  if (!digits) return userPartOrJid;
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return formatBrazilWhatsappDigitsForDisplay(digits);
  }
  if (digits.length === 10 || digits.length === 11) {
    return formatPhone(`55${digits}`);
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return digits;
};

export const formatPhone = (phone: string): string => {
  let cleaned = cleanPhone(phone);
  
  if (cleaned.length === 0) return '';
  
  // Se começar com 55 (DDI do Brasil), remover
  if (cleaned.startsWith('55') && cleaned.length > 11) {
    cleaned = cleaned.substring(2);
  }
  
  // Limita a 11 dígitos (máximo para celular brasileiro)
  const limited = cleaned.substring(0, 11);
  
  // Formatação conforme quantidade de dígitos
  if (limited.length <= 2) {
    return `(${limited}`;
  } else if (limited.length <= 7) {
    // (DDD) XXXX
    const ddd = limited.substring(0, 2);
    const rest = limited.substring(2);
    return `(${ddd}) ${rest}`;
  } else if (limited.length === 10) {
    // Telefone fixo: (DDD) 9999-9999
    return limited.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (limited.length === 11) {
    // Celular: (DDD) 9 9999-9999
    return limited.replace(/(\d{2})(\d{1})(\d{4})(\d{4})/, '($1) $2 $3-$4');
  } else {
    // Formatação parcial para celular (8-9 dígitos)
    const ddd = limited.substring(0, 2);
    const d9 = limited.substring(2, 3);
    const part1 = limited.substring(3, 7);
    const part2 = limited.substring(7);
    
    if (part2) {
      return `(${ddd}) ${d9} ${part1}-${part2}`;
    } else if (part1) {
      return `(${ddd}) ${d9} ${part1}`;
    } else {
      return `(${ddd}) ${d9}`;
    }
  }
};

/**
 * Normaliza telefone para salvar no banco (apenas números)
 */
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  return cleanPhone(phone);
};

/**
 * Obtém as iniciais de um nome (máximo 2 caracteres)
 * Ex: "João Silva" -> "JS"
 */
export const getInitials = (name: string): string => {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

/**
 * Comprime imagem para reduzir tamanho
 */
export const compressImage = (
  file: File,
  maxWidth: number = 1600,
  maxHeight: number = 1600,
  quality: number = 0.85
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calcular novas dimensões mantendo proporção completa
        const aspectRatio = width / height;
        
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            if (width > maxWidth) {
              width = maxWidth;
              height = width / aspectRatio;
            }
            if (height > maxHeight) {
              height = maxHeight;
              width = height * aspectRatio;
            }
          } else {
            if (height > maxHeight) {
              height = maxHeight;
              width = height * aspectRatio;
            }
            if (width > maxWidth) {
              width = maxWidth;
              height = width / aspectRatio;
            }
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível criar contexto do canvas'));
          return;
        }
        
        // Desenhar imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);
        
        // Converter para base64 com qualidade reduzida
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      
      img.onerror = () => {
        reject(new Error('Erro ao carregar imagem'));
      };
      
      img.src = event.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };
    
    reader.readAsDataURL(file);
  });
};

