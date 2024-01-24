const TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function encode ( location ) {
    if ( typeof location === "string" ) {
        const key = TABLE[ location.length ];

        return "w+CAIQICI" + key + Buffer.from( location, "ascii" ).toString( "base64url" );
    }
    else {
        const data = `role:1
producer:12
provenance:6
timestamp:${ Date.now() * 1000 }
latlng{
latitude_e7:${ location.latitude.toFixed( 7 ).replaceAll( ".", "" ) }
longitude_e7:${ location.longitude.toFixed( 7 ).replaceAll( ".", "" ) }
}
radius:-1
          `;

        return "a+" + Buffer.from( data ).toString( "base64url" );
    }
}

export function decode ( uule ) {
    if ( uule.startsWith( "w" ) ) {
        return Buffer.from( uule.substring( 10 ), "base64url" ).toString();
    }
    else {
        const data = Buffer.from( uule.substring( 2 ), "base64url" ).toString();

        var idx;

        idx = data.indexOf( "latitude_e7:" ) + 12;
        const latitude = data.substring( idx, data.indexOf( "\n", idx ) ) / 10_000_000;

        idx = data.indexOf( "longitude_e7:" ) + 13;
        const longitude = data.substring( idx, data.indexOf( "\n", idx ) ) / 10_000_000;

        return { latitude, longitude };
    }
}
