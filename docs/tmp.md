# Tmp

```javascript
import * as tmp from "@softvisio/core/fs/tmp";
```

## Class: TmpFile

```javascript
const file = new TmpFile();
```

Temporary file is removed automatically on precess exit or on `JavaScript` garbage collection.

### new tmp.TmpFile( options? )

-   `options` <Object\>:
    -   `dirname?` <string\> Directory, where temp file will be created. **Default:** `os.tmpdir()`.
    -   `extname?` <string\> Tmp file extension. Must be started with the `"."`, for example `".txt"`.
    -   Other options, supported by the <File\> constructor.

### file.isDestroyed

-   Returns: <boolean\> `true` if file was destroyed.

### file.path

-   Returns: <string\> Absolute file path.

### file.destroy()

Manually destroy tmp file.

## Class: TmpDir

```javascript
const dir = new TmpDir();
```

Temporary directory is removed automatically on precess exit or on `JavaScript` garbage collection.

### new tmp.TmpDir( options? )

-   `options` <Object\>:
    -   `dirname?` <string\> Directory, where temp directory will be created. **Default:** `os.tmpdir()`.

### dir.isDestroyed

-   Returns: <boolean\> `true` if directory was destroyed.

### dir.path

-   Returns: <string\> Absolute file path.

### dir.destroy()

Manually destroy tmp dir.
