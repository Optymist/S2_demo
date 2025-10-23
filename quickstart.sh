#!/bin/bash

# Microservices Demo - Quick Start Script
# This script helps you get started quickly with the microservices demo

set -e

echo "🚀 Microservices Demo - Quick Start"
echo "===================================="
echo ""

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if docker compose is available
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose v2."
    exit 1
fi

echo "✓ Docker is installed"
echo "✓ Docker Compose is available"
echo ""

# Function to check if services are running
check_services() {
    echo "Checking service health..."
    sleep 5
    
    for i in {1..30}; do
        if curl -sf http://localhost:3001/health > /dev/null 2>&1 && \
           curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            echo "✓ Services are healthy!"
            return 0
        fi
        echo "Waiting for services to be ready... ($i/30)"
        sleep 2
    done
    
    echo "⚠️  Services did not become healthy in time"
    return 1
}

# Main menu
echo "Select an option:"
echo "1) Start services (docker-compose)"
echo "2) Stop services"
echo "3) View logs"
echo "4) Run tests"
echo "5) Clean up everything"
echo "6) Build images only"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo ""
        echo "Starting services..."
        docker compose up -d
        echo ""
        check_services
        echo ""
        echo "Services are running!"
        echo "- Frontend: http://localhost:3000"
        echo "- Backend API: http://localhost:3001"
        echo ""
        echo "To view logs: docker compose logs -f"
        echo "To stop: docker compose down"
        ;;
    2)
        echo ""
        echo "Stopping services..."
        docker compose down
        echo "✓ Services stopped"
        ;;
    3)
        echo ""
        echo "Viewing logs (Ctrl+C to exit)..."
        docker compose logs -f
        ;;
    4)
        echo ""
        echo "Running tests..."
        echo ""
        echo "Backend tests:"
        cd services/backend && npm install && npm test
        echo ""
        echo "Frontend tests:"
        cd ../frontend && npm install && npm test
        cd ../..
        echo ""
        echo "✓ All tests completed"
        ;;
    5)
        echo ""
        echo "Cleaning up everything..."
        docker compose down -v --rmi all
        echo "✓ Cleanup complete"
        ;;
    6)
        echo ""
        echo "Building Docker images..."
        docker compose build
        echo "✓ Images built successfully"
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac
