# API Client

## Class: APIClient

```javascript
import API from "@softvisio/core/api";

const api = API.new("wss://devel:8080/api?maxConnections=1", { cacheMax: 1000 });
```

### API.new( url, options )

-   `url` <string\> | <URL\> API server url. Under browser `url` can be relative and will be resolved relative to the `window.location`.
-   `options?` <Object\> API options:
    -   `token` <string\> Authentication token. If not specified `url.username` will be used.
    -   `persistent` <boolean\> Persistent connections. If not defined `url` parameter `persistent` will be used. If not defined in `url` parameter persistent mode will be detected by the `url` protocol.
    -   `json` <boolean\> Use `JSON` to serialize API messages. If not set `MessagePack` will be used by default. `MessagePack` is preferred because it is faster and generates less bytes. You should use `JSON` only for debug purposes or for compatibility reasons. **Default:** `false`.
    -   `version` <string\> Default API version. Will be added to the relative method names. Must start with the `"v"` prefix. For example method name `"test/method"` will be converted to the `"/v1/test/method"`. **Default:** `"v1"`.
    -   `pongInterval` <integer\> If defined persistent connections will automatically send `pong` requests with the given interval to keep connection alive. Usualy this is not required, because API server already do this for all opened connections. **Default:** `0`.
    -   `maxConnections` <integer\> Max number of the websockets connections. Use `0` or `Infinity` for unlimited connections. For browser this option is always `1`. **Default:** `1`.
    -   `cacheMax` <integer\> Max cache size. **Default:** `10000`.
    -   `cacheMaxAge` <integer\> Default cached item max age. **Default:** `null`.
    -   `cacheReset` <string[]\> Array of the events names to automatically reset cache. For example `cacheReset: ["disconnect"]` means that cache will be dropped automatically on `"disconnect"` event received.
    -   `onRPC` <Function\> Called on remote RPC call.
        -   `method` <string\> Called RPC method name.
        -   `args` <Array\> RPC method arguments.
        -   Returns: <Result\> Must return instance of the <Result\>.
-   Returns: <APIClient\>

Creates new <APIClient\> instance.

### api.isBrowser

-   Returns: <boolean\> `true` if running undef crowser.

### api.url

-   Returns: <string\> API server url.

### api.httpURL

-   Returns: <string\> API server HTTP url.

### api.websocketsURL

-   Returns: <string\> API server websockets url.

### api.activeConnections

-   Returns: <integer\> Number of active websockets connections.

### api.isConnected

-   Returns: <boolean\> `true` is has at least `1` active websockets connection.

### api.call( method, ...args )

-   `method` <string\> Remote method name.
-   `...args` <any\> Method arguments.
-   Returns: <Promise\> Fullfils with the RPC method call <Result\>.

### api.callVoid( method, ...args )

-   `method` <string\> Remote method name.
-   `...args` <any\> Method arguments.
-   Returns: <undefined\>.

### api.callCached( key, method, ...args )

-   `key` <string\> | <Array\> Cache key. If <Array\> should have [`key`, `maxAge`].
-   `method` <string\> Remote method name.
-   `...args` <any\> Method arguments.
-   Returns: <Promise\> Fullfils with the RPC method call <Result\>.

### api.ping()

-   Returns: <Promise\> Fullfils with the call <Result\>.

### api.healthcheck()

-   Returns: <Promise\> Fullfils with the call <Result\>.

### api.publish( name, ...args )

-   `name` <string\> Event name.
-   `...args` <any\> Event arguments.

Publish event to the remote server.

### api.upload( methos, file, ...args )

-   `method` <string\> API method name.
-   `file` <File\> | <Object\> | <string\> File to upload. If <Object\> is passed it will be used as `options` for <File\> constructor. <string\> - file path.
-   `...args` <any\> Additional arguments, that will be sent to the server together with the uploading file.
-   Returns: <APIClientUpload\>

Creates file upload object instance.

### api.getConnection()

-   Returns: <Promise\> Fullfils with <APIClientConnection\>.

### api.waitConnect()

-   Returns: <Promise\>.

Wait for at least one sebsockets connection will be established.

### api.ref()

-   Returns: <APIClient\> `this`.

Ref websockets connectiona.

### api.unref()

-   Returns: <APIClient\> `this`.

Unref websockets connectiona.

## Class: APIClientUpload

```javascript
const upload = api.upload("/v1/test/upload", File).on("progress", upload => console.log(upload.progressText));

const res = await upload.start();
```

### Event: "progress"

-   <APIClientUpload\> `this` instance.

Emitted when upload status changed.

### upload.filename

-   <string\> Uplading file name.

### upload.size

-   <integer\> Uplading file size.

### upload.type

-   <string\> Uplading file MIME type.

### upload.statusText

-   <string\> Current status text.

### upload.result

-   <Result\> Upload result.

### upload.isNew

-   <boolean\> `true` if uplad created but not yet started.

### upload.isStarted

-   <boolean\> `true` if uplad started.

### upload.isAborted

-   <boolean\> | <null\> `true` if uplad was aborted. `null` if upload is not finished.

### upload.isOk

-   <boolean\> | <null\> `true` if uplad was finished without errors. `null` if upload is not finished.

### upload.isError

-   <boolean\> | <null\> `true` if uplad was finished with the error. `null` if upload is not finished.

### upload.isFinished

-   <boolean\> `true` if uplad was finished.

### upload.loaded

-   <integer\> Number of bytes upladed.

### upload.progress

-   <number\> Upload progress in the percents.

### upload.progressText

-   <string\> Upload progress message for display in progress bar. Combines status text and progress.

### upload.start()

-   Returns: <Promise\> Fullfils with the upload <Result\> when upload will be finished.

### upload.abort()

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

### connection.api

-   Returns: <APIClient\> Parent API client instance.

### connection.isBrowser

-   Returns: <boolean\> `true` if running undef crowser.

### connection.hostname

-   Returns: <string\> This connection server host name.

### connection.isConnected

-   Returns: <boolean\> `true` if connection is ready to use.

### connection.isPending

-   Returns: <boolean\> `true` if connection is in the `connecting` state.

### connection.isDestroyed

-   Returns: <boolean\> `true` if connection is destroyed. Destroyed connection can't be reused.

### connection.ping()

-   Returns: <Promise\> Fullfils with the call <Result\>.

### connection.healthcheck()

-   Returns: <Promise\> Fullfils with the call <Result\>.

### connection.publish( name, ...args )

-   `name` <string\> Event name.
-   `...args` <any\> Event arguments.

Publish event to the remote server.

### connection.call( method, ...args )

-   `method` <string\> Remote method name.
-   `...args` <any\> Method arguments.
-   Returns: <Promise\> Fullfils with the RPC method call <Result\>.

### connection.callVoid( method, ...args )

-   `method` <string\> Remote method name.
-   `...args` <any\> Method arguments.
-   Returns: <undefined\>.

### connection.callCached( key, method, ...args )

-   `key` <string\> | <Array\> Cache key. If <Array\> should have [`key`, `maxAge`].
-   `method` <string\> Remote method name.
-   `...args` <any\> Method arguments.
-   Returns: <Promise\> Fullfils with the RPC method call <Result\>.

### connection.disconnect()

Close this connection.

### connection.ref()

-   Returns: <APIClientConnection\> `this`.

Ref this connection socket.

### connection.unref()

-   Returns: <APIClientConnection\> `this`.

Unref this connection socket.

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

### hub.num

-   Returns: <integer\> Number of services.

### hub.addService( name, url, options )

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

### ref()

-   Returns: <APIClientHub\> `this`.

Calls `ref()` on the added services.

### unref()

-   Returns: <APIClientHub\> `this`.

Calls `unref()` on the added services.
