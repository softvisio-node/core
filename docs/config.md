# Config

Read / write config files, based on file extension.

```javascript
import config from "@softvisio/core/config";

const data = config.read("cfg.yaml");
const data = config.read("#resources/cfg.yaml", { resolve: import.meta.url });

config.write("cfg.json", data, { readable: true });
```

### config.read( path, options? )

-   `path` {string|URL} Path paramenter can be filesystem path or `file:` URL (as {string} or {URL} object).
-   `options?` {Object}:
    -   `resolve` {string|URL} File URL to resolve config path. Usually `import.meta.url` is used.
    -   `json5` {boolean} Parse `JSON` configs using `json5` parser.
    -   `all` {boolean} For `YAML` configs returns all documents as {Array}.
-   Returns: {any} Config data.

### config.write( path, data, options? )

-   `path` {string|URL} Path paramenter can be filesystem path or `file:` URL (as {string} or {URL} object).
-   `data` {any} Config data to write.
-   `options?` {Object}:
    -   `resolve` {string|URL} File URL to resolve config path. Usually `import.meta.url` is used.
    -   `readable` {boolean} Pretty print `JSON` configs.
