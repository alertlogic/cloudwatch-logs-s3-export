var async   = require('async'),
    zlib    = require('zlib'),
    AWS     = require('aws-sdk');

exports.handler = function(args, context) {
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
            return context.done(err);
        }
    );
};

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
            return uploadData(data, args.awsRegion, args.s3BucketName, s3, resultCallback);
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
            case "Amazon VPC Flow Logs":
                logEvents.forEach(function (log) {
                    // Get the timestamp for the beginning of the captured window 
                    var timestamp = log.message.split(' ')[10];
                    logs = logs + "VPC Flow Log Record: " + timestamp + " " + log.message + "\n";
                });
                break;
            default:
                console.log("Unsupported '" + logFormat + "' log format.");
                break;
        }
        return callback(null, logs);
    });
}

function uploadData(data, awsRegion, s3BucketName, s3, callback) {
    "use strict";
    if (!data || !data.length) { return callback(); }

    zlib.gzip(data, function (err, compressedData) {
        if (err) {
            console.log("Failed to compress data. LogGroup: '" + data.logGroup +
                        "'. Error: " + JSON.stringify(err));
            return callback();
        }
        
        var now = new Date(),
            time_string = now.getFullYear() +
                '-' +
                now.getMonth() + '-' +
                now.getDate() + '-' +
                now.getHours() + '-' +
                now.getMinutes() + '-' +
                now.getSeconds(),
            objectName = awsRegion + "_vpc_flow_logs_" +
                Math.random().toString(36).substr(2, 4) + "_" + time_string + ".json.gz", 
            params = {
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
