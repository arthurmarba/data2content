// @jest-environment node
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

function createRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('affiliate code cookie', () => {
  it('sets cookie when valid ref parameter is present', async () => {
    const res = await middleware(createRequest('/?ref=abc123'));
    expect(res.cookies.get('d2c_ref')?.value).toBe('ABC123');
  });

  it('ignores invalid codes', async () => {
    const res = await middleware(createRequest('/?ref=!!'));
    expect(res.cookies.get('d2c_ref')).toBeUndefined();
  });
});

