import '@testing-library/jest-dom';
import 'next/dist/server/node-polyfill-fetch';

// Polyfills for Next.js API routes during testing
import { TextEncoder, TextDecoder } from 'util';

// Ensure encoding APIs exist in the test environment
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

// Evita importar a rota real do NextAuth (usa next/headers) durante os testes
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/aiService', () => require('./__mocks__/aiService.js'), { virtual: true });
jest.mock('@/app/lib/aiOrchestrator', () => require('./__mocks__/aiOrchestrator.js'), { virtual: true });

// Polyfill para ambientes JSDOM (usado por Mongoose e alguns mocks)
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
  global.clearImmediate = (id) => clearTimeout(id);
}

// Provide Stripe key for tests
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// Polyfill para Playwright e libs que esperam TransformStream (Node 18+)
try {
  const { TransformStream, ReadableStream, WritableStream } = require('stream/web');
  if (typeof global.TransformStream === 'undefined') global.TransformStream = TransformStream;
  if (typeof global.ReadableStream === 'undefined') global.ReadableStream = ReadableStream;
  if (typeof global.WritableStream === 'undefined') global.WritableStream = WritableStream;
} catch {
  /* ignore */
}
