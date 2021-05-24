for dir in services/*; do (cd "$dir" && npm i && npm run docker:push:all) & done
wait
