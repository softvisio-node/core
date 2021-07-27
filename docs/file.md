# Class: File

```javascript
import File from "@softvisio/core/file";
```

### File.new( options? )

-   `options?` <Object\>:
    -   `path` <string\> Absolute file path.
    -   `name` <string\> File name. If not specified `path` basename will be used.
    -   `type` <string\> MIME type. If not specified will be detected by the file `name` or `application/octet-stream` will be used as default value.
    -   `size` <integer\> File size in bytes, if known. If not defined and `path` is present real file size will be taken.
    -   `content` <Buffer\> | <Array\> | <stream.Readable\> File content.

### file.lastModified

### file.lastModifiedDate

### file.name

### file.type

### file.size

### file.path

### file.buffer()

-   Returns: <Promise\> Fullfils with the file content as <Buffer\>.

### file.text( encoding? )

-   `encoding?` <string\> Text encoding. **Default:** `utf8`.
-   Returns: <Promise\> Fullfils with the file content as <string\>.

### file.stream()

-   Returns: <stream.Readable\> File content as readable stream.
