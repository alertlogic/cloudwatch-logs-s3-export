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
        '!' + base + 'deployment/**'
    ],
    "config": [
        base + 'package.json'
    ]
};

var awsRegions      = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-northeast-1'];

/*
 * Create the node_modules directory so that it exists for installation regardless of module definitions for deployment
 */
async.waterfall([
    function(callback) {
        mkdirp(deploy + 'node_modules/', function (err) {
            if (err) {
                return callback(err);
            }
            execfile('npm', ['install', '--production', '--prefix', 'target/cloudwatch-logs-s3-export', './'], function(err, stdout) {
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
                switch (section) {
                    default:
                        glob.sync(source[section]).forEach(function(item) {
                            console.log("Making " + path.dirname(item.replace(base, deploy)));
                            mkdirp(path.dirname(item.replace(base, deploy)), function (err) {
                                if (err) {
                                    console.log("Error: " + JSON.stringify(err));
                                    return eachCallback(err);
                                } else {
                                    switch (this.section) {
                                        case 'application':
                                            var minified = uglifyjs.minify(item, {mangle: false});
                                            fs.writeFile(item.replace(base, deploy), minified.code.replace('release.version', pkg.version));
                                            break;
                                        default:
                                            fs.createReadStream(item).pipe(fs.createWriteStream(item.replace(base, deploy)));
                                            break;
                                    }
                                    return eachCallback(null);
                                }
                            }.bind({section: section}));
                        });
                        break;
                }
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
        console.log("fileName: " + fileName + ", zipped: " + zipped);
        process.chdir('target/cloudwatch-logs-s3-export');
        execfile('zip', ['-r', '-X', zipped, './'], function(err, stdout) {});
        process.chdir('../../');

        // Prompt for profile to use to deploy our package to S3
        var promptSchema = {
            properties: {
                profile: {
                    required: true
                },
                bucket: {
                    description: 'Provide backet name prefix to upload ' + fileName + '. The region name will be appended to the name you provide.',
                    required: true,
                    default: 'alertlogic-public-repo',
                    before: function(value) { return awsRegions.map(function(region) { return {regionName: region, bucketName: value + '.' + region}; }); }
                }
            }
        };

        prompt.start();
        prompt.get(promptSchema, function (err, input) {
            if (err) { return onErr(err); }

            var AWS             = new require('aws-sdk');
                credentials = new AWS.SharedIniFileCredentials({profile: input.profile});
                code = require('fs').readFileSync(
                                        require('path').resolve(
                                            __dirname,
                                            '../target/' + fileName));
                AWS.config.credentials = credentials;
                var s3 = new AWS.S3();
            
            async.eachSeries(input.bucket, function(bucket, seriesCallback) {
                console.log("Uploading '" + fileName + "' to '" + bucket.bucketName + "' bucket.");
                s3.endpoint = getS3Endpoint(bucket.regionName);
                var params = {
                            "Bucket": bucket.bucketName,
                            "Key": fileName,
                            "Body": code,
                            "ContentType": "application/binary"
                        };
                s3.putObject(params, function(err, _result) {
                    if (err) {
                        console.log("Failed to persist '" + fileName + "' object to '" + bucket.bucketName + "' bucket. " +
                                    "Error: " + JSON.stringify(err));
                    } else {
                        console.log("Successfully persisted '" + fileName + "'.");
                    }
                    return seriesCallback(err);
                });
            },
            function(err) {
                if (err) {
                    console.log("Upload to S3 failed. Error: " + JSON.stringify(err));
                    return callback(err);
                } else {
                    console.log("Successfully uploaded to S3.");
                    return callback(null);
                }
            });
        });
    }],
    function (err) {
        return onErr(err)
    });

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
