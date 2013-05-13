/**
 * The MIT License
 *
 * Copyright (c) 2013 Gabriel Harrison
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * isA.js
 *
 * Reusable node.js/browser JavaScript library that exposes some isXXX() type
 * of functions. These functions do as much as possible to provide cross
 * JavaScript VM compatible methods to determine whether or not an object is
 * of a given type.
 *
 * If this library is included in a browser via a script tag, all of it's
 * components will be placed in the window scope.
 *
 * If this library is require()'ed in node.js, it will return a function that
 * takes either 0 or 1 parameters. If no parameters are required, the functions
 * and properties of this library are returned in a single object literal that
 * can be used for assignment normally.
 *
 * If the function is invoked with a parameter, that parameter is assumed to
 * be the scope into which these functions and properties will be copied.
 *
 * Example usage:
 *   var isA = require('isA')();        // scoped to isA param
 *   var isA = require('isA')(global);  // scoped to isA *AND* global
 *
 * @author Gabriel Harrison (nyteshade AT gmail.com)
 * @version 0.0.5
 */
(function() {
  "use strict";

  function exists(variableName) {
    var result;
    try { result = eval('(' + variableName + ')'); }
    catch (e) {
      result = undefined;
    }
    return result;
  }

  var myExports = exists('exports'),
      myModule = exists('module'),
      myWindow = exists('window'),
      myGlobal = exists('global'),
      hasExports = myExports !== undefined,
      namespace = hasExports ? myExports :
          (myWindow !== undefined) ? myWindow :
          (myGlobal !== undefined) ? myGlobal : null,
      library, i, backRef;

  if (!namespace) {
    console.error('Cannot locate place to export library to!');
    throw new Error('Missing namespace!');
  }

  library = (function(exports) {
    var _t, _t2, _count = 0, _unique = 0, _questionable = [], unique;

    /**
     * Declare an array of Strings reported by the JavaScript VM to be the
     * actual toString() representation of a particular base type such that
     * it can be repeatedly compared with accuracy using the functions below.
     *
     * By not hardcoding the Strings here, we can guarantee that we are seeing
     * unique types.
     */
    exports.IS_A = {
      UNDEFINED:  Object.prototype.toString.call(undefined),
      FUNCTION:   Object.prototype.toString.call(new Function()),
      BOOLEAN:    Object.prototype.toString.call(true),
      OBJECT:     Object.prototype.toString.call({}),
      REGEXP:     Object.prototype.toString.call(new RegExp()),
      STRING:     Object.prototype.toString.call(""),
      NUMBER:     Object.prototype.toString.call(1),
      ARRAY:      Object.prototype.toString.call([]),
      ERROR:      Object.prototype.toString.call(new Error()),
      NULL:       Object.prototype.toString.call(null)
    };

    /* This back reference array allows us to quickly map existing constructors
     * for base types to their appropriate strings without having to create new
     * instances of the type for comparison. */
    backRef = exports.IS_A_BACKREF = [
      undefined, exports.IS_A.UNDEFINED,
      Function, exports.IS_A.FUNCTION,
      Boolean, exports.IS_A.BOOLEAN,
      Object, exports.IS_A.OBJECT,
      RegExp, exports.IS_A.REGEXP,
      String, exports.IS_A.STRING,
      Number, exports.IS_A.NUMBER,
      Array, exports.IS_A.ARRAY,
      Error, exports.IS_A.ERROR,
      null, exports.IS_A.NULL
    ];

    if (!backRef.indexOf) {
      backRef.indexOf = function(obj) {
        for (i = 0; i < backRef.length; i++) {
          if (backRef[i] === obj) {
            return i;
          }
        }
        return -1;
      };
    }

    /** Quick reference function to get correct offset of backRef */
    backRef.matchingType = function(baseConstructor) {
      var pos = this.indexOf(baseConstructor);
      if (pos === -1) {
        return Object.prototype.toString.call(baseConstructor);
      }
      return this[pos + 1];
    };

    /* Quick test to guarantee we have no repeated types and provide a way to
     * measure the accuracy of our comparison "constants" */
    for (_t in exports.IS_A) {
      if (exports.IS_A.hasOwnProperty(_t)) {
        unique = true;
        for (_t2 in exports.IS_A) {
          if (exports.IS_A.hasOwnProperty(_t2)) {
            if (_t === _t2) { continue; }
            unique = exports.IS_A[_t] !== exports.IS_A[_t2];
            if (!unique) {
              _questionable.push([_t, _t2]);
              break;
            }
          }
        }
        if (unique) { _unique++; }
        _count++;
      }
    }

    /**
     * This property should reflect 1 if every type in the IS_A dictionary
     * reported unique values. This will quickly tell you if your assumptions
     * about toString() results will be accurate or not. In the case of a value
     * less than 1, exports.IS_A_QUESTIONABLE will contain pairs of keys that
     * returned the same value for your own debugging pleasure.
     */
    exports.IS_A_ACCURACY = _unique / _count;
    exports.IS_A_QUESTIONABLE = _questionable;
    if (exports.IS_A_ACCURACY !== 1.0) {
      console.warn('IS_A dictionary reported non-unique value pairs: ',
          exports.IS_A_QUESTIONABLE);
    }

    /**
     * Cross JavaScript VM method to definitively test the type that an object
     * reports to the JavaScript engine itself. Accuracy will decline and/or
     * vary if the type is not one of the types listed in exports.IS_A, above.
     */
    exports.isA = function(type, object) {
      var result, typeString;
      if (arguments.length === 1) {
        result = Object.prototype.toString.call(type);
      }
      else {
        typeString = Object.prototype.toString.call(object);
        result = typeString === type
            || typeString === exports.IS_A[type]
            || typeString === backRef.matchingType(type);
      }
      return result;
    };

    /**
     * Not the most efficient way to test for undefined, but follows suit with
     * the other methods in this suite.
     *
     * @param object any object to be tested
     * @return boolean true if the object is undefined, false otherwise
     */
    exports.isUndefined = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.UNDEFINED;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of a Function.
     *
     * @param object any object to be tested
     * @return boolean true if the object is a function, false otherwise
     */
    exports.isFunction = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.FUNCTION;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of a Boolean.
     *
     * @param object any object to be tested
     * @return boolean true if the object is a Boolean, false otherwise
     */
    exports.isBoolean = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.BOOLEAN;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of a RegExp.
     *
     * @param object any object to be tested
     * @return boolean true if the object is a RegExp, false otherwise
     */
    exports.isObject = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.OBJECT;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of a RegExp.
     *
     * @param object any object to be tested
     * @return boolean true if the object is a RegExp, false otherwise
     */
    exports.isRegExp = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.REGEXP;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of a String.
     *
     * @param object any object to be tested
     * @return boolean true if the object is a String, false otherwise
     */
    exports.isString = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.STRING;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of a Number.
     *
     * @param object any object to be tested
     * @return boolean true if the object is a Number, false otherwise
     */
    exports.isNumber = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.NUMBER;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of an Array.
     *
     * @param object any object to be tested
     * @return boolean true if the object is an Array, false otherwise
     */
    exports.isArray = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.ARRAY;
    };

    /**
     * Cross JavaScript VM method to definitively test whether or not an object
     * is an instance of an Error.
     *
     * @param object any object to be tested
     * @return boolean true if the object is an Error, false otherwise
     */
    exports.isError = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.ERROR;
    };

    /**
     * Not the most efficient way to test for null, but follows suit with
     * the other methods in this suite.
     *
     * @param object any object to be tested
     * @return boolean true if the object is null, false otherwise
     */
    exports.isNull = function(object) {
      return Object.prototype.toString.call(object) === exports.IS_A.NULL;
    };

    /**
     * Inject isA library to the supplied scope. If null or undefined are given
     * as the destinationScope an exception will be thrown.
     *
     * @param destinationScope the scope to dump these library functions to
     * @return object the exports object
     */
    exports.INJECT_IS_A_LIB = function(destinationScope) {
      var property;

      if (destinationScope === null || destinationScope === undefined) {
        throw new Error("Cannot locate destination scope to install to.");
      }
      for (property in exports) {
        if (exports.hasOwnProperty(property)) {
          destinationScope[property] = exports[property];
        }
      }
      return exports;
    };

    return exports;
  }({}));

  if (hasExports && myModule !== undefined) {
    myModule.exports = function(destination) {
      var result;
      if (!destination) {
        result = library;
      }
      else {
        result = library.INJECT_IS_A_LIB(destination);
      }
      return result;
    };
  }
  else if (myWindow !== undefined) {
    library.INJECT_IS_A_LIB(myWindow);
  }
  else {
    namespace.isA = library;
  }
}());

/** JSLint Hinting */
/*properties
 ARRAY, BOOLEAN, ERROR, FUNCTION, INJECT_IS_A_LIB, IS_A, IS_A_ACCURACY,
 IS_A_BACKREF, IS_A_QUESTIONABLE, NULL, NUMBER, OBJECT, REGEXP, STRING,
 UNDEFINED, call, error, exports, hasOwnProperty, indexOf, isA, isArray,
 isBoolean, isError, isFunction, isNull, isNumber, isObject, isRegExp,
 isString, isUndefined, length, matchingType, prototype, push, toString,
 warn
 */
/*jslint
 browser: true, devel: true, node: true, continue: true, evil: true,
 nomen: true, plusplus: true, unparam: true, white: true, indent: 2,
 maxlen: 80
 */
