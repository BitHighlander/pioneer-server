for dir in services/*; do (cd "$dir" && npm i && npm run build:all-stage); done
