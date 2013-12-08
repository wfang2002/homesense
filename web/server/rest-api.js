

// Returns remote client IP Address
var getClientAddress = function (req) {
    return (req.headers['x-forwarded-for'] || '').split(',')[0]
        || req.connection.remoteAddress;
};

var defaultContentType = "application/json;charset=utf-8";

RESTstop.configure({use_auth: true});

RESTstop.add(
    '/api/test_results', 'GET', function () {
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

// Register mobile client devices
RESTstop.add(
    '/api/register_device', 'POST', function () {
        //logger.info("Request: ", this.request);
        var method = this.request.method;
        var header = this.request.header;
        var params = this.request.body;
        this.response.setHeader('Content-Type', defaultContentType);

        logger.info("Received request: ", this.request.url);
        logger.info("Received request body: %j", this.request.body);

        var app = cacheGet("Apps", params.app_id);
        if (app) {

            var fields = _.pick(params, 'user_id', 'api_key', 'udid',  'width', 'height', 'mac', 'model', 'os', 'push_token', 'prd');
            fields.owner = app.owner;

            if (fields.push_token) {
                //allow lowercase a-f, 0-9 only
                fields.push_token = fields.push_token.toLowerCase().replace(/[^a-f0-9]/ig, "");
            }

            var id = getHash(params.push_token + params.app_id);
            try {
                fields._id = id;
                fields.created = new Date();
                MobileDevices.insert(fields);

                logger.info("API finished");
                return EJSON.stringify({status:'ok', msg: 'device registered.'});
            } catch(e) {
                delete fields._id;
                delete fields.created;
                fields.updated = new Date();
                MobileDevices.update({_id:id}, {$set:fields});

                logger.info("API finished");
                return EJSON.stringify({status:'ok', msg: 'device updated.'});
            }
        }

        return EJSON.stringify({status:'error', error:'204', msg:"app_id not exists"});
    }
);


// Send error message for unknown api
RESTstop.add(
    '/api/*', 'GET', function () {
        return EJSON.stringify({status:'error', error:'204', msg:"api not exists"});
    }
);