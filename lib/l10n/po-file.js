import fs from "node:fs";

const PLURAL = [];

export default class PoFile {
    #language;
    #nplurals;
    #pluralExpression;
    #messages;

    constructor ( path ) {
        this.#load( path );
    }

    // public

    // private
    #setLanguage () {}

    #load ( path ) {
        var content = fs.readFileSync( path, "utf8" );

        const messages = {},
            headers = {};

        content = content.trim().split( /\n(?:\s*\n)+/ );

        for ( const message of content ) {
            const lines = message.trim().split( /(msgid_plural|msgid|msgstr\[\d+\]|msgstr) / );

            lines.shift();

            const fields = {};

            while ( lines.length ) {
                const id = lines.shift(),
                    line = this.#readPoString( lines.shift() );

                fields[id] = line;
            }

            // headers
            if ( fields.msgid === "" ) {
                for ( const line of fields.msgstr.split( "\n" ) ) {
                    const idx = line.indexOf( ":" );

                    if ( idx < 1 ) continue;

                    headers[line.substring( 0, idx ).trim().toLowerCase()] = line.substring( idx + 1 ).trim();
                }
            }

            // plural message
            else if ( fields.msgid_plural ) {
                messages[fields.msgid] = { "translations": [] };

                for ( const [field, value] of Object.entries( fields ) ) {
                    if ( !field.startsWith( "msgstr[" ) ) continue;

                    const idx = +field.charAt( 7 );

                    if ( typeof idx !== "number" ) continue;

                    if ( value ) messages[fields.msgid].translations[idx] = value;
                }
            }

            // single message
            else {
                if ( fields.msgstr ) messages[fields.msgid] = { "translations": [fields.msgstr] };
            }
        }

        this.#messages = messages;

        if ( headers.language ) this.#setLanguage( headers.language );

        if ( !PLURAL[this.#language] && headers["plural-forms"] ) {
            this.#nplurals = +headers["plural-forms"].match( /nplurals=(\d+);/ )?.[1];

            this.#pluralExpression = headers["plural-forms"].match( /plural=([^;]+);/ )?.[1];
        }
    }

    #readPoString ( lines ) {
        lines = lines.split( "\n" );

        let string = "";

        for ( let line of lines ) {
            line = line.trim();

            // comment
            if ( line.startsWith( "#" ) ) continue;

            // dequote
            line = line.slice( 1, -1 );

            string += line.replaceAll( "\\n", "\n" );
        }

        return string;
    }
}
