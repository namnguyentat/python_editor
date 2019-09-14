#!/bin/bash

jupyter notebook --NotebookApp.token=test-secret --NotebookApp.allow_origin='*' --NotebookApp.ip='0.0.0.0'
