# Threads

## Class: Threads

```javascript
import Threads from "@softvisio/core/threads";

const threads = new Threads();
```

### Event: "event"

### Event: "event/<event-name>"

### Event: "subscribe"

-   `eventName` <string\> Subscribed event name.

Emitted, when one of the remote threads subscribed to event.

### Event: "unsubscribe"

-   `eventName` <string\> Unsubscribed event name.

Emitted, when no more remote threads listening for `eventName`.

### Threads.isMainThread

-   Returns: <boolean\> `true` if threads is main process thread.

### threads.run( options )

### threads.publish( name, ...args )

### threads.call( name, ...args )

### threads.callVoid( name, ...args )

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
