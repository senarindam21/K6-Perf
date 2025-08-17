# syntax=docker/dockerfile:1

FROM node:18-alpine

#WORKDIR /home/site/wwwroot
WORKDIR /usr/mountebank

# Copy package files
COPY package*.json /usr/mountebank
COPY product-controller.js /usr/mountebank
COPY product-persistence.js /usr/mountebank
COPY nodemailer-smtp-mock-server.js /usr/mountebank
COPY smtp-server-management.js /usr/mountebank
COPY ./bin /usr/mountebank/bin
COPY ./src /usr/mountebank/src
COPY ./ConfigFiles /usr/mountebank/ConfigFiles
COPY ./lib /usr/mountebank/lib
COPY start-mq-server.js /usr/mountebank
COPY startup.sh /usr/mountebank

# Install dependencies
RUN npm install --production

# Set permissions
RUN chmod +x startup.sh

EXPOSE 2525 3002 3005 8080

CMD ["/bin/sh", "./startup.sh"]
