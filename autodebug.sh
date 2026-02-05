#!/bin/bash

echo "=== Autodebug Script ==="
echo "Running in directory: $(pwd)"
echo ""

# Change to backend directory
cd backend || { echo "Failed to cd to backend"; exit 1; }

echo "=== Building backend ==="
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Build successful"
echo ""

echo "=== Running tests ==="
npm test
if [ $? -ne 0 ]; then
    echo "❌ Tests failed"
    exit 1
fi
echo "✅ Tests passed"
echo ""

echo "=== Smoke run ==="
npm start &
PID=$!
sleep 5
if kill -0 $PID 2>/dev/null; then
    echo "✅ App started successfully"
    kill $PID
else
    echo "❌ App failed to start"
    exit 1
fi

echo "🎉 All checks passed!"