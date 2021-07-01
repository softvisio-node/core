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
    -   `onRPC` <Function\> Called on remote RPC call.
        -   `method` <string\> Called RPC method name.
        -   `args` <Array\> RPC method arguments.
        -   Returns: <Result\> Must return instance of the <Result\>.
-   Returns: <APIClient\>

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

### upload( methos, file, ...args )

-   `method` <string\> API method.
-   `file` <File\> | <Object\> | <string\> File to upload. If <Object\> is passed it will be used as `options` for <File\> constructor. <string\> - file path.
-   `...args` <any\> Additional arguments, that will be sent to the server together with the uploading file.
-   Returns: <APIClientUpload\>

### getConnection()

-   Returns: <Promise\> Fullfils with <APIClientConnection\>.

### waitConnect()

## Class: APIClientUpload

```javascript
const upload = api.upload("/v1/test/upload", File).on("progress", upload => console.log(upload.progressText));

const res = await upload.start();
```

### Event: "progress"

-   <APIClientUpload\> `this` instance.

Emitted when upload status changed.

### filename

-   <string\> Uplading file name.

### size

-   <integer\> Uplading file size.

### type

-   <string\> Uplading file MIME type.

### statusText

-   <string\> Current status text.

### result

-   <Result\> Upload result.

### isNew

-   <boolean\> `true` if uplad created but not started.

### isStarted

-   <boolean\> `true` if uplad started.

### isAborted

-   <boolean\> | <null\> `true` if uplad was aborted. `null` if upload is not finished.

### isOk

-   <boolean\> | <null\> `true` if uplad was finished without errors. `null` if upload is not finished.

### isError

-   <boolean\> | <null\> `true` if uplad was finished with the error. `null` if upload is not finished.

### isFinished

-   <boolean\> `true` if uplad was finished.

### loaded

-   <integer\> Number of bytes upladed.

### progress

-   <number\> Upload progress.

### progressText

-   <string\> Upload progress message for display in progress bar. Combines status text and progress.

### start()

-   Returns: <Promise\> Fullfils with the upload <Result\> when upload will be finished.

### abort()

-   Returns: <boolean\> `true` if upload was aborted successfuly.

Aborts upload if it was not finished.

## Class: APIClientConnection

Implements the persistent websocket connection to the api server. You can not construct this object directly, it returned as result of [`api.getConnection()`](#getconnection) call.

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

## Class: APIClientHub

```javascript
import APIClientHub from "@softvisio/core/api/hub";

const hub = new APIClientHub({
    test: "wss://test.com/8080/rpc",
});

const res = await APIClientHub.call("test", "/v1/method");
```

### new APIClientHub( services )

-   `services?` <Object\>

### Event: "connect"

-   `service` <string\> Connected service name.

### Event: "disconnect"

-   `service` <string\> Disconnected service name.

### Event: "event"

-   `service` <string\> Source service name.
-   `event` <string\> Remote event name.
-   `...args` <any\> Remote event arguments.

### num

-   Returns: <integer\> Number of services.

### addService( name, url, options )

### addServices( services )

### addServicesFromEnv( options )

-   `options?` <Object\>
    -   `prefix` <string\> **Default:** `APP_SERVICE_`.
    -   `names` <string[]\>

### getService( service )

-   `service` <string\> Service name.
-   Returns: <APIClient\> API client associated withe the given service name.

### publish( services, name, ...args )

### ping( service )

### heathcheck( service )

### call( service, method, ...args )

### callVoid( service, method, ...args )

### callCached( service, key, method, ...args )
