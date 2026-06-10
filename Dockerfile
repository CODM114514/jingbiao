FROM node:20-alpine AS runtime

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

ENV HOST=0.0.0.0
EXPOSE 3000

CMD ["node", "server.mjs"]
