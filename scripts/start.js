#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const buildPath = path.join(__dirname, '../build');
const buildExists = fs.existsSync(buildPath);

// Verifica múltiplas variáveis de ambiente para produção
const isProduction = 
  process.env.NODE_ENV === 'production' || 
  process.env.REACT_APP_NODE_ENV === 'production' ||
  process.env.ENV === 'production';

// Se a pasta build existe, sempre serve os arquivos estáticos (produção)
// Isso garante que mesmo sem NODE_ENV definido, se houver build, serve produção
if (buildExists) {
  console.log('🚀 Iniciando servidor de produção (arquivos estáticos)...');
  console.log(`📦 Build encontrado em: ${buildPath}`);
  console.log(
    'ℹ️  REACT_APP_* do .env não altera o JS já compilado. Para mudar URL de upgrade: edite public/upgrade-redirect-config.js e rode `npm run build` de novo, ou altere build/upgrade-redirect-config.js no servidor.'
  );
  const port = process.env.PORT || 3000;
  execSync(`serve -s build -l ${port}`, { stdio: 'inherit' });
} else if (isProduction) {
  console.log('⚠️  Modo produção detectado, mas pasta build não encontrada.');
  console.log('💡 Execute "npm run build" antes de iniciar em produção.');
  console.log('🔧 Iniciando servidor de desenvolvimento como fallback...');
  execSync('react-scripts start', { stdio: 'inherit' });
} else {
  console.log('🔧 Iniciando servidor de desenvolvimento...');
  execSync('react-scripts start', { stdio: 'inherit' });
}

