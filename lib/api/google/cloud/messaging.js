import Oauth from "#lib/api/google/oauth";
import fetch from "#lib/fetch";

const DEFAULT_MAX_RUNNING_THREADS = 20;

export default class GoogleCloudMessaging {
    #oauth;
    #dispatcher = new fetch.Dispatcher( {
        "connections": DEFAULT_MAX_RUNNING_THREADS,
    } );

    constructor ( key ) {
        this.#oauth = new Oauth( key, "https://www.googleapis.com/auth/firebase.messaging" );
    }

    // public
    // https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#Message
    async send ( message ) {
        const token = await this.#oauth.getToken();

        if ( !token.ok ) return token;

        const res = await fetch( `https://fcm.googleapis.com/v1/projects/${ this.#oauth.projectId }/messages:send`, {
            "method": "post",
            "dispatcher": this.#dispatcher,
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

                return result( [ 500, data.error?.message || res.statusText ] );
            }
            catch {
                return result( res );
            }
        }
    }

    async subscribeToTopic ( topic, tokens ) {
        return this.#manageTopic( "batchAdd", topic, tokens );
    }

    async unsubscribeFromTopic ( topic, tokens ) {
        return this.#manageTopic( "batchRemove", topic, tokens );
    }

    // private
    async #manageTopic ( type, topic, tokens ) {
        if ( !Array.isArray( tokens ) ) tokens = [ tokens ];

        const token = await this.#oauth.getToken();

        if ( !token.ok ) return token;

        const res = await fetch( "https://iid.googleapis.com/iid/v1:" + type, {
            "method": "post",
            "dispatcher": this.#dispatcher,
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
            const stat = {
                "successCount": 0,
                "failureCount": 0,
                "errors": [],
            };

            for ( let n = 0; n < data.results.length; n++ ) {
                if ( data.results[ n ].error ) {
                    stat.failureCount++;
                    stat.errors.push( {
                        "token": tokens[ n ],
                        "error": data.results[ n ].error,
                    } );
                }
                else {
                    stat.successCount++;
                }
            }

            return result( 200, stat );
        }
        else {
            return result( [ res.status, data?.error || res.statusText ] );
        }
    }
}
