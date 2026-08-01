# FluxBlog SSR 镜像：构建 Astro（@astrojs/node standalone）并以 node 运行。
# 注意：此为容器化部署路径；本项目的生产部署是 systemd + nginx（见 AGENTS.md §5.2）。
# 运行时需提供 PUBLIC_BLOG_API（绝对地址，指向 AppPilot Go 后端）与 FLUXBLOG_SITE_URL。

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG FLUXBLOG_SITE_URL=https://example.com
ENV FLUXBLOG_SITE_URL=$FLUXBLOG_SITE_URL
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=4321
COPY --from=build /app/dist /app/dist
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
