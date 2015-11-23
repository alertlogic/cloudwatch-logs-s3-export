##Cloud Watch Logs Export via Kinesis and Lambda Project - Getting started  

##Mac OS X  Installation Requirements
*~ You must have installed XCode and accepted the licensing agreemment before continuing with this document ~*  

Install [Homebrew](http://brew.sh/)  
```$ ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"```  
*~ Homebrew allows us to easily install and manage packages with dependencies ~*  

Use [Homebrew](http://brew.sh/) to install [Node](http://nodejs.org/)  
```$ brew install node```  
*~ Javascript runtime required to run Lambda cli tools ~*  

###Linux Installation Requirements

Install [Node](http://nodejs.org/) latest Distribution from [Distributions](https://nodejs.org/dist/v4.1.1/)  
*~ Javascript runtime required to run Lambda cli tools ~*  

###Building the project

Clone this repository to somewhere under your home directory.  (we recommend ~/workspace)  
```$ git clone git@github.com:alertlogic/cloudwatch-logs-s3-export.git cloudwatch-logs-s3-export```  
```$ cd cloudwatch-log-s3-export```  

Execute the Lambda development environment installation script.  
```$ build/install.sh```

##Building for AWS
run ```npm run build``` to create a versioned, distributable zip artifact.  
This artifcat is properly packaged to upload directly to AWS Lambda and work with the default configuration.  
run ```npm run release``` to update the version  

    Note: Build process will prompt for aws credentials profile name in 
          order to upload generated lambda zip file to S3 for subsequent 
          deployment into S3.
    
```
