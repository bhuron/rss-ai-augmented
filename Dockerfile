# Stage 1: Build the React client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production server (Node + Express API)
FROM node:20-alpine AS server
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/src/ ./src/
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "src/index.js"]

# Stage 3: Nginx serving client + reverse-proxying API
FROM nginx:alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=client-builder /app/client/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
