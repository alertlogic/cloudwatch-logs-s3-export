#!/bin/bash

# Set up term colors
blue='\033[1;36m'
green='\033[1;32m'
red='\033[0;31m'
white='\033[1;37m'
yellow='\033[1;33m'
NC='\033[0m' # No Color

BASE_DIR=`pwd`

# Find out where we launched from.
echo -e "${white}Installing Lambda Workspace.${NC}"
START_DIR=`pwd`

BREW=`which brew`
NODE=`which node`
if [ -z $NODE ]
    then
        echo -e "${yellow}NodeJS not found.${NC}"
        if [ -z $BREW ]
            then
                echo -e "${red}Installation can not continue.${NC}"
                exit 1
            else
                echo -e "${blue}Installing NodeJS${NC}"
                brew install node
        fi
    else
        echo -e "${blue}Found NodeJS at $NODE${NC}"
fi

# Find Lambda installation so we can make sure we are at it's root.
OZONE_DIR=`find $BASE_DIR -name cloudwatch-logs-s3-export | grep -v .Trash`
if [ -z $OZONE_DIR ]
    then
        echo -e "${red}Lambda not found, can not continue.${NC}"
        exit 1
    else
        echo -e "${blue}Found Lambda at $OZONE_DIR${NC}"
fi

# Remove any existing modules, this may be a reinstall.
echo -e "${yellow}Removing legacy node modules.${NC}"
cd $OZONE_DIR
rm -Rf ~/.npm
rm -Rf node_modules

# Install base Lambda development environment requires.
echo -e "${white}Installing Lambda Dependencies.${NC}"
cd $OZONE_DIR
npm install -g n

# Run npm install to get final dependencies and execute postinstall scripts.
echo -e "${white}Installing NPM dependencies.${NC}"
cd $OZONE_DIR
npm install

# Execute copying of githooks to all checkouts.
echo -e "${yellow}Adding GIT pre-push hooks to all projects.${NC}"
cd $OZONE_DIR
npm run hookmeup

# Return to where the user executed this script from.
cd $START_DIR
echo -e "${green}Lambda Workspace Installation Complete!${NC}"
exit 0
