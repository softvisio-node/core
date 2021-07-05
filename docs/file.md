# Class: File

```javascript
import File from "@softvisio/core/file";
```

### File.new( options )

-   `name` <string\>
-   `type` <string\>
-   `size` <integer\>
-   `path` <string\>
-   `data` <Buffer\> | <Array\> | <stream.Readable\>

### file.data

-   Returns: <any\>

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
