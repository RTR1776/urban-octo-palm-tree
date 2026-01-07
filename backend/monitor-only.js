#!/usr/bin/env node
/**
 * Run the whale monitoring bot without the web interface
 * Perfect for running in the background or on a server
 * 
 * Usage: node monitor-only.js
 * Or add to package.json: npm run monitor
 */

require('tsx/cjs');
require('./src/index.ts');
