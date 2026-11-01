FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.server.json ./
COPY server ./server
RUN npx tsc -p tsconfig.server.json && cp server/schema.sql build/server/schema.sql
RUN npm prune --omit=dev --no-audit --no-fund
FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4181 DATA_DIR=/data
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./
USER node
EXPOSE 4181
CMD ["node", "build/server/main.js"]
