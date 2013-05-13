<h1>
isA.js
</h1>

<h2>License</h2>
The MIT License

Copyright (c) 2013 Gabriel Harrison

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

<h2>Installation</h2>

To install the isA library, invoke
```shell
npm install isa-lib
```

<h2>About</h2>

Reusable node.js/browser JavaScript library that exposes some isXXX() type of functions. These functions do as much as possible to provide cross JavaScript VM compatible methods to determine whether or not an object is of a given type.

If this library is included in a browser via a script tag, all of it's components will be placed in the window scope.

<h3>Example Usage:</h3>
```html
<script type="text/javascript" src="/path/to/isA.js"></script>
<script type="text/javascript">
  console.log(isA(IS_A.NUMBER, 5));       // true
  console.log(isNumber(5));               // true
  console.log(isA(5, 5));                 // true
  console.log(isA(5));                    // "[object Number]"
  console.log(IS_A.NUMBER);               // "[object Number]"
  console.log('NUMBER', 5);               // true
  console.log(isA("[object Number]", 5)); // true
  console.log(isA(Number, 5));            // true
  console.log(isA(String, "Hi"));         // true
</script>
```

If this library is require()'ed in node.js, it will return a function that takes either 0 or 1 parameters. If no parameters are required, the functions and properties of this library are returned in a single object literal that
can be used for assignment normally. If the function is invoked with a parameter, that parameter is assumed to be the scope into which these functions and properties will be copied.

<h3>Example usage:</h3>
```javascript
  var isA = require('isa-lib')();        // scoped to isA param
  var isA = require('isa-lib')(global);  // scoped to isA *AND* global
```

<h2>Library contents</h2>

```javascript
Function isA(type, object);
Function isUndefined(object);
Function isFunction(object);
Function isBoolean(object);
Function isObject(object);
Function isRegExp(object);
Function isString(object);
Function isNumber(object);
Function isArray(object);
Function isError(object);
Function isNull(object);

// Function to inject this library to a JavaScript scope object
Function INJECT_IS_A_LIB(scopeObject);

// Anything less than 1 indicates pairs of incorrect type designations
Number   IS_A_ACCURACY

// Array of pairs of types that incorrectly return the same value
Array    IS_A_QUESTIONABLE

// Constants of known base types
Object   IS_A

// Back reference to type string from constructor
Array    IS_A_BACKREF
```

