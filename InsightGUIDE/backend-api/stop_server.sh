#!/bin/bash

# InsightGUIDE API - Stop Script
# This script stops the running Gunicorn process

PID_FILE="./logs/gunicorn.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "Stopping InsightGUIDE API (PID: $PID)..."
    
    if kill -0 "$PID" 2>/dev/null; then
        kill -TERM "$PID"
        sleep 2
        
        if kill -0 "$PID" 2>/dev/null; then
            echo "Process still running, forcing shutdown..."
            kill -KILL "$PID"
        fi
        
        rm -f "$PID_FILE"
        echo "InsightGUIDE API stopped successfully!"
    else
        echo "Process with PID $PID is not running"
        rm -f "$PID_FILE"
    fi
else
    echo "PID file not found. Is the application running?"
    echo "Attempting to find and kill gunicorn processes..."
    pkill -f "gunicorn.*main:app" && echo "Killed gunicorn processes" || echo "No gunicorn processes found"
fi
