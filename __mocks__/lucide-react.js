const React = require('react');

const MockLucideIcon = (props) => React.createElement('svg', props);

module.exports = new Proxy(
  { __esModule: true, default: MockLucideIcon },
  {
    get(target, property) {
      if (property in target) return target[property];
      return MockLucideIcon;
    },
  }
);
