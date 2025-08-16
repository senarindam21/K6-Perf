@echo off
REM Setup script for Real MQ Integration - Sets default environment variables
REM Run this before starting the Real MQ server if you don't have IBM MQ installed

echo Setting up Real MQ Integration environment variables...

REM Set default MQ connection parameters
set MQ_QUEUE_MANAGER=QM1
set MQ_HOST=localhost
set MQ_PORT=1414
set MQ_CHANNEL=DEV.APP.SVRCONN
set MQ_USER_ID=
set MQ_PASSWORD=
set MQ_TIMEOUT=30000

REM Set default queues
set MQ_INPUT_QUEUE=DEV.QUEUE.1
set MQ_OUTPUT_QUEUE=DEV.QUEUE.RESPONSE
set MQ_ERROR_QUEUE=DEV.QUEUE.ERROR

REM Set logging
set MQ_LOG_LEVEL=info
set MQ_DEBUG=false

echo Environment variables set successfully!
echo.
echo MQ_QUEUE_MANAGER = %MQ_QUEUE_MANAGER%
echo MQ_HOST = %MQ_HOST%
echo MQ_PORT = %MQ_PORT%
echo MQ_CHANNEL = %MQ_CHANNEL%
echo MQ_INPUT_QUEUE = %MQ_INPUT_QUEUE%
echo.
echo Now you can run: npm run startRealMQ
echo.
pause
