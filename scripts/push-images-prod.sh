#https://unix.stackexchange.com/questions/103920/parallelize-a-bash-for-loop
for dir in services/*/*; do (cd "$dir" && npm i && npm run docker:push:all) & done
wait
