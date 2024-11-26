# Class: File

```javascript
import File from "@softvisio/core/file";
```

### File.new( options? )

- `options?` {File|Object} See the `new File()` constructor options.

If `options` is the instance of {File} returns it as is. Otherwise calls `new File( options )` constructor (see below).

### new File( options? )

- `options?` {Object}:
    - `path?` {string} Absolute file path.
    - `name?` {string} File name. If not specified `path` basename will be used.
    - `type?` {string} MIME type. If not specified will be detected by the file `name` or `application/octet-stream` will be used as default value.
    - `size?` {integer} File size in bytes, if known. If not defined and `path` is present real file size will be taken.
    - `content?` {Buffer|Array|stream.Readable} File content.

### file.lastModified

- Returns: {integer} UNIX timestamp in milliseconds.

### file.lastModifiedDate

- Returns: {Date} File last modified date.

### file.name

- Returns: {string} File base name.

### file.type

- Returns: {string} File MIME type.

### file.size

- Returns: {integer} File size in bytes.

### file.path

- Returns: {string} Absolute file path.

### file.buffer()

- Returns: {Promise} Fullfils with the file content as {Buffer}.

### file.aeeayBuffer()

- Returns: {Promise} Fullfils with the file content as {ArrayBuffer}.

### file.text( options? )

- `options` {Object}:
    - `encoding?` {string} Text encoding. **Default:** `utf8`.
- Returns: {Promise} Fullfils with the file content as {string}.

### file.stream()

- Returns: {stream.Readable} File content as readable stream.
