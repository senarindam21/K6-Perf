'use strict';

/**
 * MQ Imposter implementation for Mountebank
 * Handles the creation and management of MQ protocol imposters
 */

const { create: createMQServer } = require('./mqServer');
const { MQConfig } = require('../../../lib/mq/mqConfig');

/**
 * Create an MQ imposter
 */
async function create(creationRequest, logger, responseFn) {
    const config = new MQConfig();

    try {
        // Validate the imposter configuration
        await config.validateConfig(creationRequest);
        
        // Create the MQ server
        const server = createMQServer({
            port: creationRequest.port,
            encoding: creationRequest.encoding || 'utf8',
            logger: logger,
            mq: creationRequest.mq || {},
            queues: creationRequest.queues || [],
            stubs: creationRequest.stubs || [],
            imposters: creationRequest.imposters
        });

        // Setup imposter methods
        const imposter = {
            port: creationRequest.port,
            protocol: 'mq',
            numberOfRequests: 0,
            requests: [],
            stubs: creationRequest.stubs || [],
            
            // Add request tracking
            addRequest: function(request) {
                this.requests.push(request);
                this.numberOfRequests += 1;
            },

            // Get all requests
            getRequests: function() {
                return this.requests;
            },

            // Reset requests
            resetRequests: function() {
                this.requests = [];
                this.numberOfRequests = 0;
            },

            // Add stub
            addStub: function(stub) {
                this.stubs.push(stub);
            },

            // Remove stub
            removeStub: function(stubIndex) {
                if (stubIndex >= 0 && stubIndex < this.stubs.length) {
                    this.stubs.splice(stubIndex, 1);
                }
            },

            // Replace stub
            replaceStub: function(stubIndex, newStub) {
                if (stubIndex >= 0 && stubIndex < this.stubs.length) {
                    this.stubs[stubIndex] = newStub;
                }
            },

            // Get stub by index
            getStub: function(stubIndex) {
                return this.stubs[stubIndex];
            },

            // Imposter metadata
            toJSON: function() {
                return {
                    protocol: this.protocol,
                    port: this.port,
                    numberOfRequests: this.numberOfRequests,
                    requests: this.requests,
                    stubs: this.stubs,
                    mq: creationRequest.mq || {},
                    queues: creationRequest.queues || [],
                    _links: {
                        self: { href: `/imposters/${this.port}` },
                        stubs: { href: `/imposters/${this.port}/stubs` }
                    }
                };
            },

            // Start the server
            start: function() {
                return server.start();
            },

            // Stop the server
            stop: function() {
                return server.stop();
            },

            // Get server status
            getStatus: function() {
                return server.getStatus();
            },

            // Add queue dynamically
            addQueue: function(queueConfig) {
                return server.addQueue(queueConfig);
            },

            // Remove queue dynamically
            removeQueue: function(queueName) {
                return server.removeQueue(queueName);
            },

            // Put test message
            putTestMessage: function(queueName, messageData, options) {
                return server.putTestMessage(queueName, messageData, options);
            },

            // Browse queue
            browseQueue: function(queueName) {
                return server.browseQueue(queueName);
            }
        };

        // Setup event handlers
        server.on('messageProcessed', (queueName, request, response) => {
            // Track the request
            imposter.addRequest({
                timestamp: new Date().toISOString(),
                queue: queueName,
                messageId: request.messageId,
                correlationId: request.correlationId,
                data: request.data,
                headers: request.headers || {},
                response: response ? {
                    messageId: response.messageId,
                    correlationId: response.correlationId,
                    data: response.data
                } : null
            });

            // Log the interaction
            logger.debug('MQ message processed', {
                queue: queueName,
                messageId: request.messageId,
                responseId: response ? response.messageId : null
            });
        });

        server.on('error', (error) => {
            logger.error('MQ Server error:', error);
        });

        server.on('started', (port) => {
            logger.info(`MQ Imposter started on port ${port}`);
        });

        server.on('stopped', () => {
            logger.info(`MQ Imposter on port ${creationRequest.port} stopped`);
        });

        return imposter;

    } catch (error) {
        logger.error('MQ Imposter validation failed:', error);
        throw error;
    }
}

/**
 * Validate MQ imposter configuration
 */
async function validate(request) {
    const config = new MQConfig();
    try {
        await config.validateConfig(request);
        return []; // No errors
    } catch (error) {
        if (error.errors && Array.isArray(error.errors)) {
            return error.errors;
        } else if (error.message) {
            return [error.message];
        } else {
            return ['MQ imposter validation failed'];
        }
    }
}

module.exports = {
    create: create,
    validate: validate
};
