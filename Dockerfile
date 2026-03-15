# Node.js Dockerfile
# FROM node:24
# WORKDIR /usr/src/app
# COPY package*.json ./
# COPY prisma ./prisma
# RUN npm install
# COPY . .
# RUN npm run build
# EXPOSE 3000
# CMD ["npm", "run", "start:prod"]
FROM oven/bun:1

RUN apt-get update && apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*

ENV TZ=America/Sao_Paulo
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

WORKDIR /usr/src/app
COPY package.json bun.lockb* tsconfig.json ./
RUN bun install
COPY . .
RUN bun x tsc && bun x tsc-alias
EXPOSE 3000
CMD ["bun", "run", "start:prod"]
