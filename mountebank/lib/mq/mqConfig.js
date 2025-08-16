'use strict';

/**
 * MQ Protocol Configuration for Mountebank
 * Handles MQ-specific configuration and validation
 */

/**
 * MQ Configuration Manager
 */
class MQConfig {
    constructor() {
        this.defaultConfig = {
            queueManager: 'QM1',
            connectionName: 'localhost(1414)',
            channel: 'DEV.APP.SVRCONN',
            userId: '',
            password: '',
            timeout: 30000,
            reconnectDelay: 5000,
            maxReconnectAttempts: 5,
            messageFormat: 'MQSTR',
            persistence: 1, // MQPER_PERSISTENT
            priority: 0,
            expiry: -1
        };
    }

    /**
     * Validate MQ imposter configuration
     */
    async validateConfig(imposterConfig) {
        const errors = [];

        try {
            if (!imposterConfig.port) {
                errors.push("MQ imposter requires a 'port' field");
            }

            if (!imposterConfig.protocol || imposterConfig.protocol !== 'mq') {
                errors.push("MQ imposter requires protocol to be 'mq'");
            }

            // Validate MQ-specific configuration
            if (imposterConfig.mq) {
                if (imposterConfig.mq.queueManager && typeof imposterConfig.mq.queueManager !== 'string') {
                    errors.push("MQ queueManager must be a string");
                }

                if (imposterConfig.mq.connectionName && typeof imposterConfig.mq.connectionName !== 'string') {
                    errors.push("MQ connectionName must be a string");
                }

                if (imposterConfig.mq.channel && typeof imposterConfig.mq.channel !== 'string') {
                    errors.push("MQ channel must be a string");
                }

                if (imposterConfig.mq.timeout && (typeof imposterConfig.mq.timeout !== 'number' || imposterConfig.mq.timeout < 0)) {
                    errors.push("MQ timeout must be a non-negative number");
                }
            }

            // Validate queues configuration
            if (imposterConfig.queues) {
                if (!Array.isArray(imposterConfig.queues)) {
                    errors.push("MQ queues must be an array");
                } else {
                    imposterConfig.queues.forEach((queue, index) => {
                        if (!queue.name || typeof queue.name !== 'string') {
                            errors.push(`Queue at index ${index} must have a name field of type string`);
                        }
                        if (queue.type && !['input', 'output', 'both'].includes(queue.type)) {
                            errors.push(`Queue at index ${index} type must be 'input', 'output', or 'both'`);
                        }
                    });
                }
            }

            // Validate stubs
            if (imposterConfig.stubs) {
                if (!Array.isArray(imposterConfig.stubs)) {
                    errors.push("MQ stubs must be an array");
                } else {
                    imposterConfig.stubs.forEach((stub, stubIndex) => {
                        this.validateStub(stub, stubIndex, errors);
                    });
                }
            }

            if (errors.length > 0) {
                throw {
                    code: 'bad request',
                    message: 'MQ imposter validation failed',
                    errors: errors
                };
            }

        } catch (error) {
            throw error;
        }
    }

    /**
     * Validate a single stub
     */
    validateStub(stub, stubIndex, errors) {
        if (!stub.responses || !Array.isArray(stub.responses) || stub.responses.length === 0) {
            errors.push(`Stub at index ${stubIndex} must have at least one response`);
        }

        // Validate predicates
        if (stub.predicates) {
            if (!Array.isArray(stub.predicates)) {
                errors.push(`Stub at index ${stubIndex} predicates must be an array`);
            } else {
                stub.predicates.forEach((predicate, predicateIndex) => {
                    this.validatePredicate(predicate, stubIndex, predicateIndex, errors);
                });
            }
        }

        // Validate responses
        if (stub.responses) {
            stub.responses.forEach((response, responseIndex) => {
                this.validateResponse(response, stubIndex, responseIndex, errors);
            });
        }
    }

    /**
     * Validate a predicate
     */
    validatePredicate(predicate, stubIndex, predicateIndex, errors) {
        const validPredicateTypes = ['equals', 'contains', 'matches', 'exists', 'not', 'or', 'and'];
        const predicateTypes = Object.keys(predicate);
        
        if (predicateTypes.length === 0) {
            errors.push(`Stub ${stubIndex} predicate ${predicateIndex} must have at least one predicate type`);
        }

        predicateTypes.forEach(type => {
            if (!validPredicateTypes.includes(type)) {
                errors.push(`Stub ${stubIndex} predicate ${predicateIndex} contains invalid predicate type: ${type}`);
            }
        });
    }

    /**
     * Validate a response
     */
    validateResponse(response, stubIndex, responseIndex, errors) {
        if (!response.is && !response.proxy && !response.inject) {
            errors.push(`Stub ${stubIndex} response ${responseIndex} must have 'is', 'proxy', or 'inject' field`);
        }

        if (response.is) {
            // Validate 'is' response
            if (response.is.body === undefined && response.is.data === undefined) {
                errors.push(`Stub ${stubIndex} response ${responseIndex} 'is' response should have 'body' or 'data' field`);
            }
        }

        // Validate behaviors
        if (response.behaviors) {
            if (!Array.isArray(response.behaviors)) {
                errors.push(`Stub ${stubIndex} response ${responseIndex} behaviors must be an array`);
            } else {
                response.behaviors.forEach((behavior, behaviorIndex) => {
                    this.validateBehavior(behavior, stubIndex, responseIndex, behaviorIndex, errors);
                });
            }
        }
    }

    /**
     * Validate a behavior
     */
    validateBehavior(behavior, stubIndex, responseIndex, behaviorIndex, errors) {
        const validBehaviorTypes = ['wait', 'copy', 'lookup', 'decorate', 'shellTransform'];
        const behaviorTypes = Object.keys(behavior);
        
        if (behaviorTypes.length === 0) {
            errors.push(`Stub ${stubIndex} response ${responseIndex} behavior ${behaviorIndex} must have at least one behavior type`);
        }

        behaviorTypes.forEach(type => {
            if (!validBehaviorTypes.includes(type)) {
                errors.push(`Stub ${stubIndex} response ${responseIndex} behavior ${behaviorIndex} contains invalid behavior type: ${type}`);
            }
        });

        if (behavior.wait && (typeof behavior.wait !== 'number' || behavior.wait < 0)) {
            errors.push(`Stub ${stubIndex} response ${responseIndex} behavior ${behaviorIndex} 'wait' must be a non-negative number`);
        }
    }

    /**
     * Merge configuration with defaults
     */
    mergeWithDefaults(config) {
        return {
            ...this.defaultConfig,
            ...config
        };
    }

    /**
     * Get default MQ imposter configuration
     */
    getDefaultImposterConfig() {
        return {
            protocol: 'mq',
            port: 1414,
            mq: { ...this.defaultConfig },
            queues: [
                {
                    name: 'DEV.QUEUE.1',
                    type: 'both'
                }
            ],
            stubs: []
        };
    }

    /**
     * Get supported MQ message types
     */
    getMessageTypes() {
        return {
            MQMT_DATAGRAM: 1,
            MQMT_REPLY: 2,
            MQMT_REQUEST: 8,
            MQMT_REPORT: 4
        };
    }

    /**
     * Get supported MQ persistence options
     */
    getPersistenceOptions() {
        return {
            MQPER_PERSISTENCE_AS_Q_DEF: 0,
            MQPER_NOT_PERSISTENT: 1,
            MQPER_PERSISTENT: 2
        };
    }

    /**
     * Get supported MQ formats
     */
    getFormats() {
        return {
            MQFMT_NONE: 'MQFMT_NONE',
            MQFMT_STRING: 'MQSTR',
            MQFMT_RF_HEADER: 'MQHRF',
            MQFMT_RF_HEADER_2: 'MQHRF2',
            MQFMT_DEAD_LETTER_HEADER: 'MQDLH',
            MQFMT_XMIT_Q_HEADER: 'MQXQH',
            MQFMT_PCF: 'MQADMIN'
        };
    }
}

module.exports = { MQConfig };
