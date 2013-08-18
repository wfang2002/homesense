var path = Npm.require('path');
var Future = Npm.require('fibers/future');

aggregateEnabler = function() {

    var aggregate = function(pipeline) {
        var self = this;

        var future = new Future;
        self.find()._mongo.db.createCollection(self._name, function (err, collection) {
            if (err) {
                future.throw(err);
                return;
            }
            collection.aggregate(pipeline, function(err, result) {
                if (err) {
                    future.throw(err);
                    return;
                }
                future.ret([true, result]);
            });
        });
        var result = future.wait();
        if (!result[0])
            throw result[1];

        return result[1];
    };

    //Enable aggregate
    MotionSensorEvents.aggregate = aggregate;
    ComfortSensorData.aggregate = aggregate;

}