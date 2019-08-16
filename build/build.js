/*
 * Build dependencies and configuration
 */
var async             = require('async'),
    fs                = require('fs'),
    glob              = require('glob-all'),
    mkdirp            = require('mkdirp'),
    path              = require('path'),
    uglifyjs          = require('uglify-js'),
    prompt            = require('prompt'),
    AWS               = require('aws-sdk'),
    pkg               = require('../package.json'),
    base              = pkg.folders.jsSource,
    deploy            = pkg.folders.build + pkg.name + '/',
    deploymentList    = [],
    accountList       = [],
    execfile          = require('child_process').execFile;

console.log('Building Lambda package to ' + deploy + ', base = ' + base);

/*
 * Source location mappings for glob
 */
var source = {
    "application": [
        base + '**/*.js',
        '!' + base + 'build/**',
        '!' + base + 'git-hooks/**',
        '!' + base + 'node_modules/**',
        '!' + base + 'target/**',
        '!' + base + 'utility/**',
        '!' + base + 'deployment/**',
        '!' + base + 'configuration/**'
    ],
    "config": [
        base + 'package.json'
    ]
};

var awsRegions      = ['us-east-1', 'us-east-2', 'us-west-1','us-west-2', 'eu-west-1', 'ap-northeast-1', 'ap-southeast-2', 'ap-southeast-1', 'eu-central-1'];

/*
 * Create the node_modules directory so that it exists for installation regardless of module definitions for deployment
 */
async.waterfall([
    function(callback) {
        mkdirp(deploy + 'node_modules/', function (err) {
            fs.createReadStream('./package.json').pipe(fs.createWriteStream('./target/cloudwatch-logs-s3-export/package.json'));
            execfile('npm', ['install', '--only=production', '--prefix', 'target/cloudwatch-logs-s3-export'], function(err, stdout) {
                if (err) {
                    console.log("npm install failed. Error: " + err);
                    return callback(err);
                } else {
                    return callback(null);
                }
            });
        });
    },
    function(callback) {
        /*
         * Execute glob based distribution of source files
         */
        async.each(Object.getOwnPropertyNames(source),
            function(section, eachCallback) {
                glob.sync(source[section]).forEach(function(item) {
                    mkdirp(path.dirname(item.replace(base, deploy)), function (err) {
                        if (err) {
                            console.log("Error: " + JSON.stringify(err));
                            return eachCallback(err);
                        } else {
                            var stream = fs.createReadStream(item).pipe(fs.createWriteStream(item.replace(base, deploy)));
                        }
                    }.bind({section: section}));
                });
                return eachCallback(null);
            },
            function(err) {
                return callback(null);
            }
        );
    },
    function(callback) {
        var updated    = false,
            properties = [],
            callback   = function() {},
            required   = {
                "api_url": ""
            };

        var fileName = 'cloudwatch-logs-s3-export-' + pkg.version + '.zip';
        var zipped  = '../' + fileName;
        process.chdir('target/cloudwatch-logs-s3-export');
        execfile('zip', ['-r', '-X', zipped, './'], function(err, stdout) {});
        process.chdir('../../');

        // Prompt for profile to use to deploy our package to S3
        var promptSchema = {
            properties: {
                profile: {
                    required: true
                },
                bucketPrefix: {
                    description: 'Provide backet name prefix to upload files. The region name will be appended to the name you provide.',
                    required: true,
                    default: 'alertlogic-public-repo'
                }
            }
        };

        prompt.start();
        prompt.get(promptSchema, function (err, input) {
            if (err) { return onErr(err); }

            var AWS             = new require('aws-sdk');
                credentials = new AWS.SharedIniFileCredentials({profile: input.profile});
                AWS.config.credentials = credentials;
            var s3 = new AWS.S3({'signatureVersion': 'v4'});

           code = require('fs').readFileSync(
                                    require('path').resolve(
                                        __dirname,
                                        '../target/' + fileName));
            
            async.eachSeries(awsRegions, function(region, seriesCallback) {
                var bucketName = input.bucketPrefix + "." + region;
                console.log("Uploading '" + fileName + "' to '" + bucketName + "' bucket.");
                s3.endpoint = getS3Endpoint(region);
                var params = {
                            "Bucket": bucketName,
                            "Key": fileName,
                            "Body": code,
                            "ContentType": "application/binary"
                        };
                s3.putObject(params, function(err, _result) {
                    if (err) {
                        console.log("Failed to persist '" + fileName + "' object to '" + bucketName +
                                    "' bucket. Error: " + JSON.stringify(err));
                        return seriesCallback(err);
                    } else {
                        console.log("Successfully persisted '" + fileName + "'.");
                        return seriesCallback(null);
                    }
                });
            },
            function(err) {
                if (err) {
                    console.log("Upload to S3 failed. Error: " + JSON.stringify(err));
                    return callback(err);
                } else {
                    console.log("Successfully uploaded to S3.");
                    // Update cloudformation with new default values
                    return updateCFTemplate(input.bucketPrefix, fileName, callback);
                }
            });
        });
    }],
    function (err) {
        return onErr(err)
    });

function updateCFTemplate(bucketPrefix, objectName, resultCallback) {
    "use strict";
    var jsonTemplateFile = "configuration/cloudformation/cwl-s3-export.template";
    console.log("Updating '" + jsonTemplateFile + "'.");
    async.waterfall([
        function(callback) {
            fs.readFile(jsonTemplateFile, { encoding: 'utf8' }, function (err, data) {
                if (err) {return callback(err);}
                // parse and return json to callback
                var json = JSON.parse(data);
                return callback(null, json);
            });
        },
        function(template, callback) {
            var modified = false;
            if (template.Parameters.LambdaS3BucketNamePrefix.Default !== bucketPrefix) {
                template.Parameters.LambdaS3BucketNamePrefix.Default = bucketPrefix;
                modified = true;
            }
            if (template.Parameters.LambdaPackageName.Default !== objectName) {
                template.Parameters.LambdaPackageName.Default = objectName;
                modified = true;
            }
            return callback(null, modified ? template : null);
        },
        function (template, callback) {
            if (template) {
                return fs.writeFile(jsonTemplateFile, JSON.stringify(template, null, 4), callback);
            } else {
                return callback(null);
            }
        }
    ], function (err) {
        return resultCallback(err);
    });
}

function onErr(err) {
    if (err !== null) {
        console.log(err);
        return 1;
    }
}

function getS3Endpoint(region) {
    "use strict";
    if (!region || region === 'us-east-1' || region === '') {
            return 's3.amazonaws.com';
    }
    return 's3-' + region + '.amazonaws.com';
}
