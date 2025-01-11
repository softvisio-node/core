import Accounts from "#lib/api/cloudflare/accounts";
import DnsRecords from "#lib/api/cloudflare/dns-records";
import User from "#lib/api/cloudflare/user";
import Zones from "#lib/api/cloudflare/zones";
import fetch from "#lib/fetch";
import mixins from "#lib/mixins";

// NOTE https://api.cloudflare.com/

const BASE_URL = new URL( "https://api.cloudflare.com/client/v4/" );

export default class Cloudflare extends mixins( Accounts, DnsRecords, User, Zones ) {
    #token;
    #email;

    constructor ( token, email ) {
        super();

        this.#token = token;
        this.#email = email;
    }

    // protected
    async _doRequest ( method, path, params, body ) {
        const url = new URL( path, BASE_URL );

        if ( params ) url.search = new URLSearchParams( params );

        if ( body ) body = JSON.stringify( body );

        const res = await fetch( url, {
            method,
            "headers": {
                "Content-Type": "application/json",
                ...this.#getAuthHeaders(),
            },
            body,
        } );

        if ( !res.ok ) return result( res );

        try {
            const data = await res.json();

            if ( !data.success ) {
                return result( [ 500, data.errors.join( ", " ) ] );
            }

            return result( 200, data.result );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    #getAuthHeaders () {
        if ( this.#email ) {
            return {
                "X-Auth-Email": this.#email,
                "X-Auth-Key": this.#token,
            };
        }
        else {
            return {
                "Authorization": "Bearer " + this.#token,
            };
        }
    }
}
