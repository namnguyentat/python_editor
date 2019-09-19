# Use an official node runtime as a parent image
FROM nikolaik/python-nodejs:python3.7-nodejs8

RUN pip3 install --upgrade pip
RUN pip3 install pyls==0.1.6
RUN pip3 install python-jsonrpc-server==0.1.2
RUN pip3 install python-language-server[all]
RUN pip3 install python-language-server==0.26.1

ENV APP_HOME /app
RUN mkdir -p $APP_HOME
WORKDIR $APP_HOME

COPY pyls/config/pycodestyle /root/.config/


EXPOSE 8080
