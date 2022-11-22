#!/bin/sh

# set -ex

REPO_HOST=${1:-localhost:6060}

./init.sh base osm-edge $REPO_HOST