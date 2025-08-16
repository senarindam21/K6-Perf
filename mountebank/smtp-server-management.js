const express = require('express');
const NodemailerSMTPMockServer = require('./nodemailer-smtp-mock-server');
const fs = require('fs');
const path = require('path');

/**
 * SMTP Mock Server Management Interface
 * 
 * This Express.js server provides a web-based management interface for the 
 * Nodemailer SMTP Mock Server. It allows you to:
 * - Start/stop the SMTP server
 * - View received emails and sent acknowledgments
 * - Monitor server statistics
 * - Configure server settings
 * - Clear logs and reset data
 * 
 * Usage:
 * node smtp-server-management.js --port=4000 --smtp-port=3005
 */

class SMTPServerManagement {
    constructor(options = {}) {
        this.config = {
            managementPort: options.managementPort || 4000,
            managementHost: options.managementHost || '127.0.0.1',
            smtpPort: options.smtpPort || 3005,
            smtpHost: options.smtpHost || '127.0.0.1',
            enableAuth: options.enableAuth || false,
            autoStart: options.autoStart !== false,
            logToFile: options.logToFile !== false,
            ...options
        };
        
        this.app = express();
        this.smtpServer = null;
        this.isSmtpRunning = false;
        
        this.setupMiddleware();
        this.setupRoutes();
    }
    
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // CORS for development
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
            next();
        });
    }
    
    setupRoutes() {
        // Management dashboard
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });
        
        // API Routes
        this.app.get('/api/status', (req, res) => {
            res.json({
                smtpRunning: this.isSmtpRunning,
                config: this.config,
                stats: this.smtpServer ? this.smtpServer.getStats() : null,
                uptime: process.uptime()
            });
        });
        
        this.app.post('/api/smtp/start', async (req, res) => {
            try {
                if (this.isSmtpRunning) {
                    return res.status(400).json({ error: 'SMTP server is already running' });
                }
                
                await this.startSMTPServer();
                res.json({ success: true, message: 'SMTP server started successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.post('/api/smtp/stop', async (req, res) => {
            try {
                if (!this.isSmtpRunning) {
                    return res.status(400).json({ error: 'SMTP server is not running' });
                }
                
                await this.stopSMTPServer();
                res.json({ success: true, message: 'SMTP server stopped successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.post('/api/smtp/restart', async (req, res) => {
            try {
                if (this.isSmtpRunning) {
                    await this.stopSMTPServer();
                }
                await this.startSMTPServer();
                res.json({ success: true, message: 'SMTP server restarted successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.get('/api/emails/received', (req, res) => {
            if (!this.smtpServer) {
                return res.status(400).json({ error: 'SMTP server not initialized' });
            }
            
            const limit = parseInt(req.query.limit) || 20;
            const emails = this.smtpServer.getReceivedEmails(limit);
            res.json(emails);
        });
        
        this.app.get('/api/emails/acknowledgments', (req, res) => {
            if (!this.smtpServer) {
                return res.status(400).json({ error: 'SMTP server not initialized' });
            }
            
            const limit = parseInt(req.query.limit) || 20;
            const acks = this.smtpServer.getSentAcknowledgments(limit);
            res.json(acks);
        });
        
        this.app.post('/api/clear-logs', (req, res) => {
            try {
                if (this.smtpServer) {
                    this.smtpServer.clearLogs();
                }
                res.json({ success: true, message: 'Logs cleared successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        this.app.get('/api/stats', (req, res) => {
            if (!this.smtpServer) {
                return res.status(400).json({ error: 'SMTP server not initialized' });
            }
            
            res.json(this.smtpServer.getStats());
        });
        
        this.app.put('/api/config', async (req, res) => {
            try {
                const newConfig = { ...this.config, ...req.body };
                
                // Restart SMTP server with new config if it's running
                if (this.isSmtpRunning) {
                    await this.stopSMTPServer();
                    this.config = newConfig;
                    await this.startSMTPServer();
                } else {
                    this.config = newConfig;
                }
                
                res.json({ success: true, config: this.config });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                smtpRunning: this.isSmtpRunning
            });
        });
        
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });
        
        // Error handler
        this.app.use((err, req, res, next) => {
            console.error('Management server error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    
    async startSMTPServer() {
        if (this.smtpServer) {
            await this.smtpServer.stop();
        }
        
        this.smtpServer = new NodemailerSMTPMockServer(this.config);
        
        // Set up event listeners
        this.smtpServer.on('emailReceived', (email) => {
            console.log(`📧 Email received: "${email.subject}" from ${email.from}`);
        });
        
        this.smtpServer.on('acknowledgmentSent', (ack) => {
            console.log(`✉️  Acknowledgment sent: ${ack.ackId} to ${ack.sentTo}`);
        });
        
        this.smtpServer.on('error', (error) => {
            console.error(`❌ SMTP server error: ${error.message}`);
            this.isSmtpRunning = false;
        });
        
        await this.smtpServer.start();
        this.isSmtpRunning = true;
    }
    
    async stopSMTPServer() {
        if (this.smtpServer) {
            await this.smtpServer.stop();
            this.isSmtpRunning = false;
        }
    }
    
    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMTP Mock Server Management</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background-color: #f5f5f5; 
            padding: 20px; 
            line-height: 1.6;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 10px; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
            overflow: hidden;
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { font-size: 32px; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 16px; }
        .content { padding: 30px; }
        .status-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .status-card { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            border-left: 4px solid #007bff; 
        }
        .status-card h3 { color: #333; margin-bottom: 10px; }
        .status-card .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .status-card .label { color: #666; font-size: 14px; }
        .controls { margin: 30px 0; }
        .btn-group { margin: 10px 0; }
        .btn { 
            background: #007bff; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 6px; 
            cursor: pointer; 
            margin-right: 10px; 
            font-size: 14px;
            transition: background 0.3s;
        }
        .btn:hover { background: #0056b3; }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #1e7e34; }
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #bd2130; }
        .btn-warning { background: #ffc107; color: #333; }
        .btn-warning:hover { background: #e0a800; }
        .section { 
            margin: 30px 0; 
            padding: 20px; 
            background: #f8f9fa; 
            border-radius: 8px; 
        }
        .section h2 { margin-bottom: 15px; color: #333; }
        .email-list { max-height: 400px; overflow-y: auto; }
        .email-item { 
            background: white; 
            padding: 15px; 
            margin-bottom: 10px; 
            border-radius: 6px; 
            border-left: 4px solid #28a745; 
        }
        .email-item h4 { color: #333; margin-bottom: 5px; }
        .email-item .meta { color: #666; font-size: 12px; }
        .config-form { background: white; padding: 20px; border-radius: 8px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: bold; color: #333; }
        .form-group input, .form-group select { 
            width: 100%; 
            padding: 10px; 
            border: 1px solid #ddd; 
            border-radius: 4px; 
        }
        .loading { text-align: center; padding: 20px; color: #666; }
        .error { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .success { background: #d4edda; color: #155724; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .status-indicator { 
            display: inline-block; 
            width: 12px; 
            height: 12px; 
            border-radius: 50%; 
            margin-right: 8px; 
        }
        .status-running { background: #28a745; }
        .status-stopped { background: #dc3545; }
        .refresh-indicator { 
            animation: spin 1s linear infinite; 
            display: inline-block; 
            margin-left: 10px; 
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
            .status-grid { grid-template-columns: 1fr; }
            .btn { display: block; width: 100%; margin: 5px 0; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 SMTP Mock Server Management</h1>
            <p>Monitor and control your Nodemailer SMTP Mock Server</p>
        </div>
        
        <div class="content">
            <div id="status-section">
                <div class="status-grid">
                    <div class="status-card">
                        <h3>Server Status</h3>
                        <div class="value" id="server-status">
                            <span class="status-indicator status-stopped"></span>Loading...
                        </div>
                        <div class="label">SMTP Server</div>
                    </div>
                    <div class="status-card">
                        <h3>Emails Received</h3>
                        <div class="value" id="emails-received">-</div>
                        <div class="label">Total received</div>
                    </div>
                    <div class="status-card">
                        <h3>Acknowledgments Sent</h3>
                        <div class="value" id="acks-sent">-</div>
                        <div class="label">Auto-responses</div>
                    </div>
                    <div class="status-card">
                        <h3>Uptime</h3>
                        <div class="value" id="uptime">-</div>
                        <div class="label">Server uptime</div>
                    </div>
                </div>
            </div>
            
            <div class="controls">
                <h2>Server Controls</h2>
                <div class="btn-group">
                    <button class="btn btn-success" onclick="startServer()">▶️ Start SMTP Server</button>
                    <button class="btn btn-danger" onclick="stopServer()">⏹️ Stop SMTP Server</button>
                    <button class="btn btn-warning" onclick="restartServer()">🔄 Restart Server</button>
                    <button class="btn" onclick="refreshData()">🔄 Refresh Data <span id="refresh-icon"></span></button>
                </div>
                <div class="btn-group">
                    <button class="btn" onclick="clearLogs()">🗑️ Clear Logs</button>
                    <button class="btn" onclick="downloadLogs()">💾 Download Logs</button>
                </div>
            </div>
            
            <div id="messages"></div>
            
            <div class="section">
                <h2>📨 Recent Received Emails</h2>
                <div id="received-emails" class="email-list">
                    <div class="loading">Loading emails...</div>
                </div>
            </div>
            
            <div class="section">
                <h2>✉️ Recent Acknowledgments</h2>
                <div id="sent-acks" class="email-list">
                    <div class="loading">Loading acknowledgments...</div>
                </div>
            </div>
            
            <div class="section">
                <h2>⚙️ Server Configuration</h2>
                <div class="config-form">
                    <form id="config-form">
                        <div class="form-group">
                            <label for="smtp-host">SMTP Host</label>
                            <input type="text" id="smtp-host" name="smtpHost" value="127.0.0.1">
                        </div>
                        <div class="form-group">
                            <label for="smtp-port">SMTP Port</label>
                            <input type="number" id="smtp-port" name="smtpPort" value="3005">
                        </div>
                        <div class="form-group">
                            <label for="enable-auth">Enable Authentication</label>
                            <select id="enable-auth" name="enableAuth">
                                <option value="false">Disabled</option>
                                <option value="true">Enabled</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="auto-ack">Auto-Acknowledgment</label>
                            <select id="auto-ack" name="autoAck">
                                <option value="true">Enabled</option>
                                <option value="false">Disabled</option>
                            </select>
                        </div>
                        <button type="submit" class="btn">💾 Update Configuration</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <script>
        let refreshInterval;
        
        function showMessage(message, type = 'success') {
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = type === 'error' ? 'error' : 'success';
            messageDiv.textContent = message;
            messagesDiv.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }
        
        async function apiCall(url, options = {}) {
            try {
                const response = await fetch(url, {
                    headers: { 'Content-Type': 'application/json' },
                    ...options
                });
                
                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Request failed');
                }
                
                return await response.json();
            } catch (error) {
                console.error('API call failed:', error);
                throw error;
            }
        }
        
        async function refreshData() {
            const refreshIcon = document.getElementById('refresh-icon');
            refreshIcon.className = 'refresh-indicator';
            refreshIcon.textContent = '⟳';
            
            try {
                await Promise.all([
                    updateStatus(),
                    loadReceivedEmails(),
                    loadSentAcknowledgments()
                ]);
            } catch (error) {
                showMessage('Failed to refresh data: ' + error.message, 'error');
            } finally {
                refreshIcon.className = '';
                refreshIcon.textContent = '';
            }
        }
        
        async function updateStatus() {
            try {
                const status = await apiCall('/api/status');
                
                const serverStatus = document.getElementById('server-status');
                const indicator = serverStatus.querySelector('.status-indicator');
                
                if (status.smtpRunning) {
                    serverStatus.innerHTML = '<span class="status-indicator status-running"></span>Running';
                    indicator.className = 'status-indicator status-running';
                } else {
                    serverStatus.innerHTML = '<span class="status-indicator status-stopped"></span>Stopped';
                    indicator.className = 'status-indicator status-stopped';
                }
                
                if (status.stats) {
                    document.getElementById('emails-received').textContent = status.stats.receivedEmails;
                    document.getElementById('acks-sent').textContent = status.stats.sentAcknowledgments;
                }
                
                const uptimeSeconds = Math.floor(status.uptime);
                const hours = Math.floor(uptimeSeconds / 3600);
                const minutes = Math.floor((uptimeSeconds % 3600) / 60);
                const seconds = uptimeSeconds % 60;
                document.getElementById('uptime').textContent = \`\${hours}h \${minutes}m \${seconds}s\`;
                
                // Update config form
                if (status.config) {
                    document.getElementById('smtp-host').value = status.config.smtpHost;
                    document.getElementById('smtp-port').value = status.config.smtpPort;
                    document.getElementById('enable-auth').value = status.config.enableAuth.toString();
                    document.getElementById('auto-ack').value = status.config.autoAck.toString();
                }
                
            } catch (error) {
                console.error('Failed to update status:', error);
            }
        }
        
        async function loadReceivedEmails() {
            try {
                const emails = await apiCall('/api/emails/received?limit=10');
                const container = document.getElementById('received-emails');
                
                if (emails.length === 0) {
                    container.innerHTML = '<div class="loading">No emails received yet</div>';
                    return;
                }
                
                container.innerHTML = emails.map(email => \`
                    <div class="email-item">
                        <h4>\${email.subject || 'No Subject'}</h4>
                        <div class="meta">
                            From: \${email.from} | To: \${email.to.join(', ')} | 
                            Received: \${new Date(email.timestamp).toLocaleString()}
                        </div>
                    </div>
                \`).join('');
                
            } catch (error) {
                console.error('Failed to load emails:', error);
                document.getElementById('received-emails').innerHTML = 
                    '<div class="error">Failed to load emails</div>';
            }
        }
        
        async function loadSentAcknowledgments() {
            try {
                const acks = await apiCall('/api/emails/acknowledgments?limit=10');
                const container = document.getElementById('sent-acks');
                
                if (acks.length === 0) {
                    container.innerHTML = '<div class="loading">No acknowledgments sent yet</div>';
                    return;
                }
                
                container.innerHTML = acks.map(ack => \`
                    <div class="email-item">
                        <h4>\${ack.subject}</h4>
                        <div class="meta">
                            To: \${ack.sentTo} | Sent: \${new Date(ack.timestamp).toLocaleString()} |
                            Original: \${ack.originalMessageId}
                        </div>
                    </div>
                \`).join('');
                
            } catch (error) {
                console.error('Failed to load acknowledgments:', error);
                document.getElementById('sent-acks').innerHTML = 
                    '<div class="error">Failed to load acknowledgments</div>';
            }
        }
        
        async function startServer() {
            try {
                await apiCall('/api/smtp/start', { method: 'POST' });
                showMessage('SMTP server started successfully');
                await updateStatus();
            } catch (error) {
                showMessage('Failed to start server: ' + error.message, 'error');
            }
        }
        
        async function stopServer() {
            try {
                await apiCall('/api/smtp/stop', { method: 'POST' });
                showMessage('SMTP server stopped successfully');
                await updateStatus();
            } catch (error) {
                showMessage('Failed to stop server: ' + error.message, 'error');
            }
        }
        
        async function restartServer() {
            try {
                await apiCall('/api/smtp/restart', { method: 'POST' });
                showMessage('SMTP server restarted successfully');
                await updateStatus();
            } catch (error) {
                showMessage('Failed to restart server: ' + error.message, 'error');
            }
        }
        
        async function clearLogs() {
            if (!confirm('Are you sure you want to clear all logs?')) return;
            
            try {
                await apiCall('/api/clear-logs', { method: 'POST' });
                showMessage('Logs cleared successfully');
                await refreshData();
            } catch (error) {
                showMessage('Failed to clear logs: ' + error.message, 'error');
            }
        }
        
        async function downloadLogs() {
            try {
                window.open('/api/stats', '_blank');
            } catch (error) {
                showMessage('Failed to download logs: ' + error.message, 'error');
            }
        }
        
        // Config form submission
        document.getElementById('config-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const config = {};
            
            for (const [key, value] of formData.entries()) {
                if (key === 'smtpPort') {
                    config[key] = parseInt(value);
                } else if (key === 'enableAuth' || key === 'autoAck') {
                    config[key] = value === 'true';
                } else {
                    config[key] = value;
                }
            }
            
            try {
                await apiCall('/api/config', {
                    method: 'PUT',
                    body: JSON.stringify(config)
                });
                showMessage('Configuration updated successfully');
                await updateStatus();
            } catch (error) {
                showMessage('Failed to update configuration: ' + error.message, 'error');
            }
        });
        
        // Initialize dashboard
        document.addEventListener('DOMContentLoaded', () => {
            refreshData();
            
            // Auto-refresh every 10 seconds
            refreshInterval = setInterval(refreshData, 10000);
        });
        
        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            if (refreshInterval) {
                clearInterval(refreshInterval);
            }
        });
    </script>
</body>
</html>
        `;
    }
    
    async start() {
        if (this.config.autoStart) {
            try {
                await this.startSMTPServer();
                console.log('✅ SMTP server auto-started');
            } catch (error) {
                console.error(`❌ Failed to auto-start SMTP server: ${error.message}`);
            }
        }
        
        return new Promise((resolve, reject) => {
            this.app.listen(this.config.managementPort, this.config.managementHost, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🚀 SMTP Management Interface started on http://${this.config.managementHost}:${this.config.managementPort}`);
                    console.log(`📧 SMTP Server: ${this.isSmtpRunning ? 'RUNNING' : 'STOPPED'} on ${this.config.smtpHost}:${this.config.smtpPort}`);
                    resolve();
                }
            });
        });
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const config = {
        managementPort: 4000,
        managementHost: '127.0.0.1',
        smtpPort: 3005,
        smtpHost: '127.0.0.1',
        enableAuth: false,
        autoStart: true
    };
    
    // Parse command line arguments
    args.forEach(arg => {
        if (arg.startsWith('--port=')) {
            config.managementPort = parseInt(arg.split('=')[1]) || 4000;
        } else if (arg.startsWith('--smtp-port=')) {
            config.smtpPort = parseInt(arg.split('=')[1]) || 3005;
        } else if (arg.startsWith('--host=')) {
            config.managementHost = arg.split('=')[1];
        } else if (arg.startsWith('--smtp-host=')) {
            config.smtpHost = arg.split('=')[1];
        } else if (arg.includes('--auth')) {
            config.enableAuth = true;
        } else if (arg.includes('--no-auto-start')) {
            config.autoStart = false;
        }
    });
    
    const management = new SMTPServerManagement(config);
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down SMTP Management Interface...');
        if (management.smtpServer) {
            await management.stopSMTPServer();
        }
        process.exit(0);
    });
    
    management.start().catch(console.error);
}

module.exports = SMTPServerManagement;
