##Cloud Watch Logs Export To S3 via Kinesis and Lambda Project - Getting started  

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
Skip to the [Setup](#Setup) section if you want to use pre-built Lambda package.
#### Build process
Run ```npm run build``` to create a versioned, distributable zip artifact.  
This artifcat is properly packaged to upload directly to AWS Lambda and work with the default configuration.  
run ```npm run release``` to update the version  

    Note: Build process will prompt for aws credentials profile name in 
          order to upload generated lambda zip file to S3 for subsequent 
          deployment into S3.
          In order for the Lambda deployment to work, the package must
          exist in each region and therefore you will, currently, need to
          create 4 buckets in each supported region.
          
## Supported AWS regions
  Region Name             | Region 
 -------------------------| ------------- 
 US East (N. Virginia)    | us-east-1    
 US West (Oregon)         | us-west-2
 EU (Ireland)			  | eu-west-1
 Asia Pacific (Tokyo)     | ap-northeast-1 

### Setup
The **Cloud Watch Logs Export To S3** utility is deployed via a CloudFormation Service using the template located in ```configuration/cloudformation/cwl-s3-export.template``` file.

#### Exporting VPC Flow Logs To S3
1. Ensure that ***VPC Flow Logs*** is correctly enabled for your VPC and the logs are present in the Cloud Watch Logs.
2. Create an ***S3 bucket*** to send VPC Flow Logs into.
3. In AWS console, select ***CloudFormation*** Service and make sure to select correct deployment region.
4. Create new stack using the template stored ```configuration/cloudformation/cwl-s3-export.template```.
5. Specify ***CloudWatch Log Group*** where your ***VPC Flog Logs*** are sent.
6. Specify ***S3 Bucket*** to store ***VPC Flog Logs***.
7. Create ***CloudFormation*** stack.

-
    Note: Due to the eventual consistency nature of the AWS services, the CloudFormation creation may fail during creation of the Kinesis Event Stream Mapping. The problem is the CloudFormation service sees IAM Policy created while Kinesis service doesn't. If this happens, delete failed stack and re-run CloudFormation stack creation.


