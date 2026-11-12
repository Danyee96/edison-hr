#!/bin/sh
set -eu

# The Laravel checkout must be a sibling of public_html named edison-hrm.
APP_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
DOMAIN_DIR=$(dirname "$APP_DIR")
PUBLIC_DIR="$DOMAIN_DIR/public_html"

if [ "$(basename "$APP_DIR")" != "edison-hrm" ]; then
    echo 'Expected the project directory to be named edison-hrm.' >&2
    exit 1
fi
if [ ! -f "$APP_DIR/public/build/manifest.json" ] || [ ! -f "$APP_DIR/vendor/autoload.php" ]; then
    echo 'Install Composer dependencies and build frontend assets before publishing.' >&2
    exit 1
fi
if [ -e "$PUBLIC_DIR/index.php" ] && ! grep -q 'edison-hrm/public/index.php' "$PUBLIC_DIR/index.php"; then
    echo 'public_html/index.php already exists and is not the Edison entry point; move it aside before proceeding.' >&2
    exit 1
fi
if [ -e "$PUBLIC_DIR/storage" ] && [ ! -L "$PUBLIC_DIR/storage" ]; then
    echo 'public_html/storage exists and is not a symlink; inspect it before proceeding.' >&2
    exit 1
fi
mkdir -p "$PUBLIC_DIR"
rsync -a --exclude='/index.php' --exclude='/hot' --exclude='/storage' "$APP_DIR/public/" "$PUBLIC_DIR/"
cp "$APP_DIR/deploy/hostinger/index.php" "$PUBLIC_DIR/index.php"
if [ ! -e "$PUBLIC_DIR/storage" ] && [ ! -L "$PUBLIC_DIR/storage" ]; then
    ln -s "$APP_DIR/storage/app/public" "$PUBLIC_DIR/storage"
fi
echo 'Public assets published. Existing unrelated public_html files were left in place.'
