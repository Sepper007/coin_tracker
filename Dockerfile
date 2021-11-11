FROM node:16

WORKDIR /user/src/app
COPY . /user/src/app

RUN npm install

CMD heroku local -p 7000


