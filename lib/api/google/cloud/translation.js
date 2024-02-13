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
                "q": text.split( "\n" ),
                "target": language,
            } ),
        } );

        if ( !res.ok ) return res;

        const json = await res.json();

        return result( 200, json.data.translations.map( item => item.translatedText ).join( "\n" ) );
    }
}
