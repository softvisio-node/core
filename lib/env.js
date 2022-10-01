import fs from "fs";
import { readConfig } from "#lib/config";
import path from "path";
import _Env from "#lib/_browser/env";
import os from "os";
import { isMainThread } from "node:worker_threads";
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

const USER_ENV_LOCATION = "softvisio";

class Env extends _Env.constructor {
    #root;
    #userEnv;
    #package;
    #gitId;

    get mode () {
        return super.mode;
    }

    set mode ( value ) {
        process.env.NODE_ENV = value || "production";
    }

    get root () {
        if ( this.#root == null ) {
            let _path = isMainThread ? process.argv[1] : global[Symbol.for( "mainThreadArgv1" )];

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

    loadEnv ( { location, mode, defaultConfig, envPrefix = "APP_", envOverwrite } = {} ) {
        const env = [],
            configPrefix = "env",
            files = [`${configPrefix}.yaml`, `${configPrefix}.local.yaml`],
            config = {};

        // process default config
        if ( defaultConfig ) {
            this.#mergeConfig( config, defaultConfig );

            // extract "env" key
            if ( config.env ) {
                env.push( config.env );
                delete config.env;
            }
        }

        location ||= this.root;
        mode ||= this.mode;

        files.push( `${configPrefix}.${mode}.yaml`, `${configPrefix}.${mode}.local.yaml` );

        for ( const file of files ) {
            if ( !fs.existsSync( location + "/" + file ) ) continue;

            const _config = readConfig( location + "/" + file );

            // extract "env" key
            if ( _config.env ) {
                env.push( _config.env );
                delete _config.env;
            }

            // merge
            this.#mergeConfig( config, _config );
        }

        this.#mergeEnv( env, {
            "prefix": envPrefix,
            "overwrite": envOverwrite,
        } );

        return config;
    }

    loadUserEnv () {
        this.#userEnv ??= this.loadEnv( {
            "location": XDG.CONFIG_HOME + "/" + USER_ENV_LOCATION,
            "envPrefix": false,
        } );

        return this.#userEnv;
    }

    getXdgConfigDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.CONFIG_HOME + path.sep + name;
    }

    getXdgDataDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.DATA_HOME + path.sep + name;
    }

    getXdgCacheDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.CACHE_HOME + path.sep + name;
    }

    getXdgRuntimeDir ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        return XDG.RUNTIME_DIR + path.sep + name;
    }

    findXdgConfig ( _path ) {
        if ( path.sep !== "/" ) _path = _path.replaceAll( "/", path.sep );

        for ( const configDir of [XDG.CONFIG_HOME, ...XDG.CONFIG_DIRS] ) {
            if ( fs.existsSync( configDir + path.sep + _path ) ) return configDir + path.sep + _path;
        }
    }

    async getGitId ( root ) {
        if ( !root && this.#gitId !== undefined ) return this.#gitId;

        var id = super.getGitId();

        if ( id ) {
            if ( !root ) this.#gitId = id;
        }
        else {
            const Git = ( await import( "#lib/api/git" ) ).default;

            const git = new Git( root || this.root );

            id = await git.getId();

            if ( !id.ok ) {
                console.error( `Unable to get git status: ${id}` );

                if ( !root ) this.#gitId = null;
            }
            else {
                id = id.data;

                if ( !root ) this.#gitId = id;
            }
        }

        return id;
    }

    // private
    #mergeConfig ( a, b ) {
        for ( const prop in b ) {
            if ( objectIsPlain( b[prop] ) ) {
                if ( !objectIsPlain( a[prop] ) ) a[prop] = {};

                this.mergeConfig( a[prop], b[prop] );
            }
            else {
                a[prop] = b[prop];
            }
        }
    }

    #mergeEnv ( env, { prefix, overwrite } = {} ) {
        if ( !Array.isArray( env ) ) env = [env];

        const tmp = {};

        // merge
        for ( const _env of env ) {
            for ( const name in _env ) {
                let value = _env[name];

                // prepare value
                if ( value == null ) {
                    value = "";
                }
                else if ( typeof value === "boolean" ) {
                    value = value ? "true" : "";
                }
                else if ( typeof value === "string" ) {

                    // interpolate
                    value = value.replace( /(?<!\\)\$\{?([a-zA-Z0-9_]+)\}?/g, ( match, name ) => process.env[name] ?? tmp[name] ?? "" );
                }
                else if ( typeof value === "number" ) {
                    value = value + "";
                }
                else {
                    throw Error( `Environment variable "${name}" must be string or number` );
                }

                tmp[name] = value;
            }
        }

        for ( const name in tmp ) {

            // must start with prefix
            if ( prefix && !name.startsWith( prefix ) ) continue;

            // do not overwrite
            if ( !overwrite && Object.hasOwnProperty.call( process.env, name ) ) continue;

            // set environment variable
            process.env[name] = tmp[name];
        }
    }
}

export default new Env();
