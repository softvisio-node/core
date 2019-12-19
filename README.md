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

# CORO

```
const coro = require( "@softvisio/core/lib/coro.js" );

function timer ( timeout, cb ) {
    setTimeout( cb, timeout );
}

function* thread ( ) {
    var res;

    res = yield time( 1, coro.cb() );

    res = yield time( 1, coro.cb() );

    retrn res;
}

( async () => {
    var res;

    coro.run( thread() );
    coro.run( thread() );

    res = await coro.run( thread() );
    res = await coro.run( thread() );
} )();

```
