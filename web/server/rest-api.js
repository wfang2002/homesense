

// Returns remote client IP Address
var getClientAddress = function (req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0]
        || req.connection.remoteAddress;
};

var defaultContentType = "application/json;charset=utf-8";

RESTstop.configure({use_auth: true, api_path:'/api'});

/*
    sign up from mobile terminal
    email and password are mandatory
 */
RESTstop.add(
    '/signup', 'POST', function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;

        var params = this.params;

        this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);
        logger.info("Received request params: %j", params);

        if (!params.email) {
            return EJSON.stringify({status:'error', error:1,  msg:"missing email"});
        }

        if (!params.password) {
            return EJSON.stringify({status:'error', error:2,  msg:"missing password"});
        }

        if (Meteor.users.findOne({username:params.email})) {
            return EJSON.stringify({status:'error', error:3,  msg:"email already exist"});
        }

        logger.info("Creating user: ", params.email);
        var result = Accounts.createUser({username: params.email, email:params.email, password:params.password,
            profile:{name:params.email, api_key:apiKeyGen(10), devices:[]}});

        logger.info("CreateUser finished: result=%s", result );

        var deviceIp = getClientAddress(this.request);
        return EJSON.stringify({status:'ok', ip:deviceIp});
    }
);


/*
    return all devices registered to current user
 */
RESTstop.add(
    '/mobile/devices', {require_login: true}, function () {
        //logger.info("Request: ", this.request);
        var perfStart = new Date();
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;
        var params = this.params;

        this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);
        logger.info("Received request body: %j", body);

        if (!this.user || !this.user.profile) {
            return EJSON.stringify({status:'error', error:1, msg:"internal error"});
        }

        console.log("user=", this.user);
        var deviceIds = this.user.profile.devices || [];

        console.log("deviceIds=", deviceIds);
        var devices = DeviceStock.find({_id:{$in:deviceIds}}).fetch();

        console.log("devices=", devices);
        return EJSON.stringify({status:'ok', devices:devices});

    }
);

/*
    Register a device from  mobile
    mandatory params: user_id, auth_token, sn
 */
RESTstop.add(
    '/mobile/register_device', 'POST', function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;
        this.response.setHeader('Content-Type', defaultContentType);

        var params = this.params;

        logger.info("Received request: ", this.request.url);
        logger.info("Received request params: %j", params);

        var devSn = params.sn;
        var apiToken = params.api_token;

        if (!devSn || !RemoteDevices.findOne({_id:devSn})) {
            return EJSON.stringify({status:'error', error:'204', msg:"sn not exists"});
        }

        if (!apiToken) {
            return EJSON.stringify({status:'reject', msg:"missing api token"});
        }

        var clientIp = getClientAddress(this.request);
        return EJSON.stringify({status:'ok', ip:clientIp});
    }
);

/*
    device reports data to server.
    mandatory params: sn
    optional params: api_token
 */
RESTstop.add(
    '/device/data', 'POST', function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;
        this.response.setHeader('Content-Type', defaultContentType);

        var params = this.params;

        logger.info("Received request: ", this.request.url);
        logger.info("Received request params: %j", params);

        var devSn = params.sn;
        var apiToken = params.api_token;

        if (!devSn || !RemoteDevices.findOne({_id:devSn})) {
            return EJSON.stringify({status:'error', error:'204', msg:"sn not exists"});
        }

        if (!apiToken) {
            return EJSON.stringify({status:'reject', msg:"missing api token"});
        }

        var clientIp = getClientAddress(this.request);

        return EJSON.stringify({status:'ok', ip:clientIp});
    }
);

RESTstop.add(
    '/device/ip_changed', 'POST', function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;

        var params = this.params;

        this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);
        logger.info("Received request params: %j", params);

        var deviceIp = getClientAddress(this.request);
        return EJSON.stringify({status:'ok', ip:deviceIp});
    }
);

RESTstop.add(
    '/history_data', ["POST", "GET"], function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;
        var clientIp = getClientAddress(this.request);

        this.response.setHeader('Content-Type', 'text/javascript');

        logger.info("Request method: ", method);
        logger.info("Request header: ", header);
        logger.info("Request query: ", query);
        logger.info("Received request: ", this.request.url);
        logger.info("Request body: ", body);

        var callback = query.callback;
        var points = query.points ? query.points.split(',') : [];
        var binaryPoints = query.binary_points ? query.binary_points.split(',') : [];
        var start = query.start || new Date(2014, 4, 1);
        var end = query.ed || new Date();

        var interval = '60';    // default hourly data
        if (end.getTime() - start.getTime() < 24*60*60000) interval = '5';  // 5 minute data

        var results = InputsAggregated.find({device_id:query.device_id || "unknown", type:interval, ts: {$gte:start.getTime(), $lte:end.getTime()}}).fetch();

        console.log("Found %s results", results.length);

        var rows = {};
        _.each(results, function(result) {
            // append binary points
            _.each(binaryPoints, function(pointIdx) {
                var key = '1' + pointIdx;
                if (!rows[key])rows[key] = [];
                rows[key].push('[' + result.ts + ',' + result.binary_points[pointIdx] + ']')
            }) 

            //append analog points
            _.each(points, function(pointIdx) {
                var key = '2' + pointIdx;   // add prefix '2' to avoid conflict with binary points
                if (!rows[key])rows[key] = [];
                rows[key].push('[' + result.ts + ',' + result.analog_points[pointIdx].avg.toFixed(1) + ']')
            }) 
        })

        var sRows = [];
        _.each(rows, function(row) {
            sRows.push('[' + row.join(',') + ']');
        })
        var response = callback + '([' + sRows.join(',') + ']);';

        console.log("Response=", response)

        if (query.pretty) {
            return JSON.stringify(response, null, 4);
        }

        //return EJSON.stringify(response);
        return response;
    }
);

RESTstop.add(
    '/echo', ["POST", "GET"], function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;
        var clientIp = getClientAddress(this.request);

        this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);

        var response = {};
        response.params = this.params;
        response.status = "ok";
        response.ip= clientIp;

        if (query.pretty) {
            return JSON.stringify(response, null, 4);
        }

        return EJSON.stringify(response);
    }
);

// Send error message for unknown api
RESTstop.add(
    '/*', 'GET', function () {
        return EJSON.stringify({status:'error', error:'204', msg:"api not exists"});
    }
);