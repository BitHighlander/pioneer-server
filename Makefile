SHELL=/bin/bash

env=prod

.DEFAULT_GOAL := build

clean::
	find . -name "node_modules" -type d -prune -print | xargs du -chs && find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \; &&\

build::
	sh scripts/build.sh

#TODO
test::
	echo $(env)

push::
	sh scripts/push-images-$(env).sh

up::
	node deploy/leeroy-sdk.js
