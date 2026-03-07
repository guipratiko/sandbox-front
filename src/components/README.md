# Componentes OnlyFlow

Este diretório contém todos os componentes reutilizáveis do projeto OnlyFlow.

## Estrutura

```
components/
├── Layout/          # Componentes de layout
├── UI/              # Componentes de interface
├── Login/           # Componentes específicos
└── examples/        # Exemplos de uso
```

## Componentes Base

### Layout

#### Layout
Componente base que aplica o background padrão do backend.

```tsx
import { Layout } from '../components/Layout';

<Layout>
  {/* Seu conteúdo aqui */}
</Layout>
```

#### Container
Container responsivo com max-width configurável.

```tsx
import { Container } from '../components/Layout';

<Container maxWidth="xl">
  {/* Seu conteúdo aqui */}
</Container>
```

**Props:**
- `maxWidth`: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' (padrão: 'xl')

---

### UI Components

#### Button
Botão reutilizável com múltiplas variantes e tamanhos.

```tsx
import { Button } from '../components/UI';

<Button variant="primary" size="md" isLoading={false}>
  Clique aqui
</Button>
```

**Props:**
- `variant`: 'primary' | 'secondary' | 'outline' | 'ghost' (padrão: 'primary')
- `size`: 'sm' | 'md' | 'lg' (padrão: 'md')
- `isLoading`: boolean (padrão: false)
- Todas as props padrão de `<button>`

**Variantes:**
- `primary`: Botão principal (cor do backend: #5B9DFE)
- `secondary`: Botão secundário (cinza)
- `outline`: Botão com borda
- `ghost`: Botão transparente

#### Input
Input reutilizável com label, error e helper text.

```tsx
import { Input } from '../components/UI';

<Input
  label="Email"
  type="email"
  placeholder="seu@email.com"
  error="Campo obrigatório"
  helperText="Digite seu email"
/>
```

**Props:**
- `label`: string (opcional)
- `error`: string (opcional) - Mensagem de erro
- `helperText`: string (opcional) - Texto de ajuda
- Todas as props padrão de `<input>`

#### Card
Card reutilizável com padding, shadow e hover configuráveis.

```tsx
import { Card } from '../components/UI';

<Card padding="md" shadow="lg" hover>
  {/* Conteúdo do card */}
</Card>
```

**Props:**
- `padding`: 'none' | 'sm' | 'md' | 'lg' (padrão: 'md')
- `shadow`: 'none' | 'sm' | 'md' | 'lg' (padrão: 'md')
- `hover`: boolean (padrão: false) - Adiciona efeito hover

---

## Exemplo Completo

```tsx
import React from 'react';
import { Layout, Container } from '../components/Layout';
import { Button, Input, Card } from '../components/UI';

const MinhaPage: React.FC = () => {
  return (
    <Layout>
      <Container>
        <Card hover>
          <h1 className="text-2xl font-bold text-clerky-backendText mb-4">
            Título
          </h1>
          <form className="space-y-4">
            <Input
              label="Nome"
              placeholder="Digite seu nome"
            />
            <Button variant="primary" type="submit">
              Salvar
            </Button>
          </form>
        </Card>
      </Container>
    </Layout>
  );
};

export default MinhaPage;
```

## Cores Disponíveis

Todos os componentes usam automaticamente as cores do backend:

- **Background**: `bg-clerky-backendBg` (#EBF2FD)
- **Textos**: `text-clerky-backendText` (#111D32)
- **Botões**: `bg-clerky-backendButton` (#5B9DFE)

Você também pode usar essas classes diretamente em qualquer elemento.

