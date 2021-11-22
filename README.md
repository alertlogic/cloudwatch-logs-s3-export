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
Skip to the [Setup](#setup) section if you want to use pre-built Lambda package.
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
          
## Setup

### Supported AWS Regions
  Region Name             | Region           | CloudFormation Template
 -------------------------| -----------------| -----------------
 US East (N. Virginia)    | us-east-1        | https://s3.us-east-1.amazonaws.com/alertlogic-public-repo.us-east-1/templates/cwl-s3-export.template
 US East (Ohio)           | us-east-2        | https://s3.us-east-2.amazonaws.com/alertlogic-public-repo.us-east-2/templates/cwl-s3-export.template
 US West (N. California)  | us-west-1        | https://s3.us-west-1.amazonaws.com/alertlogic-public-repo.us-west-1/templates/cwl-s3-export.template
 US West (Oregon)         | us-west-2        | https://s3.us-west-2.amazonaws.com/alertlogic-public-repo.us-west-2/templates/cwl-s3-export.template
 EU (Ireland)			  | eu-west-1        | https://s3.eu-west-1.amazonaws.com/alertlogic-public-repo.eu-west-1/templates/cwl-s3-export.template
 EU (Frankfurt)           | eu-central-1     | https://s3.eu-central-1.amazonaws.com/alertlogic-public-repo.eu-central-1/templates/cwl-s3-export.template
 Asia Pacific (Tokyo)     | ap-northeast-1   | https://s3.ap-northeast-1.amazonaws.com/alertlogic-public-repo.ap-northeast-1/templates/cwl-s3-export.template
 Asia Pacific (Singapore) | ap-southeast-1   | https://s3.ap-southeast-1.amazonaws.com/alertlogic-public-repo.ap-southeast-1/templates/cwl-s3-export.template
 Asia Pacific (Sydney)    | ap-southeast-2   | https://s3.ap-southeast-2.amazonaws.com/alertlogic-public-repo.ap-southeast-2/templates/cwl-s3-export.template

 

The **Cloud Watch Logs Export To S3** utility is deployed via a CloudFormation Service using the template references in the Supported AWS Regions table. When setting up a new stack in AWS CloudFormation service, select 'Specify an Amazon S3 template URL' option and specify corresponding region's template. 

#### Supported CloudWatch Log formats
1. AWS VPC Flow Log
2. AWS Lambda
3. AWS IoT

#### Exporting AWS CloudWatch Logs To S3
1. Ensure that ***VPC Flow Logs*** is correctly enabled for your VPC and the logs are present in the Cloud Watch Logs.
2. Create an ***S3 bucket*** to send VPC Flow Logs into.
3. In AWS console, select ***CloudFormation*** Service and make sure to select correct deployment region.
4. Specify CloudFormation name.
5. Create new stack using the template references in ***Supported AWS Regions*** table.
6. Specify ***CloudWatch Log Group*** where your ***VPC Flog Logs*** are sent.
7. Choose Log Format.
8. Specify ***S3 Bucket*** to store ***VPC Flog Logs***.
9. Create ***CloudFormation*** stack.

-
    Note: Due to the eventual consistency nature of the AWS services, the
    CloudFormation creation may fail during creation of the Kinesis Event
    Stream Mapping. The problem is the CloudFormation service sees IAM
    Policy created while Kinesis service doesn't. If this happens, delete
    failed stack and re-run CloudFormation stack creation.


