var config        = require('../config.js');
exports.getSource = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/sources';
    get(url, params.args, params.auth, callback);
};

exports.getCredentials = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/credentials';
    get(url, params.args, params.auth, callback);
};

exports.getPolicy = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/policies';
    get(url, params.args, params.auth, callback);
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
    post(url, payload, params.auth, callback);
};

exports.createPolicy = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/policies/' + params.type,
        payload = {};
    params.policy.default = toBoolean(params.policy.default);
    params.policy.multiline.is_multiline = toBoolean(params.policy.multiline.is_multiline);
   
    payload[params.type] = params.policy;
    payload[params.type]['name'] = params.name;
    console.log("Create Policy object: " + JSON.stringify(payload));
    post(url, payload, params.auth, callback); 
};

exports.createSource = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/sources/' + params.type,
        payload = {};
    params.source.enabled = toBoolean(params.source.enabled);
    
    if (params.source.hasOwnProperty('max_collection_interval')) {
        params.source.max_collection_interval = toInteger(params.source.max_collection_interval);
    }

    payload[params.type] = params.source;
    payload[params.type]['name'] = params.name;
    payload[params.type]['credential_id'] = params.credentialId;
    payload[params.type]['policy_id'] = params.policyId;
    post(url, payload, params.auth, callback); 
};

exports.deleteCredential = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/credentials/' + params.id;
    del(url, params.auth, callback);
};

exports.deletePolicy = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/policies/' + params.id;
    del(url, params.auth, callback);
};

exports.deleteSource = function(params, callback) {
    "use strict";
    var url = '/api/lm/v1/' + params.customerId + '/sources/' + params.id;
    del(url, params.auth, callback);
};



function get(url, args, auth, callback) {
    "use strict";
    var https   = require('https'),
        options = {
            hostname:   config.api_url,
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

function post(url, payload, auth, callback) {
    "use strict";
    var https   = require('https'),
        data    = JSON.stringify(payload),
        options = {
            hostname:   config.api_url,
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

function del(url, auth, callback) {
    "use strict";
    var https   = require('https'),
        options = {
            hostname:   config.api_url,
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

function toInteger(value) {
    "use strict";
    value = (value === "string") ? parseInt(value, 10) : value;

}

function errorFromResult(res) {
    "use strict";
    return {errorCode: res.statusCode, message: res.statusMessage};
}
