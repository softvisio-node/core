# INSTALL AND USE

```
yarn add @softvisio/core
```

# API

```
import softvisioApi from '@softvisio/api';

const api = new softvisioApi({
    url: '//devel/api',
    token: 'your-api-token',
    version: 'v1',
    onEvent: function (api, ev) { },
    onRpc: function (api, cb, method, args) {
        cb(200, data);
        // cb([400, 'Error reason'], data);
    },
});

api.call('class/method', arg1, argN, function (res) {
    if ( res.isSuccess() ) {
        console.log(res.data);
    }
    else {
        console.log(res.status, res.reason);
    }
});
```

# CONDVAR

```
const condvar = require( "@softvisio/core/lib/async/condvar.js" );

var cv = condvar().begin();

cv.begin();
async(...).then(cv.end());

cv.begin();
async(...).then(cv.end());

await cv.end().recv();

```
