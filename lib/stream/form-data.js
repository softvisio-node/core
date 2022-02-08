import StreamSplit from "#lib/stream/split";

export default class StreamFormData extends StreamSplit {
    #boundary;

    constructor ( contentType ) {
        var boundary;

        // parse boundary
        if ( contentType ) {
            const match = contentType.match( /boundary=(.+)/ );

            if ( match ) {
                boundary = match[1];

                // dequote boundary
                if ( boundary.startsWith( `"` ) ) {
                    boundary = boundary.substring( 1, boundary.length - 1 );
                }
            }
        }

        if ( !boundary ) throw Error( `Unable to parse boundary` );

        super( boundary );

        this.#boundary = boundary;
    }

    // protected
    async _onNewStream ( stream ) {
        const t = await stream.text();

        console.log( "---", JSON.stringify( t ) );

        // this.push( stream );
    }
}
