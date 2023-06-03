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

export default class App {
    #config;
    #components;
    #isShuttingDown = false;
    #shutDownLock;
    #events = new Events();

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
        var targets, publisherId;

        if ( typeof name === "object" ) {
            ( { name, targets, "arguments": args, publisherId } = name );
        }

        if ( name.endsWith( "/" ) ) targets ??= args.shift();

        var localName, cluster;

        if ( name.startsWith( "/" ) ) {
            localName = name.substring( 1 );
            cluster = this.cluster;
        }
        else {
            localName = name;
        }

        // to api
        if ( localName.startsWith( "api/" ) ) {
            localName = localName.substring( 4 );

            this.api?.publish( {
                "name": localName,
                targets,
                "arguments": args,
                publisherId,
            } );

            cluster?.publish( {
                "name": "to-api/" + localName,
                targets,
                "arguments": args,
            } );
        }

        // to rpc
        else if ( localName.startsWith( "rpc/" ) ) {
            localName = localName.substring( 4 );

            this.rpc?.publish( {
                "name": localName,
                "arguments": args,
                publisherId,
            } );

            cluster?.publish( {
                "name": "to-rpc/" + localName,
                "arguments": args,
            } );
        }

        // other
        else {

            // to local emitter
            this.#events.emit( name, ...args );

            // global events to cluster
            cluster?.publish( {
                "name": "to-app" + name,
                "arguments": args,
            } );
        }

        return this;
    }

    async healthCheck () {
        return this._healthCheck();
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

    async _healthCheck () {
        return result( 200 );
    }

    // private
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

            console.log( `• Application started` );
        }

        return result( 200 );
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
}
