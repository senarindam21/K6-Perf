'use strict';

/**
 * Native IBM MQ Protocol Server for Mountebank
 * Enables Mountebank to act as a native IBM MQ server
 */

const EventEmitter = require('events');
const { MQClient } = require('../../../lib/mq/mqClient');
const { MQMessageHandler } = require('../../../lib/mq/mqMessageHandler');
const { MQConfig } = require('../../../lib/mq/mqConfig');

/**
 * MQ Protocol Server
 * Integrates IBM MQ with Mountebank's stub system
 */
class MQServer extends EventEmitter {
    constructor(options) {
        super();
        this.options = options || {};
        this.port = options.port || 1414;
        this.logger = options.logger || console;
        this.encoding = options.encoding || 'utf8';
        
        // MQ Configuration
        this.mqConfig = new MQConfig();
        this.config = this.mqConfig.mergeWithDefaults(options.mq || {});
        
        // MQ Client and Message Handler
        this.mqClient = new MQClient(this.config);
        this.messageHandler = new MQMessageHandler(options.imposters, this.logger);
        
        // Server state
        this.isRunning = false;
        this.queues = new Map();
        this.activeConnections = new Set();
        this.messageProcessors = new Map();
        
        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Setup event handlers for MQ client
     */
    setupEventHandlers() {
        this.mqClient.on('connected', () => {
            this.logger.info('MQ Server connected to Queue Manager');
            this.emit('connected');
        });

        this.mqClient.on('disconnected', () => {
            this.logger.info('MQ Server disconnected from Queue Manager');
            this.emit('disconnected');
        });

        this.mqClient.on('error', (error) => {
            this.logger.error('MQ Client error:', error);
            this.emit('error', error);
        });

        this.mqClient.on('messagePut', (queueName, message) => {
            this.logger.debug(`Message put to queue ${queueName}:`, message.messageId);
        });

        this.mqClient.on('messageGet', (queueName, message) => {
            if (message) {
                this.logger.debug(`Message retrieved from queue ${queueName}:`, message.messageId);
            }
        });
    }

    /**
     * Start the MQ server
     */
    async start() {
        try {
            if (this.isRunning) {
                throw new Error('MQ Server is already running');
            }

            this.logger.info(`Starting MQ Server on port ${this.port}...`);

            // Connect to IBM MQ
            await this.mqClient.connect();

            // Setup queues
            await this.setupQueues();

            // Start message processors
            await this.startMessageProcessors();

            this.isRunning = true;
            this.emit('started', this.port);
            
            this.logger.info(`MQ Server started successfully on port ${this.port}`);
            this.logger.info(`Queue Manager: ${this.config.queueManager}`);
            this.logger.info(`Connection: ${this.config.connectionName}`);
            this.logger.info(`Channel: ${this.config.channel}`);

            return this;

        } catch (error) {
            this.logger.error('Failed to start MQ Server:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Stop the MQ server
     */
    async stop() {
        try {
            if (!this.isRunning) {
                return;
            }

            this.logger.info('Stopping MQ Server...');

            // Stop message processors
            await this.stopMessageProcessors();

            // Close all queues
            await this.closeAllQueues();

            // Disconnect from IBM MQ
            if (this.mqClient.isConnected) {
                await this.mqClient.disconnect();
            }

            this.isRunning = false;
            this.emit('stopped');
            
            this.logger.info('MQ Server stopped successfully');

        } catch (error) {
            this.logger.error('Error stopping MQ Server:', error);
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Setup queues based on configuration
     */
    async setupQueues() {
        try {
            const queueConfigs = this.options.queues || [
                { name: 'DEV.QUEUE.1', type: 'both' }
            ];

            for (const queueConfig of queueConfigs) {
                await this.setupQueue(queueConfig);
            }

        } catch (error) {
            throw error;
        }
    }

    /**
     * Setup a single queue
     */
    async setupQueue(queueConfig) {
        try {
            const queueName = queueConfig.name;
            const queueType = queueConfig.type || 'both';

            // Open queue with appropriate options
            const openOptions = {
                input: queueType === 'input' || queueType === 'both',
                output: queueType === 'output' || queueType === 'both',
                browse: true,
                inquire: true
            };

            const queue = await this.mqClient.openQueue(queueName, openOptions);
            
            this.queues.set(queueName, {
                ...queue,
                config: queueConfig,
                type: queueType,
                messageCount: 0,
                lastActivity: new Date()
            });

            this.logger.info(`Queue setup completed: ${queueName} (${queueType})`);
            return queue;

        } catch (error) {
            this.logger.error(`Failed to setup queue ${queueConfig.name}:`, error);
            throw error;
        }
    }

    /**
     * Start message processors for all input queues
     */
    async startMessageProcessors() {
        try {
            for (const [queueName, queueInfo] of this.queues) {
                if (queueInfo.type === 'input' || queueInfo.type === 'both') {
                    const processor = this.createMessageProcessor(queueName);
                    this.messageProcessors.set(queueName, processor);
                    processor.start();
                }
            }

        } catch (error) {
            throw error;
        }
    }

    /**
     * Create a message processor for a queue
     */
    createMessageProcessor(queueName) {
        return {
            queueName: queueName,
            isRunning: false,
            intervalId: null,
            
            start: () => {
                if (this.isRunning) return;
                
                this.isRunning = true;
                this.intervalId = setInterval(async () => {
                    try {
                        await this.processQueueMessages(queueName);
                    } catch (error) {
                        this.logger.error(`Error processing messages for queue ${queueName}:`, error);
                    }
                }, 1000); // Check for messages every second
                
                this.logger.debug(`Message processor started for queue: ${queueName}`);
            },
            
            stop: () => {
                if (!this.isRunning) return;
                
                this.isRunning = false;
                if (this.intervalId) {
                    clearInterval(this.intervalId);
                    this.intervalId = null;
                }
                
                this.logger.debug(`Message processor stopped for queue: ${queueName}`);
            }
        };
    }

    /**
     * Process messages from a specific queue
     */
    async processQueueMessages(queueName) {
        try {
            const message = await this.mqClient.getMessage(queueName, { waitInterval: 100 });
            
            if (message) {
                // Update queue statistics
                const queueInfo = this.queues.get(queueName);
                if (queueInfo) {
                    queueInfo.messageCount++;
                    queueInfo.lastActivity = new Date();
                }

                this.logger.debug(`Processing message from queue ${queueName}: ${message.messageId}`);
                
                // Process message through stub system
                const response = await this.messageHandler.processMessage(message, this.options);
                
                // Send response if reply-to queue is specified
                if (message.replyToQueue && response) {
                    await this.sendResponse(message.replyToQueue, response);
                }

                this.emit('messageProcessed', queueName, message, response);
            }

        } catch (error) {
            // Log error but don't stop processing
            this.logger.debug(`No message available or error processing queue ${queueName}:`, error.message);
        }
    }

    /**
     * Send response message to a queue
     */
    async sendResponse(queueName, response) {
        try {
            // Ensure the response queue is open for output
            if (!this.queues.has(queueName)) {
                await this.setupQueue({ name: queueName, type: 'output' });
            }

            const result = await this.mqClient.putMessage(queueName, response.data, {
                correlationId: response.correlationId,
                messageType: response.messageType,
                priority: response.priority,
                persistence: response.persistence,
                format: response.format
            });

            this.logger.debug(`Response sent to queue ${queueName}: ${result.messageId}`);
            return result;

        } catch (error) {
            this.logger.error(`Failed to send response to queue ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Stop all message processors
     */
    async stopMessageProcessors() {
        for (const [queueName, processor] of this.messageProcessors) {
            processor.stop();
        }
        this.messageProcessors.clear();
    }

    /**
     * Close all queues
     */
    async closeAllQueues() {
        try {
            for (const [queueName] of this.queues) {
                await this.mqClient.closeQueue(queueName);
            }
            this.queues.clear();

        } catch (error) {
            throw error;
        }
    }

    /**
     * Get server status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            port: this.port,
            queueManager: this.config.queueManager,
            connectionName: this.config.connectionName,
            channel: this.config.channel,
            queues: Array.from(this.queues.entries()).map(([name, info]) => ({
                name: name,
                type: info.type,
                messageCount: info.messageCount,
                lastActivity: info.lastActivity
            })),
            activeProcessors: Array.from(this.messageProcessors.keys()),
            mqClientStatus: this.mqClient.getStatus()
        };
    }

    /**
     * Add a new queue dynamically
     */
    async addQueue(queueConfig) {
        try {
            await this.setupQueue(queueConfig);
            
            // Start processor if it's an input queue
            if (queueConfig.type === 'input' || queueConfig.type === 'both') {
                const processor = this.createMessageProcessor(queueConfig.name);
                this.messageProcessors.set(queueConfig.name, processor);
                processor.start();
            }

            this.emit('queueAdded', queueConfig.name);

        } catch (error) {
            throw error;
        }
    }

    /**
     * Remove a queue dynamically
     */
    async removeQueue(queueName) {
        try {
            // Stop processor if exists
            const processor = this.messageProcessors.get(queueName);
            if (processor) {
                processor.stop();
                this.messageProcessors.delete(queueName);
            }

            // Close and remove queue
            await this.mqClient.closeQueue(queueName);
            this.queues.delete(queueName);

            this.emit('queueRemoved', queueName);

        } catch (error) {
            throw error;
        }
    }

    /**
     * Manually put a message to a queue (for testing)
     */
    async putTestMessage(queueName, messageData, options = {}) {
        return await this.mqClient.putMessage(queueName, messageData, options);
    }

    /**
     * Browse messages in a queue (for monitoring)
     */
    async browseQueue(queueName) {
        return await this.mqClient.browseMessages(queueName);
    }
}

/**
 * Create MQ server instance
 */
function create(options) {
    return new MQServer(options);
}

module.exports = {
    create: create,
    MQServer: MQServer
};
