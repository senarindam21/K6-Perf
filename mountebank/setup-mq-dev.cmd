@echo off
REM IBM MQ Development Environment Setup Script for Windows
REM This script sets up a basic MQ environment for development and testing

echo ========================================
echo IBM MQ Development Environment Setup
echo ========================================
echo.

REM Check if MQ is installed
where dspmq >nul 2>nul
if errorlevel 1 (
    echo ERROR: IBM MQ is not installed or not in PATH
    echo Please install IBM MQ Client or Server first
    pause
    exit /b 1
)

echo 1. Checking existing Queue Managers...
dspmq

echo.
echo 2. Creating Queue Manager QM1 (if not exists)...
crtmqm QM1
if errorlevel 1 (
    echo Queue Manager QM1 might already exist or creation failed
)

echo.
echo 3. Starting Queue Manager QM1...
strmqm QM1
if errorlevel 1 (
    echo Failed to start Queue Manager QM1
    echo Please check the error messages above
    pause
    exit /b 1
)

echo.
echo 4. Configuring MQ objects...
(
echo DEFINE CHANNEL^(DEV.APP.SVRCONN^) CHLTYPE^(SVRCONN^) TRPTYPE^(TCP^) MCAUSER^('mqm'^)
echo DEFINE QLOCAL^(DEV.QUEUE.1^)
echo DEFINE QLOCAL^(DEV.QUEUE.RESPONSE^)
echo DEFINE QLOCAL^(DEV.QUEUE.BOTH^)
echo DEFINE QLOCAL^(DEV.QUEUE.DYNAMIC^)
echo DEFINE QLOCAL^(TEST.QUEUE.1^)
echo DEFINE QLOCAL^(TEST.REQUEST.QUEUE^)
echo DEFINE QLOCAL^(TEST.RESPONSE.QUEUE^)
echo.
echo REM Set channel authentication for development
echo SET CHLAUTH^(DEV.APP.SVRCONN^) TYPE^(BLOCKUSER^) USERLIST^('nobody'^)
echo SET CHLAUTH^(DEV.APP.SVRCONN^) TYPE^(ADDRESSMAP^) ADDRESS^('*'^) USERSRC^(CHANNEL^) CHCKCLNT^(ASQMGR^)
echo REFRESH SECURITY TYPE^(CONNAUTH^)
echo.
echo REM Start listener
echo START LISTENER^(SYSTEM.DEFAULT.LISTENER.TCP^)
echo.
echo REM Display configuration
echo DISPLAY CHANNEL^(DEV.APP.SVRCONN^)
echo DISPLAY QLOCAL^(DEV.QUEUE.1^)
echo DISPLAY LISTENER^(SYSTEM.DEFAULT.LISTENER.TCP^)
) | runmqsc QM1

echo.
echo 5. Verifying setup...
echo Checking Queue Manager status:
dspmq

echo.
echo 6. Testing connection...
node -e "
const { MQClient } = require('./lib/mq/mqClient');
async function test() {
    const client = new MQClient({
        queueManager: 'QM1',
        connectionName: 'localhost(1414)',
        channel: 'DEV.APP.SVRCONN'
    });
    try {
        await client.connect();
        console.log('✓ Connection test successful!');
        await client.disconnect();
    } catch (error) {
        console.error('✗ Connection test failed:', error.message);
    }
}
test();
"

echo.
echo ========================================
echo MQ Development Environment Setup Complete!
echo ========================================
echo.
echo Queue Manager: QM1
echo Connection: localhost(1414)
echo Channel: DEV.APP.SVRCONN
echo.
echo Available Queues:
echo - DEV.QUEUE.1
echo - DEV.QUEUE.RESPONSE  
echo - DEV.QUEUE.BOTH
echo - DEV.QUEUE.DYNAMIC
echo - TEST.QUEUE.1
echo - TEST.REQUEST.QUEUE
echo - TEST.RESPONSE.QUEUE
echo.
echo You can now run your MQ integration tests:
echo   node test-mq-integration.js
echo   node mq-client-test.js
echo.
pause
