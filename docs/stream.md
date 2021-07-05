# Stream

Adds some missed methods to the `node` streams.

```javascript
import "@softvisio/core/stream";
```

## Class: stream.Readable

### readable.readChunk( chunkLength, options? )

-   `chunkLength` <integer\> Chunk length in bytes.
-   `options?` <Object\>:
    -   `encoding` <string\> Buffer encoding. If specified returned buffer will be encoded to string.
-   Returns: <Promise\> Fullfils with the <Buffer\>, <string\> or <null\> in case of error.

Reads chunk of data with the deifned length. Example:

```javascript
const buffer = await stream.readChunk(100); // reads 100 bytes, returns Buffer

const string = await stream.readChunk(100, { encoding: "utf8" }); // reads 100 bytes, returns utf8 string
```

### readable.readLine( options? )

-   `options?` <Object\>:
    -   `eol` <string\> | <Buffer\> End of line. **Default:** `"\n"`.
    -   `maxLength` <integer\> Max line length. **Default:** `Infinity`.
    -   `encoding` <string\> Buffer encoding. If specified returned buffer will be encoded to string.
-   Returns: <Promise\> Fullfils with the <Buffer\>, <string\> or <null\> in case of error.

Reads line ended with the specified EOL separator and with the defined maximum length. This method is optimized for speed and can be used to read lines from large buffers, for example to parse `multipart/form-data` streams. Example:

```javascript
const string = await stream.readLine({ eol: "\r\n", maxLength: 100, encoding: "utf8" });
```

### readable.readHttpHeaders( options? )

-   `options?` <Object\>
    -   `maxLength` <integer\> Max buffer length. **Default:** `64k`.
-   Returns: <Promise\> Fullfils with the <Buffer\> or <null\> in case of error.

Reads HTTP headers.
