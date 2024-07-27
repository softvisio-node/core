import "#lib/result";
import "#lib/shutdown";
import Components from "#lib/app/components";
import Events from "#lib/events";
import env from "#lib/env";
import { mergeObjects, freezeObjectRecursively } from "#lib/utils";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import fs from "node:fs";
import constants from "#lib/app/constants";
import Cli from "#lib/cli";
import Env from "#lib/app/env";
import externalResources from "#lib/external-resources";
import url from "node:url";
import "#lib/locale";
import Templates from "#lib/app/templates";
import Logger from "#lib/logger";

new Logger( {
    "colorMode": true,
} ).installGlobalConsole();

export default class App {
    #config;
    #components;
    #isShuttingDown = false;
    #shutDownLock;
    #events = new Events();
    #ajvCache;
    #env = new Env( this );
    #templates = new Templates( this );

    // static
    static async start () {
        const app = new this();

        const res = await app.start();

        if ( !res.ok ) process.exit( 1 );

        return app;
    }

    // properties
    get location () {
        throw `App location getter is not defined`;
    }

    get config () {
        return this.#config;
    }

    get env () {
        return this.#env;
    }

    get components () {
        return this.#components;
    }

    get templates () {
        return this.#templates;
    }

    get maxListeners () {
        return this.#events.maxListeners;
    }

    set maxListeners ( value ) {
        this.#events.maxListeners = value;
    }

    // public
    async start () {
        var res;

        res = await this.#start();
        if ( !res.ok ) process.shutDown( { "code": 1 } );

        return res;
    }

    async checkHealth () {
        return this._checkHealth();
    }

    userIsRoot ( userId ) {
        return userId === constants.rootUserId;
    }

    emailIsLocal ( email ) {
        return email.endsWith( constants.localEmailTld );
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
        if ( name.startsWith( "/" ) ) {
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
    async _cli ( config ) {
        return result( 200 );
    }

    async _configure () {
        return result( 200 );
    }

    async _init () {
        return result( 200 );
    }

    async _start () {
        return result( 200 );
    }

    async _afterAppStarted () {
        return result( 200 );
    }

    async _startThreads () {
        return result( 200 );
    }

    async _checkHealth () {
        return result( 200 );
    }

    // private
    async #start () {
        var res;

        // create components
        this.#components = new Components( this.location, { "app": this } );

        // load components config
        res = this.#components.loadConfig();
        if ( !res.ok ) return this.#logError( res );

        // cli
        await this.#cli();

        // set mode from cli
        if ( process.cli.globalOptions.mode ) env.mode = process.cli.globalOptions.mode;

        // load app env and public config
        const config = env.loadEnv();

        // cli config
        res = await this._cli( config );
        if ( !res.ok ) return this.#logError( res );

        // validatee public config structure
        const appPublicConfigValidate = new Ajv().compile( readConfig( "#resources/schemas/app-public-config.schema.yaml", { "resolve": import.meta.url } ) );
        if ( !appPublicConfigValidate( config ) ) {
            if ( !res.ok ) return this.#logError( result( [ 500, `Application public config is not valid:\n${ appPublicConfigValidate.errors }` ] ) );
        }

        // validate app public config
        if ( config.config ) {
            res = this.#validateAppConfig( "public-config", config.config );
            if ( !res.ok ) return this.#logError( res );
        }

        // load components
        res = await this.#components.load( process.cli.globalOptions.service || config.defaultService );
        if ( !res.ok ) return this.#logError( res );

        console.info( `Service:`, this.#components.service || "-" );

        // validate service publuc config
        if ( config.services?.[ this.#components.service ]?.config ) {
            res = this.#validateAppConfig( "public-config", config.services?.[ this.#components.service ]?.config );
            if ( !res.ok ) return this.#logError( res );
        }

        // merge app config
        this.#config = mergeObjects(
            {},
            this.#components.config.config,
            config.config, //
            this.#components.config.services?.[ this.#components.service ]?.config,
            config.services?.[ this.#components.service ]?.config
        );

        // create components
        res = await this.#components.create( config );
        if ( !res.ok ) return this.#logError( res );

        // configure components
        res = await this.#components.configure();
        if ( !res.ok ) return this.#logError( res );

        // configure app
        res = await this._configure();
        if ( !res.ok ) return this.#logError( res );

        // add app templates
        if ( this.#components.config.templates ) {
            this.templates.add( this.#components.config.templates );
        }

        // validate app config
        res = this.#validateAppConfig();
        if ( !res.ok ) return this.#logError( res );
        this.#ajvCache = null;

        // freeze app config
        freezeObjectRecursively( this.#config );

        // install components
        res = await this.#components.install();
        if ( !res.ok ) return this.#logError( res );

        // lock shut down
        if ( this._shutDown ) this.#shutDownLock = process.shutdown.lock( "application" );

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

        // start components
        if ( !this.#isShuttingDown ) {
            res = await this.#components.start();
            if ( !res.ok ) return this.#logError( res );
        }

        // start app
        if ( !this.#isShuttingDown ) {
            res = await this._start();
            if ( !res.ok ) return this.#logError( res );
        }

        // after app start
        if ( !this.#isShuttingDown ) {
            res = await this.#components.afterAppStarted();
            if ( !res.ok ) return this.#logError( res );

            res = await this._afterAppStarted();
            if ( !res.ok ) return this.#logError( res );

            console.info( `Application started, pid:`, process.pid );
        }

        // start updating external resources
        externalResources.startUpdate();

        return result( 200 );
    }

    async #cli () {
        const cli = mergeObjects( {}, readConfig( new URL( "app/cli.yaml", import.meta.url ) ), this.#components.config.cli );

        cli.title ||= env.package.name + " v" + env.package.version;

        if ( !this.#components.config.services ) {
            delete cli?.globalOptions?.service;
        }

        await Cli.parse( cli );
    }

    async #init () {
        var res;

        if ( this.cluster ) {
            this.#events.link( this.cluster, {
                "on": name => ( name.startsWith( "/" ) ? "to-app" + name : null ),
                "forwarder": ( name, args ) => this.#events.emit( name, ...args ),
            } );
        }

        // migrating app database schema
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
        console.error( res + "" );

        return res;
    }

    #validateAppConfig ( schema, config ) {
        var ajv = this.#ajvCache;

        if ( !ajv ) {
            const schemaPath = url.fileURLToPath( new URL( "app.schema.yaml", this.location ) );

            if ( fs.existsSync( schemaPath ) ) {
                ajv = this.#ajvCache = new Ajv().addSchema( readConfig( schemaPath ) );
            }
        }

        if ( ajv ) {
            if ( schema ) {
                if ( ajv.getSchema( schema ) && !ajv.validate( schema, config ) ) {
                    return result( [ 400, `App ${ schema } is not valid:\n` + ajv.errors ] );
                }
            }
            else {

                // validate env
                if ( ajv.getSchema( "env" ) && !ajv.validate( "env", process.env ) ) {
                    return result( [ 400, `App env is not valid:\n` + ajv.errors ] );
                }

                // validate config
                if ( ajv.getSchema( "config" ) && !ajv.validate( "config", this.#config ) ) {
                    return result( [ 400, `App config is not valid:\n` + ajv.errors ] );
                }
            }
        }

        return result( 200 );
    }
}
