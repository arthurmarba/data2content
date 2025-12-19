module.exports = {
  cookies: () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: () => new Map(),
};
