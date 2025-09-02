FROM node:22.16.0-alpine

#WORKDIR /home/site/wwwroot
WORKDIR /usr/mountebank

#ENV MQ_INSTALLATION_PATH=/opt/mqclient
#ENV PATH=$MQ_INSTALLATION_PATH/bin64:$PATH
#RUN chgrp -R 0 /usr/mountebank && chmod -R g=u /usr/mountebank
#RUN mkdir -p /usr/mountebank && chmod -R 777 /usr/mountebank

# Copy package files
#COPY 9.4.3.0-IBM-MQC-Redist-LinuxX64.tar.gz /usr/mountebank/ 
COPY package*.json /usr/mountebank/
COPY product-controller.js /usr/mountebank/
COPY product-persistence.js /usr/mountebank/
COPY nodemailer-smtp-mock-server.js /usr/mountebank/
COPY smtp-server-management.js /usr/mountebank/
COPY ./bin /usr/mountebank/bin
COPY ./ConfigFiles /usr/mountebank/ConfigFiles
COPY ./images /usr/mountebank/images
COPY ./lib /usr/mountebank/lib
#COPY ./products /usr/mountebank/products
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
    
#RUN adduser -D -h '/usr/mountebank' mountebank
#RUN chown -R 0:0 /usr/mountebank && chmod -R g=u /usr/mountebank
#RUN chgrp -R 0 /usr/mountebank && chmod -R g=u /usr/mountebank
#RUN chmod -R g=u /usr/mountebank

# Install dependencies

RUN npm ci --only=production && \
    npm cache clean --force

#RUN npm install
#RUN npm install --save glob
#RUN chmod 777 ./
#RUN whoami
#RUN adduser -D -h '/home/mountebank' -s /bin/sh -S mountebank
#RUN chown -R mountebank /usr/mountebank
#RUN chmod 777 /home/mountebank

RUN adduser -D mountebank && \
    mkdir -p /usr/mountebank/.npm && \
    chown -R mountebank:mountebank /usr/mountebank && \
    chgrp -R 0 /usr/mountebank && \
    chmod -R g=u /usr/mountebank && \
    chmod +x ./bin/mb

USER mountebank
#ENV HOME=/home/mountebank
RUN whoami



EXPOSE 2525 3002 3005 8080

CMD ["npm", "run", "start"]
