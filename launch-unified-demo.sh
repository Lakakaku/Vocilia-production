#!/bin/bash

# AI Feedback Platform - Unified Demo Launcher
echo "🇸🇪 AI Feedback Platform - Unified Demo Launcher"
echo "================================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    echo "   Please update Node.js from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Navigate to demo directory
cd unified-demo

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found. Make sure you're in the correct directory."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
fi

echo ""
echo "🚀 Starting AI Feedback Platform Demo..."
echo ""
echo "📱 Demo will be available at: http://localhost:3010"
echo "🎯 Features:"
echo "   • Complete customer journey simulation"
echo "   • Business dashboard with Swedish market data" 
echo "   • Admin platform with system monitoring"
echo "   • AI-powered quality scoring and fraud detection"
echo ""
echo "⏹️  Press Ctrl+C to stop the demo server"
echo ""
echo "================================================="

# Start the development server
npm run dev