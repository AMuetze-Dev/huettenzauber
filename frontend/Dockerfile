# Mehrstufig: `builder` baut das Bundle, `runner` serviert es via nginx (Standard).
# Dev-Modus nutzt `target: builder` + `command:` (Vite-Dev-Server) in docker-compose.yml.

FROM node:22.12-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
