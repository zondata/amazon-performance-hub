const path = require('node:path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env.local'),
});

process.argv = ['node', 'next', 'build'];
require('../apps/web/node_modules/next/dist/bin/next');
