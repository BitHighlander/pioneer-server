SHELL=/bin/bash

env=skunkworks

.DEFAULT_GOAL := build

clean::
	find . -name "node_modules" -type d -prune -print | xargs du -chs && find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \; &&\

build::
	for dir in services/*; do (cd "$dir" && npm i && npm run build); done

#TODO
test::
	echo env

push::
	docker build -t pioneer/pioneer-server:latest . &&\
	docker tag pioneer/pioneer-server:latest registry.digitalocean.com/pioneer/pioneer/pioneer-server:latest &&\
    docker push registry.digitalocean.com/pioneer/pioneer/pioneer-server:latest

up::
	node deploy/leeroy-sdk.js
