var G = (typeof global != 'undefined') ? global : window,
    Q = require('q'),
    request = require('request'),
    fs = require('fs'),
    pth = require('path'),
    URL = require('url'),
    log = G.console && G.console.log || function(){},
    err = G.console && G.console.error || log,
    isA = function(o) {return "[object Array]" === ({}).toString.call(o)},
    isO = function(o) {return "[object Object]" === ({}).toString.call(o)},
    isS = function(o) {return "[object String]" === ({}).toString.call(o)},
    jQuery = require('jquery'),
    moduleState = {},
    root = '',
    jsRoot = '',
    cssRoot = '';

/**
 * TODO comment
 */
function Combiner(files, config) {
  config = jQuery.extend({}, Combiner.DEFAULTS, isO(files) ? files : config || {});
  if (isO(files) && files.files) {
    files = isA(config.files) && config.files || [];
  }

  if (!config.type && files && files.length) {
    config.type = pth.extname(files[0]);
  }

  config.output = config.output.replace(pth.extname(config.output), '')
      + config.suffix + (config.type || Combiner.JS);

  this.ROOTS = isA(config.roots) && config.roots || [];
  this.type = config.type || Combiner.JS;
  this.files = isA(files) && files || [];
  this.requirements = [];
  this.cache = {};
  this.config = config;

  if (!this.ROOTS.length) {
    this.ROOTS = Combiner.getRootsForType(this.type);
  }
}

Combiner.prototype = {
  /** 
   * JavaScript root directory. All JavaScript should be in one
   * of the directories this array contains.
   */
  ROOTS: null,

  /** The extension of file to process for this combiner action (w/dot) */
  type: null,

  /** Known files required to include (in order) */
  files: null,

  /** Requirements for the files loaded. */
  requirements: null,

  /** Already read */
  cache: null,

  /** Flag denoting whether or not a readFiles() call is executing */
  isReading: false,

  /** Reading state; some variables to access state between nested calls */
  readState: null,

  go: function(files, dest) {
    this.readFiles(files || this.files);
    this.writeOutput(this.cache.output, dest);
    return this;
  },

  readFiles: function(files, cache) {
    // log('\x1b[34mreadFiles():%s\x1b[0m', new Error().stack);

    var soFar = "", 
        self = this, 
        thisPass = [],
        reqs = [],
        express = moduleState.express || null,
        host = express && express.locals.settings.host || 'localhost',
        port = String(express && express.locals.settings.port || 80),
        rootUri = self.type === Combiner.JS ? moduleState.jsRootUri :
            moduleState.cssRootUri,
        index, path, stat, defer, uri, url, result, reqsPass, isForReqs;

    files = files || self.files || [];
    cache = cache || self.cache || {};

    if ((isForReqs = arguments.length < 2)) {
      cache['output'] = "";
      self.files = files;
      self.requirements = [];
    }

    this.ROOTS.forEach(function(root, rootIndex, roots) {
      log('\x1b[31mROOTS[%s,%d]\x1b[0m', root, rootIndex);
      files.forEach(function(file, fileIndex) {
        path = pth.join(pth.resolve(root), file);
        log('\x1b[32mFILES[%s,%s]\x1b[0m', path, fileIndex);
        uri = pth.join(rootUri, file);
        url = URL.format({
          protocol: 'http:',
          hostname: host,
          pathname: uri,
          search: '?skipCombiner=true',
          port: port
        });        
        defer = Q.defer();
        reqsDefer = Q.defer();

        if (isForReqs) {
          self.requirements.push(uri);
        }

        (function(path, uri, url, defer, reqsDefer, fileIndex, rootUri) {
          if (cache[uri]) {
            log('\x1b[1mCACHED\x1b[0m %s', uri);
            defer.resolve({
              path: path, 
              body: cache[uri].content,
              error: null,
              index: fileIndex,
              reqs: reqsDefer.promise
            });
          }
          else {
            jQuery.ajax({
              url:url, 
              success: function(body, status, xhr) {
                log('\x1b[1mGOT\x1b[0m %s', uri);
                defer.resolve({
                  path: path, 
                  body: body,
                  error: null,
                  index: fileIndex
                });
              },
              error: function(xhr, status, error) {
                defer.resolve({
                  path: path,
                  body: status,
                  error: error,
                  index: fileIndex
                });
              },
              complete: function(xhr, status) {}
            }); 
          }       
          
          defer.promise.done(function(pack) {
            var body = pack.body, path = pack.path, error = pack.error, z;

            if (!error) {
              cache[uri] = pack;

              reqs = Combiner.getRequired(cache[uri].body);
              log('\x1b[36mREQS[%s]: %s\x1b[0m', file, reqs);
              if (reqs.length) {
                reqsPass = self.readFiles(reqs, cache).items;
                reqsPass.push(defer.promise);
                reqsDefer.resolve(reqsPass);
                self.requirements = self.requirements.concat(reqs);
                thisPass = thisPass.concat(reqsPass);
              }
              else {
                reqsDefer.resolve(defer.promise);
              }
            }
          });
          thisPass.push(reqsDefer.promise);
       }(path, uri, url, defer, reqsDefer, fileIndex, rootUri));

      });
    });

    result = Q.allResolved(thisPass);
    result.items = thisPass;    
    result.defer = Q.defer();
    result.output = result.defer.promise;

    if (arguments.length < 2) {      
      result.then(function(groups) {
        log('\x1b[91mGROUPS:\x1b[0m %s', groups);
        groups.forEach(function(group, index) {
          var file;
          if (isA(group.valueOf())) {
            log('\x1b[92m  GROUP:\x1b[0m %s', group.valueOf());
            group.valueOf().forEach(function(file) {
              file = file.valueOf && file.valueOf() || file;
              log('\x1b[92m    PROMISE:\x1b[0m %s', file);
              self.cache['output'] += file.body;
            })
          }
          else {
            file = file.valueOf && file.valueOf() || file;
            log('\x1b[92m  PROMISE:\x1b[0m %s', promise);
            self.cache['output'] += file.body;
          }
        });
        result.defer.resolve(self.cache['output']);
      });
    }

    return result;
  },

  writeOutput: function(output, dest) {
    output = output || this.cache.output;

    if (output.length === 0) {
      this.readFiles();
      output = this.cache.output;
    }

    var dir = Combiner.getRootsForType(this.type), fpath;
    dir = dir.length ? dir[0] : process.cwd();

    fpath = pth.resolve(pth.join(dest || this.config.outputPath || dir, 
        this.config.output));

    fs.writeFileSync(fpath, output);

    return {
      file: fpath,
      uri: fpath.replace(root, '')
    };
  }

};

jQuery.extend(Combiner, {
  /** Known extension type for JavaScript (JS) files */
  JS: ".js",

  /** Known extension type for Cascading Style Sheets (CSS) files */
  CSS: ".css",

  /** Known extension type for LESS files */
  LESS: ".less",

  /** Known extension type for SCSS files */
  SCSS: ".scss",

  /** Known extension type for SASS files */
  SASS: ".sass",

  /** Default config properties for Combiner instances */
  DEFAULTS: {
    suffix: ".packed",
    output: "concatted"
  },

  /** Regular expression used to parse files for requirements "arrays" */
  REQUIRE: /(?:\/\/|\/\*|\s*\*\s*)*\**\s*@require\s*(\[([^\]]+)\])/g,

  getRootsForType: function(type) {
    var results = [];

    if (type === Combiner.JS) {
      results.push(jsRoot);
    } 
    else if (type === Combiner.CSS
        || type === Combiner.LESS
        || type === Combiner.SCSS
        || type === Combiner.SASS) {
      results.push(cssRoot);
    }

    return results;
  },

  /**
   * Given a source file, find the @require text within a comment and
   * the subsequent JSON array value. Once this is found, remove any
   * comment asterisks and/or one one comments injected in the text to
   * make the comment persist over multiple lines.
   *
   * Finally, convert the text back into a JS array for processing and
   * return this value.
   *
   * @param {String} source the source code to process
   * @return {Array} an array, empty if there were errors or no require
   *      strings to process
   */
  getRequired: function(source) {
    var evalString, 
        requiresPortion,           
        regex = new RegExp(Combiner.REQUIRE),
        results = [];

    if (Object.prototype.toString.call(source) !== '[object String]') {
      err('Cannot parse source ', source);
      return results;
    }

    if (!(requiresPortion = regex.exec(source))) {
      return results;
    }

    do {
      try {
        requiresPortion = requiresPortion[1];
        evalString = requiresPortion
            .replace(/(\*|\/\/|\r?\n\s*)/g, '')  // Remove *'s and newlines
            .replace(/\,\s*/g,',')          // Remove spaces after commas
        results = results.concat(eval('(' + evalString + ')'));
      }
      catch(e) {
        err('Failed to parse ' + requiresPortion);
      }
    }
    while ((requiresPortion = regex.exec(source)));

    return results;
  }
});

/**
 * TODO comment
 */ 
function PageNameCombiner(req, res, next) {
  var defExtension = '.' + req.app.get('view engine'),
      pageExtension = pth.extname(req.url) || defExtension,
      pageName = req.url === '/' ? 'index' 
          : pth.basename(req.url).replace(pageExtension, ''),
      uriToPage = pth.dirname(req.url),
      jsPageName, jsPagePath, jsCombiner, jsTask, 
      cssPageName, cssPagePath, cssCombiner, cssTask;

  jsPageName = pageName;
  jsPagePath = pth.join(jsRoot, uriToPage, 'pages');
  jsCombiner = req.app.jsCombiner || new Combiner({
    type: Combiner.JS, 
    output: jsPageName,
    outputPath: jsPagePath
  });

  jsTask = jsCombiner.readFiles([pth.join('pages', jsPageName + Combiner.JS)]);
  // res.locals.pageJS = jsCombiner.writeOutput().uri;

  cssPageName = pageName;
  cssPagePath = pth.join(cssRoot, uriToPage, 'pages');
  cssCombiner = req.app.cssCombiner || new Combiner({
    type: Combiner.CSS, 
    output: cssPageName,
    outputPath: cssPagePath
  });

  cssTask = cssCombiner.readFiles([pth.join('pages', cssPageName + Combiner.CSS)]);
  // res.locals.pageCSS = cssCombiner.writeOutput().uri;

  log(global.jsTask = jsTask);
  log(global.cssTask = cssTask);

  Q.all([jsTask.output, cssTask.output]).done(function() {
    res.locals.pageJS = jsCombiner.writeOutput().uri;
    res.locals.pageCSS = cssCombiner.writeOutput().uri;
    next();
  })

  // next();
};

/**
 * TODO comment
 */
function JSCombiner(req, res, next) {
  if (req.query.skipCombiner && req.query.skipCombiner.toLowerCase() === "true") {
    return next();
  }

  var jsPageName = req.params[0],
      jsCombiner = req.app.jsCombiner || new Combiner();

  if (pth.basename(req.url).indexOf(jsCombiner.config.suffix) === -1) {
    jsCombiner.readFiles([jsPageName]).output.done(function() {
      res.set('Content-Type', 'text/javascript');
      res.send(jsCombiner.cache.output);     
    });
  }
  else {
    return next();
  }
};

/**
 * TODO comment
 */
function CSSCombiner(req, res, next) {
  if (req.query.skipCombiner && req.query.skipCombiner.toLowerCase() === "true") {
    return next();
  }

  var cssPageName = req.params[0],
      cssCombiner = req.app.cssCombiner || new Combiner({type: Combiner.CSS});

  log(require('util').inspect(req.route, {colors:true}));

  if (pth.basename(req.url).indexOf(cssCombiner.config.suffix) === -1) {
    cssCombiner.readFiles([cssPageName]).output.done(function() {
      res.set('Content-Type', 'text/css');
      res.send(cssCombiner.cache.output);       
    });
  }
  else {
    return next();
  }
};

function handleJS(express, additonalMiddleware, pathName) {
  var regex = new RegExp("^\\/" + (pathName || "js") + "\\/(.*)$"),
      middleware;

  if (additonalMiddleware) {
    middleware = [];
    if (isA(additonalMiddleware)) {
      middleware.concat(additonalMiddleware);
    }
    else {
      middleware.push(additonalMiddleware);
    }
    express.get(regex, middleware, JSCombiner);  
  }
  else {
    express.get(regex, JSCombiner);
  }
}

function handleCSS(express, additonalMiddleware, pathName) {
  var regex = new RegExp("^\\/" + (pathName || "css") + "\\/(.*)$"),
      middleware;

  if (additonalMiddleware) {
    middleware = [];
    if (isA(additonalMiddleware)) {
      middleware.concat(additonalMiddleware);
    }
    else {
      middleware.push(additonalMiddleware);
    }
    express.get(regex, middleware, CSSCombiner);  
  }
  else {
    express.get(regex, CSSCombiner);
  }
}

function handleBoth(express, additonalMiddleware, jsPath, cssPath) {
  handleJS(express, additonalMiddleware, jsPath);
  handleCSS(express, additonalMiddleware, cssPath);
}

module.exports = function(config) {
  this.CSSCombiner = CSSCombiner;
  this.JSCombiner = JSCombiner;
  this.PageNameCombiner = PageNameCombiner;
  this.Combiner = Combiner;
  this.handleCSS = handleCSS;
  this.handleJS = handleJS;
  this.handleScriptAndStyle = handleBoth;


  this.root = root = config.root || process.cwd();
  this.jsRoot = jsRoot = config.jsRoot || pth.join(this.root, 'js');
  this.jsRootUri = this.jsRoot.replace(this.root, '');
  this.cssRoot = cssRoot = config.cssRoot || pth.join(this.root, 'css');
  this.cssRootUri = this.cssRoot.replace(this.root, '');

  this.express = config.express || null;
  this.env = this.express && this.express.get('env') 
      || config.env || 'development';
  this.dev = (this.env === 'development');
  jQuery.extend(moduleState, this);

  return this;
}
