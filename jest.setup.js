import React from 'react';
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

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    const { src, alt, ...rest } = props || {};
    const resolvedSrc = typeof src === 'string' ? src : src?.src || '';
    return React.createElement('img', { src: resolvedSrc, alt: alt || '', ...rest });
  },
}));


// Polyfill para ambientes JSDOM (usado por Mongoose e alguns mocks)
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
  global.clearImmediate = (id) => clearTimeout(id);
}

// Polyfills para APIs de browser usadas em testes (Sentry, UI responsiva)
if (typeof globalThis.performance !== 'undefined' && typeof globalThis.performance.getEntriesByType !== 'function') {
  globalThis.performance.getEntriesByType = () => [];
}

if (typeof globalThis.performance !== 'undefined' && typeof globalThis.performance.markResourceTiming !== 'function') {
  globalThis.performance.markResourceTiming = () => {};
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// Mock IntersectionObserver for components relying on it
if (typeof global.IntersectionObserver === 'undefined') {
  global.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
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
