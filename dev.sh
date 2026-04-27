#!/bin/bash

# YourFin Local Development Script
# Usage: ./dev.sh [start|stop|restart]

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

start_backend() {
    echo -e "${YELLOW}🚀 Starting Backend...${NC}"
    cd "$BACKEND_DIR"
    
    # Check if JAR exists
    if [ ! -f "target/api-0.0.1-SNAPSHOT.jar" ]; then
        echo -e "${YELLOW}📦 Building backend...${NC}"
        ./mvnw clean package -DskipTests
    fi
    
    # Start backend in background
    java -jar target/api-0.0.1-SNAPSHOT.jar > backend.log 2>&1 &
    echo $! > backend.pid
    echo -e "${GREEN}✅ Backend started on http://localhost:8080${NC}"
    echo -e "${GREEN}   PID: $(cat backend.pid)${NC}"
}

start_frontend() {
    echo -e "${YELLOW}🚀 Starting Frontend...${NC}"
    cd "$FRONTEND_DIR"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        npm install
    fi
    
    # Start frontend in background
    npm run dev > frontend.log 2>&1 &
    echo $! > frontend.pid
    echo -e "${GREEN}✅ Frontend started on http://localhost:3000${NC}"
    echo -e "${GREEN}   PID: $(cat frontend.pid)${NC}"
}

stop_backend() {
    echo -e "${YELLOW}🛑 Stopping Backend...${NC}"
    cd "$BACKEND_DIR"
    if [ -f "backend.pid" ]; then
        kill $(cat backend.pid) 2>/dev/null
        rm backend.pid
        echo -e "${GREEN}✅ Backend stopped${NC}"
    else
        pkill -f "api-0.0.1-SNAPSHOT.jar" 2>/dev/null
        echo -e "${GREEN}✅ Backend stopped (via pkill)${NC}"
    fi
}

stop_frontend() {
    echo -e "${YELLOW}🛑 Stopping Frontend...${NC}"
    cd "$FRONTEND_DIR"
    if [ -f "frontend.pid" ]; then
        kill $(cat frontend.pid) 2>/dev/null
        rm frontend.pid
        echo -e "${GREEN}✅ Frontend stopped${NC}"
    else
        pkill -f "next dev" 2>/dev/null
        echo -e "${GREEN}✅ Frontend stopped (via pkill)${NC}"
    fi
}

status() {
    echo -e "${YELLOW}📊 YourFin Status:${NC}"
    echo ""
    
    # Check backend
    if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend: Running on http://localhost:8080${NC}"
    else
        echo -e "${RED}❌ Backend: Not running${NC}"
    fi
    
    # Check frontend
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Frontend: Running on http://localhost:3000${NC}"
    else
        echo -e "${RED}❌ Frontend: Not running${NC}"
    fi
}

case "$1" in
    start)
        echo -e "${GREEN}🎯 Starting YourFin Platform...${NC}"
        start_backend
        sleep 3
        start_frontend
        sleep 3
        status
        ;;
    stop)
        echo -e "${GREEN}🎯 Stopping YourFin Platform...${NC}"
        stop_backend
        stop_frontend
        ;;
    restart)
        echo -e "${GREEN}🎯 Restarting YourFin Platform...${NC}"
        stop_backend
        stop_frontend
        sleep 2
        start_backend
        sleep 3
        start_frontend
        sleep 3
        status
        ;;
    status)
        status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo ""
        echo "Commands:"
        echo "  start   - Start both backend and frontend"
        echo "  stop    - Stop both backend and frontend"
        echo "  restart - Restart both services"
        echo "  status  - Check service status"
        exit 1
        ;;
esac
