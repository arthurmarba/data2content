module.exports = new Proxy({}, {
  get: () => {
    return function Icon() {
      return null;
    };
  }
});
