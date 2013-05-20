/**
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Express' });
};

exports.index_packages = function(req, res, next) {
  var combiner = require('js-combiner')({
    files: [
      '/q.js',
      '/jquery-1.9.1.js',
      '/bootstrap.min.js',
      '/isA.js'
    ],
    minify: false,
    log: true,
    packedSuffix: 'packed',
    folder: '/public/js',
    cwd: req.app.get('root'),
    outputName: 'combined'
  });

  combiner.promise.done(function() {
    next();
  });
}