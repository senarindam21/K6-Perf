# Mock IBM MQ Server - Quick Start Guide

This guide shows how to use Mountebank's Mock IBM MQ Server for development and testing without requiring a real IBM MQ installation.

## 🚀 Quick Start

### 1. Start the Mock MQ Server

```bash
# Option 1: Using npm script (recommended)
npm run startMockMQ

# Option 2: Direct command
node bin/mb --configfile ConfigFiles/Imposters/mock-mq-server.ejs --allowInjection
```

The mock server will start on port **3002** and provide a complete IBM MQ simulation.

### 2. Run Tests

```bash
# Test the mock MQ server functionality
npm run test:mock-mq
```

### 3. Basic Usage Examples

#### Send a Message
```bash
curl -X POST http://localhost:3002/mq/send \
  -H "Content-Type: application/json" \
  -d '{
    "queueName": "TEST.QUEUE",
    "message": {
      "text": "Hello Mock MQ!",
      "timestamp": "2024-01-20T10:30:00Z"
    }
  }'
```

#### Receive a Message
```bash
curl http://localhost:3002/mq/receive?queueName=TEST.QUEUE
```

#### Check Queue Depth
```bash
curl http://localhost:3002/mq/queue/depth?queueName=TEST.QUEUE
```

#### Health Check
```bash
curl http://localhost:3002/mq/health
```

## 📋 Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/mq/connect` | Connect to mock queue manager |
| POST | `/mq/disconnect` | Disconnect from queue manager |
| POST | `/mq/send` | Send message to queue |
| GET | `/mq/receive` | Receive message from queue |
| POST | `/mq/browse` | Browse messages without removing |
| GET | `/mq/queue/depth` | Get current queue depth |
| POST | `/mq/queue/create` | Create a new queue |
| DELETE | `/mq/queue/delete` | Delete a queue |
| GET | `/mq/queue/list` | List all queues |
| GET | `/mq/health` | Server health status |

## 🎯 Features

✅ **Complete MQ Simulation**: All major IBM MQ operations  
✅ **No Installation Required**: No need for real IBM MQ  
✅ **Real-time Queue Management**: Dynamic queue creation/deletion  
✅ **Message Persistence**: In-memory message storage  
✅ **Queue Depth Monitoring**: Track message counts  
✅ **Error Simulation**: Realistic MQ error scenarios  
✅ **Correlation ID Support**: Message correlation  
✅ **Connection Management**: Mock connect/disconnect  
✅ **HTTP REST API**: Easy integration with any client  

## 🔧 Configuration

The mock server configuration is in `ConfigFiles/Imposters/mock-mq-server.ejs`:

- **Port**: 3002 (configurable)
- **Protocol**: HTTP
- **Request Recording**: Enabled for debugging
- **Injection**: Enabled for dynamic responses

## 🧪 Testing with JMeter

1. Start the mock MQ server: `npm run startMockMQ`
2. Open JMeter test plan: `jmeter-mq-integration/JMeter-MQ-TestPlan.jmx`
3. Update endpoints to point to `http://localhost:3002`
4. Run your load tests against the mock server

## 🐛 Troubleshooting

### Mock Server Won't Start
- Check if port 3002 is available
- Ensure Node.js dependencies are installed: `npm install`
- Check for syntax errors in config files

### Test Failures
- Ensure mock server is running before running tests
- Check network connectivity to localhost:3002
- Review error messages in test output

### Performance Issues
- Mock server runs in-memory, no persistence between restarts
- For high-volume testing, monitor memory usage
- Consider adding delays in configuration for realistic behavior

## 📊 Monitoring

### View Request Logs
The mock server records all requests. You can view them at:
```bash
curl http://localhost:2525/imposters/3002
```

### Debug Mode
Add `--debug` flag when starting:
```bash
node bin/mb --configfile ConfigFiles/Imposters/mock-mq-server.ejs --allowInjection --debug
```

## 🔄 Integration Examples

### Node.js Client
```javascript
const http = require('http');

async function sendMessage(queueName, message) {
    const postData = JSON.stringify({
        queueName: queueName,
        message: message
    });

    const options = {
        hostname: 'localhost',
        port: 3002,
        path: '/mq/send',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Usage
sendMessage('TEST.QUEUE', { text: 'Hello from Node.js!' })
    .then(response => console.log('Message sent:', response))
    .catch(error => console.error('Error:', error));
```

### Python Client
```python
import requests
import json

def send_message(queue_name, message):
    url = 'http://localhost:3002/mq/send'
    payload = {
        'queueName': queue_name,
        'message': message
    }
    
    response = requests.post(url, json=payload)
    return response.json()

# Usage
result = send_message('TEST.QUEUE', {'text': 'Hello from Python!'})
print('Message sent:', result)
```

## ⚡ Quick Commands Reference

```bash
# Start mock MQ server
npm run startMockMQ

# Run comprehensive tests
npm run test:mock-mq

# Send test message
curl -X POST http://localhost:3002/mq/send -H "Content-Type: application/json" -d '{"queueName":"TEST","message":{"text":"test"}}'

# Get message
curl http://localhost:3002/mq/receive?queueName=TEST

# Check health
curl http://localhost:3002/mq/health

# Stop server
Ctrl+C
```

## 📚 Next Steps

- Review `test-mock-mq-server.js` for comprehensive usage examples
- Check `lib/mq/mock-mq-handler.js` for implementation details
- Customize error scenarios in `lib/mq/mq-bridge-middleware.js`
- Add more advanced features as needed for your testing scenarios

## 🆚 Mock vs Real MQ

| Feature | Mock MQ Server | Real IBM MQ |
|---------|----------------|-------------|
| Installation | None required | Full IBM MQ installation |
| Performance | Very fast | Production speed |
| Persistence | In-memory only | Disk persistence |
| Clustering | Single instance | Full clustering support |
| Security | Basic simulation | Full security features |
| Protocols | HTTP REST only | MQI, JMS, HTTP, etc. |
| Use Case | Development/Testing | Production |

For production testing, consider using the Real MQ integration (`npm run startRealMQ`) when you have access to an actual IBM MQ server.
