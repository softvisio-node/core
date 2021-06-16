# Application

## Events

Send application event:

```
app.emit( name, ...params );
```

Send local event (will be delivered to the app and threads listeners):

```
app.publish( name, ...params );
```

Send global event (will be delivered to all listeners in cluster):

```
app.publish( @name, ...params );
```
