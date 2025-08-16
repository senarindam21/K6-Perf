const nodemailer = require('nodemailer');
const { SMTPServer } = require('smtp-server');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class NodemailerSMTPMockServer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            smtpPort: options.smtpPort || 3005,
            smtpHost: options.smtpHost || '127.0.0.1',
            ackFromEmail: options.ackFromEmail || 'noreply@mocksmtp.com',
            ackFromName: options.ackFromName || 'Mock SMTP Server',
            enableAuth: options.enableAuth || false,
            logToFile: options.logToFile || true,
            logFile: options.logFile || path.join(process.cwd(), 'smtp-mock-logs.json'),
            maxMessageSize: options.maxMessageSize || 10 * 1024 * 1024, // 10MB
            autoAck: options.autoAck !== false, // Default to true
            ...options
        };
        
        this.receivedEmails = [];
        this.sentAcknowledgments = [];
        this.server = null;
        this.outgoingTransporter = null;
        
        this.initializeServer();
        this.initializeTransporter();
    }
    
    initializeServer() {
        this.server = new SMTPServer({
            name: this.config.smtpHost,
            banner: 'Mock SMTP Server with Nodemailer - Ready for JMeter',
            authMethods: this.config.enableAuth ? ['PLAIN', 'LOGIN'] : [],
            authOptional: !this.config.enableAuth, // Make auth optional when disabled
            size: this.config.maxMessageSize,
            allowInsecureAuth: true,
            hideSTARTTLS: true,
            secure: false,
            
            // Authentication handler
            onAuth: (auth, session, callback) => {
                if (!this.config.enableAuth) {
                    return callback(null, { user: 'anonymous' });
                }
                
                // Simple auth for testing - accept any credentials
                if (auth.username && auth.password) {
                    this.log('info', `Authentication successful for user: ${auth.username}`);
                    callback(null, { user: auth.username });
                } else {
                    this.log('warning', `Authentication failed for user: ${auth.username}`);
                    callback(new Error('Invalid credentials'));
                }
            },
            
            // Data handler - receives email content
            onData: (stream, session, callback) => {
                this.handleIncomingEmail(stream, session, callback);
            },
            
            // Connection handler
            onConnect: (session, callback) => {
                this.log('info', `New SMTP connection from ${session.remoteAddress}`);
                callback();
            },
            
            // Error handler
            onError: (err) => {
                this.log('error', `SMTP Server error: ${err.message}`);
                this.emit('error', err);
            }
        });
    }
    
    initializeTransporter() {
        // Create transporter for sending acknowledgment emails
        // For testing, we'll use a JSON transport that logs emails to file
        this.outgoingTransporter = nodemailer.createTransport({
            jsonTransport: true
        });
    }
    
    handleIncomingEmail(stream, session, callback) {
        let emailData = '';
        
        stream.on('data', (chunk) => {
            emailData += chunk.toString();
        });
        
        stream.on('end', async () => {
            try {
                const parsedEmail = await this.parseEmailData(emailData, session);
                this.receivedEmails.push(parsedEmail);
                
                this.log('info', `Email received from ${parsedEmail.from} to ${parsedEmail.to.join(', ')}`);
                
                // Send acknowledgment email if enabled
                if (this.config.autoAck) {
                    await this.sendAcknowledgment(parsedEmail);
                }
                
                // Log to file if enabled
                if (this.config.logToFile) {
                    this.saveEmailLog(parsedEmail);
                }
                
                this.emit('emailReceived', parsedEmail);
                callback();
                
            } catch (error) {
                this.log('error', `Error processing email: ${error.message}`);
                callback(new Error('Failed to process email'));
            }
        });
        
        stream.on('error', (err) => {
            this.log('error', `Stream error: ${err.message}`);
            callback(err);
        });
    }
    
    async parseEmailData(emailData, session) {
        const lines = emailData.split('\n');
        const headers = {};
        let bodyStart = 0;
        
        // Parse headers
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') {
                bodyStart = i + 1;
                break;
            }
            
            const colonIndex = line.indexOf(':');
            if (colonIndex > 0) {
                const key = line.substring(0, colonIndex).toLowerCase().trim();
                const value = line.substring(colonIndex + 1).trim();
                headers[key] = value;
            }
        }
        
        const body = lines.slice(bodyStart).join('\n').trim();
        
        return {
            messageId: this.generateMessageId(),
            timestamp: new Date().toISOString(),
            from: headers.from || (session.envelope.mailFrom ? session.envelope.mailFrom.address : 'unknown@test.com'),
            to: session.envelope.rcptTo ? session.envelope.rcptTo.map(rcpt => rcpt.address) : ['unknown@test.com'],
            subject: headers.subject || 'No Subject',
            headers: headers,
            body: body,
            rawData: emailData,
            session: {
                remoteAddress: session.remoteAddress,
                clientHostname: session.clientHostname,
                user: session.user
            }
        };
    }
    
    async sendAcknowledgment(originalEmail) {
        const ackEmail = {
            from: `"${this.config.ackFromName}" <${this.config.ackFromEmail}>`,
            to: originalEmail.from,
            subject: `✓ Email Received: ${originalEmail.subject}`,
            text: this.generateAckTextContent(originalEmail),
            html: this.generateAckHtmlContent(originalEmail),
            headers: {
                'In-Reply-To': originalEmail.headers['message-id'] || originalEmail.messageId,
                'References': originalEmail.headers['message-id'] || originalEmail.messageId,
                'X-Auto-Response-Suppress': 'All',
                'X-Mock-SMTP-Server': 'Nodemailer-Mock-v1.0'
            }
        };
        
        try {
            const info = await this.outgoingTransporter.sendMail(ackEmail);
            
            const ackRecord = {
                ackId: this.generateMessageId(),
                timestamp: new Date().toISOString(),
                originalMessageId: originalEmail.messageId,
                sentTo: originalEmail.from,
                subject: ackEmail.subject,
                transportInfo: info,
                status: 'sent',
                messageData: JSON.parse(info.message)
            };
            
            this.sentAcknowledgments.push(ackRecord);
            this.log('info', `✉️  Acknowledgment sent to ${originalEmail.from} for message ${originalEmail.messageId}`);
            this.emit('acknowledgmentSent', ackRecord);
            
            return ackRecord;
            
        } catch (error) {
            this.log('error', `Failed to send acknowledgment: ${error.message}`);
            throw error;
        }
    }
    
    generateAckTextContent(originalEmail) {
        return `
Hello,

Thank you for your email. This is an automated acknowledgment to confirm that we have received your message.

📧 EMAIL DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Received: ${originalEmail.timestamp}
• Message ID: ${originalEmail.messageId}
• Subject: ${originalEmail.subject}
• From: ${originalEmail.from}
• Recipients: ${originalEmail.to.join(', ')}
• Remote IP: ${originalEmail.session.remoteAddress}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ STATUS: Successfully processed and logged
🕒 Processing Time: ${new Date().toISOString()}
🖥️  Server: Mock SMTP Server with Nodemailer
🔧 Version: 1.0.0

Your email has been successfully received and processed by our Mock SMTP Server.
This acknowledgment was automatically generated for testing purposes.

Best regards,
Mock SMTP Server Team
        `.trim();
    }
    
    generateAckHtmlContent(originalEmail) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Email Acknowledgment</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f5f5; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 8px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
        }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px; }
        .status-badge { 
            background: #10b981; 
            color: white; 
            padding: 8px 16px; 
            border-radius: 20px; 
            display: inline-block; 
            font-weight: bold; 
            margin-bottom: 20px; 
        }
        .details { margin: 20px 0; }
        .details table { 
            border-collapse: collapse; 
            width: 100%; 
            background: #f8f9fa;
            border-radius: 6px;
            overflow: hidden;
        }
        .details th, .details td { 
            padding: 12px 15px; 
            text-align: left; 
            border-bottom: 1px solid #e9ecef;
        }
        .details th { 
            background-color: #6c757d; 
            color: white;
            font-weight: 600;
        }
        .details td { background-color: white; }
        .details tr:last-child td { border-bottom: none; }
        .footer { 
            margin-top: 30px; 
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            font-size: 14px; 
            color: #6c757d; 
            text-align: center;
        }
        .emoji { font-size: 18px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1><span class="emoji">📧</span> Email Acknowledgment</h1>
            <p>Your message has been received and processed</p>
        </div>
        
        <div class="content">
            <div class="status-badge">
                ✅ Successfully Received
            </div>
            
            <p>Hello,</p>
            <p>Thank you for your email. This is an automated acknowledgment to confirm that we have successfully received and processed your message.</p>
            
            <div class="details">
                <h3>📋 Email Details</h3>
                <table>
                    <tr><th><span class="emoji">🕒</span> Received</th><td>${originalEmail.timestamp}</td></tr>
                    <tr><th><span class="emoji">🆔</span> Message ID</th><td>${originalEmail.messageId}</td></tr>
                    <tr><th><span class="emoji">📨</span> Subject</th><td>${originalEmail.subject}</td></tr>
                    <tr><th><span class="emoji">👤</span> From</th><td>${originalEmail.from}</td></tr>
                    <tr><th><span class="emoji">📬</span> Recipients</th><td>${originalEmail.to.join(', ')}</td></tr>
                    <tr><th><span class="emoji">🌐</span> Remote IP</th><td>${originalEmail.session.remoteAddress}</td></tr>
                    <tr><th><span class="emoji">⚡</span> Processing Time</th><td>${new Date().toISOString()}</td></tr>
                    <tr><th><span class="emoji">🖥️</span> Server</th><td>Mock SMTP Server with Nodemailer v1.0</td></tr>
                </table>
            </div>
            
            <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p><strong>🔧 For Testing Purposes:</strong></p>
                <p>This acknowledgment was automatically generated by our Mock SMTP Server for JMeter testing scenarios. Your email has been logged and processed successfully.</p>
            </div>
            
            <div class="footer">
                <p>This is an automated message from the Mock SMTP Server.<br>
                <em>Powered by Nodemailer • Generated at ${new Date().toISOString()}</em></p>
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();
    }
    
    generateMessageId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `MSG-${timestamp}-${random}@mocksmtp.com`;
    }
    
    log(level, message) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: message
        };
        
        console.log(`[${logEntry.timestamp}] ${logEntry.level}: ${logEntry.message}`);
        this.emit('log', logEntry);
    }
    
    saveEmailLog(email) {
        try {
            let logs = [];
            if (fs.existsSync(this.config.logFile)) {
                const existingLogs = fs.readFileSync(this.config.logFile, 'utf8');
                logs = JSON.parse(existingLogs);
            }
            
            logs.push({
                timestamp: email.timestamp,
                messageId: email.messageId,
                from: email.from,
                to: email.to,
                subject: email.subject,
                bodyPreview: email.body.substring(0, 200) + (email.body.length > 200 ? '...' : ''),
                sessionInfo: email.session
            });
            
            // Keep only last 1000 emails
            if (logs.length > 1000) {
                logs = logs.slice(-1000);
            }
            
            fs.writeFileSync(this.config.logFile, JSON.stringify(logs, null, 2));
            
        } catch (error) {
            this.log('error', `Failed to save email log: ${error.message}`);
        }
    }
    
    start() {
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.smtpPort, this.config.smtpHost, (err) => {
                if (err) {
                    this.log('error', `Failed to start SMTP server: ${err.message}`);
                    reject(err);
                } else {
                    this.log('info', `🚀 Nodemailer SMTP Mock Server started on ${this.config.smtpHost}:${this.config.smtpPort}`);
                    this.log('info', `📧 Ready to receive emails from JMeter clients`);
                    this.log('info', `✉️  Auto-acknowledgment: ${this.config.autoAck ? 'ENABLED' : 'DISABLED'}`);
                    this.log('info', `🔐 Authentication: ${this.config.enableAuth ? 'ENABLED' : 'DISABLED'}`);
                    resolve();
                }
            });
        });
    }
    
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.log('info', '🛑 SMTP Mock Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
    
    getStats() {
        return {
            receivedEmails: this.receivedEmails.length,
            sentAcknowledgments: this.sentAcknowledgments.length,
            uptime: process.uptime(),
            lastEmailReceived: this.receivedEmails.length > 0 ? 
                this.receivedEmails[this.receivedEmails.length - 1].timestamp : null,
            config: {
                smtpPort: this.config.smtpPort,
                smtpHost: this.config.smtpHost,
                enableAuth: this.config.enableAuth,
                autoAck: this.config.autoAck,
                logToFile: this.config.logToFile
            }
        };
    }
    
    getReceivedEmails(limit = 10) {
        return this.receivedEmails.slice(-limit).reverse();
    }
    
    getSentAcknowledgments(limit = 10) {
        return this.sentAcknowledgments.slice(-limit).reverse();
    }
    
    clearLogs() {
        this.receivedEmails = [];
        this.sentAcknowledgments = [];
        if (fs.existsSync(this.config.logFile)) {
            fs.unlinkSync(this.config.logFile);
        }
        this.log('info', 'All logs cleared');
    }
}

// CLI usage
if (require.main === module) {
    const server = new NodemailerSMTPMockServer({
        smtpPort: process.env.SMTP_PORT || 3005,
        smtpHost: process.env.SMTP_HOST || '127.0.0.1',
        enableAuth: process.env.SMTP_ENABLE_AUTH === 'true',
        autoAck: process.env.SMTP_AUTO_ACK !== 'false',
        logToFile: process.env.SMTP_LOG_TO_FILE !== 'false'
    });
    
    // Event listeners
    server.on('emailReceived', (email) => {
        console.log(`📧 Email received: "${email.subject}" from ${email.from}`);
    });
    
    server.on('acknowledgmentSent', (ack) => {
        console.log(`✉️  Acknowledgment sent: ${ack.ackId} to ${ack.sentTo}`);
    });
    
    server.on('error', (error) => {
        console.error(`❌ Server error: ${error.message}`);
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down SMTP Mock Server...');
        await server.stop();
        process.exit(0);
    });
    
    // Start server
    server.start().catch(console.error);
    
    // Print stats every 30 seconds
    setInterval(() => {
        const stats = server.getStats();
        console.log(`📊 Stats: ${stats.receivedEmails} emails received, ${stats.sentAcknowledgments} acknowledgments sent`);
    }, 30000);
}

module.exports = NodemailerSMTPMockServer;
