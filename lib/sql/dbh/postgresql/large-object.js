import Blob from "#lib/blob";
import { sql } from "#lib/sql/query";
import stream from "#lib/stream";

const DEFAULT_READ_SIZE = 65_536,
    MAX_READ_SIZE = 2_147_483_647;

const SQL = {
    "loCreate": sql`SELECT lo_create ( ? ) AS oid`.prepare(),

    "loFromBytea": sql`SELECT lo_from_bytea( ?, ? ) AS oid`.prepare(),

    "loPut": sql`SELECT lo_put( ?, ?, ? )`.prepare(),

    "loGet": sql`SELECT lo_get( ? ) AS buffer`.prepare(),

    "loGetLength": sql`SELECT lo_get( ?, ?, ? ) AS buffer`.prepare(),

    "loUnlink": sql`SELECT lo_unlink( ? )`.prepare(),
};

class LargeObjectReadable extends stream.Readable {
    #dbh;
    #oid;
    #start;
    #length;
    #readLength = 0;

    constructor ( dbh, oid, { start, length } = {} ) {
        super();

        this.#dbh = dbh;
        this.#oid = oid;
        this.#start = start || 0;
        this.#length = length;
    }

    // properties
    get oid () {
        return this.#oid;
    }

    get start () {
        return this.#start;
    }

    get length () {
        return this.#length;
    }

    // protected
    async _read ( size ) {
        size ||= DEFAULT_READ_SIZE;

        if ( this.#length ) {
            const rest = this.#length - this.#readLength;

            if ( rest < 0 ) {
                return this.push( null );
            }
            else if ( rest < size ) {
                size = rest;
            }
        }

        const res = await this.#dbh.selectRow( SQL.loGetLength, [ this.#oid, this.#start + this.#readLength, size ] );

        if ( res.ok ) {
            const length = res.data.buffer.length;

            if ( length ) {
                this.#readLength += length;

                this.push( res.data.buffer );

                // data length limit reached
                if ( this.#length && this.#readLength >= this.#length ) {
                    this.push( null );
                }

                // returned data length < requested length, no more data available
                else if ( length < size ) {
                    this.push( null );
                }
            }
            else {
                this.push( null );
            }
        }
        else {
            this.destroy( res );
        }
    }
}

class LargeObject {
    #dbh;

    constructor ( dbh ) {
        this.#dbh = dbh;
    }

    // public
    async read ( oid, { start, length } = {} ) {
        if ( length ) {
            if ( length > MAX_READ_SIZE ) {
                const stream = await this.createReadStream( oid, { start, length } );

                return stream
                    .buffer()
                    .then( buffer => result( 200, { buffer } ) )
                    .catch( e => result.catch( e ) );
            }
            else {
                return this.#dbh.selectRow( SQL.loGetLength, [ oid, start || 0, length ] );
            }
        }
        else if ( start ) {
            const stream = await this.createReadStream( oid, { start, length } );

            return stream
                .buffer()
                .then( buffer => result( 200, { buffer } ) )
                .catch( e => result.catch( e ) );
        }
        else {
            return this.#dbh.selectRow( SQL.loGet, [ oid ] );
        }
    }

    async write ( data, { oid } = {} ) {

        // Blob
        if ( data instanceof Blob ) {
            data = data.stream();
        }

        if ( data instanceof stream.Readable ) {
            return this.#dbh.begin( async dbh => {
                var res,
                    start = 0;

                if ( oid ) {
                    res = await dbh.selectRow( SQL.loUnlink, [ oid ] );
                    if ( !res.ok ) throw res;
                }

                res = await dbh.selectRow( SQL.loCreate, [ oid || 0 ] );
                if ( !res.ok ) throw res;

                oid = res.data.oid;

                for await ( let buffer of data ) {
                    if ( !Buffer.isBuffer( buffer ) ) buffer = Buffer.from( buffer );

                    res = await dbh.select( SQL.loPut, [ oid, start, buffer ] );

                    if ( !res.ok ) {
                        data.destroy();

                        throw res;
                    }

                    start += buffer.length;
                }

                data.destroy();

                return result( 200, { oid } );
            } );
        }
        else {
            if ( !Buffer.isBuffer( data ) ) data = Buffer.from( data );

            if ( oid ) {
                return this.#dbh.begin( async dbh => {
                    var res;

                    res = await dbh.selectRow( SQL.loUnlink, [ oid ] );
                    if ( !res.ok ) throw res;

                    res = await dbh.selectRow( SQL.loFromBytea, [ oid, data ] );
                    if ( !res.ok ) throw res;

                    return res;
                } );
            }
            else {
                return this.#dbh.selectRow( SQL.loFromBytea, [ 0, data ] );
            }
        }
    }

    async unlink ( oid ) {
        return this.#dbh.selectRow( SQL.loUnlink, [ oid ] );
    }

    createReadStream ( oid, { start, length } = {} ) {
        return new Promise( resolve => {
            this.#dbh.lock( async dbh => {
                return new Promise( unlock => {
                    const stream = new LargeObjectReadable( dbh, oid, { start, length } );

                    resolve( stream );

                    stream.once( "destroy", unlock );
                } );
            } );
        } );
    }
}

export default Super =>
    class extends Super {
        #largeObject;

        // properties
        get largeObject () {
            if ( !this.#largeObject ) {
                this.#largeObject = new LargeObject( this );
            }

            return this.#largeObject;
        }
    };
