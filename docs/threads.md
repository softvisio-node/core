# Threads

## Class: Threads

```javascript
import Threads from "@softvisio/core/threads";

const threads = new Threads();

var res = await threads.run({
    worker1: {
        num: 1
        path: new URL("./worker1.js", import.meta.url),
        arguments: []
    },
    worker2: {
        num: -2
        path: new URL("./worker2.js", import.meta.url),
        arguments: []
    },
});

if (!res.ok) throw res;

res = await threads.call("worker1", "method", arg1, arg2);
```

### Event: "event"

-   `name` <string\> Remote event name.
-   `args` <Array\> Remote event arguments.

Emitted, when remote thread publish event.

### Event: "event/<event-name\>"

-   `...args` <any\> Remote event arguments.

Emitted, when remote thread publish event.

### Event: "subscribe"

-   `eventName` <string\> Subscribed event name.

Emitted, when one of the remote threads subscribed to event.

### Event: "unsubscribe"

-   `eventName` <string\> Unsubscribed event name.

Emitted, when no more remote threads listening for `eventName`.

### Threads.isMainThread

-   Returns: <boolean\> `true` if threads is main process thread.

### threads.run( options )

-   `options` <Object\> Threads to run. Property name is a thread name. Property value <Object\>:

    -   `num` <integer\> Number of threads to run. **Default:** number of CPUs.
    -   `path` <URL\> | <string\> File URL or path to the worker module.
    -   `arguments?` <Array\> Arguments for worker constructor.

-   Returns: <Promise\> Resolves to the <Result\>.

Start remote threads.

### threads.publish( name, ...args )

-   `name` <string\> Event name.
-   `...args` <any\> Event arguments.

Publish event. Event will be delivered only to the threads, which are subscribed to this event.

### threads.call( name, ...args )

-   `name` <string\> Thread name.
-   `method` <string\> Method name.
-   `...args` <any\> Remote method arguments.
-   Returns: <Promise> Resolved to the <Result\>.

Select remote thread (round robin) and calls remote method with the given arguments.

### threads.callVoid( thread, method, ...args )

-   `name` <string\> Thread name.
-   `method` <string\> Method name.
-   `...args` <any\> Remote method arguments.

Select remote thread (round robin) and calls remote method with the given arguments.

## Class: CondVar

```javascript
import CondVar from "@softvisio/core/threads/condvar";

const cv = new CondVar().begin();

await cv.end().recv();
```

### cv.begin()

-   Returns: <CondVar\> Instance of `this`.

Increases internal counter. If counter will equal `0` condvar will be resolved.

### cv.end()

-   Returns: <CondVar\> Instance of `this`.

Decreases internal counter. If counter will equal `0` condvar will be resolved.

### cv.send( res? )

-   `res?` <any\> Any result, will be passed to the `cv.recv()` callback.

Resolves condvar, if it wasn't resolved previously.

### cv.recv()

-   Returns: <Promise\> Resolves to the <any\>.

## Class: Semaphore

```javascript
import Semaphre from "@softvisio/core/threads/semaphore";

const semaphore = new Semaphore();
```

## Class: Mutex

```javascript
import Mutex from "@softvisio/core/threads/mutex";

const mutex = new Mutex();
```

`Mutex` exports the same interface as <Semaphore\>, except `MaxThreads` is limited to `1`.

## Class: Signal

```javascript
import Signal from "@softvisio/core/threads/signal";

const signal = new Signal();
```
