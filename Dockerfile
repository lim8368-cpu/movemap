FROM node:20-alpine AS builder

WORKDIR /app
COPY apps ./apps
COPY scripts ./scripts
RUN node scripts/build-vercel-static.js

FROM node:20-alpine AS runtime

ENV NODE_ENV=production \
    APP_ENV=production \
    PORT=3000

WORKDIR /app
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node api ./api
COPY --chown=node:node server/production-server.js ./server/production-server.js
COPY --chown=node:node server/environment.js ./server/environment.js

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server/production-server.js"]
