const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Forneça o caminho para o seu aplicativo Next.js para carregar next.config.js e .env em seu ambiente de teste
  dir: './',
});

// Adicione qualquer configuração personalizada que deseja passar para o Jest
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
      // --- CORREÇÃO APLICADA AQUI ---
      // Adicionado para lidar com a importação otimizada de lucide-react pelo Next.js
      '^modularize-import-loader\\?name=([a-zA-Z0-9_-]+)&from=default&as=default&join=../esm/icons/([a-zA-Z0-9_-]+)!lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
      
      // Mapeamentos existentes
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',
      '^@/app/(.*)$': '<rootDir>/src/app/$1',
      '^@heroicons/react/24/(solid|outline)/esm/.*$': '<rootDir>/__mocks__/heroicons/24/$1.js',
      '^@heroicons/react/(.*)$': '<rootDir>/__mocks__/heroicons/$1.js',
    },
  };

module.exports = createJestConfig(customJestConfig);
