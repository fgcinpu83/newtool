FROM node:20-bullseye

WORKDIR /app

# Install build tools required by native modules (better-sqlite3, etc.)
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 build-essential g++ make ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./backend/

# Use `npm install` here to allow lockfile reconciliation inside the build
# (the project's lockfile appears out-of-sync with package.json in the image context)
RUN cd backend && npm install --no-audit --prefer-offline

COPY backend ./backend

WORKDIR /app/backend

RUN npm run build

CMD ["npm", "test"]
