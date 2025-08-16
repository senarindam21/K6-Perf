#!/usr/bin/env node
'use strict';

/**
 * MQ Bridge Middleware for Mountebank
 * Handles routing HTTP requests to MQ operations
 */

const { spawn } = require('child_process');
const path = require('path');

/**
 * Execute MQ operation and return response
 */
function executeMQOperation(operation, request) {
    return new Promise((resolve) => {
        const handlerPath = path.join(__dirname, 'real-mq-handler.js');
        
        // Check if handler file exists
        const fs = require('fs');
        if (!fs.existsSync(handlerPath)) {
            resolve({
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ERROR',
                    error: 'MQ handler file not found',
                    details: `Handler file not found at: ${handlerPath}`,
                    timestamp: new Date().toISOString()
                })
            });
            return;
        }
        
        const process = spawn('node', [handlerPath, operation]);
        
        // Send request data to handler
        process.stdin.write(JSON.stringify(request));
        process.stdin.end();
        
        let output = '';
        let errorOutput = '';
        
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        process.on('close', (code) => {
            if (code !== 0) {
                resolve({
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'ERROR',
                        error: `Process exited with code ${code}`,
                        details: errorOutput,
                        timestamp: new Date().toISOString()
                    })
                });
                return;
            }
            
            try {
                const response = JSON.parse(output);
                resolve(response);
            } catch (parseError) {
                resolve({
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'ERROR',
                        error: 'Failed to parse MQ handler response',
                        details: output,
                        timestamp: new Date().toISOString()
                    })
                });
            }
        });
        
        process.on('error', (error) => {
            resolve({
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ERROR',
                    error: 'Failed to spawn MQ handler process',
                    details: error.message,
                    timestamp: new Date().toISOString()
                })
            });
        });
    });
}

// Export functions for different operations
module.exports = {
    send: (request) => executeMQOperation('send', request),
    receive: (request) => executeMQOperation('receive', request),
    depth: (request) => executeMQOperation('depth', request),
    health: (request) => executeMQOperation('health', request),
    createqueue: (request) => executeMQOperation('createqueue', request),
    
    // Mock MQ operations (using mock-mq-handler.js)
    mockSend: (request) => executeMockMQOperation('send', request),
    mockReceive: (request) => executeMockMQOperation('receive', request),
    mockBrowse: (request) => { 
        const browsRequest = { ...request, body: JSON.stringify({ ...JSON.parse(request.body || '{}'), browse: true }) };
        return executeMockMQOperation('receive', browsRequest);
    },
    mockDepth: (request) => executeMockMQOperation('depth', request),
    mockHealth: (request) => executeMockMQOperation('health', request),
    mockList: (request) => executeMockMQOperation('list', request),
    mockCreate: (request) => executeMockMQOperation('create', request),
    mockClear: (request) => executeMockMQOperation('clear', request),
    mockStatus: (request) => executeMockMQOperation('health', request)
};

/**
 * Execute Mock MQ operation and return response
 */
function executeMockMQOperation(operation, request) {
    return new Promise((resolve) => {
        const handlerPath = path.join(__dirname, 'mock-mq-handler.js');
        
        // Check if handler file exists
        const fs = require('fs');
        if (!fs.existsSync(handlerPath)) {
            resolve({
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ERROR',
                    error: 'Mock MQ handler file not found',
                    details: `Handler file not found at: ${handlerPath}`,
                    timestamp: new Date().toISOString()
                })
            });
            return;
        }
        
        const process = spawn('node', [handlerPath, operation]);
        
        // Send request data to handler
        process.stdin.write(JSON.stringify(request));
        process.stdin.end();
        
        let output = '';
        let errorOutput = '';
        
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });
        
        process.on('close', (code) => {
            if (code !== 0) {
                resolve({
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'ERROR',
                        error: `Mock MQ process exited with code ${code}`,
                        details: errorOutput,
                        timestamp: new Date().toISOString()
                    })
                });
                return;
            }
            
            try {
                const response = JSON.parse(output);
                resolve(response);
            } catch (parseError) {
                resolve({
                    statusCode: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        status: 'ERROR',
                        error: 'Failed to parse Mock MQ handler response',
                        details: output,
                        timestamp: new Date().toISOString()
                    })
                });
            }
        });
        
        process.on('error', (error) => {
            resolve({
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'ERROR',
                    error: 'Failed to spawn Mock MQ handler process',
                    details: error.message,
                    timestamp: new Date().toISOString()
                })
            });
        });
    });
}
