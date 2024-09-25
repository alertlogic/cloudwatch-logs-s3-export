var config = require('../config.js');
const baseSourceUrl = '/sources/v1/';
const sourcesEndPoint = '/sources';
const credentialsEndpoint = '/credentials';
const policiesEndpoint = '/policies';
exports.getSource = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + sourcesEndPoint;
    return await get(params.customerId, url, params.args, params.aims_access_key_id, params.aims_secret_key);
};

exports.getCredentials = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + credentialsEndpoint;
    return await get(params.customerId, url, params.args, params.aims_access_key_id, params.aims_secret_key);
};

exports.getPolicy = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + policiesEndpoint;
    return await get(params.customerId, url, params.args, params.aims_access_key_id, params.aims_secret_key);
};

exports.createCredentials = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + credentialsEndpoint;
    var payload = null;
    switch (params.credentials.type) {
        case 'iam_role':
            payload = {
                'credential': {
                    'type': params.credentials.type,
                    'name': params.name,
                    'iam_role': {
                        'arn': params.credentials.arn,
                        'external_id': params.credentials.externalId
                    }
                }
            };
            break;
        default:
            return "Unsupported credentials type specified.";
    }
    return await post(params.customerId, url, payload, params.aims_access_key_id, params.aims_secret_key);
};

exports.createPolicy = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + policiesEndpoint,
        payload = {};
    params.policy.default = toBoolean(params.policy.default);
    payload[params.type] = params.policy;
    payload['name'] = params.name;
    payload['type'] = params.type;
    if (params.policy.hasOwnProperty("multiline")) {
        params.policy.multiline.is_multiline = toBoolean(params.policy.multiline.is_multiline);
    }
    const newPayload = { "policy": Object.assign({}, payload) };
    return await post(params.customerId, url, newPayload, params.aims_access_key_id, params.aims_secret_key);
};

exports.createSource = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + sourcesEndPoint,
        payload = {},
        source = params.source;
    source.enabled = toBoolean(source.enabled);
    payload['source'] = source;
    return await post(params.customerId, url, payload, params.aims_access_key_id, params.aims_secret_key);
};

exports.deleteCredential = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + credentialsEndpoint + '/' + params.id;
    return await del(params.customerId, url, params.aims_access_key_id, params.aims_secret_key);
};

exports.deletePolicy = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + policiesEndpoint + '/' + params.id;
    return await del(params.customerId, url, params.aims_access_key_id, params.aims_secret_key);
};

exports.deleteSource = async function (params) {
    "use strict";
    var url = baseSourceUrl + params.customerId + sourcesEndPoint + '/' + params.id;
    return await del(params.customerId, url, params.aims_access_key_id, params.aims_secret_key);
};

async function get(customerId, url, args, aims_access_key_id, aims_secret_key) {
    "use strict";
    var https = require('https');
    try {
        const authToken = await getToken(config.ci_api_url, aims_access_key_id, aims_secret_key);
        const yardUrl = await getYardUrlEndPoint(customerId, config.ci_api_url, authToken);
        var options = {
            hostname: yardUrl,
            port: 443,
            path: url + getQueryString(args),
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'x-aims-auth-token': authToken
            }
        };

        return new Promise((resolve, reject) => {
            var apiGet = https.request(options, function (res) {
                var responseString = "";
                res.setEncoding('utf-8');
                res.on('data', function (data) {
                    responseString += data;
                });
                res.on('end', function () {
                    if (res.statusCode !== 200) {
                        console.log("Failed to execute GET for '" + url + "'. StatusCode: " + res.statusCode);
                        reject(errorFromResult(res));
                    } else {
                        resolve(responseString);
                    }
                });
            });

            apiGet.on('error', function (e) {
                console.log('problem with request: ' + e.message);
                reject(e);
            });

            apiGet.end();
        });
    } catch (e) {
        console.log('problem with request: ' + e.message);
        return e;
    }
}

async function post(customerId, url, payload, aims_access_key_id, aims_secret_key) {
    "use strict";
    var https = require('https'),
        data = JSON.stringify(payload);
    try {
        const authToken = await getToken(config.ci_api_url, aims_access_key_id, aims_secret_key);
        const yardUrl = await getYardUrlEndPoint(customerId, config.ci_api_url, authToken);

        var options = {
            hostname: yardUrl,
            port: 443,
            path: url,
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Length': data.length,
                'x-aims-auth-token': authToken
            }
        };
        return new Promise((resolve, reject) => {
            var apiPost = https.request(options, function (res) {
                var responseString = "";
                res.setEncoding('utf-8');
                res.on('data', function (data) {
                    responseString += data;
                });
                res.on('end', function () {
                    if (res.statusCode !== 201) {
                        console.log("Failed to execute POST for '" + url + "'. StatusCode: " + res.statusCode + ". Payload: '" + JSON.stringify(payload, null, 4) + "'." +
                            " Options: '" + JSON.stringify(options, null, 4) + "'.");
                        reject(errorFromResult(res));
                    } else {
                        resolve(responseString);
                    }
                });
            });

            apiPost.on('error', function (e) {
                console.log('problem with request: ' + e.message);
                reject(e);
            });

            apiPost.write(data);
            apiPost.end();
        });
    } catch (e) {
        console.log('problem with request: ' + e.message);
        return e;
    }
}

async function del(customerId, url, aims_access_key_id, aims_secret_key) {
    "use strict";
    var https = require('https');

    try {
        const authToken = await getToken(config.ci_api_url, aims_access_key_id, aims_secret_key);
        const yardUrl = await getYardUrlEndPoint(customerId, config.ci_api_url, authToken);
        var options = {
            hostname: yardUrl,
            port: 443,
            path: url,
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'x-aims-auth-token': authToken
            }
        };
        return new Promise((resolve, reject) => {
            var apiDel = https.request(options, function (res) {
                var responseString = "";
                res.setEncoding('utf-8');
                res.on('data', function (data) {
                    responseString += data;
                });
                res.on('end', function () {
                    if (res.statusCode !== 204) {
                        console.log("Failed to execute DELETE for '" + url + "'. StatusCode: " + res.statusCode + "." +
                            " Options: '" + JSON.stringify(options, null, 4) + "'.");
                        reject(errorFromResult(res));
                    } else {
                        resolve(responseString);
                    }
                });
            });

            apiDel.on('error', function (e) {
                reject(e);
            });

            apiDel.end();
        });
    } catch (e) {
        console.log('problem with del request: ' + e.message);
        return e;
    }
}

function getQueryString(args) {
    "use strict";
    if (!args.length) { return ''; }

    return '?' +
        args.map(function (obj) {
            return obj.name + '=' + obj.value;
        }).join('&');
}

function toBoolean(value) {
    "use strict";
    return (typeof value === "string") ? (value === "true") : value;
}

function errorFromResult(res) {
    "use strict";
    return { errorCode: res.statusCode, message: res.statusMessage };
}

async function getToken(hostname, accessKey, secretKey) {
    "use strict";
    var https = require('https');
    try {
        const credentials = `${accessKey}:${secretKey}`;
        const encodedCredentials = Buffer.from(credentials).toString('base64');
        const options = {
            hostname: hostname,
            port: 443,
            path: '/aims/v1/authenticate',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${encodedCredentials}`,
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options);

        req.write('{}');

        return new Promise((resolve, reject) => {
            let data = '';
            req.on('response', (res) => {
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(data).authentication.token);
                    } else {
                        reject(new Error(`Error getting token: ${res.statusCode}: ${res.statusMessage}`));
                    }
                });
            });
            req.on('error', (e) => {
                reject(new Error(`Error getting token: ${e.message}`));
            });
            req.end();
        });
    } catch (error) {
        return error;
    }
}

async function getYardUrlEndPoint(customerId, url, authToken) {
    "use strict";
    var https = require('https');
    try {
        var options = {
            hostname: `${config.ci_api_url}`,
            port: 443,
            path: `/endpoints/v1/${customerId}/residency/default/services/yard/endpoint`,
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'x-aims-auth-token': authToken
            }
        };

        const req = https.request(options);

        req.write('{}');

        return new Promise((resolve, reject) => {
            let responseString = '';
            req.on('response', (res) => {
                res.setEncoding('utf-8');
                res.on('data', (data) => {
                    responseString += data;
                });
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        console.log("Failed to execute GET for '" + url + "'. StatusCode: " + res.statusCode);
                        reject(errorFromResult(res));
                    } else {
                        resolve(JSON.parse(responseString).yard);
                    }
                });
            });
            req.on('error', (e) => {
                console.log('problem with yard endpoint request: ' + e);
                reject(e);
            });
            req.end();
        });
    } catch (e) {
        console.log('problem with yard endpoint reques' + e.message);
        return e;
    }
}