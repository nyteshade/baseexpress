
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , path = require('path')
  , sass = require("node-sass")
  , isA = require('isa-lib')(global)
  , app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'html');
  app.engine('html', require('hbs').__express);
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(require('less-middleware')({ 
    src: '../less',
    dest: '/css',
    root: path.join(__dirname, 'public'),
    debug: false
  }));
  app.use(sass.middleware({
    src: '../sass',
    dest: '/css',
    root: path.join(__dirname, 'public'),
    debug: false
  }));
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', routes.index);

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

// Require the app.js in REPL to bootstrap the app in interactive mode
// > var app = require('./app.js');
module.exports = app;
