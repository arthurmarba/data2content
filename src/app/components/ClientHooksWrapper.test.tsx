"use client";

/** @jest-environment jsdom */
import { render } from '@testing-library/react';
import ClientHooksWrapper from './ClientHooksWrapper';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
}));

describe('ClientHooksWrapper', () => {
  beforeEach(() => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams(''));
    document.cookie = '';
    localStorage.clear();
  });

  it('stores agency invite code when codigo_agencia param is present', () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('codigo_agencia=XYZ123'));
    render(<ClientHooksWrapper />);
    expect(localStorage.getItem('agencyInviteCode')).toBeTruthy();
  });
});

