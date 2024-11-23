import "#lib/result";
import { Api, extensions, TelegramClient } from "telegram";
import telegramEvents from "telegram/events/index.js";
import { StringSession } from "telegram/sessions/index.js";
import env from "#lib/env";
import StartManager from "#lib/threads/start-manager";
import { prompt } from "#lib/utils";

// NOTE https://core.telegram.org/methods
// NOTE https://gram.js.org/beta/classes/TelegramClient.html
// NOTE https://gram.js.org

export default class TelegramClientApi {
    #startManager;
    #client;

    constructor ( { apiId, apiHash, session, deviceModel, appVersion, connectionRetries = 5, logLevel, connect, ...options } = {} ) {
        this.#startManager = new StartManager( {
            "onStart": this.#connect.bind( this ),
            "onStop": this.#disconnect.bind( this ),
        } );

        const stringSession = new StringSession( session );

        this.#client = new TelegramClient( stringSession, apiId, apiHash, {
            connectionRetries,
            "deviceModel": deviceModel || env.package.name,
            "appVersion": appVersion || env.package.version,
            "baseLogger": new extensions.Logger( logLevel || "error" ),
            ...options,

            // "systemVersion": "1.0.0",
            // "langCode": clientParams.langCode,
            // "langPack": "",
            // "systemLangCode": clientParams.systemLangCode,
        } );

        if ( connect ) this.connect();
    }

    // properties
    get Api () {
        return Api;
    }

    get events () {
        return telegramEvents;
    }

    // XXX
    get isConnected () {
        return this.#client.connected;
    }

    // public
    async createSession ( { accountId, phoneCode, password } = {} ) {
        if ( !accountId ) {
            accountId = await prompt( "Enter Telegram account phone number or Telegram bot API token: " );
        }
        else if ( typeof accountId === "function" ) {
            accountId = await accountId();
        }

        var options;

        // phone number
        if ( /^\+?\d+$/.test( accountId ) ) {
            options = {
                "phoneNumber": accountId,
                "phoneCode": typeof phoneCode === "function"
                    ? phoneCode
                    : async () => phoneCode || ( await prompt( "Enter the code you just received: " ) ),
                "password": typeof password === "function"
                    ? password
                    : async () => password || ( await prompt( "Enter Telegram account password: " ) ),
            };
        }

        // bot api token
        else {
            options = {
                "botAuthToken": accountId,
            };
        }

        return this.#client
            .start( {
                ...options,
                "onError": e => console.log( e + "" ),
            } )
            .then( () => result( 200, this.session.save() ) )
            .catch( e => result.catch( e, { "log": false } ) );
    }

    async connect () {
        return this.#startManager.start();
    }

    async disconnect ( { graceful } = {} ) {
        return this.#startManager.stop( { graceful } );
    }

    // XXX
    async call ( ...args ) {
        this.#startManager.startRequest();

        const res = await this.#client.invoke( ...args );

        this.#startManager.finishRequest();

        return res;
    }

    // XXX
    async getMe () {
        this.#startManager.startRequest();

        const res = await this.#client.getMe();

        this.#startManager.finishRequest();

        return res;
    }

    // private
    async #connect () {
        const res = await this.#client.connect();

        return res
            ? result( 200 )
            : result( 500 );
    }

    async #disconnect () {
        return this.#client.disconnect();
    }
}
