#!/bin/bash

set -e

docker-compose -f docker/docker-compose.yml -p pythoneditor up -d
docker attach python-editor-react
