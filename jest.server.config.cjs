const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/', '/tests/e2e/'],
  transformIgnorePatterns: [
    '/node_modules/(?!(openid-client|jose|next-auth|@auth/core|uncrypto)/)',
  ],
  moduleNameMapper: {
    '^modularize-import-loader\\?name=([a-zA-Z0-9_-]+)&from=default&as=default&join=../esm/icons/([a-zA-Z0-9_-]+)!lucide-react$': '<rootDir>/__mocks__/lucide-react.js',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(gif|ttf|eot|svg|png)$': '<rootDir>/__mocks__/fileMock.js',
    '^@/app/api/auth/\\[\\.\\.\\.nextauth\\]/route(\\.ts)?$': '<rootDir>/__mocks__/nextauth-route.js',
    '^next-auth/providers/(.*)$': '<rootDir>/__mocks__/next-auth-provider.js',
    '^next-auth/?(.*)$': '<rootDir>/__mocks__/next-auth.js',
    '^next/headers$': '<rootDir>/__mocks__/next-headers.js',
    '^@/app/lib/aiService(?:\\.ts)?$': '<rootDir>/__mocks__/aiService.js',
    '^@/app/lib/aiOrchestrator(?:\\.ts)?$': '<rootDir>/__mocks__/aiOrchestrator.js',
    '^@/app/lib/stateService(?:\\.ts)?$': '<rootDir>/__mocks__/stateService.js',
    '^\\.\\./stateService$': '<rootDir>/__mocks__/stateService.js',
    '^nanoid$': '<rootDir>/__mocks__/nanoid.js',
    '^uncrypto(?:/.*)?$': '<rootDir>/__mocks__/uncrypto.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@heroicons/react/24/(solid|outline)/esm/.*$': '<rootDir>/__mocks__/heroicons/24/$1.js',
    '^@heroicons/react/(.*)$': '<rootDir>/__mocks__/heroicons/$1.js',
    '^jose$': '<rootDir>/__mocks__/jose.js',
  },
};

module.exports = createJestConfig(customJestConfig);
