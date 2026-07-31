# syntax=docker/dockerfile:1.7
FROM node:22.13.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_DATA_SOURCE=api
ARG NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
ENV NEXT_PUBLIC_DATA_SOURCE=$NEXT_PUBLIC_DATA_SOURCE
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:22.13.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN useradd --create-home --uid 10001 appuser
COPY --from=build --chown=appuser:appuser /app/package.json /app/package-lock.json ./
COPY --from=build --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=build --chown=appuser:appuser /app/dist ./dist
COPY --from=build --chown=appuser:appuser /app/public ./public
COPY --from=build --chown=appuser:appuser /app/.openai ./.openai
COPY --from=build --chown=appuser:appuser /app/vite.config.ts /app/next.config.ts ./
USER appuser
EXPOSE 5173
CMD ["npm", "run", "start"]
