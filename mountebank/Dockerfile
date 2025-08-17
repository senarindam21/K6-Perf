# syntax=docker/dockerfile:1

FROM node:18-alpine

#WORKDIR /home/site/wwwroot
WORKDIR /usr/mountebank

# Copy package files
COPY package*.json ./
COPY product-controller.js ./
COPY product-persistence.js ./
COPY nodemailer-smtp-mock-server.js ./
COPY smtp-server-management.js ./
COPY bin ./bin
COPY src ./src
COPY ConfigFiles ./ConfigFiles
COPY lib ./lib
COPY start-mq-server.js ./
COPY startup.sh ./

# Install dependencies
RUN npm install --production

# Set permissions
RUN chmod +x startup.sh

EXPOSE 2525 3002 3005 8080

CMD ["/bin/sh", "./startup.sh"]
