#!/bin/sh

set -eu

if [ -x "/opt/homebrew/opt/node@20/bin/node" ]; then
  export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
fi

exec "$@"
