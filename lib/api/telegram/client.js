import "#lib/result";
import { Api, extensions, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import env from "#lib/env";
import { prompt } from "#lib/utils";

// NOTE https://core.telegram.org/methods
// NOTE https://gram.js.org/beta/classes/TelegramClient.html
// NOTE https://gram.js.org

export default class TelegramClientApi extends TelegramClient {
    constructor ( { apiId, apiHash, session, deviceModel, appVersion, connectionRetries = 5, logLevel, ...options } = {} ) {
        const stringSession = new StringSession( session );

        super( stringSession, apiId, apiHash, {
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
    }

    // properties
    get Api () {
        return Api;
    }

    // public
    async start ( { accountId, password } = {} ) {
        accountId ||= await prompt( "Enter Telegram account phone number or Telegram bot API token: " );

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
