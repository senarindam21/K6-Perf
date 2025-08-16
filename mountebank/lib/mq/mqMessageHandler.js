'use strict';

/**
 * MQ Message Handler for Mountebank
 * Handles message processing, transformation, and routing
 */

const jsonPath = require('../../src/models/jsonpath');

/**
 * Message Handler for processing MQ messages through Mountebank stubs
 */
class MQMessageHandler {
    constructor(imposters, logger) {
        this.imposters = imposters;
        this.logger = logger || console;
    }

    /**
     * Process an incoming MQ message through the stub system
     */
    async processMessage(message, imposterConfig) {
        try {
            const request = this.createRequestFromMessage(message);
            const response = await this.findMatchingStub(request, imposterConfig);
            
            if (response) {
                const mqResponse = this.createMessageFromResponse(response, message);
                return mqResponse;
            } else {
                // No matching stub found - return default response
                const defaultResponse = this.createDefaultResponse(message);
                return defaultResponse;
            }
            
        } catch (error) {
            this.logger.error('Error processing MQ message:', error);
            throw error;
        }
    }

    /**
     * Create a request object from an MQ message
     */
    createRequestFromMessage(message) {
        return {
            protocol: 'mq',
            method: 'MESSAGE',
            path: message.replyToQueue || '/',
            query: {},
            headers: {
                'message-id': message.messageId,
                'correlation-id': message.correlationId,
                'message-type': message.messageType.toString(),
                'priority': message.priority.toString(),
                'persistence': message.persistence.toString(),
                'format': message.format,
                'put-application-name': message.putApplicationName || '',
                'put-time': message.putTime ? message.putTime.toISOString() : '',
                'expiry': message.expiry.toString()
            },
            body: message.data,
            timestamp: message.putTime || new Date(),
            ip: '127.0.0.1', // MQ doesn't have IP concept, use localhost
            queue: message.queue || ''
        };
    }

    /**
     * Find a matching stub for the request
     */
    async findMatchingStub(request, imposterConfig) {
        try {
            if (!imposterConfig || !imposterConfig.stubs) {
                return null;
            }
            
            for (const stub of imposterConfig.stubs) {
                if (await this.matchesPredicate(request, stub.predicates)) {
                    const response = await this.processResponse(stub.responses[0], request);
                    return response;
                }
            }
            
            return null;
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Check if request matches predicates
     */
    async matchesPredicate(request, predicates) {
        if (!predicates || predicates.length === 0) {
            return true;
        }
        
        for (const predicate of predicates) {
            if (!await this.evaluatePredicate(request, predicate)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Evaluate a single predicate
     */
    async evaluatePredicate(request, predicate) {
        const deferred = Q.defer();
        
        try {
            // Handle different predicate types
            if (predicate.equals) {
                const result = await this.evaluateEquals(request, predicate.equals);
                deferred.resolve(result);
            } else if (predicate.contains) {
                const result = await this.evaluateContains(request, predicate.contains);
                deferred.resolve(result);
            } else if (predicate.matches) {
                const result = await this.evaluateMatches(request, predicate.matches);
                deferred.resolve(result);
            } else if (predicate.exists) {
                const result = await this.evaluateExists(request, predicate.exists);
                deferred.resolve(result);
            } else {
                // Unknown predicate type - default to true
                deferred.resolve(true);
            }
            
        } catch (error) {
            deferred.reject(error);
        }
        
        return deferred.promise;
    }

    /**
     * Evaluate equals predicate
     */
    async evaluateEquals(request, equals) {
        for (const field in equals) {
            const expectedValue = equals[field];
            const actualValue = this.getFieldValue(request, field);
            
            if (actualValue !== expectedValue) {
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluate contains predicate
     */
    async evaluateContains(request, contains) {
        for (const field in contains) {
            const expectedValue = contains[field];
            const actualValue = this.getFieldValue(request, field);
            
            if (!actualValue || actualValue.toString().indexOf(expectedValue) === -1) {
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluate matches (regex) predicate
     */
    async evaluateMatches(request, matches) {
        for (const field in matches) {
            const pattern = new RegExp(matches[field]);
            const actualValue = this.getFieldValue(request, field);
            
            if (!actualValue || !pattern.test(actualValue.toString())) {
                return false;
            }
        }
        return true;
    }

    /**
     * Evaluate exists predicate
     */
    async evaluateExists(request, exists) {
        for (const field in exists) {
            const shouldExist = exists[field];
            const actualValue = this.getFieldValue(request, field);
            const fieldExists = actualValue !== null && actualValue !== undefined;
            
            if (shouldExist !== fieldExists) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get field value from request using dot notation
     */
    getFieldValue(request, field) {
        const parts = field.split('.');
        let value = request;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return null;
            }
        }
        
        return value;
    }

    /**
     * Process response with behaviors
     */
    async processResponse(response, request) {
        const deferred = Q.defer();
        
        try {
            let processedResponse = { ...response };
            
            // Apply behaviors if present
            if (response.behaviors) {
                for (const behavior of response.behaviors) {
                    processedResponse = await this.applyBehavior(processedResponse, behavior, request);
                }
            }
            
            deferred.resolve(processedResponse);
            
        } catch (error) {
            deferred.reject(error);
        }
        
        return deferred.promise;
    }

    /**
     * Apply a behavior to the response
     */
    async applyBehavior(response, behavior, request) {
        if (behavior.wait) {
            // Add delay
            await new Promise(resolve => setTimeout(resolve, behavior.wait));
        }
        
        if (behavior.copy) {
            // Copy values from request to response
            for (const copy of behavior.copy) {
                const sourceValue = this.getFieldValue(request, copy.from);
                if (sourceValue !== null) {
                    this.setFieldValue(response, copy.into, sourceValue);
                }
            }
        }
        
        if (behavior.lookup) {
            // Lookup and replace values
            // Implementation would depend on specific requirements
        }
        
        return response;
    }

    /**
     * Set field value in response using dot notation
     */
    setFieldValue(response, field, value) {
        const parts = field.split('.');
        let target = response;
        
        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!target[part] || typeof target[part] !== 'object') {
                target[part] = {};
            }
            target = target[part];
        }
        
        target[parts[parts.length - 1]] = value;
    }

    /**
     * Create an MQ message from a response
     */
    createMessageFromResponse(response, originalMessage) {
        const messageData = response.body || response.data || '';
        
        return {
            messageId: this.generateMessageId(),
            correlationId: originalMessage.messageId, // Use original message ID as correlation ID
            replyToQueue: '', // Clear reply-to queue for response
            messageType: 2, // MQMT_REPLY
            persistence: originalMessage.persistence || 1,
            priority: originalMessage.priority || 0,
            expiry: response.expiry || -1,
            format: response.format || 'MQSTR',
            data: messageData,
            putTime: new Date(),
            putApplicationName: 'Mountebank-MQ-Server',
            responseHeaders: response.headers || {}
        };
    }

    /**
     * Create a default response when no stub matches
     */
    createDefaultResponse(originalMessage) {
        return {
            messageId: this.generateMessageId(),
            correlationId: originalMessage.messageId,
            replyToQueue: '',
            messageType: 2, // MQMT_REPLY
            persistence: originalMessage.persistence || 1,
            priority: originalMessage.priority || 0,
            expiry: -1,
            format: 'MQSTR',
            data: JSON.stringify({
                status: 'error',
                message: 'No matching stub found',
                originalMessageId: originalMessage.messageId
            }),
            putTime: new Date(),
            putApplicationName: 'Mountebank-MQ-Server'
        };
    }

    /**
     * Generate a unique message ID
     */
    generateMessageId() {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `AMQ${timestamp}${random}`;
    }
}

module.exports = { MQMessageHandler };
