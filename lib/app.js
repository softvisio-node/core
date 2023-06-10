import "#lib/result";
import "#lib/shutdown";
import Components from "#lib/app/components";
import Events from "#lib/events";
import env from "#lib/env";
import { resolve, mergeObjects, freezeObjectRecursively } from "#lib/utils";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import fs from "node:fs";
import constants from "#lib/app/constants";
import CLI from "#lib/cli";

export default class App {
    #config;
    #components;
    #isShuttingDown = false;
    #shutDownLock;
    #events = new Events();
    #ajvCache;

    // static

    // properties
    get location () {
        throw `App location getter is not defined`;
    }

    get config () {
        return this.#config;
    }

    get components () {
        return this.#components;
    }

    // public
    // XXX
    async cli () {

        // create components
        const res = this.#createComponents();
        if ( !res.ok ) return this.#logError( res );

        const cli = this.#components.config.cli;

        cli.title ||= env.package.name + " v" + env.package.version;

        cli.options ||= {};

        cli.options.service = {
            "description": `Application service name to run`,
            "schema": {
                "type": "string",
                "format": "kebab-case",
            },
        };

        cli.options.mode = {
            "description": `Set application mode. Set NODE_ENV variable. Allowed values: "production", "development", "test"`,
            "schema": {
                "type": "string",
                "enum": ["production", "development", "test"],
            },
        };

        cli.options["reset-root"] = {
            "short": false,
            "description": `Set root password from the ".env" files and exit. If root password is not defined in environment it will be randomly generated.`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        await CLI.parse( cli );

        // set mode
        if ( process.cli?.options.mode ) env.mode = process.cli.options.mode;

        return this;
    }

    async run () {
        var res;

        res = await this.#run();
        if ( !res.ok ) process.shutDown();

        return res;
    }

    async checkHealth () {
        return this._checkHealth();
    }

    userIsRoot ( userId ) {
        return userId + "" === constants.rootUserId;
    }

    on ( name, listener ) {
        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    publish ( name, ...args ) {

        // to local emitter
        this.#events.emit( name, ...args );

        // global events to cluster
        if ( name.startsWit( "/" ) ) {
            this.cluster?.publish( {
                "name": "to-app" + name,
                "data": args,
            } );
        }

        return this;
    }

    publishToApi ( name, ...args ) {
        if ( !this.api && !this.cluster ) return this;

        var users, publisherId, localName, cluster;

        if ( typeof name === "object" ) {
            ( { name, users, "data": args, publisherId } = name );
        }

        if ( name.startsWith( "/" ) ) {
            localName = name.substring( 1 );
            cluster = this.cluster;
        }

        if ( name.endsWith( "/" ) ) {
            users ??= args.shift();
        }

        this.api?.publish( {
            "name": localName ?? name,
            users,
            "data": args,
            publisherId,
        } );

        cluster?.publish( {
            "name": "to-api/" + localName,
            users,
            "data": args,
        } );

        return this;
    }

    publishToRpc ( name, ...args ) {
        if ( !this.rpc && !this.cluster ) return this;

        var publisherId, localName, cluster;

        if ( typeof name === "object" ) {
            ( { name, "data": args, publisherId } = name );
        }

        if ( name.startsWith( "/" ) ) {
            localName = name.substring( 1 );
            cluster = this.cluster;
        }

        this.rpc?.publish( {
            "name": localName ?? name,
            "data": args,
            publisherId,
        } );

        cluster?.publish( {
            "name": "to-rpc/" + localName,
            "data": args,
        } );

        return this;
    }

    // protected
    async _configure () {
        return result( 200 );
    }

    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    async _runThreads () {
        return result( 200 );
    }

    async _checkHealth () {
        return result( 200 );
    }

    // private
    async #run () {
        var res;

        // create components
        res = this.#createComponents();
        if ( !res.ok ) return this.#logError( res );

        // load app env
        const config = env.loadEnv();

        // validate app public config
        res = this.#validateAppConfig( "public-config", config.config ?? {} );
        if ( !res.ok ) return this.#logError( res );

        // load components
        res = await this.#components.load( process.cli.options.service || config.service );
        if ( !res.ok ) return this.#logError( res );

        console.log( `• Service:`, this.#components.service );

        // merge app config
        this.#config = mergeObjects( [{}, this.#components.config.config, config.config] );

        // create components
        res = await this.#components.create( this, config.components );
        if ( !res.ok ) return this.#logError( res );

        // configure components
        res = await this.#components.configure();
        if ( !res.ok ) return this.#logError( res );

        // configure app
        res = await this._configure();
        if ( !res.ok ) return this.#logError( res );

        // validate app config
        res = this.#validateAppConfig();
        if ( !res.ok ) return this.#logError( res );
        this.#ajvCache = null;

        // freeze app config
        freezeObjectRecursively( this.#config );

        // install components
        res = await this.#components.install();
        if ( !res.ok ) return this.#logError( res );

        // configure components instances
        res = await this.#components.configureInstances();
        if ( !res.ok ) return this.#logError( res );

        // init components
        res = await this.#components.init();
        if ( !res.ok ) return this.#logError( res );

        // init app
        res = await this.#init();
        if ( !res.ok ) return this.#logError( res );

        process.shutdown.on( "shutdown", this.#shutDown.bind( this ) );

        // run components
        if ( !this.#isShuttingDown ) {
            res = await this.#components.run();
            if ( !res.ok ) return this.#logError( res );
        }

        // run app
        if ( !this.#isShuttingDown ) {
            res = await this._run();
            if ( !res.ok ) return this.#logError( res );

            if ( this._shutDown ) this.#shutDownLock = process.shutdown.lock( "application" );
        }

        // post run components
        if ( !this.#isShuttingDown ) {
            res = await this.#components.postRun();
            if ( !res.ok ) return this.#logError( res );

            console.log( `• Application started, pid:`, process.pid );
        }

        return result( 200 );
    }

    #createComponents () {
        if ( this.#components ) return result( 200 );

        this.#components = new Components( this.location );

        const res = this.#components.loadConfig();

        return res;
    }

    async #init () {
        var res;

        if ( this.cluster ) {
            this.#events.link( this.cluster, {
                "on": name => ( name.startsWith( "/" ) ? "to-app" + name : null ),
                "forwarder": ( name, args ) => this.#events.emit( name, ...args ),
            } );
        }

        // migratings app database schema
        if ( this.dbh ) {
            const dbSchemaLocation = new URL( "db", this.location );

            if ( fs.existsSync( dbSchemaLocation ) ) {
                res = await this.dbh.schema.migrate( dbSchemaLocation );
                if ( !res.ok ) return res;
            }
        }

        res = await this._init();
        if ( !res.ok ) return this.#logError( res );

        return result( 200 );
    }

    async #shutDown () {
        if ( this.#isShuttingDown ) return;
        this.#isShuttingDown = true;

        // shut down app
        if ( this.#shutDownLock && !this.#shutDownLock.isDone ) {
            process.stdout.write( "Shutting down application ... " );

            await this._shutDown();

            console.log( "done" );

            this.#shutDownLock.done();
        }

        // shut down components
        await this.#components.shutDown();
    }

    #logError ( res ) {
        console.log( `• Error: ${res}` );

        return res;
    }

    #validateAppConfig ( schema, config ) {
        var ajv = this.#ajvCache;

        if ( !ajv ) {
            const schemaPath = resolve( "#resources/schemas/app.config.schema.yaml", this.location, { "silent": true } );

            if ( schemaPath ) {
                ajv = this.#ajvCache = new Ajv().addSchema( readConfig( schemaPath ) );
            }
        }

        if ( ajv ) {
            if ( schema ) {
                if ( ajv.getSchema( schema ) && !ajv.validate( schema, config ) ) {
                    return result( [400, `App ${schema} is not valid:\n` + ajv.errors] );
                }
            }
            else {

                // validate env
                if ( ajv.getSchema( "env" ) && !ajv.validate( "env", process.env ) ) {
                    return result( [400, `App env is not valid:\n` + ajv.errors] );
                }

                // validate config
                if ( ajv.getSchema( "config" ) && !ajv.validate( "config", this.#config ) ) {
                    return result( [400, `App config is not valid:\n` + ajv.errors] );
                }
            }
        }

        return result( 200 );
    }
}
