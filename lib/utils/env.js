require( "@softvisio/core" );
const fs = require( "../fs" );
const path = require( "path" );

class Env extends require( "./browser/env" ).constructor {
    #root;

    get root () {
        if ( this.#root == null ) {
            for ( const _path of require.main.paths ) {
                if ( fs.existsSync( _path ) ) {
                    this.#root = path.dirname( _path );

                    break;
                }
            }

            this.#root ??= "";
        }

        return this.#root;
    }

    // prefix
    // trim
    apply ( env, options = {} ) {
        if ( !Array.isArray( env ) ) env = [env];

        const tmp = {};

        for ( const _env of env ) {
            for ( const name in _env ) {
                let value = _env[name];

                // prepare value
                value ??= "";
                if ( options.trim ) value = value.trim();

                // interpolate
                value = value.replace( /(?<!\\)\$\{?([a-zA-Z0-9_]+)\}?/g, ( match, name ) => process.env[name] ?? tmp[name] ?? "" );

                tmp[name] = value;
            }
        }

        for ( const name in tmp ) {

            // must start with prefix
            if ( options.prefix && !name.startsWith( options.prefix ) ) continue;

            // do not override
            if ( Object.hasOwnProperty.call( process.env, name ) ) continue;

            // add variable
            process.env[name] = tmp[name];
        }
    }

    // mode: development, production, ...
    // root: path, default - project root
    // prefix: default APP_
    read ( options = {} ) {
        const env = [],
            files = [".env.yaml", ".env.local.yaml"],
            root = options.root ?? this.root,
            prefix = options.prefix || "APP_",
            config = {};

        if ( options.mode ) files.push( `.env.${options.mode}.yaml`, `.env.${options.mode}.local.yaml` );

        for ( const file of files ) {
            if ( !fs.existsSync( root + "/" + file ) ) continue;

            const _config = fs.config.read( root + "/" + file );

            if ( _config.env ) {
                env.push( _config.env );
                delete _config.env;
            }

            // merge
            for ( const key in _config ) config[key] = { ...( config[key] || {} ), ..._config[key] };
        }

        this.apply( env, { prefix } );

        return config;
    }
}

module.exports = new Env();
