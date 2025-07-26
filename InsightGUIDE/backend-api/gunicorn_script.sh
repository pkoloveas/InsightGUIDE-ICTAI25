#!/bin/bash

# InsightGUIDE API - Production Deployment Script
# This script starts the FastAPI application using Gunicorn with optimized settings

if [ -f .env ]; then
    echo "Loading configuration from .env file..."
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
else
    echo "Warning: .env file not found, using default values"
fi

WORKERS=4
WORKER_CLASS="uvicorn.workers.UvicornWorker"
HOST=${HOST:-0.0.0.0}
PORT=${PORT:-8000}
BIND_ADDRESS="$HOST:$PORT"
APP_MODULE="main:app"

ACCESS_LOG="./logs/access.log"
ERROR_LOG="./logs/error.log"
LOG_LEVEL="info"

mkdir -p logs

gunicorn \
  --workers $WORKERS \
  --worker-class $WORKER_CLASS \
  --bind $BIND_ADDRESS \
  --daemon \
  --access-logfile $ACCESS_LOG \
  --error-logfile $ERROR_LOG \
  --log-level $LOG_LEVEL \
  --worker-connections 1000 \
  --max-requests 1000 \
  --max-requests-jitter 100 \
  --timeout 300 \
  --keep-alive 2 \
  --pid ./logs/gunicorn.pid \
  $APP_MODULE

echo "InsightGUIDE API started successfully!"
echo "PID file: ./logs/gunicorn.pid"
echo "Access log: $ACCESS_LOG"
echo "Error log: $ERROR_LOG"
echo "API available at: http://$HOST:$PORT"
echo "API docs available at: http://$HOST:$PORT/docs"