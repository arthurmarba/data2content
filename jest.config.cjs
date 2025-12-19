const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Forneça o caminho para o seu aplicativo Next.js para carregar next.config.js e .env em seu ambiente de teste
  dir: './',
});

// Adicione qualquer configuração personalizada que deseja passar para o Jest
const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests/e2e/'],
  // Permite transformar alguns pacotes ESM usados pelo next-auth/openid-client
  transformIgnorePatterns: [
    '/node_modules/(?!(openid-client|jose|next-auth|@auth/core|uncrypto)/)',
  ],
    moduleNameMapper: {
      // --- CORREÇÃO APLICADA AQUI ---
      // Adicionado para lidar com a importação otimizada de lucide-react pelo Next.js
      '^modularize-import-loader\\?name=([a-zA-Z0-9_-]+)&from=default&as=default&join=../esm/icons/([a-zA-Z0-9_-]+)!lucide-react$': '<rootDir>/__mocks__/lucide-react.js',

      // Mapeamentos existentes
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',

      // Mocks específicos devem vir antes do alias geral "@/"
      '^@/app/api/auth/\\[\\.\\.\\.nextauth\\]/route(\\.ts)?$': '<rootDir>/__mocks__/nextauth-route.js',
      '^next-auth/?(.*)$': '<rootDir>/__mocks__/next-auth.js',
      '^next/headers$': '<rootDir>/__mocks__/next-headers.js',
      '^@/app/lib/aiService(?:\\.ts)?$': '<rootDir>/__mocks__/aiService.js',
      '^@/app/lib/aiOrchestrator(?:\\.ts)?$': '<rootDir>/__mocks__/aiOrchestrator.js',
      '^@/app/lib/stateService(?:\\.ts)?$': '<rootDir>/__mocks__/stateService.js',
      '^\\.\\./stateService$': '<rootDir>/__mocks__/stateService.js',
      '^nanoid$': '<rootDir>/__mocks__/nanoid.js',
      '^uncrypto(?:/.*)?$': '<rootDir>/__mocks__/uncrypto.js',

      // Permite que imports usando o alias "@" apontem para a pasta src
      '^@/(.*)$': '<rootDir>/src/$1',

      '^@heroicons/react/24/(solid|outline)/esm/.*$': '<rootDir>/__mocks__/heroicons/24/$1.js',
      '^@heroicons/react/(.*)$': '<rootDir>/__mocks__/heroicons/$1.js',
      '^jose$': '<rootDir>/__mocks__/jose.js',
    },
  };

module.exports = createJestConfig(customJestConfig);
