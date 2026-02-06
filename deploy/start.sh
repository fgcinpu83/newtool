#!/bin/bash
# Start Redis
docker-compose up -d redis

# Start Backend
cd ../backend
npm install
npm run start:dev &

# Start Frontend
cd ../frontend
npm install
npm run start:dev &

echo "System Starting... Access UI at http://localhost:3000"
