# Clerky Frontend

Frontend do Clerky - Hub de conexão com redes sociais.

## Tecnologias

- React
- TypeScript
- Tailwind CSS
- React Router

## Configuração

1. Instale as dependências:
```bash
npm install
```

2. Execute o projeto em modo desenvolvimento:
```bash
npm start
```

O projeto será aberto em `http://localhost:3000`

## Estrutura

```
Frontend/
├── src/
│   ├── components/
│   │   └── Login/         # Componente de login
│   ├── styles/
│   │   ├── globals.css    # Estilos globais
│   │   └── theme.ts       # Sistema de design
│   ├── img/               # Imagens (logo, favicon)
│   ├── App.tsx
│   └── index.tsx
├── public/
└── package.json
```

## Sistema de Design

O projeto utiliza uma paleta de cores baseada no site clerky.com.br:

- **Primary (Azul profundo):** `#0040FF`
- **Secondary (Azul vibrante):** `#00C0FF`
- **Dark (Preto):** `#000000`
- **Light (Cinza claro):** `#F5F5F5`

As cores podem ser usadas via Tailwind CSS com as classes:
- `bg-clerky-primary`
- `bg-clerky-secondary`
- `text-clerky-primary`
- etc.

