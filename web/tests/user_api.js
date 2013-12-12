var request = require('request'),
    assert = require('assert');

var userId, loginToken;

describe('User API', function(){
    describe('POST /api/user/signup', function(){
        it("should return error code 1", function(done){
            request.post('http://localhost:3000/api/signup', {form:{password:"changeme"}}, function(err,resp,body){

                var body = JSON.parse(resp.body);
                assert.equal(body.status, "error");
                assert.equal(body.error, "1");
                done();
            });
        });
        it("should return error code 2", function(done){
            request.post('http://localhost:3000/api/signup', {form:{email:"test@test.com"}}, function(err,resp,body){
                assert.equal(resp.statusCode, 200);
                var body = JSON.parse(resp.body);
                assert.equal(body.status, "error");
                assert.equal(body.error, "2");
                done();
            });
        });

        it("should return error code 3", function(done){
            request.post('http://localhost:3000/api/signup', {form:{email:"test@test.com", password:"changeme"}}, function(err,resp,body){
                assert.equal(resp.statusCode, 200);
                var body = JSON.parse(resp.body);
                assert.equal(body.status, "error");
                assert.equal(body.error, "3");
                done();
            });
        });

        it("log in shall return auth token", function(done){
            request.post('http://localhost:3000/api/login', {form:{user:"test@test.com", password:"changeme"}}, function(err,resp,body){
                assert.equal(resp.statusCode, 200);
                var body = JSON.parse(resp.body);
                console.log(body);
                assert.equal(body.success, true);
                assert.equal(!!body.loginToken, true);
                userId = body.userId;
                loginToken = body.loginToken;
                done();
            });
        });

        it("shall return 404 if loginToken not provided", function(done){
            request.get('http://localhost:3000/api/mobile/devices?userId=' + userId, function(err,resp,body){
                assert.equal(resp.statusCode, 403);
                done();
            });
        });

        it("shall return ok", function(done){
            request.get('http://localhost:3000/api/mobile/devices?userId=' + userId + '&loginToken=' + loginToken, function(err,resp,body){
                assert.equal(resp.statusCode, 200);
                var body = JSON.parse(resp.body);
                assert.equal(body.status, "ok");
                done();
            });
        });
    });
});