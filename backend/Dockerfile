FROM node:20-bullseye

ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Install build tools for native modules (better-sqlite3 etc.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 build-essential g++ make git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app/backend

# Copy dependency manifest for better layer caching
COPY backend/package.json ./package.json

RUN npm install --unsafe-perm --prefer-offline

# Copy source
COPY backend/ ./

# Build the project (if script exists)
RUN npm run build --if-present

# Run tests (best-effort; won't fail the image build)
RUN npm test --silent || true

# Default: open a shell so the container is useful for debugging/commands
CMD ["/bin/bash"]
