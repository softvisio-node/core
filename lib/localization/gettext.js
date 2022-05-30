export default class GetText {

    // public
    toJSON () {}

    readPoFile ( content ) {
        const headers = {},
            translations = {},
            lines = content.trim().split( "\n" );

        var translation;

        while ( lines.length ) {
            let line = lines.shift().trim();

            // empty line
            if ( line === "" ) {
                if ( translation?.id ) translations[translation.id] = translation;

                translation = null;

                continue;
            }

            // comment
            else if ( line.startsWith( "#" ) ) {
                continue;
            }

            // header
            else if ( line.startsWith( `"` ) ) {
                let header = "";

                while ( 1 ) {

                    // dequote
                    header += line.slice( 1, -1 );

                    if ( header.endsWith( "\\n" ) ) {
                        header = header.slice( 0, -2 );

                        const idx = header.indexOf( ":" );

                        if ( idx > 0 ) {
                            headers[header.substring( 0, idx ).trim()] = header.substring( idx + 1 ).trim();
                        }

                        break;
                    }
                    else {
                        line = lines.shift();
                    }
                }
            }

            // msgid
            else if ( line.startsWith( "msgid " ) ) {
                if ( translation?.id ) translations[translation.id] = translation;

                const id = line.substring( 6 ).trim().slice( 1, -1 );

                if ( !id ) continue;

                translation = {
                    id,
                    "messages": [],
                };
            }

            // msgid_plural
            else if ( line.startsWith( "msgid_plural " ) ) {
                if ( !translation ) continue;

                const plural = line.substring( 13 ).trim().slice( 1, -1 );

                if ( plural ) translation.plural = plural;
            }

            // msgstr
            else if ( line.startsWith( "msgstr" ) ) {
                if ( !translation ) continue;

                let idx, text;

                if ( line.charAt( 6 ) === "[" ) {
                    idx = +line.charAt( 7 );

                    if ( typeof idx !== "number" ) continue;

                    text = line.substring( 10 ).trim().slice( 1, -1 );
                }
                else {
                    idx = 0;
                    text = line.substring( 7 ).trim().slice( 1, -1 );
                }

                if ( text ) translation.messages[idx] = text;
            }
        }

        if ( translation?.id ) translations[translation.id] = translation;

        console.log( headers );
        console.log( translations );

        return this;
    }
}
