
var Future = Npm.require("fibers/future");

var dbConn;
MongoDB.connect(process.env.MONGO_URL || "localhost:3000", function(err, db) {
    logger.info("insertGsFile: Connected to MongoDB");
    dbConn = db;
});

insertGsFile = function(params, cb) {
    var db = params.db || dbConn;
    var filename = params.filename.replace(/\\/g, '/');

    var gs = new MongoDB.GridStore(db, filename, 'w', {
        "content_type": params.type,
        "chunk_size": 1024*4
    });

    var fullname = params.path;

    gs.writeFile(fullname, function(err, doc) {
        if (err) {
            logger.error("Failed to write gs file: %s, error: ", fullname, err.toString());
            cb(err);
        } else {
            logger.debug("GridStore Write file done. %s", fullname);
            cb(0, doc);
            if (gs.close) gs.close();
        }
    })
}

insertGsFileSync = function(params) {
    var db = params.db || dbConn;
    var filename = params.filename.replace(/\\/g, '/');

    var gs = new MongoDB.GridStore(db, filename, 'w', {
        "content_type": params.type,
        "chunk_size": 1024*4
    });

    var fullname = params.path;

    var fut = new Future();
    gs.writeFile(fullname, function(err, doc) {
        if (err) {
            logger.error("Failed to write gs file: %s, error: ", fullname, err.toString());
            fut.return({error:err});
        } else {
            logger.debug("GridStore Write file done. %s", fullname);
            console.dir(doc.fileId);
            console.dir(doc);
            var result = {error:0, fileId: doc.fileId.toString(), filename: doc.filename};
            if (gs.close) gs.close();
            fut.return(result);
        }
    })

    return fut.wait();
}