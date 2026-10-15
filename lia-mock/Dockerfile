FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY evidence ./evidence
ENV PORT=4010
EXPOSE 4010
CMD ["node", "src/server.js"]
