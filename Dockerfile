FROM node:20-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY server.js ./

RUN npm init -y 2>/dev/null; npm install express ioredis 2>/dev/null || true

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "server.js"]
