const React = require('react');

module.exports = new Proxy({}, {
  get: (target, prop) => {
    return function Icon(props) {
      return React.createElement('svg', { ...props, 'data-icon': prop });
    };
  }
});
