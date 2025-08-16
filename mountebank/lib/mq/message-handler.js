#!/usr/bin/env node
'use strict';

/**
 * Message Handler for Mock MQ Server
 * Reads messages from DEV.QUEUE.1, processes them, and sends responses to DEV.QUEUE.RESPONSE
 */

const { mockMQServer } = require('./mock-mq-server');

class MessageHandler {
    constructor() {
        this.isRunning = false;
        this.pollingInterval = 1000; // Poll every 1 second
        this.pollingTimer = null;
        this.processors = new Map();
        this.requestQueue = 'DEV.QUEUE.1';
        this.responseQueue = 'DEV.QUEUE.RESPONSE';
        
        // Initialize default processors
        this.initializeProcessors();
    }

    /**
     * Initialize default message processors
     */
    initializeProcessors() {
        // Default echo processor
        this.addProcessor('echo', (message) => ({
            type: 'echo_response',
            originalMessage: message,
            processedAt: new Date().toISOString(),
            status: 'SUCCESS'
        }));

        // Product lookup processor
        this.addProcessor('product_lookup', (message) => {
            const productId = message.productId || message.id;
            if (!productId) {
                return {
                    type: 'product_lookup_response',
                    error: 'Product ID is required',
                    status: 'ERROR',
                    processedAt: new Date().toISOString()
                };
            }

            // Simulate product data
            const products = {
                '1001': { name: 'Laptop', price: 999.99, category: 'Electronics' },
                '1002': { name: 'Mouse', price: 29.99, category: 'Electronics' },
                '1003': { name: 'Keyboard', price: 79.99, category: 'Electronics' }
            };

            const product = products[productId];
            return {
                type: 'product_lookup_response',
                productId: productId,
                product: product || null,
                found: !!product,
                status: product ? 'SUCCESS' : 'NOT_FOUND',
                processedAt: new Date().toISOString()
            };
        });

        // Customer information processor
        this.addProcessor('customer_info', (message) => {
            const customerId = message.customerId || message.id;
            if (!customerId) {
                return {
                    type: 'customer_info_response',
                    error: 'Customer ID is required',
                    status: 'ERROR',
                    processedAt: new Date().toISOString()
                };
            }

            // Simulate customer data
            const customers = {
                'CUST001': { name: 'John Doe', email: 'john@example.com', status: 'Active' },
                'CUST002': { name: 'Jane Smith', email: 'jane@example.com', status: 'Active' },
                'CUST003': { name: 'Bob Johnson', email: 'bob@example.com', status: 'Inactive' }
            };

            const customer = customers[customerId];
            return {
                type: 'customer_info_response',
                customerId: customerId,
                customer: customer || null,
                found: !!customer,
                status: customer ? 'SUCCESS' : 'NOT_FOUND',
                processedAt: new Date().toISOString()
            };
        });

        // Order processing processor
        this.addProcessor('process_order', (message) => {
            const order = message.order;
            if (!order || !order.items || !Array.isArray(order.items)) {
                return {
                    type: 'process_order_response',
                    error: 'Invalid order format',
                    status: 'ERROR',
                    processedAt: new Date().toISOString()
                };
            }

            // Calculate total
            let total = 0;
            const processedItems = order.items.map(item => {
                const itemTotal = (item.price || 0) * (item.quantity || 1);
                total += itemTotal;
                return {
                    ...item,
                    itemTotal: itemTotal
                };
            });

            return {
                type: 'process_order_response',
                orderId: `ORD-${Date.now()}`,
                customerId: order.customerId,
                items: processedItems,
                total: total,
                tax: total * 0.08, // 8% tax
                grandTotal: total * 1.08,
                status: 'PROCESSED',
                processedAt: new Date().toISOString()
            };
        });

        // Data transformation processor
        this.addProcessor('transform_data', (message) => {
            const data = message.data;
            if (!data) {
                return {
                    type: 'transform_data_response',
                    error: 'No data to transform',
                    status: 'ERROR',
                    processedAt: new Date().toISOString()
                };
            }

            // Transform data (example: convert to uppercase, add metadata)
            const transformed = {
                originalData: data,
                transformedData: typeof data === 'string' ? data.toUpperCase() : data,
                metadata: {
                    transformationType: 'uppercase',
                    dataType: typeof data,
                    transformedAt: new Date().toISOString()
                }
            };

            return {
                type: 'transform_data_response',
                result: transformed,
                status: 'SUCCESS',
                processedAt: new Date().toISOString()
            };
        });

        // Error simulation processor
        this.addProcessor('simulate_error', (message) => {
            const errorType = message.errorType || 'generic';
            const errors = {
                'timeout': { code: 'TIMEOUT', message: 'Operation timed out' },
                'validation': { code: 'VALIDATION_ERROR', message: 'Invalid input data' },
                'system': { code: 'SYSTEM_ERROR', message: 'Internal system error' },
                'generic': { code: 'GENERIC_ERROR', message: 'An error occurred' }
            };

            const error = errors[errorType] || errors.generic;
            return {
                type: 'simulate_error_response',
                error: error,
                requestedErrorType: errorType,
                status: 'ERROR',
                processedAt: new Date().toISOString()
            };
        });
    }

    /**
     * Add a custom message processor
     */
    addProcessor(messageType, processorFunction) {
        this.processors.set(messageType, processorFunction);
        console.log(`Added processor for message type: ${messageType}`);
    }

    /**
     * Remove a message processor
     */
    removeProcessor(messageType) {
        const removed = this.processors.delete(messageType);
        if (removed) {
            console.log(`Removed processor for message type: ${messageType}`);
        }
        return removed;
    }

    /**
     * List all available processors
     */
    listProcessors() {
        return Array.from(this.processors.keys());
    }

    /**
     * Process a single message
     */
    processMessage(message) {
        try {
            // Determine message type
            const messageType = message.type || message.messageType || 'echo';
            
            // Get processor
            const processor = this.processors.get(messageType);
            if (!processor) {
                return {
                    type: 'unknown_message_response',
                    error: `No processor found for message type: ${messageType}`,
                    availableTypes: this.listProcessors(),
                    originalMessage: message,
                    status: 'ERROR',
                    processedAt: new Date().toISOString()
                };
            }

            // Process message
            const response = processor(message);
            
            // Add correlation ID if present in original message
            if (message.correlationId) {
                response.correlationId = message.correlationId;
            }

            // Add request ID for tracking
            response.requestId = message.requestId || `REQ-${Date.now()}`;
            
            return response;

        } catch (error) {
            return {
                type: 'processing_error_response',
                error: error.message,
                originalMessage: message,
                status: 'ERROR',
                processedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Poll for messages from request queue
     */
    async pollForMessages() {
        if (!this.isRunning) return;

        try {
            // Get message from request queue
            const message = mockMQServer.getMessage(this.requestQueue, { browse: false });
            
            if (message) {
                console.log(`Processing message from ${this.requestQueue}:`, message.messageId);
                
                // Parse message data
                let messageData;
                try {
                    messageData = typeof message.data === 'string' 
                        ? JSON.parse(message.data) 
                        : message.data;
                } catch (parseError) {
                    messageData = { 
                        rawData: message.data, 
                        parseError: 'Could not parse as JSON' 
                    };
                }

                // Process the message
                const response = this.processMessage(messageData);
                
                // Add original message metadata to response
                response.originalMessageId = message.messageId;
                response.originalCorrelationId = message.correlationId;
                response.responseToQueue = this.requestQueue;

                // Send response to response queue
                const responseMessage = mockMQServer.putMessage(
                    this.responseQueue, 
                    response, 
                    {
                        correlationId: message.correlationId,
                        replyToQueue: message.replyToQueue || this.requestQueue,
                        priority: message.priority || 0
                    }
                );

                console.log(`Response sent to ${this.responseQueue}:`, responseMessage.messageId);
                
                // Update statistics
                this.updateStats('processed');
            }

        } catch (error) {
            console.error('Error polling for messages:', error);
            this.updateStats('error');
        }

        // Schedule next poll if still running
        if (this.isRunning) {
            this.pollingTimer = setTimeout(() => this.pollForMessages(), this.pollingInterval);
        }
    }

    /**
     * Start the message handler
     */
    start() {
        if (this.isRunning) {
            console.log('Message handler is already running');
            return;
        }

        console.log(`Starting message handler...`);
        console.log(`Request Queue: ${this.requestQueue}`);
        console.log(`Response Queue: ${this.responseQueue}`);
        console.log(`Available Processors: ${this.listProcessors().join(', ')}`);
        
        this.isRunning = true;
        this.stats = {
            startTime: new Date().toISOString(),
            messagesProcessed: 0,
            errors: 0
        };

        // Start polling
        this.pollForMessages();
        console.log('Message handler started successfully');
    }

    /**
     * Stop the message handler
     */
    stop() {
        if (!this.isRunning) {
            console.log('Message handler is not running');
            return;
        }

        console.log('Stopping message handler...');
        this.isRunning = false;
        
        if (this.pollingTimer) {
            clearTimeout(this.pollingTimer);
            this.pollingTimer = null;
        }

        console.log('Message handler stopped');
        this.printStats();
    }

    /**
     * Update processing statistics
     */
    updateStats(type) {
        if (!this.stats) return;
        
        if (type === 'processed') {
            this.stats.messagesProcessed++;
        } else if (type === 'error') {
            this.stats.errors++;
        }
    }

    /**
     * Print processing statistics
     */
    printStats() {
        if (!this.stats) return;
        
        const runtime = new Date() - new Date(this.stats.startTime);
        const runtimeMinutes = Math.floor(runtime / 60000);
        const runtimeSeconds = Math.floor((runtime % 60000) / 1000);
        
        console.log('\n=== Message Handler Statistics ===');
        console.log(`Runtime: ${runtimeMinutes}m ${runtimeSeconds}s`);
        console.log(`Messages Processed: ${this.stats.messagesProcessed}`);
        console.log(`Errors: ${this.stats.errors}`);
        console.log(`Success Rate: ${this.stats.messagesProcessed > 0 ? ((this.stats.messagesProcessed / (this.stats.messagesProcessed + this.stats.errors)) * 100).toFixed(1) : 0}%`);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            requestQueue: this.requestQueue,
            responseQueue: this.responseQueue,
            pollingInterval: this.pollingInterval,
            availableProcessors: this.listProcessors(),
            stats: this.stats || null
        };
    }

    /**
     * Set polling interval
     */
    setPollingInterval(interval) {
        this.pollingInterval = Math.max(100, interval); // Minimum 100ms
        console.log(`Polling interval set to ${this.pollingInterval}ms`);
    }
}

// Create singleton instance
const messageHandler = new MessageHandler();

// Handle process signals for graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    messageHandler.stop();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM, shutting down gracefully...');
    messageHandler.stop();
    process.exit(0);
});

// Command line interface
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            messageHandler.start();
            break;
        case 'stop':
            messageHandler.stop();
            break;
        case 'status':
            console.log('Message Handler Status:', JSON.stringify(messageHandler.getStatus(), null, 2));
            break;
        case 'processors':
            console.log('Available Processors:', messageHandler.listProcessors());
            break;
        default:
            console.log('Usage: node message-handler.js [start|stop|status|processors]');
            console.log('  start      - Start the message handler');
            console.log('  stop       - Stop the message handler');
            console.log('  status     - Show current status');
            console.log('  processors - List available message processors');
            break;
    }
}

module.exports = { MessageHandler, messageHandler };
