

// Returns remote client IP Address
var getClientAddress = function (req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0]
        || req.connection.remoteAddress;
};

var defaultContentType = "application/json;charset=utf-8";

RESTstop.configure({use_auth: true, api_path:'/api'});

RESTstop.add(
    '/test_results', 'GET', function () {
        //logger.info("Request: ", this.request);
        var perfStart = new Date();
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
		this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);

        var response = {status:'ok'};

        var page = (query.page > 0) ? query.page : 1;
        var page_size = (query.page_size > 0) ? query.page_size : 10;
        var since = query.since;

        var querySelector = {};
        var queryOptions = {sort:{ts_end:-1}, limit:page_size, skip:(page - 1) * page_size};

        if (since) {

            var d = new Date(since);
            logger.info("Finds test result since: ", d);
            querySelector = {ts_end:{$gt: d.getTime()}};
        }

        var testResults = TAFTestPackageLogs.find(querySelector, queryOptions).fetch();

        response.count = testResults.length;
        response.results = testResults;

        // add performance data for debugging
        var perfEnd = new Date();
        var duration = perfEnd - perfStart;
        response.perf = duration;

        logger.info("API finished");
        if (query.pretty) {
            return JSON.stringify(response, null, 4);
        }
        return EJSON.stringify(response);

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

        // extend params from url and body
        var params = query;
        params = _.extend(params, body);

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

        // extend params from url and body
        var params = query;
        params = _.extend(params, body);

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

        // extend params from url and body
        var params = query;
        params = _.extend(params, body);

        this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);
        logger.info("Received request params: %j", params);

        var deviceIp = getClientAddress(this.request);
        return EJSON.stringify({status:'ok', ip:deviceIp});
    }
);

RESTstop.add(
    '/echo', 'GET', function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var query = this.request.query;
        var body = this.request.body;
        var clientIp = getClientAddress(this.request);

        this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);

        var response = {};
        response.query = query;
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