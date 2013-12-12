var request = require('request'),
    assert = require('assert');

describe('Device API', function(){
    describe('POST /api/device/data', function(){
        it("should respond with status 200", function(done){
            request.post('http://localhost:3000/api/device/data?api_token=kdhds&sn=22345', {form:{sn:'11345'}}, function(err,resp,body){
                assert.equal(resp.statusCode, 200);
                done();
            });
        });
        it("should respond with sn not exist", function(done){
            request.post('http://localhost:3000/api/device/data?api_token=kdhds', function(err,resp,body){
                assert.equal(resp.statusCode, 200);
                var body = JSON.parse(resp.body);

                console.log(body);
                assert.equal(body.status, "error");
                assert.equal(body.error, "204");
                assert.equal(body.msg, "sn not exists");
                done();
            });
        });
        it("should respond with status 200", function(done){
            request.post('http://localhost:3000/api/device/data?api_token=kdhds&sn=22345', {form:{sn:'11345'}}, function(err,resp,body){
                assert.equal(resp.statusCode, 200);
                done();
            });
        });
    });
});