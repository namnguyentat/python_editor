FROM continuumio/miniconda3:4.3.27

ENV APP_HOME /app
RUN mkdir -p $APP_HOME
WORKDIR $APP_HOME

# COPY requirements file
COPY requirements.txt /app/

# Installs, clean, and update
RUN pip install --upgrade pip
RUN pip install -r /app/requirements.txt

EXPOSE 8888
