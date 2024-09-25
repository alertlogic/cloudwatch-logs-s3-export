var defenderApi = require('./utilities/ci_yard_api_client.js'),
    { S3Client,
        GetBucketLocationCommand,
        GetBucketLifecycleConfigurationCommand,
        PutBucketLifecycleConfigurationCommand,
        DeleteBucketLifecycleCommand
    } = require('@aws-sdk/client-s3');

exports.createSource = async function (args) {
    "use strict";
    var sourceName = args.name,
        sourceType = args.type,
        params = {
            customerId: args.customerId,
            aims_access_key_id: args.aims_access_key_id,
            aims_secret_key: args.aims_secret_key,
            args: [
                { name: 'source.config.collection_type', value: sourceType },
                { name: 'name', value: sourceName }
            ]
        };

    if (args.customerId === "" || args.aims_access_key_id === "" || args.aims_secret_key === "") {
        return { id: "" };
    }

    try {
        const lifeCycleParams = {
            name: args.name + "-rule",
            bucket: args.s3.bucket
        };
        await updateBucketLifeCycle(lifeCycleParams, "add");

        const result = await defenderApi.getSource(params);
        const r = JSON.parse(result);

        if (r.sources.length) {
            console.log("Source '" + sourceName + "' already exists.");
            console.log("Source: " + JSON.stringify(r.sources[0], null, 2));
            if (r.sources[0]['source']['config']['collection_type'] === sourceType) {
                return { id: r.sources[0]['source'].id };
            } else {
                return await createSourceImpl(args);
            }
        } else {
            return await createSourceImpl(args);
        }
    } catch (err) {
        console.log("Failed to create source. Error: '" + JSON.stringify(err) + "'");
        return err;
    }
};
exports.deleteSource = async function (args) {
    "use strict";
    var sourceName = args.name,
        sourceType = args.type,
        params = {
            customerId: args.customerId,
            aims_access_key_id: args.aims_access_key_id,
            aims_secret_key: args.aims_secret_key,
            args: [
                { name: 'source.config.collection_type', value: sourceType },
                { name: 'name', value: sourceName }
            ]
        };

    if (args.customerId === "" || args.aims_access_key_id === "" || args.aims_secret_key === "") {
        return { id: "" };
    }

    try {
        var lifeCycleParams = {
            name: args.name + "-rule",
            bucket: args.s3.bucket
        };
        await updateBucketLifeCycle(lifeCycleParams, "remove");

        const result = await defenderApi.getSource(params);

        var r = JSON.parse(result);
        if (!r.sources.length) {
            return { id: "" };
        }

        for (var i = 0; i < r.sources.length; i++) {
            if (r.sources[0]['source']['config']['collection_type'] === sourceType) {
                var source = r.sources[0]['source'];
                args['sourceId'] = source.id;
                args['credentialId'] = source.config.s3.credential.id;
                args['policyId'] = source.config.policy.id;
                return await deleteSourceImpl(args);
            }
        }

        return { id: "" };
    } catch (err) {
        console.log("Error in deleteSource operation. Error: " + JSON.stringify(err));
        return err;
    }
};

async function createSourceImpl(args) {
    "use strict";
    console.log("Creating '" + args.name + "' source of '" + args.type + "' type.");
    try {
        const credentialId = await getCredentials(args, true);
        const policyId = await getPolicy(args, true);
        const result = await doCreateSource(args, credentialId, policyId);
        console.log("Successfully created source. Result: '" + JSON.stringify(result) + "'");
        return result;
    } catch (err) {
        console.log("Error creating source: " + JSON.stringify(err));
        return err;
    }
}

async function deleteSourceImpl(args) {
    "use strict";
    console.log("Deleting '" + args.sourceId + "' source.");
    try {
        await doDeleteSource(args);
        await deletePolicy(args);
        await deleteCredential(args);
        return { id: args.sourceId };
    } catch (err) {
        console.log("Error deleting source: " + JSON.stringify(err));
        return err;
    }
}

async function getCredentials(args, createFlag) {
    "use strict";
    var params = {
        customerId: args.customerId,
        aims_access_key_id: args.aims_access_key_id,
        aims_secret_key: args.aims_secret_key,
        args: [
            { name: 'type', value: args.credentials.type },
            { name: 'name', value: args.name }
        ]
    };

    try {
        const result = await defenderApi.getCredentials(params);
        var r = JSON.parse(result);
        if (r.credentials.length) {
            var id = r.credentials[0]['credential'].id;
            console.log("CredentialId: " + id);
            return id;
        } else if (!createFlag) {
            return { message: "Credentials object doesn't exist", code: 404 };
        }
        return await createCredentials(args);
    } catch (err) {
        console.log("Error getting credentials: " + JSON.stringify(err));
        return err;
    }
}

async function createCredentials(args) {
    "use strict";
    var params = {
        customerId: args.customerId,
        aims_access_key_id: args.aims_access_key_id,
        aims_secret_key: args.aims_secret_key,
        name: args.name,
        credentials: args.credentials
    };

    try {
        const result = await defenderApi.createCredentials(params);
        var id = JSON.parse(result)['credential'].id;
        console.log("Created new credentials object: " + id);
        return id;
    } catch (err) {
        console.log("Error creating credentials: " + JSON.stringify(err));
        return err;
    }
}

async function deleteCredential(args) {
    "use strict";
    var params = {
        customerId: args.customerId,
        aims_access_key_id: args.aims_access_key_id,
        aims_secret_key: args.aims_secret_key,
        id: args.credentialId
    };

    try {
        await defenderApi.deleteCredential(params);
    } catch (err) {
        console.log("Failed to delete credential '" + args.credentialId + "'. Error: " + JSON.stringify(err));
        return err;
    }
}

async function getPolicy(args, createFlag) {
    "use strict";
    var params = {
        customerId: args.customerId,
        aims_access_key_id: args.aims_access_key_id,
        aims_secret_key: args.aims_secret_key,
        args: [
            { name: 'type', value: args.type },
            { name: 'name', value: args.name }
        ]
    };

    try {
        const result = await defenderApi.getPolicy(params);
        var r = JSON.parse(result);
        if (r.policies.length) {
            var id = r.policies[0]['policy'].id;
            console.log("Policy Id: " + id);
            return id;
        } else if (!createFlag) {
            return { message: "Policy object doesn't exist", code: 404 };
        }
        return await createPolicy(args);
    } catch (err) {
        console.log("Error getting policy: " + JSON.stringify(err));
        return err;
    }
}

async function createPolicy(args) {
    "use strict";
    var params = {};

    switch (args.logFormat) {
        case "AWS VPC Flow Logs":
            params = {
                customerId: args.customerId,
                aims_access_key_id: args.aims_access_key_id,
                aims_secret_key: args.aims_secret_key,
                name: args.name,
                type: args.type,
                template_id: "BFE6243E-E57C-4ADE-B444-C5999E8FE3A7",
                policy: {
                    default: "false"
                }
            };
            break;
        case "AWS IoT":
            params = {
                customerId: args.customerId,
                aims_access_key_id: args.aims_access_key_id,
                aims_secret_key: args.aims_secret_key,
                name: args.name,
                type: args.type,
                policy: {
                    default: "false",
                    timestamp: {
                        format: "YYYY-MM-DD hh:mm:ss"
                    },
                    multiline: {
                        is_multiline: "false"
                    }
                }
            };
            break;
        default:
            params = {
                customerId: args.customerId,
                aims_access_key_id: args.aims_access_key_id,
                aims_secret_key: args.aims_secret_key,
                name: args.name,
                type: args.type,
                policy: args.policy
            };
    }

    console.log("Creating policy document: %s", JSON.stringify(params));
    try {
        const result = await defenderApi.createPolicy(params);
        var id = JSON.parse(result)['policy'].id;
        console.log("Created new policy object: " + id);
        return id;
    } catch (err) {
        console.log("Error creating policy: " + JSON.stringify(err));
        return err;
    }
}

async function deletePolicy(args) {
    "use strict";
    var params = {
        customerId: args.customerId,
        aims_access_key_id: args.aims_access_key_id,
        aims_secret_key: args.aims_secret_key,
        id: args.policyId
    };

    try {
        await defenderApi.deletePolicy(params);
    } catch (err) {
        console.log("Failed to delete policy '" + args.policyId + "'. Error: " + JSON.stringify(err));
        return err;
    }
}

async function doCreateSource(args, credentialId, policyId) {
    "use strict";
    var params = {
        customerId: args.customerId,
        aims_access_key_id: args.aims_access_key_id,
        aims_secret_key: args.aims_secret_key,
        name: args.name,
        type: args.type,
        source: {
            config: {
                time_zone: args[args.type]['time_zone'],
                collection_method: "api",
                collection_type: args.type,
                [args.type]: {
                    bucket: args[args.type]['bucket'],
                    max_collection_interval: args[args.type]['max_collection_interval'] ? Number(args[args.type]['max_collection_interval']) : 300,
                    file_pattern: args[args.type]['file_pattern'],
                    credential: {
                        id: credentialId
                    }
                },
                policy: {
                    id: policyId
                }
            },
            enabled: args[args.type]['enabled'],
            name: args.name,
            product_type: "lm",
            type: "api"
        }
    };
    console.log("Creating source: %s", JSON.stringify(params));
    try {
        const result = await defenderApi.createSource(params);
        var newSource = JSON.parse(result).source;
        console.log("Created source object. Id: '" + newSource.id + "'");
        return { id: newSource.id };
    } catch (err) {
        console.log("Error creating source: " + JSON.stringify(err));
        return err;
    }
}

async function doDeleteSource(args) {
    "use strict";
    var params = {
        customerId: args.customerId,
        aims_access_key_id: args.aims_access_key_id,
        aims_secret_key: args.aims_secret_key,
        id: args.sourceId
    };

    try {
        await defenderApi.deleteSource(params);
    } catch (err) {
        console.log("Failed to delete source '" + args.sourceId + "'. Error: " + JSON.stringify(err));
        return err;
    }
}
async function updateBucketLifeCycle(lifeCycleParams, operation) {
    "use strict";
    console.log("updateBucketLifeCycle called... params: '%s', operation: '%s'", JSON.stringify(lifeCycleParams), operation);
    var index = lifeCycleParams.bucket.indexOf('/'),
        bucketName = lifeCycleParams.bucket.slice(0, index),
        prefix = lifeCycleParams.bucket.slice(index + 1);

    var s3 = new S3Client({ region: lifeCycleParams.region });
    try {
        await setupS3endpoint();
        const rules = await getS3Lifecycle();
        await setupLifecycle(rules);
    } catch (err) {
        return err;
    }

    async function setupS3endpoint() {
        try {
            const data = await s3.send(new GetBucketLocationCommand({ "Bucket": bucketName }));
            s3.config.endpoint = `https://${getS3Endpoint(data.LocationConstraint)}`;
            console.log("Using '" + s3.config.endpoint + "' endpoint");
        } catch (err) {
            console.log("Failed to get '" + bucketName + "' bucket location. " +
                "Error: " + JSON.stringify(err));
            return err;
        }
    }

    async function getS3Lifecycle() {
        var params = { "Bucket": bucketName },
            lifeCycleRule = {
                "Prefix": prefix,
                "Status": "Enabled",
                "Expiration": { "Days": 1 },
                "ID": lifeCycleParams.name
            };

        try {
            const data = await s3.send(new GetBucketLifecycleConfigurationCommand(params));
            for (var i = 0; i < data.Rules.length; i++) {
                var rule = data.Rules[i];
                if (rule.Prefix === lifeCycleRule.Prefix) {
                    if (operation === "add") {
                        return data.Rules;
                    } else {
                        if (rule.ID === lifeCycleRule.ID) {
                            data.Rules.splice(i, 1);
                            return data.Rules.length ? data.Rules : null;
                        } else {
                            return data.Rules;
                        }
                    }
                }
            }
            if (operation === "add") {
                data.Rules.push(lifeCycleRule);
                return data.Rules;
            } else {
                return null;
            }
        } catch (err) {
            if (err.name === "NoSuchLifecycleConfiguration") {
                return (operation === "add") ? [lifeCycleRule] : null;
            }
            console.log("Failed to get '" + bucketName + "' bucket lifecycle. " +
                "Error: " + JSON.stringify(err));
            return err;
        }
    }

    async function setupLifecycle(rules) {
        if (!rules) {
            if (operation === "add") {
                return;
            }
            try {
                await s3.send(new DeleteBucketLifecycleCommand({ "Bucket": bucketName }));
                console.log("Successfully deleted lifecycle configuration on '" + bucketName + "' bucket.");
            } catch (err) {
                console.log("Failed to delete lifecycle configuration on '" + bucketName + "' bucket. " +
                    "Error: " + JSON.stringify(err));
                return err;
            }
        } else {
            var params = {
                "Bucket": bucketName,
                "LifecycleConfiguration": { "Rules": rules }
            };
            try {
                await s3.send(new PutBucketLifecycleConfigurationCommand(params));
                console.log("Successfully updated lifecycle configuration on '" + bucketName + "' bucket.");
            } catch (err) {
                console.log("Operation '" + operation + "'. Failed to set '" + bucketName + "' bucket lifecycle. " +
                    "Error: " + JSON.stringify(err));
                return err;
            }
        }
    }
}

function getS3Endpoint(region) {
    "use strict";
    if (!region || region === 'us-east-1' || region === '') {
        return 's3.amazonaws.com';
    }
    return 's3-' + region + '.amazonaws.com';
}