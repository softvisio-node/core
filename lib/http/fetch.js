import "#index";

import _fetch from "node-fetch";
import Agent from "./agent.js";

const CHROME = {
    "accept-language": "en-US,en;q=0.9",
    "user-agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.142 Safari/537.36`,
};

// options:
// proxy: null
// rejectUnauthorized: bool
// chrome: bool
export default async function fetch ( url, options = {} ) {
    if ( options.agent ) {
        if ( Object.isPlain( options.agent ) ) {
            options = { ...options, "agent": new Agent( options.agent ).fetchAgent };
        }
        else if ( options.agent instanceof Agent ) {
            options = { ...options, "agent": options.agent.fetchAgent };
        }
    }

    if ( options.chrome ) {
        const headers = { ...( options.headers || {} ), ...CHROME };

        options = { ...options, headers };
    }

    return new Promise( resolve => {
        _fetch( url, options )
            .then( res => {
                res.reason = res.statusText;

                resolve( res );
            } )
            .catch( e => {
                const res = new fetch.Response( null, {
                    "status": 599,
                    "statusText": e.message,
                } );

                res.reason = res.statusText;

                resolve( res );
            } );
    } );
}

fetch.Agent = Agent;
