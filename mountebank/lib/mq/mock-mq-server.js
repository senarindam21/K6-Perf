#!/usr/bin/env node
'use strict';

/**
 * Mock IBM MQ Server Engine for Mountebank
 * Simulates complete IBM MQ functionality without requiring real MQ installation
 */

const fs = require('fs');
const path = require('path');

class MockMQServer {
    constructor() {
        this.queues = new Map();
        this.connections = new Map();
        this.messageId = 1;
        this.correlationId = 1;
        this.isRunning = false;
        this.queueManager = 'MOCK_QM1';
        
        // Initialize default queues
        this.initializeDefaultQueues();
        
        // Load persistent data if exists
        this.loadPersistentData();
    }

    initializeDefaultQueues() {
        const defaultQueues = [
            'DEV.QUEUE.1',
            'DEV.QUEUE.RESPONSE', 
            'TEST.REQUEST.QUEUE',
            'TEST.RESPONSE.QUEUE',
            'DEV.QUEUE.ERROR'
        ];

        defaultQueues.forEach(queueName => {
            this.createQueue(queueName, {
                maxDepth: 10000,
                description: `Mock queue: ${queueName}`
            });
        });
    }

    createQueue(queueName, options = {}) {
        if (!this.queues.has(queueName)) {
            this.queues.set(queueName, {
                name: queueName,
                messages: [],
                maxDepth: options.maxDepth || 5000,
                description: options.description || '',
                created: new Date().toISOString(),
                openInputCount: 0,
                openOutputCount: 0,
                totalMessagesIn: 0,
                totalMessagesOut: 0
            });
            return true;
        }
        return false;
    }

    deleteQueue(queueName) {
        return this.queues.delete(queueName);
    }

    putMessage(queueName, messageData, options = {}) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue '${queueName}' does not exist`);
        }

        if (queue.messages.length >= queue.maxDepth) {
            throw new Error(`Queue '${queueName}' is full (max depth: ${queue.maxDepth})`);
        }

        const message = {
            messageId: this.generateMessageId(),
            correlationId: options.correlationId || this.generateCorrelationId(),
            data: messageData,
            putTime: new Date().toISOString(),
            priority: options.priority || 0,
            persistence: options.persistence || 1,
            format: options.format || 'MQSTR',
            messageType: options.messageType || 8,
            replyToQueue: options.replyToQueue || '',
            expiry: options.expiry || -1,
            putApplicationName: options.putApplicationName || 'MockMQServer'
        };

        queue.messages.push(message);
        queue.totalMessagesIn++;

        // Auto-save state
        this.savePersistentData();

        return message;
    }

    getMessage(queueName, options = {}) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue '${queueName}' does not exist`);
        }

        if (queue.messages.length === 0) {
            return null; // No messages available
        }

        let message;
        if (options.browse) {
            // Browse mode - don't remove message
            message = queue.messages[0];
        } else {
            // Get mode - remove message
            message = queue.messages.shift();
            queue.totalMessagesOut++;
        }

        if (message && !options.browse) {
            this.savePersistentData();
        }

        return message;
    }

    getQueueDepth(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue '${queueName}' does not exist`);
        }

        return {
            queueName: queueName,
            currentDepth: queue.messages.length,
            maxDepth: queue.maxDepth,
            openInputCount: queue.openInputCount,
            openOutputCount: queue.openOutputCount,
            totalMessagesIn: queue.totalMessagesIn,
            totalMessagesOut: queue.totalMessagesOut
        };
    }

    listQueues() {
        return Array.from(this.queues.values()).map(queue => ({
            name: queue.name,
            currentDepth: queue.messages.length,
            maxDepth: queue.maxDepth,
            description: queue.description,
            created: queue.created
        }));
    }

    clearQueue(queueName) {
        const queue = this.queues.get(queueName);
        if (!queue) {
            throw new Error(`Queue '${queueName}' does not exist`);
        }

        const clearedCount = queue.messages.length;
        queue.messages = [];
        this.savePersistentData();
        
        return clearedCount;
    }

    connect(connectionId, options = {}) {
        this.connections.set(connectionId, {
            id: connectionId,
            connected: new Date().toISOString(),
            clientName: options.clientName || 'MockMQClient',
            channel: options.channel || 'DEV.APP.SVRCONN',
            host: options.host || 'localhost',
            port: options.port || 1414
        });

        return {
            connectionId: connectionId,
            queueManager: this.queueManager,
            status: 'CONNECTED'
        };
    }

    disconnect(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return false;
        }

        this.connections.delete(connectionId);
        return true;
    }

    getStatus() {
        return {
            queueManager: this.queueManager,
            status: 'RUNNING',
            queues: this.queues.size,
            connections: this.connections.size,
            totalMessages: Array.from(this.queues.values())
                .reduce((total, queue) => total + queue.messages.length, 0),
            uptime: this.isRunning ? 'Running' : 'Stopped',
            version: '9.0.0.0 (Mock)',
            platform: 'MockMQ Server'
        };
    }

    generateMessageId() {
        return `MSG-${String(this.messageId++).padStart(8, '0')}-${Date.now()}`;
    }

    generateCorrelationId() {
        return `CORR-${String(this.correlationId++).padStart(8, '0')}-${Date.now()}`;
    }

    savePersistentData() {
        try {
            const dataDir = path.join(process.cwd(), 'data', 'mock-mq');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            const data = {
                queues: Array.from(this.queues.entries()),
                messageId: this.messageId,
                correlationId: this.correlationId,
                lastSaved: new Date().toISOString()
            };

            fs.writeFileSync(
                path.join(dataDir, 'mock-mq-state.json'), 
                JSON.stringify(data, null, 2)
            );
        } catch (error) {
            console.warn('Failed to save mock MQ state:', error.message);
        }
    }

    loadPersistentData() {
        try {
            const dataFile = path.join(process.cwd(), 'data', 'mock-mq', 'mock-mq-state.json');
            if (fs.existsSync(dataFile)) {
                const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                
                this.queues = new Map(data.queues);
                this.messageId = data.messageId || 1;
                this.correlationId = data.correlationId || 1;
                
                console.error('Loaded mock MQ state from persistent storage');
            }
        } catch (error) {
            console.warn('Failed to load mock MQ state:', error.message);
        }
    }

    simulateError(errorType) {
        const errors = {
            'QUEUE_FULL': { code: 2053, message: 'MQRC_Q_FULL' },
            'QUEUE_NOT_FOUND': { code: 2085, message: 'MQRC_UNKNOWN_OBJECT_NAME' },
            'CONNECTION_BROKEN': { code: 2009, message: 'MQRC_CONNECTION_BROKEN' },
            'NOT_AUTHORIZED': { code: 2035, message: 'MQRC_NOT_AUTHORIZED' },
            'NO_MSG_AVAILABLE': { code: 2033, message: 'MQRC_NO_MSG_AVAILABLE' }
        };

        const error = errors[errorType] || errors['CONNECTION_BROKEN'];
        const mqError = new Error(error.message);
        mqError.mqrc = error.code;
        throw mqError;
    }
}

// Global mock MQ server instance
const mockMQServer = new MockMQServer();

module.exports = { MockMQServer, mockMQServer };
