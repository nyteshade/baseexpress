
/**
 * Module dependencies.
 */

global.dir = function(o,print) {
  var a=require('util').inspect(o,{colors:true});
  if(print) 
    console.log(a); 
  else 
    return a;
};

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , sass = require("node-sass")
  , isA = require('isa-lib')(global)
  , app = express()
  , fs = require('fs')
  , path = require('path')
  , ROOT = path.dirname(__filename)
  , combiner = require('./middleware/combiner.js')({
      root: path.join(ROOT, 'public'),
      jsRoot: path.join(ROOT, 'public', 'js'),
      cssRoot: path.join(ROOT, 'public', 'css'),
      env: app.get('env'),
      express: app,
      log: false
    })
  , lessMiddleware = require('less-middleware')({ 
      src: '../less',
      dest: '/css',
      root: path.join(__dirname, 'public'),
      debug: false
    })
  , sassMiddleware = sass.middleware({
      src: '../sass',
      dest: '/css',
      root: path.join(__dirname, 'public'),
      debug: false
    });

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'html');
  app.set('root', path.resolve(__dirname));
  app.engine('html', require('hbs').__express);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(lessMiddleware);
  app.use(sassMiddleware);
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', combiner.PageNameCombiner, routes.index);
app.get('/testMongo', combiner.PageNameCombiner.bind({url: '/'}), routes.testMongo);

// By binding an object that specifies 'url', the PageNameCombiner
// can be coerced into sharing JS and CSS of a differently named
// page. / == 'index' as far as page names for CSS and JS go. 
app.get('/name/:name/gender/:gender', combiner.PageNameCombiner.bind({
  url: '/'
}), routes.index);

combiner.handleScriptAndStyle(app);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
  console.log("\x1b[33m" + app.get('env') + "\x1b[0m mode");
});

// Require the app.js in REPL to bootstrap the app in interactive mode
// > var app = require('./app.js');
module.exports = app;
