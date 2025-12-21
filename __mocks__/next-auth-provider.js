const provider = (options = {}) => ({
  id: "mock-provider",
  name: "Mock Provider",
  type: "oauth",
  options,
});

module.exports = provider;
module.exports.default = provider;
