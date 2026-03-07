# Guia de Traduções - Sistema i18n

## Como usar traduções em qualquer página

O sistema de traduções está configurado globalmente e funciona automaticamente em todas as páginas.

### 1. Importar o hook

```typescript
import { useLanguage } from '../contexts/LanguageContext';
```

### 2. Usar no componente

```typescript
const MinhaPage: React.FC = () => {
  const { t } = useLanguage();
  
  return (
    <div>
      <h1>{t('minhapage.title')}</h1>
      <p>{t('minhapage.description')}</p>
    </div>
  );
};
```

### 3. Adicionar novas traduções

Edite `LanguageContext.tsx` e adicione as chaves:

```typescript
const translations = {
  pt: {
    'minhapage.title': 'Título da Página',
    'minhapage.description': 'Descrição da página',
  },
  en: {
    'minhapage.title': 'Page Title',
    'minhapage.description': 'Page description',
  },
};
```

### 4. Traduções com parâmetros

Para traduções com valores dinâmicos:

```typescript
// No LanguageContext.tsx
'welcome.message': 'Bem-vindo, {name}!'

// No componente
{t('welcome.message', { name: user.name })}
// Resultado: "Bem-vindo, João!"
```

### 5. Convenções de nomenclatura

- Use prefixos por página/feature: `login.`, `signup.`, `dashboard.`
- Use categorias: `validation.`, `error.`, `common.`
- Seja descritivo: `login.welcome` ao invés de `login.w1`

### 6. Idioma persistente

O idioma escolhido é salvo automaticamente no `localStorage` e mantido entre sessões.

### 7. Exemplo completo

```typescript
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const NovaPage: React.FC = () => {
  const { t, language } = useLanguage();
  
  return (
    <div>
      <h1>{t('novapage.title')}</h1>
      <p>Idioma atual: {language}</p>
      <button>{t('novapage.button')}</button>
    </div>
  );
};
```

## Estrutura recomendada de traduções

```typescript
{
  // Páginas
  'pagename.title': '...',
  'pagename.subtitle': '...',
  
  // Validações (compartilhadas)
  'validation.fieldRequired': '...',
  
  // Erros (compartilhados)
  'error.generic': '...',
  
  // Comum (compartilhado)
  'common.save': 'Salvar',
  'common.cancel': 'Cancelar',
}
```

