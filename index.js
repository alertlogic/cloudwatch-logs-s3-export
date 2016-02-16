var async   = require('async'),
    zlib    = require('zlib'),
    AWS     = require('aws-sdk'),
    setup   = require('./setup.js');

exports.handler = function(args, context) {
    "use strict";
    var callback = function(err, result) {
        if (err) {
            console.log("'" + args.operation + "' failed. Error: " + JSON.stringify(err));
            return context.fail(JSON.stringify(err));
        }
        console.log("Returning: " + JSON.stringify(result));
        return context.succeed(result);
    };

    switch (args.operation) {
        case 'processLogs':
            return handleProcessLogs(args.data, callback);
        case 'createSource':
            return setup.createSource(args.data, callback);
        case 'deleteSource':
            return setup.deleteSource(args.data, callback);
        default:
            return context.fail("Unsupported operation: '" + args.operation + "'.");
    }
};

function handleProcessLogs(args, resultCallback) {
    "use strict";
    var s3 = new AWS.S3();
    async.waterfall([
        function setupS3endpoint(callback) {
            s3.getBucketLocation({"Bucket": args.s3BucketName}, function(err, data) {
                if (err) {
                    console.log("Failed to get '" + args.s3BucketName + "' bucket location. " +
                                "Error: " + JSON.stringify(err));
                    return callback(err);
                }
                s3.endpoint = getS3Endpoint(data.LocationConstraint);
                console.log("Using '" + s3.endpoint + "' endpoint");
                return callback();
            }); 
        },
        function (callback) {
            processLogs(args, s3, callback);
        }
        ],
        function done(err) {
            resultCallback(err);
        }
    );
}

function processLogs(args, s3, resultCallback) {
    "use strict";
    console.log("Processing '" + args.records.length + "' records.");
    async.map(args.records, function(record, callback) {
            return getMessages(args.logFormat, record, callback);
        },
        function done(err, results) {
            if (err) { return resultCallback(err); }
            var data = "";
            for (var i = 0; i < results.length; i++) {
                data += results[i]; 
            }
            var objectName = getObjectName(args.awsRegion, args.s3LogFilePrefix, args.logFormat);
            return uploadData(data, args.awsRegion, args.s3BucketName, objectName, s3, resultCallback);
        }
    ); 
}

function getMessages(logFormat, record, callback) {
    "use strict";
    zlib.gunzip(new Buffer(record.kinesis.data, 'base64'), function(err, result) {
        if (err) {
            console.log("Failed to uncompress data. Record: '" + JSON.stringify(record) +
                        "'. Error: " + JSON.stringify(err));
            return callback();
        }

        var data = JSON.parse(result.toString('ascii'));
        if (!data.hasOwnProperty("messageType") || data.messageType !== "DATA_MESSAGE") {
            console.log("Invalid message received. Skip processing. messageType: " + result.messageType);
            return callback();
        }

        var logEvents   = data.logEvents,
            logs        = "";

        switch(logFormat) {
            case "AWS VPC Flow Logs":
                logEvents.forEach(function (log) {
                    // Get the timestamp for the beginning of the captured window 
                    var timestamp = log.message.split(' ')[10];
                    logs = logs + "VPC Flow Log Record: " + timestamp + " " + log.message + "\n";
                });
                break;
            case "AWS Lambda":
                logEvents.forEach(function (log) {
                    // Get the timestamp for the beginning of the captured window 
                    var date = new Date(log.timestamp);  
                    logs = logs + "Lambda Log Record: [" + date.toISOString() + "] - " + log.message + "\n\n";
                });
                break;
            default:
                console.log("Unsupported '" + logFormat + "' log format.");
                break;
        }
        return callback(null, logs);
    });
}

function uploadData(data, awsRegion, s3BucketName, objectName, s3, callback) {
    "use strict";
    if (!data || !data.length) { return callback(); }

    zlib.gzip(data, function (err, compressedData) {
        if (err) {
            console.log("Failed to compress data. LogGroup: '" + data.logGroup +
                        "'. Error: " + JSON.stringify(err));
            return callback();
        }
        
        var params = {
                "Bucket": s3BucketName,
                "Key": objectName,
                "Body": new Buffer(compressedData, 'base64'),
                "ContentType": "application/json",
                "ContentEncoding": "gzip" 
            };
        s3.putObject(params, function(err, _result) {
            if (err) {
                console.log("Failed to persist '" + objectName + "' object to '" + s3BucketName + "' bucket. " +
                            "Error: " + JSON.stringify(err));
            } else {
                console.log("Successfully persisted '" + getObjectUrl(objectName, s3BucketName) + "'.");
            }
            return callback(err);
        });
    });
}

function getObjectName(awsRegion, s3LogFilePrefix, logFormat) {
    "use strict";
    var now = new Date(),
        time_string = now.getFullYear() +
            '-' +
            now.getMonth() + '-' +
            now.getDate() + '-' +
            now.getHours() + '-' +
            now.getMinutes() + '-' +
            now.getSeconds(),
        prefix = "";

    switch(logFormat) {
        case "AWS VPC Flow Logs":
            prefix = (s3LogFilePrefix === "" ? "" : s3LogFilePrefix) + awsRegion + "_vpc_flow_logs_";
            break;

        case "AWS Lambda":
            prefix = (s3LogFilePrefix === "" ? "" : s3LogFilePrefix) + awsRegion + "_lambda_logs_";
            break;

        default:
            return null;
    }
    return prefix + Math.random().toString(36).substr(2, 4) + "_" + time_string + ".json.gz";
}

function getS3Endpoint(region) {
    "use strict";
    if (!region || region === 'us-east-1' || region === '') {
            return 's3.amazonaws.com';
    }
    return 's3-' + region + '.amazonaws.com';
}

function getObjectUrl(objectName, s3BucketName) {
    "use strict";
    return "https://s3.amazonaws.com/" + s3BucketName + "/" + objectName;
}
