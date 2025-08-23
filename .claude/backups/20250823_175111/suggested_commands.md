# AI Feedback Platform - Suggested Commands

## Development Commands

### Core Development
```bash
# Start all services in development mode
npm run dev

# Start specific services
npm run dev:web      # Customer PWA only (port 3000)
npm run dev:api      # API Gateway only (port 3001)  
npm run dev:business # Business Dashboard only (port 3002)

# Build all packages
npm run build

# Clean all build artifacts
npm run clean
```

### Code Quality & Testing
```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Code formatting
npm run format                    # Auto-fix formatting
npm run format:check             # Check formatting only

# Testing
npm run test                     # Run all tests
npm run test:ios                 # iOS Safari compatibility tests
npm run test:ios:headed         # iOS tests with browser UI
npm run test:ios:debug          # iOS tests in debug mode
npm run test:ios:report         # Show iOS test results
npm run test:ios:setup          # Run iOS testing setup
```

### iOS Safari Testing (Critical for this project)
```bash
# Manual testing setup
npm run test:ios:setup

# Run iOS compatibility tests
npm run test:ios

# Debug iOS issues with browser
npm run test:ios:headed

# View detailed test results
npm run test:ios:report
```

## Task Completion Workflow

After completing any development task, run these commands in order:

1. **Format code**: `npm run format`
2. **Type check**: `npm run typecheck`  
3. **Lint**: `npm run lint`
4. **Test**: `npm run test`
5. **iOS Safari test**: `npm run test:ios` (if UI changes)

## Git Workflow
```bash
# Feature development
git checkout -b feature/123-description
git commit -m "feat(scope): description"

# Bug fixes
git checkout -b bugfix/456-description  
git commit -m "fix(scope): description"

# Hotfixes
git checkout -b hotfix/production-issue
git commit -m "hotfix(scope): description"
```

## System Utilities (macOS/Darwin specific)
```bash
# File operations
ls -la                    # List files with details
find . -name "*.ts"      # Find TypeScript files
grep -r "pattern" .      # Search in files
cd apps/customer-pwa     # Navigate to specific app

# Process monitoring
lsof -i :3000           # Check what's using port 3000
ps aux | grep node      # Find Node.js processes
killall node            # Stop all Node.js processes
```

## Performance & Monitoring
```bash
# Check WebSocket connections
lsof -i :3001

# Monitor real-time voice latency
# (Custom monitoring commands to be added)

# Check iOS Safari DevTools
# Use Safari → Develop → [Device] → Web Inspector
```

## Critical Performance Targets
- Voice Response Time: < 2 seconds
- API Response Time: < 500ms
- Page Load Time: < 3 seconds  
- System Uptime: 99.9%