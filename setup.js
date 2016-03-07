var async   = require('async'),
    AWS     = require('aws-sdk'),
    defenderApi = require('./utilities/defender_api_client.js');

exports.createSource = function(args, callback) {
    "use strict";
    var sourceName  = args.name,
        sourceType  = args.type,
        params  = {
            customerId: args.customerId,
            auth:       args.auth,
            args:       [
                { name: 'type', value: sourceType },
                { name: 'name', value: sourceName }
            ]
        };

    if (args.customerId === "" || args.auth === "") {
        return callback(null, {id: ""});
    }

    console.log("exports.createSource called with : '" + JSON.stringify(args) + "'");
    async.waterfall([
        function(asyncCallback) {
            var lifeCycleParams = {
                name: args.name + "-rule",
                bucket: args.s3.bucket
            };
            return updateBucketLifeCycle(lifeCycleParams, "add", asyncCallback);
        },
        function(result, asyncCallback) {
            defenderApi.getSource(params, function(err, result) {
                if (err) {
                    console.log("Failed to get S3 sources. Error: '" + JSON.stringify(err) + "'");
                    return asyncCallback(err);
                }
                var r = JSON.parse(result);
                if (r.sources.length) {
                    console.log("Source '" + sourceName + "' already exists.");
                    console.log("Source: " + JSON.stringify(r.sources[0], null, 3));
                    if (r.sources[0].hasOwnProperty(sourceType)) {
                        return asyncCallback(null, {id: r.sources[0][sourceType].id});
                    } else {
                        createSourceImpl(args, function(err, result) {
                            if (err) {
                                console.log("Failed to create source. Error: '" + JSON.stringify(err) + "'");
                                return asyncCallback(err);
                            }
                            console.log("Successfully created source. Result: '" + JSON.stringify(result) + "'");
                            return asyncCallback(null, result);
                        });
                    }
                } else {
                    return createSourceImpl(args, function(err, result) {
                        if (err) {
                            console.log("Failed to create source. Error: '" + JSON.stringify(err) + "'");
                            return asyncCallback(err);
                        }
                        console.log("Successfully created source. Result: '" + JSON.stringify(result) + "'");
                        return asyncCallback(null, result);
                    });
                }
            });
        }
    ], function(err, result) {
        return callback(err, result);
    });
};

exports.deleteSource = function(args, callback) {
    "use strict";
    var sourceName  = args.name,
        sourceType  = args.type,
        params  = {
            customerId: args.customerId,
            auth:       args.auth,
            args:       [
                { name: 'type', value: sourceType },
                { name: 'name', value: sourceName }
            ]
        };

    if (args.customerId === "" || args.auth === "") {
        return callback(null, {id: ""});
    }

    async.waterfall([
        function(asyncCallback) {
            var lifeCycleParams = {
                name: args.name + "-rule",
                bucket: args.s3.bucket
            };
            return updateBucketLifeCycle(lifeCycleParams, "remove", asyncCallback);
        },
        function(result, asyncCallback) {
            defenderApi.getSource(params, function(err, result) {
                if (err) {
                    console.log("Failed to get S3 sources. Error: '" + JSON.stringify(err) + "'");
                    return callback(err);
                }

                var r = JSON.parse(result);
                if (!r.sources.length) {
                    // The source doesn't exist
                    asyncCallback(null);
                }

                for (var i = 0; i < r.sources.length; i++) {
                    if (r.sources[0].hasOwnProperty(sourceType)) {
                        var source = r.sources[0][sourceType];
                        args['sourceId'] = source.id;
                        args['credentialId'] = source.credential_id;
                        args['policyId'] = source.policy_id;
                        return deleteSourceImpl(args, callback);
                    }
                }
                return asyncCallback(null); 
            });
        }
    ], function(err, result) {
        return callback(err, result);
    });
};

function createSourceImpl(args, resultCallback) {
    "use strict";
    console.log("Creating '" + args.name + "' source of '" + args.type + "' type.");
    var credentialId = "";
    async.waterfall([
        function creds(callback) {
            return getCredentials(args, true, callback);
        },
        function (id, callback) {
            credentialId = id;
            return getPolicy(args, true, callback);
        },
        function (policyId, callback) {
            return doCreateSource(args, credentialId, policyId, callback);
        }
    ], function(err, result) {
        return resultCallback(err, result);
    });
}

function deleteSourceImpl(args, resultCallback) {
    "use strict";
    console.log("Deleting '" + args.sourceId + "' source.");
    async.waterfall([
        function (callback) {
            return doDeleteSource(args, callback);
        },
        function (callback) {
            return deletePolicy(args, callback);
        },
        function (callback) {
            return deleteCredential(args, callback);
        }
    ], function(err) {
        return resultCallback(err, {id: args.sourceId});
    });
}

function getCredentials(args, createFlag, callback) {
    "use strict";
    var params = {
            customerId: args.customerId,
            auth:       args.auth,
            args:       [
                { name: 'type', value: args.credentials.type },
                { name: 'name', value: args.name }
            ]
        };

    defenderApi.getCredentials(params, function(err, result) {
        if (err) {
            return callback(err);
        }

        var r = JSON.parse(result);
        if (r.credentials.length) { 
            var id = r.credentials[0][args.credentials.type].id;
            console.log("CredentialId: " + id);
            return callback(null, id);
        } else if (!createFlag) {
            return callback({message: "Credentials object doesn't exist", code: 404});
        }
        return createCredentials(args, callback);
    });
}

function createCredentials(args, callback) {
    "use strict";
    var params = {
            customerId: args.customerId,
            auth:       args.auth,
            name:       args.name,
            credentials:    args.credentials
        };
    defenderApi.createCredentials(params, function(err, result) {
        if (err) {
            return callback(err);
        }
        var id = JSON.parse(result)[params.credentials.type].id;
        console.log("Created new credentials object: " + id);
        return callback(null, id);
    });
}

function deleteCredential(args, callback) {
    "use strict";
    var params = {
            customerId: args.customerId,
            auth:       args.auth,
            id:         args.credentialId
        };

    defenderApi.deleteCredential(params, function(err, result) {
        if (err) {
            console.log("Failed to delete credential '" + args.credentialId + "'. Error: " + JSON.stringify(err));
            return callback(err);
        }
        return callback(null);
    });
}

function getPolicy(args, createFlag, callback) {
    "use strict";
    var params = {
            customerId: args.customerId,
            auth:       args.auth,
            args:       [
                { name: 'type', value: args.type },
                { name: 'name', value: args.name }
            ]
        };

    defenderApi.getPolicy(params, function(err, result) {
        if (err) {
            return callback(err);
        }

        var r = JSON.parse(result);
        if (r.policies.length) { 
            var id = r.policies[0][args.type].id;
            console.log("Policy Id: " + id);
            return callback(null, id);
        } else if (!createFlag) {
            return callback({message: "Policy object doesn't exist", code: 404});
        }
        return createPolicy(args, callback);
    });
}

function createPolicy(args, callback) {
    "use strict";
    var params = (args.logFormat === "AWS VPC Flow Logs") ? {
            customerId: args.customerId,
            auth:       args.auth,
            name:       args.name,
            type:       args.type,
            policy: {
                default: "false",
                template_id:    "BFE6243E-E57C-4ADE-B444-C5999E8FE3A7"
            }
        } : {
            customerId: args.customerId,
            auth:       args.auth,
            name:       args.name,
            type:       args.type,
            policy:     args.policy
        };

    console.log("Creating policy document: %s", JSON.stringify(params));
    defenderApi.createPolicy(params, function(err, result) {
        if (err) {
            return callback(err);
        }
        var id = JSON.parse(result)[params.type].id;
        console.log("Created new Policy object: " + id);
        return callback(null, id);
    });
}

function deletePolicy(args, callback) {
    "use strict";
    var params = {
            customerId: args.customerId,
            auth:       args.auth,
            id:         args.policyId
        };

    defenderApi.deletePolicy(params, function(err, result) {
        if (err) {
            console.log("Failed to delete policy '" + args.policyId + "'. Error: " + JSON.stringify(err));
            return callback(err);
        }
        return callback(null);
    });
}

function doCreateSource(args, credentialId, policyId, callback) {
    "use strict";
    var params = {
            customerId:     args.customerId,
            auth:           args.auth,
            name:           args.name,
            credentialId:   credentialId,
            policyId:       policyId,
            type:           args.type,
            source:         args[args.type]
        };
    console.log("Creating source: %s", JSON.stringify(params));
    defenderApi.createSource(params, function(err, result) {
        if (err) {
            return callback(err);
        }
        var newSource = JSON.parse(result)[params.type];
        console.log("Created source object. Id: '" + newSource.id + "'");
        return callback(null, {id: newSource.id});
    });
}

function doDeleteSource(args, callback) {
    "use strict";
    var params = {
            customerId: args.customerId,
            auth:       args.auth,
            id:         args.sourceId
        };

    defenderApi.deleteSource(params, function(err, result) {
        if (err) {
            console.log("Failed to delete source '" + args.sourceId+ "'. Error: " + JSON.stringify(err));
            return callback(err);
        }
        return callback(null);
    });
}


function updateBucketLifeCycle(lifeCycleParams, operation, callback) {
    "use strict";
    console.log("updateBucketLifeCycle called... params: '%s', operation: '%s'", JSON.stringify(lifeCycleParams), operation);
    var index       = lifeCycleParams.bucket.indexOf('/'),
        bucketName  = lifeCycleParams.bucket.slice(0, index),
        prefix      = lifeCycleParams.bucket.slice(index + 1);

    var s3 = new AWS.S3();
    async.waterfall([
        function setupS3endpoint(asyncCallback) {
            s3.getBucketLocation({"Bucket": bucketName}, function(err, data) {
                if (err) {
                    console.log("Failed to get '" + bucketName + "' bucket location. " +
                                "Error: " + JSON.stringify(err));
                    return asyncCallback(err);
                }
                s3.endpoint = getS3Endpoint(data.LocationConstraint);
                console.log("Using '" + s3.endpoint + "' endpoint");
                return asyncCallback();
            }); 
        },
        function getS3Lifecycle(asyncCallback) {
            var params = {"Bucket": bucketName},
                lifeCycleRule = {
                    "Prefix": prefix,
                    "Status": "Enabled",
                    "Expiration": {"Days": "1"},
                    "ID": lifeCycleParams.name
                };

            s3.getBucketLifecycle(params, function(err, data) {
                if (err) {
                    if (err.code === "NoSuchLifecycleConfiguration") {
                        return (operation === "add") ? asyncCallback(null, [lifeCycleRule]) : asyncCallback(null, null);
                    }

                    console.log("Failed to get '" + bucketName + "' bucket lifecycle. " +
                                "Error: " + JSON.stringify(err));
                    return asyncCallback(err);
                }
                for (var i = 0; i < data.Rules.length; i++) {
                    var rule = data.Rules[i];
                    if (rule.Prefix === lifeCycleRule.Prefix) {
                        if (operation === "add") { 
                            return asyncCallback(null, data.Rules);
                        } else {
                            if (rule.ID === lifeCycleRule.ID) {
                                data.Rules.splice(i, 1);
                                return asyncCallback(null, data.Rules.length ? data.Rules : null);
                            } else {
                                return asyncCallback(null, data.Rules);
                            }
                        }
                    }
                }

                if (operation === "add") {
                    data.Rules.push(lifeCycleRule);
                    return asyncCallback(null, data.Rules);
                } else {
                    return asyncCallback(null, null);
                }
            });
        },
        function setupLifecycle(rules, asyncCallback) {
            if (!rules) {
                if (operation === "add") {
                    return asyncCallback();
                }
                s3.deleteBucketLifecycle({"Bucket": bucketName}, function(err, data) {
                    if (err) {
                        console.log("Failed to delete lifecycle configuration on '" + bucketName + "' bucket. " +
                                    "Error: " + JSON.stringify(err));
                        return asyncCallback(err);
                    }
                    console.log("Successfully deleted lifecycle configuration on '" + bucketName + "' bucket.");
                    return asyncCallback();
                });
            } else {
                var params = {
                    "Bucket": bucketName,
                    "LifecycleConfiguration": {"Rules": rules}
                };
                s3.putBucketLifecycleConfiguration(params, function(err, data) {
                    if (err) {
                        console.log("Operation '" + operation + "'. Failed to set '" + bucketName + "' bucket lifecycle. " +
                                    "Error: " + JSON.stringify(err));
                        return asyncCallback(err);
                    }
                    console.log("Successfully updated lifecycle configuration on '" + bucketName + "' bucket.");
                    return asyncCallback();
                });
            }
        }
    ], function(err, result) {
        return callback(err, result);
    });
}
function getS3Endpoint(region) {
    "use strict";
    if (!region || region === 'us-east-1' || region === '') {
            return 's3.amazonaws.com';
    }
    return 's3-' + region + '.amazonaws.com';
}
