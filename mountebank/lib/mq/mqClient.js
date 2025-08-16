'use strict';

/**
 * Native IBM MQ Client for Mountebank
 * Provides direct integration with IBM MQ for protocol-level message handling
 * Falls back to simulation mode when IBM MQ Server is not available
 */

const EventEmitter = require('events');

// Try to require IBM MQ client, fall back to simulation if not available
let mq;
let mqAvailable = false;

try {
    mq = require('ibmmq');
    mqAvailable = true;
    console.log('IBM MQ client library loaded successfully');
} catch (error) {
    console.warn('IBM MQ client library not available, using simulation mode');
    mqAvailable = false;
}

/**
 * MQ Client for direct IBM MQ integration
 * This is a wrapper around the native IBM MQ client libraries
 */
class MQClient extends EventEmitter {
    constructor(config) {
        super();
        this.config = config || {};
        this.connection = null;
        this.channels = new Map();
        this.isConnected = false;
        
        // Default configuration
        this.queueManager = config.queueManager || 'QM1';
        this.connectionName = config.connectionName || 'localhost(1414)';
        this.channel = config.channel || 'DEV.APP.SVRCONN';
        this.userId = config.userId || '';
        this.password = config.password || '';
    }

    /**
     * Connect to IBM MQ
     */
    async connect() {
        try {
            if (!mqAvailable) {
                // Simulation mode
                console.log('⚠️  Running in simulation mode - IBM MQ Server not available');
                return this.connectSimulation();
            }

            // Try to connect to real IBM MQ first
            try {
                return await this.connectReal();
            } catch (error) {
                console.warn(`Failed to connect to real IBM MQ: ${error.message} (MQRC: ${error.mqrc || 'N/A'})`);
                
                // Common connection errors that indicate MQ server is not available
                if (error.mqrc === 2538 || error.mqrc === 2059 || error.mqrc === 2058) {
                    console.log('⚠️  Falling back to simulation mode');
                    console.log('💡 To use real IBM MQ, ensure:');
                    console.log('   1. IBM MQ Server is installed and running');
                    console.log('   2. Queue Manager QM1 exists and is started');
                    console.log('   3. Channel DEV.APP.SVRCONN is defined');
                    console.log('   4. MQ Listener is running on port 1414');
                    return this.connectSimulation();
                } else {
                    throw error;
                }
            }
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Connect to real IBM MQ
     */
    async connectReal() {
        // Set up environment for client connection
        process.env.MQSERVER = `${this.channel}/TCP/${this.connectionName}`;
        
        // Try synchronous connection first for immediate error feedback
        const hConn = mq.ConnSync(this.queueManager, mq.MQC.MQCO_NONE);
        
        this.connection = {
            hConn: hConn,
            queueManager: this.queueManager,
            connectionName: this.connectionName,
            channel: this.channel,
            connected: true,
            connectionTime: new Date(),
            mode: 'real'
        };
        
        this.isConnected = true;
        this.emit('connected', this.connection);
        
        console.log(`✓ MQ Client connected to real Queue Manager: ${this.queueManager}`);
        return this.connection;
    }

    /**
     * Connect in simulation mode
     */
    async connectSimulation() {
        this.connection = {
            queueManager: this.queueManager,
            connectionName: this.connectionName,
            channel: this.channel,
            connected: true,
            connectionTime: new Date(),
            mode: 'simulation'
        };
        
        this.isConnected = true;
        this.emit('connected', this.connection);
        
        console.log(`📝 MQ Client connected in simulation mode to: ${this.queueManager}`);
        return this.connection;
    }

    /**
     * Disconnect from IBM MQ
     */
    async disconnect() {
        try {
            if (this.connection) {
                // Close all channels first
                for (const [queueName, channel] of this.channels) {
                    await this.closeQueue(queueName);
                }
                
                if (this.connection.mode === 'real' && this.connection.hConn && mqAvailable) {
                    // Disconnect from real IBM MQ
                    mq.DiscSync(this.connection.hConn);
                }
                
                this.connection = null;
                this.isConnected = false;
                this.emit('disconnected');
                
                console.log('MQ Client disconnected');
            }
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Open a queue for operations
     */
    async openQueue(queueName, options = {}) {
        try {
            if (!this.isConnected || !this.connection) {
                throw new Error('MQ Client not connected');
            }
            
            if (this.connection.mode === 'real' && mqAvailable) {
                return await this.openQueueReal(queueName, options);
            } else {
                return this.openQueueSimulation(queueName, options);
            }
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Open a queue for operations - Real MQ
     */
    async openQueueReal(queueName, options = {}) {
        // Set up queue open options
        let openOptions = mq.MQC.MQOO_INQUIRE;
        
        if (options.input !== false) {
            openOptions |= mq.MQC.MQOO_INPUT_AS_Q_DEF;
        }
        if (options.output !== false) {
            openOptions |= mq.MQC.MQOO_OUTPUT;
        }
        if (options.browse !== false) {
            openOptions |= mq.MQC.MQOO_BROWSE;
        }
        if (options.set !== false) {
            openOptions |= mq.MQC.MQOO_SET;
        }
        
        // Create Object Descriptor
        const od = new mq.MQOD();
        od.ObjectName = queueName;
        od.ObjectType = mq.MQC.MQOT_Q;
        
        // Open the queue synchronously
        const hObj = mq.OpenSync(this.connection.hConn, od, openOptions);
        
        const channel = {
            queueName: queueName,
            hObj: hObj,
            options: {
                input: options.input !== false,
                output: options.output !== false,
                inquire: options.inquire !== false,
                set: options.set !== false,
                browse: options.browse !== false
            },
            opened: true,
            openTime: new Date(),
            mode: 'real'
        };
        
        this.channels.set(queueName, channel);
        this.emit('queueOpened', queueName, channel);
        
        console.log(`✓ Queue opened (real): ${queueName}`);
        return channel;
    }

    /**
     * Open a queue for operations - Simulation
     */
    openQueueSimulation(queueName, options = {}) {
        const channel = {
            queueName: queueName,
            options: {
                input: options.input !== false,
                output: options.output !== false,
                inquire: options.inquire !== false,
                set: options.set !== false,
                browse: options.browse !== false
            },
            opened: true,
            openTime: new Date(),
            mode: 'simulation'
        };
        
        this.channels.set(queueName, channel);
        this.emit('queueOpened', queueName, channel);
        
        console.log(`📝 Queue opened (simulation): ${queueName}`);
        return channel;
    }

    /**
     * Close a queue
     */
    async closeQueue(queueName) {
        try {
            const channel = this.channels.get(queueName);
            if (channel) {
                if (channel.mode === 'real' && channel.hObj && mqAvailable) {
                    // Close real MQ queue
                    mq.CloseSync(this.connection.hConn, channel.hObj, mq.MQC.MQCO_NONE);
                }
                
                channel.opened = false;
                this.channels.delete(queueName);
                this.emit('queueClosed', queueName);
                console.log(`Queue closed: ${queueName}`);
            }
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Put a message to a queue
     */
    async putMessage(queueName, message, options = {}) {
        try {
            if (!this.isConnected || !this.connection) {
                throw new Error('MQ Client not connected');
            }
            
            const channel = this.channels.get(queueName);
            if (!channel || !channel.opened) {
                throw new Error(`Queue not opened: ${queueName}`);
            }
            
            if (this.connection.mode === 'real' && mqAvailable) {
                return await this.putMessageReal(queueName, message, options, channel);
            } else {
                return this.putMessageSimulation(queueName, message, options);
            }
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Put a message to a queue - Real MQ
     */
    async putMessageReal(queueName, message, options, channel) {
        // Create the message
        const msg = new mq.MQMD();
        msg.MessageId = null; // Let MQ generate it
        msg.CorrelId = options.correlationId ? Buffer.from(options.correlationId, 'hex') : null;
        msg.ReplyToQ = options.replyToQueue || '';
        msg.MessageType = options.messageType || mq.MQC.MQMT_REQUEST;
        msg.Persistence = options.persistence || mq.MQC.MQPER_PERSISTENT;
        msg.Priority = options.priority || 0;
        msg.Expiry = options.expiry || mq.MQC.MQEI_UNLIMITED;
        msg.Format = options.format || mq.MQC.MQFMT_STRING;
        
        // Set message data
        const buffer = Buffer.from(message, 'utf8');
        
        // Put Message Options
        const pmo = new mq.MQPMO();
        pmo.Options = mq.MQC.MQPMO_NEW_MSG_ID | mq.MQC.MQPMO_NEW_CORREL_ID;
        
        // Put the message synchronously
        mq.PutSync(this.connection.hConn, channel.hObj, msg, buffer, pmo);
        
        const mqMessage = {
            messageId: msg.MessageId ? msg.MessageId.toString('hex') : this.generateMessageId(),
            correlationId: msg.CorrelId ? msg.CorrelId.toString('hex') : options.correlationId || '',
            replyToQueue: options.replyToQueue || '',
            messageType: options.messageType || mq.MQC.MQMT_REQUEST,
            persistence: options.persistence || mq.MQC.MQPER_PERSISTENT,
            priority: options.priority || 0,
            expiry: options.expiry || mq.MQC.MQEI_UNLIMITED,
            format: options.format || mq.MQC.MQFMT_STRING,
            data: message,
            putTime: new Date(),
            putApplicationName: 'Mountebank-MQ-Server',
            mode: 'real'
        };
        
        this.emit('messagePut', queueName, mqMessage);
        console.log(`✓ Message put to queue ${queueName} (real): ${mqMessage.messageId}`);
        
        return mqMessage;
    }

    /**
     * Put a message to a queue - Simulation
     */
    putMessageSimulation(queueName, message, options) {
        const mqMessage = {
            messageId: this.generateMessageId(),
            correlationId: options.correlationId || '',
            replyToQueue: options.replyToQueue || '',
            messageType: options.messageType || 8, // MQMT_REQUEST
            persistence: options.persistence || 1, // MQPER_PERSISTENT
            priority: options.priority || 0,
            expiry: options.expiry || -1,
            format: options.format || 'MQSTR',
            data: message,
            putTime: new Date(),
            putApplicationName: 'Mountebank-MQ-Server',
            mode: 'simulation'
        };
        
        this.emit('messagePut', queueName, mqMessage);
        console.log(`📝 Message put to queue ${queueName} (simulation): ${mqMessage.messageId}`);
        
        return mqMessage;
    }

    /**
     * Get a message from a queue
     */
    async getMessage(queueName, options = {}) {
        try {
            if (!this.isConnected || !this.connection) {
                throw new Error('MQ Client not connected');
            }
            
            const channel = this.channels.get(queueName);
            if (!channel || !channel.opened) {
                throw new Error(`Queue not opened: ${queueName}`);
            }
            
            if (this.connection.mode === 'real' && mqAvailable) {
                return await this.getMessageReal(queueName, options, channel);
            } else {
                return this.getMessageSimulation(queueName, options);
            }
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Get a message from a queue - Real MQ
     */
    async getMessageReal(queueName, options, channel) {
        // Create Get Message Options
        const gmo = new mq.MQGMO();
        gmo.Options = mq.MQC.MQGMO_NO_WAIT | mq.MQC.MQGMO_FAIL_IF_QUIESCING;
        gmo.WaitInterval = options.waitInterval || 1000;
        
        if (options.correlationId) {
            gmo.Options |= mq.MQC.MQGMO_MATCH_CORREL_ID;
            gmo.MatchOptions = mq.MQC.MQMO_MATCH_CORREL_ID;
        }
        
        // Create message descriptor
        const md = new mq.MQMD();
        if (options.correlationId) {
            md.CorrelId = Buffer.from(options.correlationId, 'hex');
        }
        
        try {
            // Get the message synchronously
            const result = mq.GetSync(this.connection.hConn, channel.hObj, md, gmo);
            
            if (result && result.buf) {
                const message = {
                    messageId: result.md.MessageId.toString('hex'),
                    correlationId: result.md.CorrelId.toString('hex'),
                    replyToQueue: result.md.ReplyToQ.trim(),
                    messageType: result.md.MessageType,
                    persistence: result.md.Persistence,
                    priority: result.md.Priority,
                    expiry: result.md.Expiry,
                    format: result.md.Format.trim(),
                    data: result.buf ? result.buf.toString('utf8') : '',
                    getTime: new Date(),
                    mode: 'real'
                };
                
                this.emit('messageGet', queueName, message);
                return message;
            } else {
                this.emit('messageGet', queueName, null);
                return null;
            }
            
        } catch (error) {
            if (error.mqrc === mq.MQC.MQRC_NO_MSG_AVAILABLE) {
                this.emit('messageGet', queueName, null);
                return null;
            } else {
                throw error;
            }
        }
    }

    /**
     * Get a message from a queue - Simulation
     */
    getMessageSimulation(queueName, options) {
        // Simulate no message available for now
        // In a real simulation, you might maintain a queue of messages
        const waitInterval = options.waitInterval || 1000;
        
        return new Promise(resolve => {
            setTimeout(() => {
                this.emit('messageGet', queueName, null);
                resolve(null);
            }, waitInterval);
        });
    }

    /**
     * Browse messages in a queue without removing them
     */
    async browseMessages(queueName, options = {}) {
        try {
            if (!this.isConnected || !this.connection) {
                throw new Error('MQ Client not connected');
            }
            
            const channel = this.channels.get(queueName);
            if (!channel || !channel.opened) {
                throw new Error(`Queue not opened: ${queueName}`);
            }
            
            if (this.connection.mode === 'real' && mqAvailable) {
                return await this.browseMessagesReal(queueName, options, channel);
            } else {
                return this.browseMessagesSimulation(queueName, options);
            }
            
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * Browse messages in a queue - Real MQ
     */
    async browseMessagesReal(queueName, options, channel) {
        const messages = [];
        const maxMessages = options.maxMessages || 10;
        
        // Create Get Message Options for browsing
        let gmo = new mq.MQGMO();
        gmo.Options = mq.MQC.MQGMO_NO_WAIT | mq.MQC.MQGMO_BROWSE_FIRST;
        
        for (let i = 0; i < maxMessages; i++) {
            try {
                const md = new mq.MQMD();
                
                const result = mq.GetSync(this.connection.hConn, channel.hObj, md, gmo);
                
                if (result && result.buf) {
                    const message = {
                        messageId: result.md.MessageId.toString('hex'),
                        correlationId: result.md.CorrelId.toString('hex'),
                        replyToQueue: result.md.ReplyToQ.trim(),
                        messageType: result.md.MessageType,
                        persistence: result.md.Persistence,
                        priority: result.md.Priority,
                        expiry: result.md.Expiry,
                        format: result.md.Format.trim(),
                        data: result.buf ? result.buf.toString('utf8') : '',
                        mode: 'real'
                    };
                    
                    messages.push(message);
                    
                    // Change to browse next after first message
                    gmo.Options = mq.MQC.MQGMO_NO_WAIT | mq.MQC.MQGMO_BROWSE_NEXT;
                } else {
                    break; // No more messages
                }
                
            } catch (error) {
                if (error.mqrc === mq.MQC.MQRC_NO_MSG_AVAILABLE) {
                    break; // No more messages
                } else {
                    throw error;
                }
            }
        }
        
        this.emit('messagesBrowsed', queueName, messages);
        return messages;
    }

    /**
     * Browse messages in a queue - Simulation
     */
    browseMessagesSimulation(queueName, options) {
        // Simulate empty queue for now
        const messages = [];
        this.emit('messagesBrowsed', queueName, messages);
        return messages;
    }

    /**
     * Generate a unique message ID
     */
    generateMessageId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `AMQ${timestamp}${random}`;
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            connected: this.isConnected,
            queueManager: this.queueManager,
            connectionName: this.connectionName,
            channel: this.channel,
            openQueues: Array.from(this.channels.keys()),
            connectionTime: this.connection ? this.connection.connectionTime : null,
            mode: this.connection ? this.connection.mode : 'disconnected',
            mqAvailable: mqAvailable
        };
    }
}

module.exports = { MQClient };
