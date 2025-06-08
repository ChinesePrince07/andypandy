#!/bin/bash
set -e
cd ../web
pnpm build

rm -rf ../ssr/public
cp -r dist ../ssr/public
cd ../ssr
mv ./public/index.html ./src/index.html
pnpm build:jpg
pnpm build:next
