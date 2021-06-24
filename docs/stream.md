# Stream

```javascript
import "@softvisio/core/stream";
```

### Stream.Readable.prototype.readChunk( chunkLength, options )

-   `chunkLength` <integer\> Chunk length in bytes.
-   `options` <Object\>:
    -   `encoding?` <string\> Buffer encoding. If specified returned buffer will be encoded to string.
-   Returns: <Promise\> Fullfils with the <Buffer\>, <string\> or <null\> is case of error.

### Stream.Readable.prototype.readLine( options )

-   `options` <Object\>:
    -   `eol` <string\> | <Buffer\> End of line. **Default:** `"\n"`.
    -   `maxLength` <integer\> Max line length. **Default:** `Infinity`.
    -   `encoding?` <string\> Buffer encoding. If specified returned buffer will be encoded to string.
-   Returns: <Promise\> Fullfils with the <Buffer\>, <string\> or <null\> is case of error.

### Stream.Readable.prototype.readHttpHeaders( options )

-   `options` <Object\>
    -   `maxLength` <integer\> Max buffer length. **Default:** `64k`.
-   Returns: <Promise\> Fullfils with the <Buffer\> or <null\> is case of error.
