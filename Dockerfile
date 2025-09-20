# syntax=docker/dockerfile:1
FROM node:20-alpine as base
WORKDIR /app
COPY package.json pnpm-lock.yaml* yarn.lock* package-lock.json* ./

# Use pnpm if present, else npm
RUN if [ -f pnpm-lock.yaml ]; then npm i -g pnpm@9; fi \
 && if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm ci; fi

COPY tsconfig.json ./
COPY src ./src

RUN if [ -f pnpm-lock.yaml ]; then pnpm build; \
    elif [ -f yarn.lock ]; then yarn build; \
    else npm run build; fi

EXPOSE 3333
CMD ["node", "dist/server.js"]
