# Application

## Events

Application has three events type:

-   **global** - Events delivered to the local application listeners, local threads and and applicaiotn instances and threads in the cluster. Cluster must be initialized, otherwise events will not be delivered to the cluster listeners. **Global events are prefixed with the `"/"`**.

    ```javascript
    // listen
    app.on( "/global-event-name", callback );

    // publish
    app.publish( "/global-event-name" );
    ```

    To send events to the other cluster namespace you need to use `"//"` prefix. You are unable to listen for events from the other namespace. For example:

    ```javascript
    // ERROR
    app.on( "//namespace/global-event-name", callback );

    // OK
    app.publish( "//namespace/global-event-name" );
    ```

-   **local** - Local events are delivered to the local application and local threads.

    ```javascript
    // listen
    app.on( "local-event-name", callback );

    // publish
    app.publish( "local-event-name" );
    ```

-   **application** - Application events are delivered to the local application only.

    ```javascript
    // listen
    app.on( "app-event-name", callback );

    // publish
    app.emit( "all-event-name" );
    ```

### API events

API events - events, emitted by the API and connected API users. You also can send events to the connected API users.

#### Event: "api/ready"

Emitted on API backend connected and subscribed. Means that API backend is fully worked and ready to use.

#### Event: "api/disconnect"

Emitted on API backend disconnected. Means, that API unable to use backend until it will be re-connected. You need to drop caches or do some other cleanup.

#### Event: `api/event/<event-name>`

-   `auth` {Auth} Sender authentication descriptor.
-   `...args` {any} Event arguments.

Events from the externally connected API users. All such events names are prefixed with the `api/event/` prefix. For example, if you want to handle event named `test` from the external API user you need to listen for `api/event/test`.

#### Sending events to the API users

To send events to the connected API users you need to publish them to the `api` endpoint.

```javascript
app.publish( "api", users, name, ...args );
```

-   `users` {string|Array} Target user identificators. Each identificator can be the one of:

    -   `user id` {integer} Target user id.
    -   `users group name` {string} Application specific users group name.
    -   `"*"` All connected users.
    -   `"root"` Root user.
    -   `"user"` All authenticated users.
    -   `"guest"` All not authenticated users.

-   `name` {string} Event name.

-   `...args` {any} Event arguments.

### RPC events

RPC events - events, emitted by connected RPC clients. You also can send events to the connected RPC clients.

#### Event: `rpc/event/<event-name>`

-   `...args` {any} Event arguments.

Events from the externally connected RPC clients. All such events names are prefixed with the `rpc/event/` prefix. For example, if you want to handle event named `test` from the external RPC user you need to listen for `rpc/event/test`.

#### Sending events to the RPC clients

To send events to the connected RPC users you need to publish them to the `rpc` endpoint.

```javascript
app.publish( "rpc", clients, name, ...args );
```

-   `clients` {string|Array} RPC client identificators. Each identificator can be the one of:

    -   `"*"` All connected RPC clients.
    -   `"guest"` All connected RPC clients.
    -   `event name` - Arbitrary event name, to which particular RPC clients are subscribed.

-   `name` {string} Event name.

-   `...args` {any} Event arguments.

### Client events

#### Event: "client/connect"

-   `options` {Object} Options:
    -   `connectionId` {string} Client connection id (`uuid`);
    -   `type` {string} Connection type: `"api"`, `"rpc"`.

Emitted on new client connected using persistent connection.

#### Event: "client/disconnect"

-   `options` {Object} Options:
    -   `connectionId` {string} Client connection id (`uuid`);
    -   `type` {string} Connection type: `"api"`, `"rpc"`.

Emitted on persistent client disconnected.

### Cluster events

#### Event: "cluster/connect"

Emitted on cluster connected.

#### Event: "cluster/disconnect"

Emitted on cluster disconnected.

#### Event: "cluster/error"

-   `error` {string} Error message.

Emitted on cluster error.

### Services events

Services events - events, emitted by the services to which your application is connected. You also can send events to the services.

#### Event: `service/connect/<service-name>`

Emitted on service with the specified name become connected.

#### Event: `service/disconnect/<service-name>`

Emitted on service with the specified name become disconnected.

#### Event: `service/event/<service-name>/<event-name>`

-   `...args` {any} Event arguments.

Events from the connected serivce.

#### Sending events to the services

To send events to the connected service you need to publish them to the `service` endpoint.

```javascript
app.publish( "service", services, name, ...args );
```

-   `services` {string|Array} Target services names. You can use `"*"` to send event to the all connected services.
-   `name` {string} Event name.
-   `...args` {any} Event arguments.
