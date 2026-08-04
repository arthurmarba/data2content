#!/bin/sh

set -eu

if [ -x "/opt/homebrew/opt/node@24/bin/node" ]; then
  export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
fi

exec "$@"
