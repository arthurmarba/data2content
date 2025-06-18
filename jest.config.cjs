// jest.config.js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Forneça o caminho para o seu aplicativo Next.js para carregar next.config.js e .env em seu ambiente de teste
  dir: './',
});

// Adicione qualquer configuração personalizada que deseja passar para o Jest
const customJestConfig = {
  testEnvironment: 'jsdom',
  // Se você estiver usando @testing-library/jest-dom, descomente a linha abaixo
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleNameMapper: {
      // Mapeamentos para mocks e alias (mantemos o que já tínhamos)
      '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
      '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',
      '^@/app/(.*)$': '<rootDir>/src/app/$1',
      '^@heroicons/react/(.*)$': '<rootDir>/__mocks__/heroicons/$1.js',
    },
  };

// createJestConfig é exportado desta forma para garantir que o next/jest possa carregar a configuração do Next.js, que é assíncrona
module.exports = createJestConfig(customJestConfig);