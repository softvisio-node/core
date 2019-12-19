# INSTALL AND USE

```
yarn add @softvisio/core
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
