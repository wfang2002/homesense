Package.describe({
      summary: "Easily create charts with Highcharts."
});

Package.on_use(function (api) {
	api.use('jquery', 'client');
	//api.add_files('lib/jquery.1.9.1.min.js', 'client');
    api.add_files('lib/highstock.js', 'client');
    api.add_files('lib/highcharts-more.js', 'client');
    api.add_files('lib/modules/annotations.js', 'client');
    api.add_files('lib/modules/data.js', 'client');
});
