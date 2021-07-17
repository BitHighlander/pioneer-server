for dir in services/rest; do (cd "$dir" && npm i && npm run build); done
for dir in services/events/*; do (cd "$dir" && npm i && npm run build); done
for dir in services/ingesters/*; do (cd "$dir" && npm i && npm run build); done
