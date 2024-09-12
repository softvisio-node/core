import fs from "node:fs";
import { readConfig } from "#lib/config";
import path from "node:path";
import env from "#lib/_browser/env";
import os from "node:os";
import { mergeObjects } from "#lib/utils";

const XDG_DEFAULTS = {
    "default": {
        "CONFIG_HOME": os.homedir() + path.sep + ".config",
        "DATA_HOME": os.homedir() + path.sep + ".local" + path.sep + "share",
        "CACHE_HOME": os.homedir() + path.sep + ".cache",
        "RUNTIME_DIR": os.tmpdir(),
    },
    "linux": {
        "CONFIG_DIRS": [ "/etc/xdg" ],
        "DATA_DIRS": [ "/usr/local/share", "/usr/share" ],
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

const PATH_SEP = process.platform === "win32"
    ? ";"
    : ":";

const XDG = {
    "CONFIG_HOME": process.env.XDG_CONFIG_HOME || XDG_DEFAULTS.default.CONFIG_HOME || XDG_DEFAULTS[ process.platform ].CONFIG_HOME,
    "DATA_HOME": process.env.XDG_DATA_HOME || XDG_DEFAULTS.default.DATA_HOME || XDG_DEFAULTS[ process.platform ].DATA_HOME,
    "CACHE_HOME": process.env.XDG_CACHE_HOME || XDG_DEFAULTS.default.CACHE_HOME || XDG_DEFAULTS[ process.platform ].CACHE_HOME,
    "RUNTIME_DIR": process.env.XDG_RUNTIME_DIR || XDG_DEFAULTS.default.RUNTIME_DIR || XDG_DEFAULTS[ process.platform ].RUNTIME_DIR,
    "CONFIG_DIRS": process.env.XDG_CONFIG_DIRS
        ? process.env.XDG_CONFIG_DIRS.split( PATH_SEP )
        : XDG_DEFAULTS.default.CONFIG_DIRS || XDG_DEFAULTS[ process.platform ].CONFIG_DIRS,
    "DATA_DIRS": process.env.XDG_DATA_DIRS
        ? process.env.XDG_DATA_DIRS.split( PATH_SEP )
        : XDG_DEFAULTS.default.DATA_DIRS || XDG_DEFAULTS[ process.platform ].DATA_DIRS,
};

const USER_ENV_LOCATION = "softvisio";

class Env extends env.constructor {
    #root;
    #userEnv;
    #package;
    #gitId;
    #tmpdir;

    // properties
    get mode () {
        return super.mode;
    }

    set mode ( value ) {
        process.env.NODE_ENV = value || "production";
    }

    get root () {
        if ( this.#root == null ) {
            let root = fs.realpathSync( global[ Symbol.for( "mainThreadArgv1" ) ] || process.argv[ 1 ] );

            const idx = root.indexOf( path.sep + "node_modules" + path.sep );

            if ( idx >= 0 ) {
                root = root.substring( 0, idx );
            }

            this.#root = this.findPackageRoot( root ) || "";
        }

        return this.#root;
    }

    get package () {
        this.#package ||= JSON.parse( fs.readFileSync( this.root + "/package.json" ) );

        return this.#package;
    }

    get tmpdir () {
        this.#tmpdir ??= os.tmpdir();

        return this.#tmpdir;
    }

    // public
    loadEnv ( { location, mode, defaultConfig, mergeEnv = true, overwriteEnv, envPrefix = "APP_", locale } = {} ) {
        location ||= this.root;
        mode ||= this.mode;

        const configs = [],
            env = [],
            configPrefix = "env",
            files = [

                //
                `${ configPrefix }.yaml`,
                `${ configPrefix }.local.yaml`,
                `${ configPrefix }.${ mode }.yaml`,
                `${ configPrefix }.${ mode }.local.yaml`,
            ];

        // add default config
        if ( defaultConfig ) configs.push( defaultConfig );

        // load configs
        for ( const file of files ) {
            if ( !fs.existsSync( location + "/" + file ) ) continue;

            const config = readConfig( location + "/" + file, { locale } );

            configs.push( config );
        }

        // precess configs
        for ( const config of configs ) {

            // extract "env" key
            if ( "env" in config ) {
                env.push( config.env );
                delete config.env;
            }
        }

        // merge env
        if ( mergeEnv ) {
            this.mergeEnv( env, {
                "prefix": envPrefix,
                "overwrite": overwriteEnv,
            } );
        }

        return mergeObjects( {}, ...configs );
    }

    loadUserEnv ( { cache = true } = {} ) {
        if ( !this.#userEnv || !cache ) {
            this.#userEnv = this.loadEnv( {
                "location": XDG.CONFIG_HOME + "/" + USER_ENV_LOCATION,
                "envPrefix": false,
            } );
        }

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

    findXdgConfig ( name ) {
        if ( path.sep !== "/" ) name = name.replaceAll( "/", path.sep );

        for ( const configDir of [ XDG.CONFIG_HOME, ...XDG.CONFIG_DIRS ] ) {
            if ( fs.existsSync( configDir + path.sep + name ) ) return configDir + path.sep + name;
        }
    }

    async getGitId ( dir ) {
        if ( !dir && this.#gitId !== undefined ) return this.#gitId;

        var id = super.getGitId();

        if ( id ) {
            if ( !dir ) this.#gitId = id;
        }
        else {
            const Git = ( await import( "#lib/api/git" ) ).default;

            const git = new Git( dir || this.root );

            id = await git.getId();

            if ( !id.ok ) {
                console.error( `Unable to get git status: ${ id }` );

                if ( !dir ) this.#gitId = null;
            }
            else {
                id = id.data;

                if ( !dir ) this.#gitId = id;
            }
        }

        return id;
    }

    mergeEnv ( env, { prefix, overwrite } = {} ) {
        if ( !Array.isArray( env ) ) env = [ env ];

        const tmp = {};

        // merge
        for ( const _env of env ) {
            for ( const name in _env ) {
                let value = _env[ name ];

                // prepare value
                if ( value == null ) {
                    value = "";
                }
                else if ( typeof value === "boolean" ) {
                    value = value
                        ? "true"
                        : "";
                }
                else if ( typeof value === "string" ) {

                    // interpolate
                    value = value.replaceAll( /(?<!\\)\${?(\w+)}?/g, ( match, name ) => process.env[ name ] ?? tmp[ name ] ?? "" );
                }
                else if ( typeof value === "number" ) {
                    value = value + "";
                }
                else {
                    throw Error( `Environment variable "${ name }" must be string or number` );
                }

                tmp[ name ] = value;
            }
        }

        for ( const name in tmp ) {

            // must start with prefix
            if ( prefix && !name.startsWith( prefix ) ) continue;

            // do not overwrite
            if ( !overwrite && Object.hasOwnProperty.call( process.env, name ) ) continue;

            // set environment variable
            process.env[ name ] = tmp[ name ];
        }
    }

    isPackageRoot ( dir ) {
        dir ||= process.cwd();

        return fs.existsSync( dir + "/package.json" );
    }

    isGitPackageRoot ( dir ) {
        dir ||= process.cwd();

        return this.isPackageRoot( dir ) && fs.existsSync( dir + "/.git" );
    }

    findPackageRoot ( dir ) {
        dir ||= process.cwd();

        dir = path.normalize( path.resolve( dir ) );

        while ( true ) {
            if ( this.isPackageRoot( dir ) ) return dir;

            const dirname = path.dirname( dir );

            if ( dirname === dir ) return;

            dir = dirname;
        }
    }

    findGitPackageRoot ( dir ) {
        dir ||= process.cwd();

        dir = path.normalize( path.resolve( dir ) );

        while ( true ) {
            if ( this.isGitPackageRoot( dir ) ) return dir;

            const dirname = path.dirname( dir );

            if ( dirname === dir ) return;

            dir = dirname;
        }
    }
}

export default new Env();
