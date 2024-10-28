# Tmp

```javascript
import * as tmp from "@softvisio/core/tmp";
```

## Class: TmpFile

```javascript
const file = new TmpFile();
```

Temporary file is removed automatically on process exit or on garbage collection if goes out of the scope.

### new tmp.TmpFile( options? )

-   `options` {Object}:
    -   `dirname?` {string} Directory, where temp file will be created. **Default:** `os.tmpdir()`.
    -   `extname?` {string} Tmp file extension. Must be started with the `"."`, for example `".txt"`.
    -   Other options, supported by the {File} constructor.

Temporary file is **not** created on file system when object is instantiated. Just unique file system path is generating.

### file.isDestroyed

-   Returns: {boolean} `true` if file was destroyed.

### file.path

-   Returns: {string} Absolute file path.

### file.destroy()

Manually destroy temporary file.

## Class: TmpDir

```javascript
const dir = new TmpDir();
```

Temporary directory is removed automatically on process exit or on garbage collection if goes out of the scope.

### new tmp.TmpDir( options? )

-   `options` {Object}:
    -   `dirname?` {string} Directory, where temp directory will be created. **Default:** `os.tmpdir()`.

Creates temporary directory in the file system.

### dir.isDestroyed

-   Returns: {boolean} `true` if directory was destroyed.

### dir.path

-   Returns: {string} Absolute directory path.

### dir.destroy()

Manually destroy temporary directory.
