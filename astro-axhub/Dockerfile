# axhub 배포용 — Astro (@astrojs/node standalone) 를 빌드해 node 로 서빙.
# astro build 가 dist/server/entry.mjs 를 만들고, entry.mjs 가 node_modules 런타임을 씀.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build              # astro build → dist/server/entry.mjs

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
EXPOSE 3000
CMD ["node", "./dist/server/entry.mjs"]
