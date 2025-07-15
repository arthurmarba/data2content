import { appendInstagramLinkIfMissing } from '../process-response/dailyTipHandler';

describe('appendInstagramLinkIfMissing', () => {
  it('appends instagram link when message has no url and details has platformPostId', () => {
    const msg = 'Check this out';
    const details = { platformPostId: 'abc123' };
    const result = appendInstagramLinkIfMissing(msg, details);
    expect(result).toContain('https://www.instagram.com/p/abc123');
  });
});
