#verbose
cd services/rest && npm i && npm run build; cd ../..;
cd services/ingesters/pubkeys && npm i && npm run build; cd ../../..;
cd services/ingesters/txs/high && npm i && npm run build; cd ../../../..;
cd services/ingesters/txs/low && npm i && npm run build; cd ../../../..;

#iterate
#for dir in services/rest; do (cd "$dir" && npm i && npm run build); done
#for dir in services/events/ethereum/*; do (cd "$dir" && npm i && npm run build); done
#for dir in services/ingesters/*; do (cd "$dir" && npm i && npm run build); done
