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

  it('sets cookie when ref param is present', () => {
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams('ref=ABCD12'));
    render(<ClientHooksWrapper />);
    expect(document.cookie).toContain('d2c_ref=ABCD12');
    expect(localStorage.getItem('affiliateRefCode')).toBeTruthy();
  });
});

