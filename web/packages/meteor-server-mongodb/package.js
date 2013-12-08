Package.describe({
    summary: "Mongodb driver"
});

Npm.depends({'mongodb':"1.2.14"});

Package.on_use(function (api) {
    api.add_files('lib.js', 'server');
    api.export("MongoDB", 'server');
});