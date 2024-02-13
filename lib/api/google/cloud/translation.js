import fetch from "#lib/fetch";

export default class {
    #apiKey;

    constructor ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // public
    async translate ( text, language ) {
        const res = await fetch( "https://translation.googleapis.com/language/translate/v2", {
            "method": "post",
            "headers": {
                "X-goog-api-key": this.#apiKey,
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( {
                "q": [ "Hello world", "My name is Jeff" ],
                "target": "ru",
            } ),
        } );

        if ( !res.ok ) return res;

        const json = await res.jaon();

        return result( 200, json );
    }
}
