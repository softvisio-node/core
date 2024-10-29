# Env

Provides set of function to manage project environment.

```javascript
import env from "@softvisio/core/env";

console.log( env.root );
```

### env.mode

-   Returns: {string} Value of `NODE_ENV` or `"production"`.

This property is writable under the `nodejs` only.

### env.isDevelopment

-   Returns: {boolean} `true` if mode is development.

### env.isProduction

-   Returns: {boolean} `true` if mode is production.

### env.isTest

-   Returns: {boolean} `true` if mode is test.

### env.root

-   Returns: {string} Top-level package root directory.

### env.package

-   Returns: {Object} Top-level `package.json`.

### env.apply( env, options? )

-   `env` {Object}
-   `options?` {Object}

### readConfig( options? )

-   `options?` {Object}

### env.getUserConfig()

-   Returns: {Promise} Fullfils with the `softvisio/config.js` export.

### env.getXdgConfigDir( name )

-   `name` {string} Project name.
-   Returns: {string} Path to the project XDG config directory.

### env.getXdgDataDir( name )

-   `name` {string} Project name.
-   Returns: {string} Path to the project XDG data directory.

### env.getXdgCacheDir( name )

-   `name` {string} Project name.
-   Returns: {string} Path to the project XDG cache directory.

### env.getXdgRuntimeDir( name )

-   `name` {string} Project name.
-   Returns: {string} Path to the project XDG runtime directory.

### env.findXdgConfig( name )

-   `name` {string} Config name in the format `project-name/config-name`.
-   Returns: {string|null} Absolute path to the found config or {null}.

Tries to find application config, following XDG specification.
