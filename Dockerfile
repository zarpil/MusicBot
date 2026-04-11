FROM node:20-alpine

WORKDIR /app

# Install native build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3001
CMD ["node", "src/index.js"]
