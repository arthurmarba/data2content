import '@testing-library/jest-dom';
import 'next/dist/server/node-polyfill-fetch';

// Polyfills for Next.js API routes during testing
import { TextEncoder, TextDecoder } from 'util';

// Ensure encoding APIs exist in the test environment
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

// Provide Stripe key for tests
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123';
