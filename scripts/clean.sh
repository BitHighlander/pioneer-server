
find . -name 'node_modules' -type d -prune
for dir in modules/*; do (cd "$dir" && rm -rf dist .quasar node_modules package-lock.json); done
for dir in apps/*; do (cd "$dir" && rm -rf dist .quasar node_modules package-lock.json); done
for dir in modules/coins/*; do (cd "$dir" && rm -rf dist .quasar node_modules package-lock.json); done
for dir in modules/pioneer/*; do (cd "$dir" && rm -rf dist .quasar node_modules package-lock.json); done
for dir in modules/intergrations/*; do (cd "$dir" && rm -rf dist .quasar node_modules package-lock.json); done
for dir in modules/support/*; do (cd "$dir" && rm -rf dist .quasar node_modules package-lock.json); done
find . -name "node_modules" -exec rm -rf '{}' +; find . -name "package-lock.json" -exec rm -rf '{}' +;
find . -name "lib" -exec rm -rf '{}' +; rm -rf lib; find . -name "yarn-error.log" -exec rm -rf '{}' +;
find . -name "yarn.lock" -exec rm -rf '{}' +; find . -name ".idea" -exec rm -rf '{}' +;
