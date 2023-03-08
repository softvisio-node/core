import Oauth from "#lib/api/google/oauth";
import fetch from "#lib/fetch";
import { readConfig } from "#lib/config";

export default class FirebaseMessaging {
    #key;
    #oauth;

    constructor ( key ) {
        this.#key = typeof key === "string" ? readConfig( key ) : key;

        this.#oauth = new Oauth( this.#key, "https://www.googleapis.com/auth/firebase.messaging" );
    }

    // https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#Message
    async send ( message ) {
        const token = await this.#oauth.getToken();

        if ( !token.ok ) return token;

        const res = await fetch( `https://fcm.googleapis.com/v1/projects/${this.#key.project_id}/messages:send`, {
            "method": "post",
            "headers": {
                "Authorization": "Bearer " + token.data,
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( { message } ),
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

    async subscribeToTopic ( topic, tokens ) {
        if ( !Array.isArray( tokens ) ) tokens = [tokens];

        const token = await this.#oauth.getToken();

        if ( !token.ok ) return token;

        const res = await fetch( "https://iid.googleapis.com/iid/v1:batchAdd", {
            "method": "post",
            "headers": {
                "access_token_auth": "true",
                "Authorization": "Bearer " + token.data,
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( {
                "to": "/topics/" + topic,
                "registration_tokens": tokens,
            } ),
        } );

        const data = await res.json();

        if ( res.ok ) {
            return result( 200, data );
        }
        else {
            return result( [res.status, data?.error || res.statusText] );
        }
    }

    async unsubscribeFromTopic ( topic, tokens ) {
        if ( !Array.isArray( tokens ) ) tokens = [tokens];

        const token = await this.#oauth.getToken();

        if ( !token.ok ) return token;

        const res = await fetch( "https://iid.googleapis.com/iid/v1:batchRemove", {
            "method": "post",
            "headers": {
                "access_token_auth": "true",
                "Authorization": "Bearer " + token.data,
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( {
                "to": "/topics/" + topic,
                "registration_tokens": tokens,
            } ),
        } );

        const data = await res.json();

        if ( res.ok ) {
            return result( 200, data );
        }
        else {
            return result( [res.status, data?.error || res.statusText] );
        }
    }
}
