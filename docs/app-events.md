# Application events

Events can be prefixed with the scope:

-   `:local/` - send event to the threads and internal listeners;

-   `:threads/` - send event to the threads listeners;

    ```
    app.publish( ":threads/event-name" ); // sends event to all threads
    app.publish( ":threads:worker/event-name" ); // sends event to all threads, named "worker"
    ```

-   `:<CUSTOM-GROUP-NAME>/` - send event to the cluster listeners;

-   `:users/` - send event to the connected api users;
    ```
    app.publish( ":users/event-name" ); // sends event to all users
    app.publish( ":users:!/event-name" ); // sends event to not authenticated user
    app.publish( ":users:@/event-name" ); // sends event to all authenticated user
    app.publish( ":users:root/event-name" ); // sends event to root user
    app.publish( ":users:admin,@user/event-name" ); // sends event to "admin" and "user" users groups
    app.publish( ":users:1,2,3/event-name" ); // sends event to users with id 1, 2 and 3
    ```

## Events, emitted by application components

-   user/event-name - event from api user;
    When you fire api event in api client (`api.publish("event-name")`) it will appear on server as `user/event-name`.

-   :local/cluster/connect, cluster/disconnect;
-   :local/api/settings/update - emitted by api;
