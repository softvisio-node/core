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

-   `name` {string} Remote event name.
-   `args` {Array} Remote event arguments.

Emitted, when remote thread publish event.

### Event: `event/<event-name>`

-   `...args` {any} Remote event arguments.

Emitted, when remote thread publish event.

### Event: "subscribe"

-   `eventName` {string} Subscribed event name.

Emitted, when one of the remote threads subscribed to event.

### Event: "unsubscribe"

-   `eventName` {string} Unsubscribed event name.

Emitted, when no more remote threads listening for `eventName`.

### Threads.isMainThread

-   Returns: {boolean} `true` if threads is main process thread.

### threads.run( options )

-   `options` {Object} Threads to run. Property name is a thread name. Property value {Object}:

    -   `num` {integer} Number of threads to run. **Default:** number of CPUs.
    -   `path` {URL|string} File URL or path to the worker module.
    -   `arguments?` {Array} Arguments for worker constructor.

-   Returns: {Promise} Resolves to the {Result}.

Start remote threads.

### threads.publish( name, ...args )

-   `name` {string} Event name.
-   `...args` {any} Event arguments.

Publish event. Event will be delivered only to the threads, which are subscribed to this event.

### threads.call( name, ...args )

-   `name` {string} Thread name.
-   `method` {string} Method name.
-   `...args` {any} Remote method arguments.
-   Returns: <Promise> Resolved to the {Result}.

Select remote thread (round robin) and calls remote method with the given arguments.

### threads.callVoid( thread, method, ...args )

-   `name` {string} Thread name.
-   `method` {string} Method name.
-   `...args` {any} Remote method arguments.

Select remote thread (round robin) and calls remote method with the given arguments.

## Class: CondVar

```javascript
import CondVar from "@softvisio/core/threads/condvar";

const cv = new CondVar().begin();

await cv.end().wait();
```

### cv.begin()

-   Returns: {CondVar} Instance of `this`.

Increases internal counter. If counter will equal `0` condvar will be resolved.

### cv.end()

-   Returns: {CondVar} Instance of `this`.

Decreases internal counter. If counter will equal `0` condvar will be resolved.

### cv.send( res? )

-   `res?` {any} Any result, will be passed to the `cv.wait()` callback.

Resolves condvar, if it wasn't resolved previously.

### cv.wait()

-   Returns: {Promise} Resolves to the {any}.

## Class: Semaphore

```javascript
import Semaphre from "@softvisio/core/threads/semaphore";

const semaphore = new Semaphore();
```

### Event: "pause"

-   `semapthore` {Semaphore} This semaphore.

Emitted on semaphore paused.

### Event: "resume"

-   `semapthore` {Semaphore} This semaphore.

Emitted on semaphore resumed.

### Event: "free"

-   `semapthore` {Semaphore} This semaphore.

Emitted when semaphore has free threads slots. Not emitted, if semaphore is paused.

### Event: "free-threads"

Emitted after thread is finished and semaphore has free threads to run

### Semaphore.Set

-   Returns: {SemaphoreSet}.

### new Semaphore( options? )

-   `options` {Object}:
    -   `id?` {string} Semaphore id. If not defined `uuid` will be used.
    -   `maxThreads?` {integer|Infinity} Max number of the parallel running threads.
    -   `maxWaitingThreads?` {integer|Infinity} Max number of the waiting threads.

### semaphore.id

-   Returns: {string} Semaphore id.

### semaphore.maxThreads

-   Returns: {integer|Infinity} Max number of parallel running threads.

### semaphore.maxWaitingThreads

-   Returns: {integer|Infinity} Max number of waiting threads (max. queue length).

### semaphore.runningThreads

-   Returns: {integer} Number of the running threads.

### semaphore.freeThreads

-   Returns: {integer|Infinity} Number of the threads, that can be started until limit will be reached.

### semaphore.waitingThreads

-   Returns: {integer|Infinity} Number of the threads in the queue.

### semaphore.freeWaitingThreads

-   Returns: {integer|Infinity} Number of the threads, that can be pushed to the queue until limit will be reached.

### semaphore.totalThreads

-   Returns: {integer|Infinity} Total number of the threads, that can be pushed to the semaphore.

### semaphore.totalFreeThreads

-   Returns: {integer|Infinity} Number of the threads, that can be pushed to the semaphore currently.

### semaphore.isLocked

-   Returns: {boolean} `true` if limit of the parallel running threads is reached.

### semaphore.isPaused

-   Returns: {boolean} `true` if .semaphore is paused.

### semaphore.pause()

Pause semaphore.

### semaphore.resume()

Resume semaphore.

### semaphore.runThread( method, ...args )

-   `method` {string|Function} Method to call.
-   `...args` {an}> Method arguments.
-   Returns: {Promise} resolves to {Result}.

### semaphore.unshiftThread( method, ...args )

-   `method` {string|Function} Method to call.
-   `...args` {any} Method arguments.
-   Returns: {Promise} resolves to {Result}.

Run thread before other queued threads.

### semaphore.tryStartThread()

-   Returns: {boolean} `true` if thread was started.

### semaphore.startThread ( unshift )

-   `unshift` {Boolean} If `true` - push threads to the start of the queue.
-   Returns: {Promise} Resolves, when thread will be started.

### semaphore.endThread()

End current thread.

### semaphore.tryDown()

-   Returns: {boolean} `true` if semaphore was down.

Try do down semaphore.

### semaphore.down()

-   Returns: {Promise} Resolves, when semaphore will be down.

### semaphore.up()

Up semaphore.

### semaphore.signal

-   Returns: {Signal}.

## Class: SemaphoreSet

### semaphoreSet.has( id )

-   `id` {string} Semaphore id.
-   Returns: {boolean} `true` if semaphore with specified `id` is exists.

### semaphoreSet.get( id? )

-   `id?` {string} Semaphore id.
-   Returns: {Semaphore} Semaphore with the specified `id`. If such semaphore is not exists it will be created.

### semaphoreSet.delete( semaphore )

-   `semaphore` {Semaphore|string} Semaphore or semaphore id to delete.

Delete semaphore from the set.

## Class: Mutex

```javascript
import Mutex from "@softvisio/core/threads/mutex";

const mutex = new Mutex();
```

`Mutex` exports the same interface as {Semaphore}, except `MaxThreads` is limited to `1`.

## Class: Signal

```javascript
import Signal from "@softvisio/core/threads/signal";

const signal = new Signal();
```

### signal.waitingThreads

-   Returns: {integer} Number of the threads, waiting for the signal.

### signal.wait()

-   Returns: {Promise} Resolves to {any}. Returns immediately if signal already sent.

### signal.send( value )

-   `value` {any} Signal value.

If has waiting threads, value will be sent to the first waiting thread, otherwise `value` will be stored internally and passed to the first thread, which will call `signal.wait()` method.

### signal.try( value )

-   `value` {any} Signal value.

Try to send signal to the first waiting thread. If no waiting threads `value` will be lost.

### signal.broadcast( value )

-   `value` {any} Signal value.

Wake up all waiting threads and pass the `value`. If no waiting threads `value` will be lost.
