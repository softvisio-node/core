import msgpack from "#lib/msgpack";
import Clients from "./clients.js";
import Bots from "./bots.js";

export default class Telegram {
    #app;
    #config;
    #dbh;
    #clients;
    #bots;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#dbh;
    }

    get config () {
        return this.#config;
    }

    get clients () {
        return this.#clients;
    }

    get bots () {
        return this.#bots;
    }

    // public
    async init () {
        var res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ), {
            "app": this.app,
        } );
        if ( !res.ok ) return res;

        this.#clients = new Clients( this );
        this.#bots = new Bots( this );

        this.app.publicHttpServer?.get( this.config.filesUrl + "*", this.#downloadFile.bind( this ) );

        this.app.publicHttpServer?.get( this.config.avatarUrl + "*", this.#downloadAvatar.bind( this ) );

        return result( 200 );
    }

    async start () {
        var res;

        res = await this.clients.start();
        if ( !res.ok ) return res;

        res = await this.bots.start();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async shutDown () {
        await this.#bots.shutDown();

        await this.#clients.shutDown();
    }

    createCallbackData ( method, ...args ) {
        const value = msgpack.encode( [ method, ...args ], "base64url" );

        if ( value.length > 64 ) throw new Error( `Telegram callback data length > 64 bytes` );

        return value;
    }

    decodeCallbackData ( string ) {
        try {
            return msgpack.decode( string, "base64url" );
        }
        catch {
            return null;
        }
    }

    // private
    async #downloadFile ( req ) {
        const [ botId, fileId ] = req.path.slice( this.config.filesUrl.length ).split( "/" );

        if ( !botId || !fileId ) return req.end( 404 );

        const bot = this.bots.getBotById( botId );

        if ( !bot ) return req.end( 404 );

        return bot.files.downloadFile( req, fileId );
    }

    async #downloadAvatar ( req ) {
        const [ botId, userId ] = req.path.slice( this.config.avatarUrl.length ).split( "/" );

        if ( !botId ) return req.end( 404 );

        const bot = this.bots.getBotById( botId );

        if ( !bot ) return req.end( 404 );

        return bot.files.downloadAvatar( req, userId );
    }
}
