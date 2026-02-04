const React = require('react');

const heroiconFactory = (name) => {
  const Component = (props = {}) =>
    React.createElement('svg', { ...props, 'data-testid': String(name) });
  Component.displayName = String(name);
  return Component;
};

const heroiconBase = heroiconFactory('Heroicon');

const heroiconModule = new Proxy(heroiconBase, {
  get: (target, prop) => {
    if (prop === '__esModule') return true;
    if (prop === 'default') return target;
    if (typeof prop === 'symbol') return target[prop];
    return heroiconFactory(prop);
  },
});

module.exports = heroiconModule;
