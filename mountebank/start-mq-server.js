#!/usr/bin/env node

'use strict';

/**
 * MQ Server Startup Script
 * Demonstrates starting Mountebank with MQ protocol support
 */

const path = require('path');
const { spawn } = require('child_process');

console.log('Starting Mountebank with IBM MQ Protocol Support...\n');

// Configuration
const configFile = path.join(__dirname, 'ConfigFiles', 'Imposters', 'mq-imposter-config.json');
const mountebankBin = path.join(__dirname, 'bin', 'mb');

// Start Mountebank with MQ configuration
const mbProcess = spawn('node', [
    mountebankBin,
    '--configfile', configFile,
    '--allowInjection',
    '--debug',
    '--loglevel', 'info'
], {
    stdio: 'inherit'
});

// Handle process events
mbProcess.on('error', (error) => {
    console.error('Failed to start Mountebank:', error);
    process.exit(1);
});

mbProcess.on('close', (code) => {
    console.log(`\nMountebank exited with code ${code}`);
    process.exit(code);
});

// Handle termination signals
process.on('SIGINT', () => {
    console.log('\nShutting down Mountebank...');
    mbProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
    console.log('\nShutting down Mountebank...');
    mbProcess.kill('SIGTERM');
});

console.log('Mountebank is starting with MQ support...');
console.log('Configuration file:', configFile);
console.log('Press Ctrl+C to stop');
console.log('\nOnce started, you can:');
console.log('- View imposter status: http://localhost:2525/imposters');
console.log('- Test MQ integration: npm run test:mq');
console.log('- Test MQ client: npm run test:mq-client');
console.log('');
