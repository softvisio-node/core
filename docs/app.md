# Application

## Events

Application has three events type:

-   **global** - Events delivered to the local application listeners, local threads and annd applicaiotn instances and threads in the cluster. Cluster must be initialized, otherwise events will not be delivered to the cluster listeners. **Global events are prefixed with `"/"`**.

    ```javascript
    // listen
    app.on("/global-event-name", callback);

    // publish
    app.publish("/global-event-name");
    ```

-   **local** - Local events are delivered to the local application and local threads.

    ```javascript
    // listen
    app.on("local-event-name", callback);

    // publish
    app.publish("local-event-name");
    ```

-   **application** - Application events are delivered to the local application only.

    ```javascript
    // listen
    app.on("app-event-name", callback);

    // publish
    app.emit("all-event-name");
    ```

### API events

API events - events, emitted by the API and connected API users. You also can send events to the connected API users.

#### Event: "api/connect"

```javascript
app.on("api/connect", callback);
```

Emitted on API backend connected. Means that API backend is fully worked and can be used.

#### Event: "api/disconnect"

```javascript
app.on("api/disconnect", callback);
```

Emitted on API backend disconnected. Means, that API unable to use backend until it will be re-connected. You need to drop caches or do some other cleanup.

#### Event: "/api/settings-update"

```javascript
app.on("/api/settings-update", callback);
```

-   `callback` <Function\> Event listener:
    -   `settings` <Object\> Updated application settings.

Emitted, when application settings were updated.

#### Event: "api/event/<event-name\>"

-   `auth` <Auth\> Sender authentication descriptor.
-   `...args` <any\> Event arguments.

Events from the externally connected API users. All such events names are prefixed with the `api/event/` prefix. For example, if you want to handle event named `test` from the external API user you need to listen for `api/event/test`.

#### Sending events to the API users

To send events to the connected API users you need to publish them to the `api` endpoint.

```javascript
app.publish("api", users, name, ...args);
```

-   `users` <string\> | <Array\> Target user identificators. Each identificator can be the one of:

    -   `user id` <integer\> Target user id.
    -   `users group name` <string\> Application specific users group name.
    -   `"*"` All connected users.
    -   `"root"` Root user.
    -   `"user"` All authenticated user.
    -   `"guest"` All not authenticated users.

-   `name` <string\> Event name.
-   `...args` <any\> Event arguments.

### RPC events

RPC events - events, emitted by connected RPC clients. You also can send events to the connected RPC clients.

#### Event: "rpc/event/<event-name\>"

-   `...args` <any\> Event arguments.

Events from the externally connected RPC clients. All such events names are prefixed with the `rpc/event/` prefix. For example, if you want to handle event named `test` from the external RPC user you need to listen for `rpc/event/test`.

#### Sending events to the RPC users

To send events to the connected RPC users you need to publish them to the `rpc` endpoint.

```javascript
app.publish("rpc", name, ...args);
```

-   `name` <string\> Event name.
-   `...args` <any\> Event arguments.

### Cluster events

#### Event: "cluster/connect"

```javascript
app.on("cluster/connect", callback);
```

Emitted on cluster connected.

#### Event: "cluster/disconnect"

```javascript
app.on("cluster/disconnect", callback);
```

Emitted on cluster disconnected.

#### Event: "cluster/error"

```javascript
app.on("cluster/error", callback);
```

-   `callback` <Function\> Event listener:
    -   `error` <string\> Error message.

Emitted on cluster error.

### Services events

Services events - events, emitted by the services to which your application is connected. You also can send events to the services.

#### Event: "service/connect/<service-name\>"

```javascript
app.on("service/connect/<service-name>", callback);
```

Emitted on service with the specified name become connected.

#### Event: "service/disconnect/<service-name\>"

```javascript
app.on("service/disconnect/<service-name>", callback);
```

Emitted on service with the specified name become disconnected.

#### Event: "service/event/<service-name\>/<event-name\>"

```javascript
app.on("service/event/<service-name>/<event-name>", callback);
```

-   `callback` <Function\> Event listener:
    -   `...args` <any\> Event arguments.

Events from the connected serivce.

#### Sending events to the services

To send events to the connected service you need to publish them to the `service` endpoint.

```javascript
app.publish("service", services, name, ...args);
```

-   `services` <string\> | <Array\> Target services names. You can use `"*"` to send event to the all connected services.
-   `name` <string\> Event name.
-   `...args` <any\> Event arguments.
