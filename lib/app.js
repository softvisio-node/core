import "#lib/result";
import "#lib/shutdown";
import Components from "#lib/app/components";
import Events from "#lib/events";
import Cli from "#lib/app/cli";
import env from "#lib/env";
import { resolve, mergeObjects } from "#lib/utils";
import Ajv from "#lib/ajv";
import { readConfig } from "#lib/config";
import fs from "node:fs";
import constants from "#lib/app/constants";

const PUBLISH_SOURCE_LOCAL = 1,
    PUBLISH_SOURCE_THREADS = 2;

export default class App {
    #config;
    #components;
    #localEvents = new Events();
    #isStarted = false;
    #isShuttingDown = false;
    #shutDownLock;

    // static
    static get Cli () {
        return Cli;
    }

    // properties
    get location () {
        throw `App location getter is not defined`;
    }

    get config () {
        return this.#config;
    }

    // public
    async run () {
        var res;

        res = await this.#run();
        if ( !res.ok ) process.shutDown();

        return res;
    }

    userIsRoot ( userId ) {
        return userId + "" === constants.rootUserId;
    }

    // events
    on ( name, listener ) {
        this.#subscribe( "on", name, listener );
    }

    once ( name, listener ) {
        this.#subscribe( "once", name, listener );
    }

    off ( name, listener ) {
        this.#subscribe( "off", name, listener );
    }

    publish ( name, ...args ) {
        this.#publish( PUBLISH_SOURCE_LOCAL, name, args );
    }

    async getHealthCheckStatus () {
        return this._getHealthCheckStatus();
    }

    // protected
    async _configure () {
        return result( 200 );
    }

    async _init () {

        // migratings app database schema
        if ( this.dbh ) {
            const dbSchemaLocation = new URL( "./db", this.location );

            if ( fs.existsSync( dbSchemaLocation ) ) {
                const res = await this.dbh.schema.migrate( dbSchemaLocation );

                if ( !res.ok ) return res;
            }
        }

        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    async _runThreads () {
        return result( 200 );
    }

    async _shutDown () {}

    async _getHealthCheckStatus () {
        return result( 200 );
    }

    // private
    #logError ( res ) {
        console.log( `• Error: ${res}` );

        return res;
    }

    #validateAppEnv () {
        const schemaPath = resolve( "#resources/schemas/app.env.schema.yaml", this.location, { "silent": true } );

        if ( schemaPath ) {
            const validate = new Ajv().compile( readConfig( schemaPath ) );

            if ( !validate( process.env ) ) {
                return result( [400, `App env is not valid:\n` + validate.errors] );
            }
        }

        return result( 200 );
    }

    #validateAppConfig () {
        const schemaPath = resolve( "#resources/schemas/app.connfig.schema.yaml", this.location, { "silent": true } );

        if ( schemaPath ) {
            const validate = new Ajv().compile( readConfig( schemaPath ) );

            if ( !validate( this.#config ) ) {
                return result( [400, `App config is not valid:\n` + validate.errors] );
            }
        }

        return result( 200 );
    }

    #configureEvents () {

        // configure threads events
        if ( this.threads ) {

            // forward global subscriptions from the threads to the cluster
            if ( this.cluster ) {
                this.threads.forwardSubscriptions( this.cluster, {
                    "on": ( name, listener ) => {
                        if ( name.startsWith( "/" ) ) this.cluster.on( name, listener );
                    },
                    "off": ( name, listener ) => {
                        if ( name.startsWith( "/" ) ) this.cluster.off( name, listener );
                    },
                } );
            }

            // re-publish events from threads
            this.threads.on( "*", ( name, args ) => this.#publish( PUBLISH_SOURCE_THREADS, name, args ) );
        }

        // config rpc events
        if ( this.rpc?.frontend ) {

            // forward subscriptions from the rpc to the cluster
            if ( this.cluster ) {
                this.rpc.frontend.forwardSubscriptions( this.cluster, {
                    "on": ( name, listener ) => this.cluster.on( "rpc/" + name, listener ),
                    "off": ( name, listener ) => this.cluster.off( "rpc/" + name, listener ),
                } );
            }

            // re-publish events from rpc
            this.rpc.frontend.on( "*", ( name, args ) => this.#localEvents.emit( "rpc/" + name, ...args ) );
        }

        // cpnfigure api events
        if ( this.api?.frontend ) {

            // forward subscriptions from the api to the cluster
            if ( this.cluster ) {
                this.api.frontend.forwardSubscriptions( this.cluster, {
                    "on": ( name, listener ) => this.cluster.on( "api/" + name, listener ),
                    "off": ( name, listener ) => this.cluster.off( "api/" + name, listener ),
                } );
            }

            // re-publish events from api
            this.api.frontend.on( "*", ( name, args ) => this.#localEvents.emit( "api/" + name, ...args ) );
        }
    }

    #subscribe ( method, name, listener ) {
        this.#localEvents[method]( name, listener );

        if ( name.startsWith( "/" ) && this.cluster ) this.cluster[method]( name, listener );
    }

    #publish ( source, name, args ) {
        var targets, publisherId;

        if ( typeof name === "object" ) {
            ( { name, targets, "arguments": args, publisherId } = name );
        }

        if ( name.endsWith( "/" ) ) targets ??= args.shift();

        // to api
        if ( name.startsWith( "api/" ) || name.startsWith( "/api/" ) ) {
            let cluster;

            if ( name.startsWith( "/" ) ) {
                name = name.substring( 1 );
                cluster = this.cluster;
            }

            this.api?.frontend?.publish( {
                "name": name.substring( 4 ),
                targets,
                "arguments": args,
                publisherId,
            } );

            cluster?.publish( {
                name,
                targets,
                "arguments": args,
            } );
        }

        // to rpc
        else if ( name.startsWith( "rpc/" ) || name.startsWith( "/rpc/" ) ) {
            let cluster;

            if ( name.startsWith( "/" ) ) {
                name = name.substring( 1 );
                cluster = this.cluster;
            }

            this.rpc?.frontend?.publish( {
                "name": name.substring( 4 ),
                "arguments": args,
                publisherId,
            } );

            cluster?.publish( {
                name,
                "arguments": args,
            } );
        }

        // other
        else {

            // to local emitter
            this.#localEvents.emit( name, ...args );

            // to threads, do not re-publish, if published from threads
            if ( source !== PUBLISH_SOURCE_THREADS ) this.threads.publish( name, ...args );

            // global events to cluster
            if ( name.startsWith( "/" ) && this.cluster ) {
                this.cluster.publish( {
                    name,
                    "arguments": args,
                } );
            }
        }
    }

    async #run () {

        // create components
        this.#components = new Components( this.location );

        // load app env
        const config = env.loadEnv();

        const service = process.cli.options.service || config.service || "default";

        console.log( `• Service:`, service );

        var res;

        // load components
        res = await this.#components.load( service );
        if ( !res.ok ) return this.#logError( res );

        // merge app config
        this.#config = mergeObjects( [{}, res.data, config.config] );

        // validate app env
        res = this.#validateAppEnv();
        if ( !res.ok ) return this.#logError( res );

        // validate app config
        res = this.#validateAppConfig();
        if ( !res.ok ) return this.#logError( res );

        // create components
        res = await this.#components.create( this, config.components );
        if ( !res.ok ) return this.#logError( res );

        // configure components
        res = await this.#components.configure();
        if ( !res.ok ) return this.#logError( res );

        // configure app
        res = await this._configure();
        if ( !res.ok ) return this.#logError( res );

        // install components
        res = await this.#components.install();
        if ( !res.ok ) return this.#logError( res );

        // initialize components
        res = await this.#components.init();

        if ( !res.ok ) return this.#logError( res );

        // initialize app
        res = await this._init();
        if ( !res.ok ) return this.#logError( res );

        // configure events
        this.#configureEvents();

        this.#shutDownLock = process.shutdown.lock( "application" );

        process.shutdown.on( "shutdown", this.#shutDown.bind( this ) );

        // run components
        if ( !this.#isShuttingDown ) {
            res = await this.#components.run();
            if ( !res.ok ) return this.#logError( res );
        }

        // run app
        if ( !this.#isShuttingDown ) {
            this.#isStarted = true;

            res = await this._run();
            if ( !res.ok ) return this.#logError( res );
        }

        // post run components
        if ( !this.#isShuttingDown ) {
            res = await this.#components.postRun();
            if ( !res.ok ) return this.#logError( res );

            console.log( `• Application started` );
        }

        return result( 200 );
    }

    async #shutDown () {
        if ( this.#isShuttingDown ) return;

        this.#isShuttingDown = true;

        // shut down app
        if ( this.#isStarted ) await this._shutDown();

        // shut down components
        await this.#components.shutDown();

        this.#shutDownLock.done();
    }
}
