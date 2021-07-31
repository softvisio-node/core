import fs from "fs";
import { read as readConfig } from "#lib/config";
import path from "path";
import _Env from "#lib/_browser/env";
import os from "os";
import url from "url";
import { objectIsPlain } from "#lib/utils";

const XDG_DEFAULTS = {
    "default": {
        "CONFIG_HOME": os.homedir() + path.sep + ".config",
        "DATA_HOME": os.homedir() + path.sep + ".local" + path.sep + "share",
        "CACHE_HOME": os.homedir() + path.sep + ".cache",
        "RUNTIME_DIR": os.tmpdir(),
    },
    "linux": {
        "CONFIG_DIRS": ["/etc/xdg"],
        "DATA_DIRS": ["/usr/local/share", "/usr/share"],
    },
    "win32": {
        "CONFIG_DIRS": [],
        "DATA_DIRS": [],
    },
};

XDG_DEFAULTS.aix = XDG_DEFAULTS.linux;
XDG_DEFAULTS.darwin = XDG_DEFAULTS.linux;
XDG_DEFAULTS.freebsd = XDG_DEFAULTS.linux;
XDG_DEFAULTS.openbsd = XDG_DEFAULTS.linux;
XDG_DEFAULTS.sunos = XDG_DEFAULTS.linux;

const PATH_SEP = process.platform === "win32" ? ";" : ":";

const XDG = {
    "CONFIG_HOME": process.env.XDG_CONFIG_HOME || XDG_DEFAULTS.default.CONFIG_HOME || XDG_DEFAULTS[process.platform].CONFIG_HOME,
    "DATA_HOME": process.env.XDG_DATA_HOME || XDG_DEFAULTS.default.DATA_HOME || XDG_DEFAULTS[process.platform].DATA_HOME,
    "CACHE_HOME": process.env.XDG_CACHE_HOME || XDG_DEFAULTS.default.CACHE_HOME || XDG_DEFAULTS[process.platform].CACHE_HOME,
    "RUNTIME_DIR": process.env.XDG_RUNTIME_DIR || XDG_DEFAULTS.default.RUNTIME_DIR || XDG_DEFAULTS[process.platform].RUNTIME_DIR,
    "CONFIG_DIRS": process.env.XDG_CONFIG_DIRS ? process.env.XDG_CONFIG_DIRS.split( PATH_SEP ) : XDG_DEFAULTS.default.CONFIG_DIRS || XDG_DEFAULTS[process.platform].CONFIG_DIRS,
    "DATA_DIRS": process.env.XDG_DATA_DIRS ? process.env.XDG_DATA_DIRS.split( PATH_SEP ) : XDG_DEFAULTS.default.DATA_DIRS || XDG_DEFAULTS[process.platform].DATA_DIRS,
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
        if ( !this.#package ) this.#package = JSON.parse( fs.readFileSync( this.root + "/package.json" ) );

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
                if ( value == null || value === false ) value = "";
                else if ( value === true ) value = "true";
                else if ( typeof value !== "string" ) value += "";
                else if ( options.trim ) value = value.trim();

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

            const _config = readConfig( root + "/" + file );

            // extract "env" key
            if ( _config.env ) {
                env.push( _config.env );
                delete _config.env;
            }

            // merge
            for ( const key in _config ) {
                if ( _config[key] == null ) continue;
                else if ( objectIsPlain( _config[key] ) ) config[key] = { ...( objectIsPlain( config[key] ) ? config[key] : {} ), ..._config[key] };
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

    getXDGConfigDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.CONFIG_HOME + path.sep + name;
    }

    getXDGDataDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.DATA_HOME + path.sep + name;
    }

    getXDGCacheDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.CACHE_HOME + path.sep + name;
    }

    getXDGRuntimeDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.RUNTIME_DIR + path.sep + name;
    }

    findXDGConfig ( _path ) {
        if ( path.sep !== "/" ) _path = _path.replaceAll( "/", path.sep );

        for ( const configDir of [XDG.CONFIG_HOME, ...XDG.CONFIG_DIRS] ) {
            if ( fs.existsSync( configDir + path.sep + _path ) ) return configDir + path.sep + _path;
        }
    }
}

export default new Env();
