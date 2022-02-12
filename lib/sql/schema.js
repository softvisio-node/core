import glob from "#lib/glob";
import _url from "url";
import { readConfig } from "#lib/config";
import constants from "#lib/sql/constants";
import { sql } from "#lib/sql/query";
import Ajv from "#lib/ajv";

var VALIDATOR;

export default class {
    #pool;
    #isLoaded = false;
    #emits = new Set();

    constructor ( pool ) {
        this.#pool = pool;
    }

    // properties
    get _pool () {
        return this.#pool;
    }

    get emits () {
        return this.#emits;
    }

    get isLoaded () {
        return this.#isLoaded;
    }

    // public
    async load () {
        if ( this.#isLoaded ) return result( 200 );

        const res = await this.#pool.select( sql`SELECT * FROM _schema` );

        if ( !res.ok ) return res;

        if ( !res.data ) return result( 200 );

        this.#isLoaded = true;

        // apply emits
        for ( const row of res.data ) {
            if ( row.emits ) this.#emits = new Set( [...this.#emits, ...row.emits] );
        }

        return result( 200 );
    }

    async migrate ( url ) {
        try {
            var res;

            const path = _url.fileURLToPath( url );

            // load schema index
            const meta = readConfig( path + "/index.yaml" );

            VALIDATOR ||= new Ajv().compile( readConfig( "#resources/schemas/sql.index.schema.yaml", { "resolve": import.meta.url } ) );

            if ( !VALIDATOR( meta ) ) throw `SQL index is not valid, errors:\n${VALIDATOR.errors}`;

            // check type
            const type = new Set( Array.isArray( meta.type ) ? meta.type : [meta.type] );
            if ( this.#pool.isSqlite && !type.has( "sqlite" ) ) throw `Database schema type is not compatible with SQLite`;
            if ( this.#pool.isPgsql && !type.has( "pgsql" ) ) throw `Database schema type is not compatible with PostgreSQL`;

            // validate emits
            if ( meta.emits ) {
                for ( const name of meta.emits ) {
                    if ( constants.reservedEvents.has( name ) ) throw `Database event name "${name}" is reserved`;
                }
            }

            const schema = new Map(),
                patches = new Map();

            // load schema
            var files = glob.sync( "*.js", { "cwd": path, "nodir": true } );

            for ( const file of files ) {
                const version = Number( file.match( /^(\d+)/g )[0] );

                if ( schema.has( version ) ) throw `Database schema patch ${version} is already exists`;

                schema.set( version, await import( new URL( file, url + "/" ) ) );
            }

            // load patches
            files = glob.sync( "*.js", { "cwd": path + "/patch", "nodir": true } );

            for ( const file of files ) {
                const version = Number( file.match( /^(\d+)/g )[0] );

                if ( patches.has( version ) ) throw `Database patch ${version} is already exists`;

                patches.set( version, await import( new URL( "patch/" + file, url + "/" ) ) );
            }

            // migrate
            res = await this._migrate( meta, schema, patches );

            if ( res.ok ) {
                this.#isLoaded = true;

                // store emits
                if ( meta.emits ) this.#emits = new Set( [...this.#emits, ...meta.emits] );
            }

            return res;
        }
        catch ( e ) {
            return result.catch( e );
        }
    }
}
