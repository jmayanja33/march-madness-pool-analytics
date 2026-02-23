# Frontend Dockerfile — Vite React dev server.
# Intended for local development only; a production build would use
# a multi-stage build and serve static files via Nginx.

FROM node:20-slim

WORKDIR /app

# Install dependencies first — separate layer for better caching.
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the frontend source
COPY . .

EXPOSE 5173

# --host exposes the Vite dev server on all network interfaces,
# which is required for the port to be reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--host"]
