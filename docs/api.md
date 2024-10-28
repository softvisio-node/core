# Introduction

```shell
npm install @softvisio/core
```

## Usage

```javascript
import Api from "@softvisio/core/api";

const api = new Api({
    url: "/api/",
    token: null,
    version: "v1",
});

Vue.prototype.$api = api;
```

## Constructor arguments

-   url - Api endpoint url, url is resolved using current `window.location` as base.

Examples, where `window.location` is `https://domain.com/path/`:

| url                       | connection url                 |
| :------------------------ | :----------------------------- |
| /api/                     | <https://domain.com/api/>      |
| api/                      | <https://domain.com/path/api/> |
| //domain1.com/api/        | <https://domain1.com/api/>     |
| <http://domain1.com/api/> | <http://domain1.com/api/>      |

-   token - Authentication token, you can set it later using `auth()` method;

-   version - Default api version to use;

## Methods

-   auth( token ) - set authentication token.

    Use `null` to drop authentication.

-   call( "method", "arg1", "arg2", ... "argN", callback ) - call remote method.

Can be used in synchronous or asynchronous mode:

```javascript
// synchronous call
var res = await api.call("path/to/method", arg1, arg2);

// async call with callback
api.call("path/to/method", arg1, function (res) {
    // do something with the results
});
```

Params:

-   method - Api method to call, must start with the api version (eg: `/v1/method`) or be relative (eg: `method/path`). If method path is relative - default api version will be substituted automatically.

-   arg1, ... argN - not mandatory, arbitrary number of arguments, that will be passed to the remote method;

-   callback - not mandatory, callback function, called, when api call is completed;

Result:

Each api call returns single result class instance. Usage example:

```javascript
var res = api.call("/v1/session/signin", [username, password]);

if (res.ok) {
    console.log(res.data);
} else {
    console.log(res.toString());
}
```

Properties:

-   status - response status code;

-   reason - response status reason;

-   data - contains response data;

Other properties can be present, depends on method called.

Methods:

-   toString() - returns concatenated res.status + res.reason;

-   isOk() - checks, if api call was successfull, has 2xx status code;

-   isInfo() - has 1xx status code;

-   isRedirect() - has 3xx status code;

-   isError() - has 4xx or 5xx status code;

-   isClientError() - has 4xx status code;

-   isServerError() - has 5xx status code;
