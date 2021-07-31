import OAuth from "./oauth.js";
import fetch from "#lib/fetch";
import * as config from "#lib/config";

export default class GoogleFCM {
    #oauth;
    #key;

    constructor ( keyPath ) {
        this.#key = config.read( keyPath );

        this.#oauth = new OAuth( this.#key, "https://www.googleapis.com/auth/firebase.messaging" );
    }

    // https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#Message
    async send ( data ) {
        const token = await this.#oauth.getToken();

        if ( !token.ok ) return token;

        const res = await fetch( `https://fcm.googleapis.com/v1/projects/${this.#key.project_id}/messages:send`, {
            "method": "post",
            "headers": {
                "Authorization": "Bearer " + token.data,
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( data ),
        } );

        if ( res.ok ) {
            return result( 200, await res.json() );
        }
        else {
            try {
                const data = await res.json();

                return result( [500, data.error?.message || res.statusText] );
            }
            catch ( e ) {
                return result( res );
            }
        }
    }
}
