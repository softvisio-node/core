import "#lib/result";
import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import env from "#lib/env";
import { prompt } from "#lib/utils";

// NOTE https://core.telegram.org/methods
// NOTE https://gram.js.org/beta/classes/TelegramClient.html
// NOTE https://gram.js.org

export default class TelegramClientApi extends TelegramClient {
    #phoneNumber;

    constructor ( { apiId, apiHash, phoneNumber, session, deviceModel, appVersion, connectionRetries = 5, ...options } = {} ) {
        const stringSession = new StringSession( session );

        super( stringSession, apiId, apiHash, {
            connectionRetries,
            "deviceModel": deviceModel || env.package.name,
            "appVersion": appVersion || env.package.version,
            ...options,

            // "systemVersion": "1.0.0",
            // "langCode": clientParams.langCode,
            // "langPack": "",
            // "systemLangCode": clientParams.systemLangCode,
        } );

        this.setLogLevel( "error" );

        this.#phoneNumber = phoneNumber;
    }

    // properties
    get Api () {
        return Api;
    }

    get phoneNumber () {
        return this.#phoneNumber;
    }

    // public
    async start ( { accountId, password } = {} ) {
        accountId ||= this.#phoneNumber || ( await prompt( "Enter Telegram account phone number or Telegram bot API token: " ) );

        var options;

        // phone number
        if ( /^\+?\d+$/.test( accountId ) ) {
            options = {
                "phoneNumber": accountId,
                "phoneCode": async () => await prompt( "Enter the code you just received: " ),
                "password": async () => password || ( await prompt( "Enter Telegram account password: " ) ),
            };
        }

        // bot api token
        else {
            options = {
                "botAuthToken": accountId,
            };
        }

        return super
            .start( {
                ...options,
                "onError": e => console.log( e + "" ),
            } )
            .then( () => result( 200, this.session.save() ) )
            .catch( e => result.catch( e, { "log": false } ) );
    }
}
