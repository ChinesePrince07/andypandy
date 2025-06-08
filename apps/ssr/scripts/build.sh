#!/bin/bash
set -e
cd ../web
pnpm build
cp -r dist ../ssr/public
cd ../ssr
mv ./public/index.html ./src/index.html
pnpm build:jpg
pnpm build
