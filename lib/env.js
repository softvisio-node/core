import "#index";

import fs from "#lib/fs";
import path from "path";
import _Env from "#browser/env/common";
import os from "os";
import url from "url";

const XDG_DEFAULTS = {
    "linux": {
        "CONFIG_HOME": process.env.HOME + "/.config",
        "DATA_HOME": process.env.HOME + "/.local/share",
        "CACHE_HOME": process.env.HOME + "/.cache",
        "RUNTIME_DIR": os.tmpdir(),
        "CONFIG_DIRS": ["/etc/xdg"],
        "DATA_DIRS": ["/usr/local/share", "/usr/share"],
    },
    "win32": {
        "CONFIG_HOME": process.env.LOCALAPPDATA,
        "DATA_HOME": process.env.LOCALAPPDATA,
        "CACHE_HOME": os.tmpdir(),
        "RUNTIME_DIR": os.tmpdir(),
        "CONFIG_DIRS": [process.env.APPDATA],
        "DATA_DIRS": [process.env.APPDATA],
    },
};

XDG_DEFAULTS.aix = XDG_DEFAULTS.linux;
XDG_DEFAULTS.darwin = XDG_DEFAULTS.linux;
XDG_DEFAULTS.freebsd = XDG_DEFAULTS.linux;
XDG_DEFAULTS.openbsd = XDG_DEFAULTS.linux;
XDG_DEFAULTS.sunos = XDG_DEFAULTS.linux;

const PATH_SEP = process.platform === "win32" ? ";" : ":";

const XDG = {
    "CONFIG_HOME": process.env.XDG_CONFIG_HOME || XDG_DEFAULTS[process.platform].XDG_CONFIG_HOME,
    "DATA_HOME": process.env.XDG_DATA_HOME || XDG_DEFAULTS[process.platform].XDG_DATA_HOME,
    "CACHE_HOME": process.env.XDG_CACHE_HOME || XDG_DEFAULTS[process.platform].XDG_CACHE_HOME,
    "RUNTIME_DIR": process.env.XDG_RUNTIME_DIR || XDG_DEFAULTS[process.platform].XDG_RUNTIME_DIR,
    "CONFIG_DIRS": process.env.XDG_CONFIG_DIRS ? process.env.XDG_CONFIG_DIRS.split( PATH_SEP ) : XDG_DEFAULTS[process.platform].XDG_CONFIG_DIRS,
    "DATA_DIRS": process.env.XDG_DATA_DIRS ? process.env.XDG_DATA_DIRS.split( PATH_SEP ) : XDG_DEFAULTS[process.platform].XDG_DATA_DIRS,
};

const USER_CONFIG = "softvisio/config.js";

class Env extends _Env {
    #root;
    #userConfig;
    #package;

    get mode () {
        return super.mode;
    }

    set mode ( value ) {
        process.env.NODE_ENV = value || "production";
    }

    get root () {
        if ( this.#root == null ) {
            let _path = process.argv[1];

            while ( path.dirname( _path ) !== _path ) {
                _path = path.dirname( _path );

                if ( fs.existsSync( _path + "/node_modules" ) ) {
                    this.#root = _path;

                    break;
                }
            }

            this.#root ??= "";
        }

        return this.#root;
    }

    get package () {
        if ( !this.#package ) this.#package = fs.config.read( this.root + "/package.json" );

        return this.#package;
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

    // path: path, default - project root
    // prefix: default APP_
    readConfig ( options = {} ) {
        const env = [],
            files = [".config.yaml", ".config.local.yaml"],
            root = options.path ?? this.root,
            prefix = options.prefix || "APP_",
            config = {};

        files.push( `.config.${this.mode}.yaml`, `.config.${this.mode}.local.yaml` );

        for ( const file of files ) {
            if ( !fs.existsSync( root + "/" + file ) ) continue;

            const _config = fs.config.read( root + "/" + file );

            // extract "env" key
            if ( _config.env ) {
                env.push( _config.env );
                delete _config.env;
            }

            // merge
            for ( const key in _config ) {
                if ( _config[key] == null ) continue;
                else if ( Object.isPlain( _config[key] ) ) config[key] = { ...( Object.isPlain( config[key] ) ? config[key] : {} ), ..._config[key] };
                else config[key] = _config[key];
            }
        }

        this.apply( env, { prefix } );

        return config;
    }

    async getUserConfig () {
        if ( !this.#userConfig ) {
            const configPath = this.findXDGConfig( USER_CONFIG );

            if ( configPath ) {
                this.#userConfig = ( await import( url.pathToFileURL( configPath ) ) ).default;
            }

            this.#userConfig ||= {};
        }

        return this.#userConfig;
    }

    findXDGConfig ( path ) {
        for ( const configDir of [XDG.CONFIG_HOME, ...XDG.CONFIG_DIRS] ) {
            if ( fs.existsSync( configDir + "/" + path ) ) return configDir + "/" + path;
        }
    }
}

export default new Env();
