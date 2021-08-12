# SQL

```javascript
import sql from "@softvisio/core/sql";
```

## DBH

### PostgreSQL

```javascript
import sql from "@softvisio/core/sql";

const dbh = await sql.new("pgsql://user:password@host");
```

### SQLite

```javascript
import sql from "@softvisio/core/sql";

const dbh = await sql.new("sqlite:");
```

## Class: sql.Query

## Migration

```javascript
await dbh.loadSchema(new URL("db", import.meta.url));

const res = await dbh.migrate();
```

### dbh.loadSchema( url, module? )

-   `url` <string\> | <URL\> File URL, location of the database schema directory.
-   `module?` <string\> Schema module name. **Default:** `"main"`.

### dbh.migrate()

-   Returns: <Promise\> Fulfils with the schema migration <Result\>.

### Database schema

Database schema is the set of the files. Example:

```text
lib
└─ db
   ├─ index.json
   ├─ 010-init.js
   ├─ 020-table1.js
   ├─ 030-table2.js
   ├─ ...
   └─ patch
      ├─ 001-patch1.js
      ├─ 002-patch2.js
      └─ ...
```

Schema directory contains `index.json` file with the schema meta data. Schema files describes main SQL schema. Patch directory contains patches for the main schema.

Schema or patch file name must have folloving structure: `<index>-<name>.js`, where `<index>` is numeric file index, `<name>` - arbitrary file name. Files applied in order of their indexes (starting from the minimal).

When you merged patch with the main schema, you need to update `version` field in the `index.json`.
