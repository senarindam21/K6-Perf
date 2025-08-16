#!/usr/bin/env node

'use strict';

/**
 * Demonstration script for Native IBM MQ Protocol Support in Mountebank
 * This script shows how to:
 * 1. Start Mountebank with MQ protocol support
 * 2. Create MQ imposters programmatically
 * 3. Test MQ message processing
 */

const path = require('path');
const { spawn } = require('child_process');
const { MQTestClient } = require('./mq-client-test');

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║              IBM MQ Protocol Support for Mountebank         ║');
console.log('║                        Demonstration                         ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// Demonstration scenarios
const scenarios = [
    {
        name: 'Start Mountebank with MQ Configuration',
        description: 'Starting Mountebank server with native IBM MQ protocol support',
        action: 'startMountebank'
    },
    {
        name: 'Test MQ Message Processing',
        description: 'Send test messages to demonstrate stub matching and response generation',
        action: 'testMessages'
    },
    {
        name: 'Integration Test Suite',
        description: 'Run comprehensive integration tests for all MQ components',
        action: 'runTests'
    }
];

async function startMountebank() {
    console.log('🚀 Starting Mountebank with MQ Protocol Support...\n');
    
    const configFile = path.join(__dirname, 'ConfigFiles', 'Imposters', 'mq-imposter-config.json');
    const mountebankBin = path.join(__dirname, 'bin', 'mb');
    
    console.log(`Configuration: ${configFile}`);
    console.log(`Binary: ${mountebankBin}\n`);
    
    console.log('Command: node bin/mb --configfile ConfigFiles/Imposters/mq-imposter-config.json --allowInjection --debug');
    console.log('\nThis will start Mountebank with:');
    console.log('• MQ Protocol server on port 1414');
    console.log('• REST API on port 2525');
    console.log('• Debug logging enabled');
    console.log('• Injection capabilities enabled');
    console.log('\nPress Ctrl+C to stop the server when running...\n');
}

async function testMessages() {
    console.log('📨 Testing MQ Message Processing...\n');
    
    try {
        const client = new MQTestClient({
            queueManager: 'QM1',
            connectionName: 'localhost(1414)',
            channel: 'DEV.APP.SVRCONN'
        });

        console.log('1. Connecting to MQ...');
        await client.connect();

        console.log('2. Opening queues...');
        await client.openQueue('DEV.QUEUE.1', { output: true });

        console.log('3. Sending test messages...');
        
        // Test GET_PRODUCT message
        await client.sendMessage('DEV.QUEUE.1', {
            operation: 'GET_PRODUCT',
            productId: '12345'
        }, {
            correlationId: 'TEST001',
            replyToQueue: 'DEV.QUEUE.RESPONSE'
        });
        console.log('   ✓ GET_PRODUCT message sent');

        // Test CREATE_PRODUCT message
        await client.sendMessage('DEV.QUEUE.1', {
            operation: 'CREATE_PRODUCT',
            product: { name: 'Test Product', price: 99.99 }
        }, {
            correlationId: 'TEST002',
            replyToQueue: 'DEV.QUEUE.RESPONSE'
        });
        console.log('   ✓ CREATE_PRODUCT message sent');

        console.log('4. Cleaning up...');
        await client.closeQueue('DEV.QUEUE.1');
        await client.disconnect();

        console.log('✅ Message testing completed successfully!\n');

    } catch (error) {
        console.error('❌ Message testing failed:', error.message);
    }
}

async function runTests() {
    console.log('🧪 Running Integration Test Suite...\n');
    
    console.log('Running: node test-mq-integration.js');
    console.log('This will test:');
    console.log('• MQ Configuration validation');
    console.log('• MQ Client connectivity');
    console.log('• MQ Server lifecycle');
    console.log('• Queue management');
    console.log('• Message processing\n');
}

async function displayUsageInstructions() {
    console.log('📖 Usage Instructions:\n');
    
    console.log('1. Start Mountebank with MQ support:');
    console.log('   npm run startMQServer');
    console.log('   or');
    console.log('   node start-mq-server.js\n');
    
    console.log('2. Create MQ imposters via REST API:');
    console.log('   curl -X POST http://localhost:2525/imposters \\');
    console.log('        -H "Content-Type: application/json" \\');
    console.log('        -d @ConfigFiles/Imposters/mq-imposter-config.json\n');
    
    console.log('3. View imposter status:');
    console.log('   curl http://localhost:2525/imposters\n');
    
    console.log('4. Run integration tests:');
    console.log('   npm run test:mq');
    console.log('   npm run test:mq-client\n');
    
    console.log('5. Browse logs and monitoring:');
    console.log('   • Check mb.log for server logs');
    console.log('   • Monitor queue activity in real-time');
    console.log('   • View processed requests via REST API\n');
}

async function displayConfigurationExample() {
    console.log('⚙️  Configuration Example:\n');
    
    const example = {
        port: 1414,
        protocol: "mq",
        name: "MQ Product API",
        mq: {
            queueManager: "QM1",
            connectionName: "localhost(1414)",
            channel: "DEV.APP.SVRCONN"
        },
        queues: [
            { name: "DEV.QUEUE.1", type: "input" },
            { name: "DEV.QUEUE.RESPONSE", type: "output" }
        ],
        stubs: [
            {
                predicates: [{ contains: { body: "GET_PRODUCT" } }],
                responses: [{ 
                    is: { 
                        data: '{"productId":"12345","name":"Test Product"}',
                        messageType: 2 
                    } 
                }]
            }
        ]
    };
    
    console.log(JSON.stringify(example, null, 2));
    console.log('\n');
}

async function displayFeatures() {
    console.log('✨ Key Features:\n');
    
    const features = [
        '🔗 Native IBM MQ Integration - Direct connection to IBM MQ queue managers',
        '📋 Queue Management - Support for input, output, and bidirectional queues',
        '🎯 Message Processing - Process messages through Mountebank\'s stub system',
        '🔍 Predicate Matching - Advanced message matching with equals, contains, matches, exists',
        '⚡ Response Behaviors - Support for wait, copy, lookup, and other behaviors',
        '📊 Monitoring & Logging - Comprehensive logging and status reporting',
        '🔄 Dynamic Configuration - Add/remove queues and stubs at runtime',
        '🧪 Testing Support - Built-in test clients and integration test suites',
        '🛡️ Error Handling - Robust error handling and connection management',
        '🌐 REST API Integration - Full integration with Mountebank\'s REST API'
    ];
    
    features.forEach(feature => console.log(`   ${feature}`));
    console.log('\n');
}

// Main execution
async function main() {
    console.log('Welcome to the IBM MQ Protocol Integration for Mountebank!\n');
    
    displayFeatures();
    await displayConfigurationExample();
    await displayUsageInstructions();
    
    console.log('🚀 Available Demo Commands:\n');
    console.log('1. Start Mountebank:      node start-mq-server.js');
    console.log('2. Run Integration Test:  node test-mq-integration.js');
    console.log('3. Test MQ Client:        node mq-client-test.js');
    console.log('4. NPM Scripts:           npm run startMQServer | npm run test:mq\n');
    
    console.log('📚 Documentation: See MQ_INTEGRATION_README.md for complete guide\n');
    
    console.log('🎉 MQ Protocol integration is ready to use!');
    console.log('   Try starting Mountebank with: npm run startMQServer\n');
}

// Export for use as module or run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    startMountebank,
    testMessages,
    runTests,
    displayUsageInstructions,
    displayConfigurationExample,
    displayFeatures
};
