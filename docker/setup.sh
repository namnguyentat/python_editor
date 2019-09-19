#!/bin/bash

set -e

docker-compose -f docker/docker-compose.yml -p pythoneditor build
docker-compose -f docker/docker-compose.yml -p pythoneditor run --rm --entrypoint=/bin/bash react -c "yarn install"
docker-compose -f docker/docker-compose.yml -p pythoneditor run --rm --entrypoint=/bin/bash pyls -c "yarn install"
