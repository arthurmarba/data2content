#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
exec ./node_modules/.bin/tsx --env-file=.env.local scripts/mcpAdminLocal.ts "$@"
