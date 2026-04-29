# ─── Stage 1: dependencies ───────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev

# ─── Stage 2: production image ───────────────────────────────
FROM node:20-alpine AS runner

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src ./src

# Expose the port fly.io will route to
ENV PORT=8080
ENV NODE_ENV=production

USER appuser

EXPOSE 8080

CMD ["node", "src/server.js"]
