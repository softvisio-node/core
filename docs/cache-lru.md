# Cache LRU

```javascript
import CacheLRU from "@softvisio/utils/cache-lru";

const cache = new CacheLRU( { "max": 10 } );
```

## Class: CacheLRU

### new CacheLRU( options? )

- `options` {Object}:
    - `maxSize` {integer} Maximum cache size. Use `0` or `null` to remove limit. **Default:** `null`.
    - `maxAge` {integer} Default max age. **Default:** `null`.
    - `stale` {boolean} `true` to allow to return stale values.
- Returns: {CacheLRU}.

### Event: "delete"

- `key` {any} Deleted cache entry key.
- `value` {any} Deleted cache entry value.

Emitted on key removed from the cache.

### Event: "option"

- `option` {string} Updated option name.

Emitted on cache option updated.

### cache.maxSize

- Returns: {integer} Cache maximum size limit.

### cache.maxAge

- Returns: {integer} Default maximum cache entry age.

### cache.stale

- Returns: {boolean} `true` if allowed to return `stale` values.

### cache.size

- Returns: {integer} Number of items in the cache.

### cache.has( key )

- `key` {any} Key to search.
- Returns: {boolean} `true` if key can be retrieved.

Checks, that key is exists in the cache, not stale and can be retrieved. Key meta data is not updated.

### cache.get( key )

- `key` {any} Key to search.
- Returns: {any} Key value.

Retrieve key value from the cache and move key to the top of the cache.

### cache.set( key, value, maxAge? )

- `key` {any} Key.
- `value` {any} Value, associated with the key.
- `maxAge?` {integer} Maximum age. If maximum age is negative key does not added.

### cache.delete( key, options? )

- `key` {any} Key to delete.
- `options?` {Object}:
    - `silent` {boolean} If `true` do not emit `"delete"` event.

### cache.reset( options? )

- `options?` {Object}:
    - `silent` {boolean} If `true` do not emit `"delete"` event.

Removes all entries from the cache.

### cache.prune( options? )

- `options?` {Object}:
    - `silent` {boolean} If `true` do not emit `"delete"` event.

Removes stale entries from the cache.
