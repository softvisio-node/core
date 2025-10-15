import childProcess from "node:child_process";
import fs from "node:fs";
import { chmod } from "#lib/fs";
import { glob } from "#lib/glob";

const uid = +childProcess.execFileSync( "id", [ "-u", "postgres" ], { "encoding": "utf8" } ).trim(),
    gid = +childProcess.execFileSync( "id", [ "-g", "postgres" ], { "encoding": "utf8" } ).trim();

class PostgreSqlUtils {

    // properties
    get uid () {
        return uid;
    }

    get gid () {
        return gid;
    }

    // public
    async chmodDir ( path, { recursive } = {} ) {
        const promises = [];

        promises.push(

            //
            fs.promises.chown( path, this.uid, this.gid ),
            chmod( path, "rwx------" )
        );

        if ( recursive ) {
            const files = await glob( "**", {
                "cwd": path,
                "directories": true,
                "markDirectories": true,
            } );

            for ( const file of files ) {
                if ( file.endsWith( "/" ) ) {
                    promises.push( this.chmodDir( path + "/" + file ) );
                }
                else {
                    promises.push( this.chmodFile( path + "/" + file ) );
                }
            }
        }

        return Promise.all( promises );
    }

    async chmodFile ( path ) {
        return Promise.all( [

            //
            fs.promises.chown( path, this.uid, this.gid ),
            chmod( path, "rw-------" ),
        ] );
    }

    async writeConfig ( path, config ) {
        if ( !config ) return false;

        const lines = [];

        for ( const name in config ) {
            const value = this.#quoteConfigValue( config[ name ] );

            if ( value == null ) {
                continue;
            }
            else {
                lines.push( `${ name } = ${ value }` );
            }
        }

        if ( lines.length ) {
            await this.writeFile( path, lines.join( "\n" ) + "\n" );

            return true;
        }
        else {
            return false;
        }
    }

    async writeFile ( path, data ) {
        await fs.promises.writeFile( path, data );

        return this.chmodFile( path );
    }

    // private
    #quoteConfigValue ( value ) {

        // null
        if ( value == null ) {
            return;
        }

        // string
        else if ( typeof value === "string" ) {
            const match = value.match( /^\s*(-?\d+(?:\.\d+)?)\s*(B|kB|MB|GB|TB|us|ms|s|min|h|d)\s*$/ );

            // number with unit
            if ( match ) {
                return `${ match[ 1 ] }${ match[ 2 ] }`;
            }

            // literal
            else {
                return `'${ value.replaceAll( "'", "''" ) }'`;
            }
        }

        // boolean
        else if ( typeof value === "boolean" ) {
            return value.toString();
        }

        // number
        else if ( typeof value === "number" ) {
            return value;
        }

        // array
        else if ( Array.isArray( value ) ) {
            return value
                .map( value => this.#quoteConfigValue( value ) )
                .filter( value => value )
                .join( ", " );
        }

        // other value
        else {
            throw new Error( `PostgreSQL config value "${ value }" is not valid` );
        }
    }
}

export default new PostgreSqlUtils();
