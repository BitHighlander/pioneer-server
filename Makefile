SHELL=/bin/bash

env=prod
debug=false
coin=false

.DEFAULT_GOAL := build

clean::
	find . -name "node_modules" -type d -prune -print | xargs du -chs && find . -name 'node_modules' -type d -prune -print -exec rm -rf '{}' \; &&\
	sh scripts/clean.sh

build::
	cd services/rest && npm i && npm run build:all-$(env)

# push::
#     cd services/ingesters/pubkeys && npm i && npm run docker:push:all
#     cd services/rest && npm i && npm run docker:push:all

push::
#	cd services/ingesters/facts/intake && npm i && npm run docker:push:all
	cd services/rest && npm i && npm run docker:push:all

# push::
# 	cd services/rest && npm i && npm run docker:push:all & \
# # 	cd services/ingesters/facts/intake && npm i && npm run docker:push:all & \
# # 	cd services/events/ethereum/blocks && npm i && npm run docker:push:all & \
# # 	cd services/ingesters/pubkeys && npm i && npm run docker:push:all & \
# # 	cd services/ingesters/txs/high && npm i && npm run docker:push:all & \
# # 	cd services/ingesters/txs/low && npm i && npm run docker:push:all & \
# 	wait

## TODO start application
up::
	echo "todo"
