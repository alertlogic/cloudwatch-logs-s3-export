#!/bin/bash

# Iterate up the directory structure until we find the root of the ci_lambda_checks repo that we are being executed within
while [[ $PWD != '/' && ! ( -f "$PWD/package.json" && -f "$PWD/index.js" ) ]]; do
    if [[ -d .git && -f .git/ozone-link ]]
    then
        cd $(<.git/ozone-link)
    else
        cd ..
    fi
done

if [ $PWD = '/' ]
then
    echo "The root of the current Lambda repository could not be found: \033[1;31mABORTING\033[0m (make sure you run npm hookmeup)"
    echo "Evaluated from this path: $WHERE_AM_I"
    exit 1
fi

if [ ! -f package.json ]
then
    echo "The root of your Lambda repository does not actually appear to be an Lambda repository: \033[1;31mABORTING\033[0m"
    echo "Using Lambda root $PWD derived from origin path $WHERE_AM_I"
    exit 1
fi

echo "=================================================================="
echo "Installing git hooks to Lambda repository at \033[1;36m$PWD\033[0m..."
echo "=================================================================="

cp git-hooks/pre-push .git/hooks/
echo "Lambda.................. installed"
