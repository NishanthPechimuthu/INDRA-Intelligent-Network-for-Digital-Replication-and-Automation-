# syntax=docker/dockerfile:1

# ---- Build stage -----------------------------------------------------------
# Install exact dependencies and produce the static production bundle.
FROM node:20-alpine AS build
WORKDIR /app

ENV CI=true
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- Runtime stage ---------------------------------------------------------
# The application is a static SPA; nginx serves the optimised bundle only.
FROM nginx:1.27-alpine AS runtime

RUN rm -f /etc/nginx/conf.d/default.conf
COPY docker/nginx.conf /etc/nginx/conf.d/indra.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
