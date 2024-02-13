import fetch from "#lib/fetch";

export default class {
    #apiKey;

    constructor ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // public
    async translate ( language, text ) {
        const res = await fetch( "https://translation.googleapis.com/language/translate/v2", {
            "method": "post",
            "headers": {
                "X-goog-api-key": this.#apiKey,
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( {
                "q": text,
                "target": language,
            } ),
        } );

        if ( !res.ok ) return res;

        const json = await res.json();

        if ( Array.isArray( text ) ) {
            return result( 200, json.data.translations );
        }
        else {
            return result( 200, json.data.translations[ 0 ].translatedText );
        }
    }
}
