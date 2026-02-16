param()

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Output "Building backend image..."
docker build -t newtool-backend:local -f backend/Dockerfile .

Write-Output "Running build inside container..."
docker run --rm -v "${ScriptDir}:/workspace" -w /usr/src/app/backend newtool-backend:local npm run build

Write-Output "Build finished. To run tests inside the same image run:"
Write-Output "  docker run --rm -v \"${ScriptDir}\":/workspace -w /usr/src/app/backend newtool-backend:local npm test"
