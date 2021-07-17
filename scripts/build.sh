for dir in services/*; do (cd "$dir" && npm i && npm run build); done
for dir in services/*/*; do (cd "$dir" && npm i && npm run build); done
