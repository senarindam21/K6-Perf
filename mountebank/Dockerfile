FROM node:22.16.0-alpine

#WORKDIR /home/site/wwwroot
WORKDIR /usr/mountebank
ENV MQ_INSTALLATION_PATH=/opt/mqclient
ENV PATH=$MQ_INSTALLATION_PATH/bin64:$PATH

# Copy package files
COPY 9.4.3.0-IBM-MQC-Redist-LinuxX64.tar.gz /tmp/ 
COPY package*.json /usr/mountebank/
COPY product-controller.js /usr/mountebank/
COPY product-persistence.js /usr/mountebank/
COPY nodemailer-smtp-mock-server.js /usr/mountebank/
COPY smtp-server-management.js /usr/mountebank/
COPY ./bin /usr/mountebank/bin
COPY ./ConfigFiles /usr/mountebank/ConfigFiles
COPY ./images /usr/mountebank/images
COPY ./lib /usr/mountebank/lib
COPY ./products /usr/mountebank/products
COPY ./scripts /usr/mountebank/scripts
COPY ./src /usr/mountebank/src
COPY ./tasks /usr/mountebank/tasks
COPY ./test /usr/mountebank/test
COPY start-mq-server.js /usr/mountebank/
COPY ./.npmignore \
    ./.gitignore \
    ./README.md \
    ./LICENSE \
    /usr/mountebank/


RUN node --version

# Install dependencies
RUN apk update && apk add --no-cache tar bash curl
RUN mkdir -p /opt/mqclient && \
    tar -xzf /tmp/9.4.3.0-IBM-MQC-Redist-LinuxX64.tar.gz -C /opt/mqclient
 
RUN npm install --production && \
    npm install --save glob && \
    chmod 777 ./ && \
    adduser --system --home '/home/mountebank' --disabled-login --shell /bin/bash mountebank && \
    chown -R mountebank /usr/mountebank && \
    chmod 777 /home/mountebank

USER mountebank
ENV HOME="/home/mountebank"


EXPOSE 2525 3002 3005 8080

CMD ["npm", "run", "start"]
