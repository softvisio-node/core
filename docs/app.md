# Application

## Events

Send application event:

```
app.emit( "event-name", ...args );
```

Send local event (will be delivered to the app and threads listeners):

```
app.publish( "event-name", ...args );
```

Send global event (will be delivered to all listeners in cluster):

```
app.publish( "/event-name", ...args );
```

To API users:

```
app.publish( "/api", event-name, users, ...args );
```

To RPC users:

```
app.publish( "/rpc", event-name, ...args );
```

### Events, emitted byt the core modules

#### "api/event/<event-name\>"

Event from the external API connection.

-   `auth` <Auth\> Connections authentication descriptor.
-   `...args` <any\> Event arguments.

#### "rpc/event/<event-name\>"

Event from the external RPC connection.

-   `...args` <any\> Event arguments.

#### "/app/settings-update"

Published globally on application settings updated.

-   `settings` <Object\> Application settings.

#### "cluster/connect"

Published on connect to the cluster.

#### "cluster/disconnect"

Published on disconnect from the cluster.
