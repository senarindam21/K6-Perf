#!/usr/bin/env node
'use strict';

/**
 * Mock MQ Handler for Mountebank
 * Handles MQ operations using the mock MQ server instead of real IBM MQ
 */

const { mockMQServer } = require('./mock-mq-server');

const operation = process.argv[2];

/**
 * Send message to mock MQ queue
 */
async function sendMessage() {
    const input = await readStdin();
    const requestData = JSON.parse(input);
    
    try {
        const queueName = requestData.queue || 'DEV.QUEUE.1';
        const messageData = requestData.message || requestData.body || requestData;
        
        const message = mockMQServer.putMessage(queueName, messageData, {
            correlationId: requestData.correlationId,
            replyToQueue: requestData.replyQueue || requestData.options?.replyToQueue,
            priority: requestData.priority || 0,
            persistence: requestData.persistence || 1
        });
        
        const response = {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'SUCCESS',
                operation: 'SEND',
                messageId: message.messageId,
                correlationId: message.correlationId,
                queue: queueName,
                messageSize: JSON.stringify(messageData).length,
                timestamp: message.putTime,
                queueDepth: mockMQServer.getQueueDepth(queueName).currentDepth
            }
        };
        
        console.log(JSON.stringify(response));
        
    } catch (error) {
        const errorResponse = {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'ERROR',
                operation: 'SEND',
                error: error.message,
                mqrc: error.mqrc || 'Unknown',
                timestamp: new Date().toISOString()
            }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * Receive message from mock MQ queue
 */
async function receiveMessage() {
    const input = await readStdin();
    const requestData = JSON.parse(input);
    
    try {
        const queueName = requestData.queue || 'DEV.QUEUE.1';
        const browse = requestData.browse || false;
        
        const message = mockMQServer.getMessage(queueName, { browse });
        
        if (!message) {
            const response = {
                statusCode: 204,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    status: 'NO_MESSAGES',
                    operation: 'RECEIVE',
                    queue: queueName,
                    timestamp: new Date().toISOString()
                }
            };
            console.log(JSON.stringify(response));
            return;
        }
        
        const response = {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'SUCCESS',
                operation: browse ? 'BROWSE' : 'RECEIVE',
                message: message.data,
                messageId: message.messageId,
                correlationId: message.correlationId,
                replyToQueue: message.replyToQueue,
                queue: queueName,
                putTime: message.putTime,
                priority: message.priority,
                messageSize: JSON.stringify(message.data).length,
                timestamp: new Date().toISOString(),
                queueDepth: mockMQServer.getQueueDepth(queueName).currentDepth
            }
        };
        
        console.log(JSON.stringify(response));
        
    } catch (error) {
        const errorResponse = {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'ERROR',
                operation: 'RECEIVE',
                error: error.message,
                mqrc: error.mqrc || 'Unknown',
                timestamp: new Date().toISOString()
            }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * Get mock queue depth information
 */
async function getQueueDepth() {
    const input = await readStdin();
    const requestData = JSON.parse(input);
    
    try {
        const queueName = requestData.queue || 'DEV.QUEUE.1';
        const depthInfo = mockMQServer.getQueueDepth(queueName);
        
        const utilization = depthInfo.maxDepth > 0 
            ? ((depthInfo.currentDepth / depthInfo.maxDepth) * 100).toFixed(2)
            : 0;
        
        const response = {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'SUCCESS',
                operation: 'QUEUE_DEPTH',
                queue: queueName,
                currentDepth: depthInfo.currentDepth,
                maxDepth: depthInfo.maxDepth,
                openInputCount: depthInfo.openInputCount,
                openOutputCount: depthInfo.openOutputCount,
                totalMessagesIn: depthInfo.totalMessagesIn,
                totalMessagesOut: depthInfo.totalMessagesOut,
                utilization: `${utilization}%`,
                warning: utilization > 80 ? 'High queue utilization' : null,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log(JSON.stringify(response));
        
    } catch (error) {
        const errorResponse = {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'ERROR',
                operation: 'QUEUE_DEPTH',
                error: error.message,
                mqrc: error.mqrc || 'Unknown',
                timestamp: new Date().toISOString()
            }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * Health check for mock MQ server
 */
async function healthCheck() {
    try {
        const status = mockMQServer.getStatus();
        
        const response = {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'HEALTHY',
                operation: 'HEALTH_CHECK',
                queueManager: status.queueManager,
                queues: status.queues,
                connections: status.connections,
                totalMessages: status.totalMessages,
                version: status.version,
                platform: status.platform,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log(JSON.stringify(response));
        
    } catch (error) {
        const errorResponse = {
            statusCode: 503,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'ERROR',
                operation: 'HEALTH_CHECK',
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * List all queues
 */
async function listQueues() {
    try {
        const queues = mockMQServer.listQueues();
        
        const response = {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'SUCCESS',
                operation: 'LIST_QUEUES',
                queueCount: queues.length,
                queues: queues,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log(JSON.stringify(response));
        
    } catch (error) {
        const errorResponse = {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'ERROR',
                operation: 'LIST_QUEUES',
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * Create a new queue
 */
async function createQueue() {
    const input = await readStdin();
    const requestData = JSON.parse(input);
    
    try {
        const queueName = requestData.queueName || requestData.queue;
        if (!queueName) {
            throw new Error('Queue name is required');
        }
        
        const created = mockMQServer.createQueue(queueName, {
            maxDepth: requestData.maxDepth || 5000,
            description: requestData.description || ''
        });
        
        const response = {
            statusCode: created ? 201 : 409,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: created ? 'SUCCESS' : 'QUEUE_EXISTS',
                operation: 'CREATE_QUEUE',
                queue: queueName,
                created: created,
                message: created ? 'Queue created successfully' : 'Queue already exists',
                timestamp: new Date().toISOString()
            }
        };
        
        console.log(JSON.stringify(response));
        
    } catch (error) {
        const errorResponse = {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'ERROR',
                operation: 'CREATE_QUEUE',
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * Clear all messages from a queue
 */
async function clearQueue() {
    const input = await readStdin();
    const requestData = JSON.parse(input);
    
    try {
        const queueName = requestData.queue || 'DEV.QUEUE.1';
        const clearedCount = mockMQServer.clearQueue(queueName);
        
        const response = {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'SUCCESS',
                operation: 'CLEAR_QUEUE',
                queue: queueName,
                messagesCleared: clearedCount,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log(JSON.stringify(response));
        
    } catch (error) {
        const errorResponse = {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                status: 'ERROR',
                operation: 'CLEAR_QUEUE',
                error: error.message,
                timestamp: new Date().toISOString()
            }
        };
        console.log(JSON.stringify(errorResponse));
    }
}

/**
 * Read stdin for request data
 */
function readStdin() {
    return new Promise((resolve) => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data || '{}'));
    });
}

// Execute based on operation
switch (operation) {
    case 'send':
        sendMessage().catch(console.error);
        break;
    case 'receive':
        receiveMessage().catch(console.error);
        break;
    case 'depth':
        getQueueDepth().catch(console.error);
        break;
    case 'health':
        healthCheck().catch(console.error);
        break;
    case 'list':
        listQueues().catch(console.error);
        break;
    case 'create':
        createQueue().catch(console.error);
        break;
    case 'clear':
        clearQueue().catch(console.error);
        break;
    default:
        console.error('Unknown operation:', operation);
        console.error('Available operations: send, receive, depth, health, list, create, clear');
        process.exit(1);
}
