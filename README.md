# How to start

## Feaures

- Monaco editor for UI
- python-language-server for auto suggestion
- Jupyter protocol to execute code
- Tow layer structure
- Execute code line by line

## Start pyls and jupyter server

- Copy `pyls/config/pycodestyle` to `~/.config/pycodestyle`
- Go to `pyls` server and follow README to start python language server
- Start jupyter server `jupyter notebook --NotebookApp.token=test-secret --NotebookApp.allow_origin='*' --NotebookApp.ip='0.0.0.0'`

## Start editor

- Run `yarn install`
- Run `yarn start`
