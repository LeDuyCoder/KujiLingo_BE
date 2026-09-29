FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build

EXPOSE 8000

CMD ["npm", "start"]
