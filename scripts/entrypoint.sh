#!/bin/sh
set -e

echo "Generating prisma schemes..."
npx prisma generate

echo "Running prisma migrations..."
npx prisma migrate deploy

echo "Starting app..."
exec node dist/index.js

