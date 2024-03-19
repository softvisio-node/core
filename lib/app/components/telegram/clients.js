import sql from "#lib/sql";
import crypto from "node:crypto";

// import Client from "./client.js";

const SQL = {
    "deleteClient": sql`DELETE FROM telegram_client WHERE id = ?`,
};

export default class {
    #telegram;
    #clients = {};
    #clientsPhoneNumber = {};
    #defaultClient;
    #appHash;
    #unloading;

    constructor ( telegram ) {
        this.#telegram = telegram;
    }

    // properties
    get telegram () {
        return this.#telegram;
    }

    get app () {
        return this.#telegram.app;
    }

    get dbh () {
        return this.#telegram.app.dbh;
    }

    get isEnabled () {
        if ( !this.telegram.config.app.apiId || !this.telegram.config.app.apiHash ) return false;

        return true;
    }

    get appHash () {
        return ( this.$appHash ??= crypto
            .createHash( "md5" )
            .update( !this.telegram.config.app.apiId + "/" + !this.telegram.config.app.apiHash )
            .digest( "base64url" ) );
    }

    // public
    // XXX
    async start () {
        if ( !this.isEnabled ) return result( 200 );

        var res;

        // drop storage if app hash changed
        res = await this.dbh.do( sql`UPDATE telegram_client SET app_hash = ?, storage = NULL WHERE app_hash != ?`, [ this.appHash, this.appHash ] );
        if ( !res.ok ) return res;

        // XXX create clients
        if ( this.telegram.config.clients ) {
            for ( const clientConfig of this.telegram.config.clients ) {
                const res = await this.#createClient( {
                    ...clientConfig,
                    "isStatic": true,
                } );

                if ( !res.ok ) return res;
            }
        }

        // XXX delete missed static clients

        // XXX load clients

        // XXX set listeners

        this.#setDefaultClient();

        return result( 200 );
    }

    async shutDown () {
        return this.#unloadClients();
    }

    getClient ( id ) {
        if ( id ) {
            return this.#clients[ id ] || this.#clientsPhoneNumber[ id ];
        }
        else {
            return this.#defaultClient;
        }
    }

    async createClient ( phoneNumber, { phoneCode, passwprd, dbh } = {} ) {
        return this.#createClient( {
            phoneNumber,
            "isStatic": false,
            phoneCode,
            passwprd,
            dbh,
        } );
    }

    async deleteClient ( id, { dbh } = {} ) {
        const client = this.getClient( id );

        if ( !client ) return result( 404 );

        if ( client.isStatic ) return result( 400 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.deleteClient, [ client.id ] );
        if ( !res.ok ) return res;

        await this.#unloadClient( client.id );

        return result( 200 );
    }

    // private
    // XXX
    async #createClient ( { phoneNumber, isStatic, phoneCode, passwprd, dbh } = {} ) {
        dbh ||= this.dbh;
    }

    // XXX
    async #loadClients () {}

    async #unloadClients () {
        this.#unloading = true;

        const clients = this.#clients;

        this.#clients = {};
        this.#clientsPhoneNumber = {};

        await Promise.all( Object.values( clients ).map( client => client.shutDown() ) );

        this.#unloading = false;

        this.#loadClients();
    }

    async #unloadClient ( id ) {
        const client = this.getClient( id );

        if ( !client ) return;

        delete this.#clients[ client.id ];
        delete this.#clientsPhoneNumber[ client.phoneNumber ];

        this.#setDefaultClient();

        return client.shutDown();
    }

    #setDefaultClient () {
        this.#defaultClient = null;

        for ( const client of Object.values( this.#clients ) ) {
            if ( client.isEnabled ) {
                this.#defaultClient = client;

                break;
            }
        }
    }
}
