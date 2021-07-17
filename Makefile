SHELL=/bin/bash

env=prod

.DEFAULT_GOAL := build

clean::
	find . -name "node_modules" -type d -prune -print | xargs du -chs && find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \; &&\

build::
	sh scripts/build.sh

#NOTE the tsoa server requires the swaggar doc to be in a spefic place
dev::
	pm2 start process.json && cd services/rest && npm run start

#TODO
test::
	echo $(env)

push::
	sh scripts/push-images-$(env).sh

up::
	cd deploy && npm i && node leeroy-sdk.js
