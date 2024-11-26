# Class: Blob

```javascript
import Blob from "@softvisio/core/blob";
```

### Blob.new( content?, options? )

- `content?` {Buffer|Array} Blob content.
- `options` {Object}:
    - `type` {string} MIME type.

### blob.type

- Returns: {string} MIME type, if defined.

### blob.size

- Returns: {integer} Blob buffer size.

### blob.buffer()

- Returns: {Promise} Fullfils with the file content as {Buffer}.

### blob.arrayBuffer()

- Returns: {Promise} Fullfils with the file content as {ArrayBuffer}.

### blob.text( options? )

- `options?` {Object}:
    - `encoding?` {string} Text encoding. **Default:** `utf8`.
- Returns: {Promise} Fullfils with the file content as {string}.

### blob.stream()

- Returns: {stream.Readable} File content as readable stream.

### blob.slice( start, end, type )

- `start` {integer} Start offset.
- `end` {integer} End offset.
- `type?` {string} MIME type.
- Returns: {Blob}.

Slice blob buffer and returns new {Blob} object instance.

### blob.getContent()

- Returns: {Blob|undefined} Internal buffer.

### blob.setContent( content? )

- `content?` {Buffer|Array} Content to set.
