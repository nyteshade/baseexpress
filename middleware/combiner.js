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
    cssRoot = '',
    cols = { 
      clear:      '\u001b[0m',
      bold:       { on:'\u001b[1m',  off:'\u001b[22m' },
      italic:     { on:'\u001b[3m',  off:'\u001b[23m' },
      underline:  { on:'\u001b[4m',  off:'\u001b[24m' },
      inverse:    { on:'\u001b[7m',  off:'\u001b[27m' },
      white:      { on:'\u001b[37m', off:'\u001b[39m', bright: '\u001b[97m' },
      grey:       { on:'\u001b[90m', off:'\u001b[39m', bright: '\u001b[90m' },
      black:      { on:'\u001b[30m', off:'\u001b[39m', bright: '\u001b[90m' },
      blue:       { on:'\u001b[34m', off:'\u001b[39m', bright: '\u001b[94m' },
      cyan:       { on:'\u001b[36m', off:'\u001b[39m', bright: '\u001b[96m' },
      green:      { on:'\u001b[32m', off:'\u001b[39m', bright: '\u001b[92m' },
      magenta:    { on:'\u001b[35m', off:'\u001b[39m', bright: '\u001b[95m' },
      red:        { on:'\u001b[31m', off:'\u001b[39m', bright: '\u001b[91m' },
      yellow:     { on:'\u001b[33m', off:'\u001b[39m', bright: '\u001b[93m' } 
    };

/**
 * TODO comment
 */
function Combiner(files, config) {
  config = jQuery.extend({
      root: moduleState.root, 
      jsRoot: moduleState.jsRoot,
      jsUri: moduleState.jsRootUri,
      cssRoot: moduleState.cssRoot,
      cssUri: moduleState.cssRootUri, 
      express: moduleState.express || null
  }, Combiner.DEFAULTS, isO(files) ? files : config || {});

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
  this.order = [];
  this.cache = Combiner.getGlobalCache(this.type);
  this.config = config;
  this.output = "";

  if (!this.ROOTS.length) {
    this.ROOTS.push(this.type === Combiner.JS ? config.jsRoot : cssRoot);
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

  /** Order of files to reconstruct */
  order: null,

  /** Already read */
  cache: null,

  /** Flag denoting whether or not a readFiles() call is executing */
  isReading: false,

  /** Reading state; some variables to access state between nested calls */
  readState: null,

  go: function(files, dest) {
    this.readFiles(files || this.files);
    this.writeOutput(this.output, dest);
    return this;
  },

  /**
   * This bit of code loads the files and their dependencies into the
   * cache. If the file already exists in the cache, I need to look into
   * providing a way to refresh it. Maybe do a HEAD call first? Right now
   * the call will be skipped if the file is already cached.
   */
  cacheFile: function(file, rejectOnError, isRequirement) {
    var defer = Q.defer(), 
        promise = defer.promise,
        config = this.config,
        express = config.express || null,
        host = express && express.locals.settings.host || 'localhost',
        port = String(express && express.locals.settings.port || 80),
        rootUri = this.type === Combiner.JS ? config.jsUri : config.cssUri,
        path = pth.join(pth.resolve(config.root), file),
        uri = pth.join(rootUri, file),
        url = URL.format({
          protocol: 'http:',
          hostname: host,
          pathname: uri,
          search: '?skipCombiner=true',
          port: port
        }),
        payload = {
          body: null,
          error: null,
          uri: uri,
          path: path,
          promise: promise,
          reqs: [],
          reqsPromise: null
        };  

    var xhrSuccess = (function xhrSuccess(data) {
      if (config.log) { log('%sGOT%s %s', cols.bold.on, cols.bold.off, uri); }
      try {
        payload.body = data;
        payload.reqs = Combiner.getRequired(data).reverse();

        if (payload.reqs.length) {
          this.requirements = this.requirements.concat(payload.reqs);
          if (config.log) {
            log('%s%sREQS%s %s%s', cols.bold.on, cols.blue.bright,
                cols.bold.off, JSON.stringify(payload.reqs), cols.clear);
          }

          payload.reqsPromise = [];
          payload.reqs.forEach((function(req, reqIndex, reqs) {
            var promise = this.cacheFile(req, rejectOnError, true);
            payload.reqsPromise.push(promise);
          }).bind(this));

          Q.all(payload.reqsPromise).fin((function() {
            this.cache[uri] = payload;
            defer.resolve(payload);
          }).bind(this));
        }
        else {
          this.cache[uri] = payload;
          defer.resolve(payload);
        }
      }
      catch(e) {err(e); payload.error = e; defer.reject(payload);}
    }).bind(this);

    if (!isRequirement) {
      this.files.push(file);
    }
    this.order.push(file);

    if (!this.cache[uri]) {
      jQuery.ajax({
        url: url,
        success: (function(data, statux, xhr) {
          xhrSuccess(data);
        }).bind(this),

        error: (function(xhr, status, error) {
          err('%sERROR%s %s', cols.red.on, cols.red.off, JSON.stringify(error));
          payload['error'] = error;
          if (rejectOnError) {
            defer.reject(payload);
          }
          else {
            defer.resolve(payload);
          }
        }).bind(this)
      });
    }
    else {
      if (config.log) {
        log('%sCACHED%s %s%s%s', cols.bold.on, cols.bold.off, cols.grey.on,
          uri, cols.clear);
      }
      xhrSuccess(this.cache[uri].body);
    }

    return promise; 
  },

  /**
   * Given the fact that we don't want duplicate items in our list and a
   * payload object is not nicely comparable using the === operator, we
   * check for the equality of a sub field. If it exists in the supplied
   * list, we return true. Otherwise we return false.
   *
   * @param {Array} list an array of payload objects to search
   * @param {Object} payload the payload object to search for
   * @return true if the supplied payload already exists in the list; false
   *     otherwise
   */
  hasPayload: function(list, payload) {
    var result = false;
    if (list && payload && payload.path) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].path === payload.path) {
          result = true;
          break;
        }
      }
    }
    return result;
  },

  /**
   * A payload is a chunk of data stored about a particular file or
   * resource. These are created in the {@link #cacheFile} method. This
   * method builds up a flattened list of payload objects for each top
   * level payload supplied. 
   *
   * @param {Object} payload this is a file descriptor created in cacheFile
   * @param {Array} list this is a list that is passed in and returned to
   *     allow for appending of a single list
   * @return the list supplied or the one created when no list is supplied
   */ 
  processPayload: function(payload, list) {
    if (!list) list = [];        
    if (payload.reqsPromise && payload.reqsPromise.length) {
      for (var i = 0; i < payload.reqsPromise.length; i++) {
        var subPayload = payload.reqsPromise[i].valueOf();
        this.processPayload(subPayload, list);
        if (!this.hasPayload(list, subPayload)) {
          list.push(subPayload);
        }
      }
    }
    if (!this.hasPayload(list, subPayload)) {
      list.push(payload);
    }
    return list;
  },

  /**
   * This method takes a list of files relative to the appropriate root
   * of this Combiner. These files are then loaded, searched for noted
   * requirements. If there are any, those files will also be given the
   * same procedure. 
   * 
   * This code maintains the ordering of the scripts as necessary, placing
   * any listed requirements before the content of the supplied file, in
   * their specified order. 
   * 
   * Finally when all is said and done, the {@code output} property is 
   * filled with the content of the loaded data.
   *
   * @param {Array(String)} filesToRead an array of Strings denoting the
   *     name and relative path of the files to parse.
   * @return a promise that can be listened to for when the process is
   *     complete. It receives all the payloads in its resolution. 
   */
  readFiles: function(filesToRead) {
    var cache     = this.cache,
        config    = this.config,
        files     = filesToRead || this.files,
        promises  = [],
        defer     = Q.defer(),
        promise   = defer.promise,
        rootUri   = this.type === Combiner.JS ? config.jsUri : config.cssUri;

    this.ROOTS.forEach((function(root, rootIndex) {
      files.forEach((function(file, fileIndex) {
        promises.push(this.cacheFile(file));
      }).bind(this));
    }).bind(this));

    Q.all(promises).then((function(promised) {
      if (config.log) {
        log('%sDONE%s All files accounted for%s', cols.green.on, cols.grey.on,
          cols.clear);
      }

      try {
        var result = [];
        for (var i = 0; i < promised.length; i++) {
          result = this.processPayload(promised[i], result);
        }
        defer.resolve(result);


        this.order.reverse();     
        this.output = ""; 
        this.order.forEach((function(item) {
          this.output += this.cache[pth.join(rootUri, item)].body;
        }).bind(this));
      }
      catch (e) {
        err('Failed in readFiles() Q.all(): ',e);
      }
    }).bind(this));

    return promise;
  },

  writeOutput: function(output, dest) {
    output = output || this.output;

    if (output.length === 0) {
      this.readFiles();
      output = this.output;
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
    output: "concatted",
    log: true
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
   * TODO Comment
   */
  getGlobalCache: function(type) {
    var scope = (typeof global !== 'undefined') ? global : window;

    ((scope.CombinerCache = scope.CombinerCache || {})[type] = 
        scope.CombinerCache[type] || {});

    return scope.CombinerCache[type];
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

  Q.all([jsTask, cssTask]).done(function() {
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
    jsCombiner.readFiles([jsPageName]).then(function() {
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

  if (pth.basename(req.url).indexOf(cssCombiner.config.suffix) === -1) {
    cssCombiner.readFiles([cssPageName]).then(function() {
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
