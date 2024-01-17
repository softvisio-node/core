// data:[<mediatype>][;base64],<data>

export function parseDataUrl ( url ) {
    if ( !( url instanceof URL ) ) url = new URL( url );

    var type, encoding, data;

    const idx = url.pathname.indexOf( "," );

    // has no data
    if ( idx === -1 ) {
        type = url.pathname;
    }

    // has data
    else {
        [type, encoding] = url.pathname.substring( 0, idx ).split( ";" );

        data = encoding ? Buffer.from( url.pathname.substring( idx + 1 ), encoding ) : Buffer.from( decodeURIComponent( url.pathname.substring( idx + 1 ) ) );
    }

    return {
        type,
        encoding,
        data,
        "searchParams": url.searchParams,
    };
}

// XXX
export function createDataUrl ( { type, encoding, data, params } = {} ) {
    var url = "data:" + ( type || "" );

    if ( data != null ) {
        if ( encoding ) url += ";" + encoding + "," + data.toString( encoding );
        else url += "," + encodeURIComponent( data );
    }

    if ( params ) {
        url += "?" + ( params instanceof URLSearchParams ? params : new URLSearchParams( params ) );
    }

    return url;
}
