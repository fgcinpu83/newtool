#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building backend image..."
docker build -t newtool-backend:local -f backend/Dockerfile .

echo "Running build inside container..."
docker run --rm -v "${ROOT_DIR}":/workspace -w /usr/src/app/backend newtool-backend:local npm run build

echo "Build finished. To run tests inside the same image run:"
echo "  docker run --rm -v \"${ROOT_DIR}\":/workspace -w /usr/src/app/backend newtool-backend:local npm test"
