# Threads

## Class: Threads

```javascript
import Threads from "@softvisio/core/threads";

const threads = new Threads();
```

## Class: CondVar

```javascript
import CondVar from "@softvisio/core/threads/condvar";

const cv = new CondVar().begin();

await cv.end().recv();
```

### cv.begin()

-   Returns: <CondVar\> Instance of `this`.

### cv.end()

-   Returns: <CondVar\> Instance of `this`.

### cv.send( res )

-   `res` <any\> Any result, passed to the `cv.recv()` callback.

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
