FROM node:22-slim
WORKDIR /app
COPY package.json server.mjs ./
COPY scripts ./scripts
COPY public ./public
COPY fixtures ./fixtures
RUN mkdir -p .cache public/data
ENV PORT=5173
EXPOSE 5173
CMD ["node", "server.mjs"]
