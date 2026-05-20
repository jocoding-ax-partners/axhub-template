# axhub 배포용 — Vite + React SPA 를 빌드해 nginx 로 정적 서빙.
# axhub backend(deploy resolver)가 이 Dockerfile 의 EXPOSE 를 컨테이너 포트로 잡아요
# (apphub.yaml 의 runtime.port 가 override). 자세히는 docs/bootstrap-prep.md.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build              # tsc -b && vite build → /app/dist

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
