import '@testing-library/jest-dom';

// Polyfills for Next.js API routes during testing
import { TextEncoder, TextDecoder } from 'util';

// Ensure encoding APIs exist in the test environment
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;