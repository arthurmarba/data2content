const fallback = jest.fn(async () => ({}));

class SignJWT {
  constructor(payload) {
    this.payload = payload;
  }
  setProtectedHeader() { return this; }
  setIssuedAt() { return this; }
  setAudience() { return this; }
  setExpirationTime() { return this; }
  async sign() { return 'mock-jwt'; }
}

const baseMocks = {
  jwtVerify: jest.fn(async () => ({ payload: {}, protectedHeader: {} })),
  SignJWT,
  decodeJwt: jest.fn(() => ({})),
};

module.exports = new Proxy(baseMocks, {
  get(target, prop) {
    if (prop in target) {
      return target[prop];
    }
    const fn = fallback;
    target[prop] = fn;
    return fn;
  },
});
