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

## Class: Signal

```javascript
import Signal from "@softvisio/core/threads/signal";

const signal = new Signal();
```
