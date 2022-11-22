#!/bin/sh

# set -ex

SVC=$1
REPO_HOST=${2:-localhost:6060}

REPOS=`curl -s $REPO_HOST/api/v1/repo | grep $SVC | awk -F/ '{print $2"/"$3}'`

for repo in $REPOS
do 
  ./init.sh $SVC $repo $REPO_HOST
done
