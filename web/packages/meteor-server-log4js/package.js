Package.describe({
    summary: "A port of log4js to node.js."
});

Npm.depends({'log4js':'0.6.7'});

Package.on_use(function (api) {
    api.add_files([
        'log4js.js'
    ], 'server');
    api.export('logger', 'server');
});