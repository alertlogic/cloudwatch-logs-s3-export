var config        = require('../config.js');
exports.getSource = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/sources';
    get(params.customerId, url, params.args, params.auth, callback);
};

exports.getCredentials = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/credentials';
    get(params.customerId, url, params.args, params.auth, callback);
};

exports.getPolicy = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/policies';
    get(params.customerId, url, params.args, params.auth, callback);
};

exports.createCredentials = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/credentials/' + params.credentials.type;
    var payload = null;
    switch (params.credentials.type) {
        case 'iam_role':
            payload = {
                'iam_role': {
                    'name':         params.name,
                    'arn':          params.credentials.arn,
                    'external_id':  params.credentials.externalId
                }
            };
            break;
        default:
            return callback({message: "Unsupported credentials type specified."});
    }
    post(params.customerId, url, payload, params.auth, callback);
};

exports.createPolicy = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/policies/' + params.type,
        payload = {};
    params.policy.default = toBoolean(params.policy.default);
    payload[params.type] = params.policy;
    payload[params.type]['name'] = params.name;
    if (params.policy.hasOwnProperty("multiline")) {
        params.policy.multiline.is_multiline = toBoolean(params.policy.multiline.is_multiline);
    }
   
    console.log("Create Policy object: " + JSON.stringify(payload));
    post(params.customerId, url, payload, params.auth, callback);
};

exports.createSource = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/sources/' + params.type,
        payload = {},
        source = params.source;
    source.enabled = toBoolean(source.enabled);
    
    if (source.hasOwnProperty('max_collection_interval')) {
        source.max_collection_interval = Number(source.max_collection_interval);
    } else {
        params.source['max_collection_interval'] = 300;
    }

    payload[params.type] = source;
    payload[params.type]['name'] = params.name;
    payload[params.type]['credential_id'] = params.credentialId;
    payload[params.type]['policy_id'] = params.policyId;

    post(params.customerId, url, payload, params.auth, callback);
};

exports.deleteCredential = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/credentials/' + params.id;
    del(params.customerId, url, params.auth, callback);
};

exports.deletePolicy = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/policies/' + params.id;
    del(params.customerId, url, params.auth, callback);
};

exports.deleteSource = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/sources/' + params.id;
    del(params.customerId, url, params.auth, callback);
};

function get(customerId, url, args, auth, callback) {
    "use strict";
    var https   = require('https'),
        options = {
            hostname:   getCustomerHost(customerId),
            port:       443,
            path:       url + getQueryString(args),
            method:     'GET',
            auth:       auth,
            headers: {
                'Accept': 'application/json'
            }
        };

    var apiGet = https.request(options, function(res){
        var responseString = "";
        res.setEncoding('utf-8');
        res.on('data', function(data) {
            responseString += data;
        });
        res.on('end', function() {
            if(res.statusCode !== 200) {
                console.log("Failed to execute GET for '" + url + "'. StatusCode: " + res.statusCode);
                return callback(errorFromResult(res));
            }
            return callback(null, responseString);
        });
    });

    apiGet.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        return callback(e);
    });

    apiGet.end();
}

function post(customerId, url, payload, auth, callback) {
    "use strict";
    var https   = require('https'),
        data    = JSON.stringify(payload),
        options = {
            hostname:   getCustomerHost(customerId),
            port:       443,
            path:       url,
            method:     'POST',
            auth:       auth,
            headers: {
                'Accept': 'application/json',
                'Content-Length': data.length
            }
        };

    var apiPost = https.request(options, function(res){
        var responseString = "";
        res.setEncoding('utf-8');
        res.on('data', function(data) {
            responseString += data;
        });
        res.on('end', function() {
            if(res.statusCode !== 201) {
                console.log("Failed to execute POST for '" + url + "'. StatusCode: " + res.statusCode + ". Payload: '" + JSON.stringify(payload, null, 4) + "'." +
                            " Options: '" + JSON.stringify(options, null, 4) + "'.");
                return callback(errorFromResult(res));
            }
            return callback(null, responseString);
        });
    });

    apiPost.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        return callback(e);
    });
    
    apiPost.write(data);
    apiPost.end();
}

function del(customerId, url, auth, callback) {
    "use strict";
    var https   = require('https'),
        options = {
            hostname:   getCustomerHost(customerId),
            port:       443,
            path:       url,
            method:     'DELETE',
            auth:       auth,
            headers: {
                'Accept': 'application/json'
            }
        };
    var apiDel = https.request(options, function(res){
        var responseString = "";
        res.setEncoding('utf-8');
        res.on('data', function(data) {
            responseString += data;
        });
        res.on('end', function() {
            if(res.statusCode !== 204) {
                console.log("Failed to execute DELETE for '" + url + "'. StatusCode: " + res.statusCode + "." +
                            " Options: '" + JSON.stringify(options, null, 4) + "'.");
                return callback(errorFromResult(res));
            }
            return callback(null, responseString);
        });
    });

    apiDel.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        return callback(e);
    });
    
    apiDel.end();
}

function getCustomerHost(customerId) {
    "use strict";
    for (var region in config.api_url) {
        if (config.api_url[region].hasOwnProperty('start') && config.api_url[region].hasOwnProperty('end') && config.api_url[region].hasOwnProperty('url')) {
            var startIndex = config.api_url[region].start,
                endIndex   = config.api_url[region].end;
            if (customerId >= startIndex && customerId <= endIndex) {
                return config.api_url[region].url;
            }
        }
    }
    return null;
}

function getQueryString(args) {
    "use strict";
    if (!args.length) {return '';}

    return '?' +
        args.map(function(obj) {
            return obj.name + '=' + obj.value;
        }).join('&');
}

function toBoolean(value) {
    "use strict";
    return (typeof value === "string") ? (value === "true") : value;
}

function errorFromResult(res) {
    "use strict";
    return {errorCode: res.statusCode, message: res.statusMessage};
}
