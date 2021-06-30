# API Client

## Class: APIClient

```javascript
import API from "@softvisio/core/api";

const api = API.new("wss://devel:8080/api?maxConnections=1", { cacheMax: 1000 });
```

### API.new( url, options )

-   `url` <string\> | <URL\> API server url.
-   `options` <Object\> API options:
    -   `token` <string\>
    -   `persistent` <boolean\>
    -   `json` <boolean\>
    -   `version` <string\>
    -   `pongInterval` <integer\>
    -   `maxConnections` <integer\>
    -   `cacheMax` <integer\>
    -   `cacheMaxAge` <integer\>
    -   `cacheDrop` <string\> | <string[]\>
    -   `onRPC` <Function\>

### url

### websocketUrl

### activeConnections

### isConnected

### call( method, ...args )

### callVoid( method, ...args )

### callCached( method, ...args )

### ping()

### healthcheck()

### publish( name, ...args )

### getConnection()

-   Returns: <Promise\> Fullfils with <APIClientConnection\>.

### waitConnect()

## Class: APIClientConnection

Implements persistent websocket connection to the api server. You can not construct this object directly, it returned as result of [`api.getConnection()`](#getconnection) call.

### Event: "connect"

Emitted on connection established.

### Event: "disconnect"

-   `status` <Result\> Disconnect status descriptor.

Emitted on connection closed.

### Event: "event"

-   `name` <string\> Remote event name.
-   `args` <Array\> Event arguments.

Emitted on event from the server received.

### Event: "event/<event-name\>"

-   `...args` <any\> Event arguments.

Emitted on event from the server received.

### api

### hostname

### isConnected

### isPending

### isDestroyed

### ping()

### healthcheck()

### publish( name, ...args )

### call( method, ...args )

### callVoid( method, ...args )

### callCached( key, method, ...args )

### disconnect()

### startPong()
