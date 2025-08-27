const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Monkey patch path.relative to handle undefined arguments
const originalRelative = require('path').relative;
require('path').relative = function(from, to) {
  // Handle undefined 'to' argument that's causing the Metro error
  if (typeof to !== 'string') {
    console.warn('path.relative received undefined "to" argument, defaulting to empty string');
    to = '';
  }
  if (typeof from !== 'string') {
    console.warn('path.relative received undefined "from" argument, defaulting to empty string');
    from = '';
  }
  return originalRelative(from, to);
};

// Fix resolver to handle node:path imports
config.resolver = {
  ...config.resolver,
  alias: {
    'node:path': 'path-browserify',
  },
};

module.exports = config;