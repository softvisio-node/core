const PLURAL = {
    "en": {
        "nplurals": 2,
        "expression": `n != 1`,
    },
    "ru": {
        "nplurals": 3,
        "expression": `n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && ( n % 100 < 12 || n % 100 > 14 ) ? 1 : 2`,
    },
    "uk": {
        "nplurals": 3,
        "expression": `n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && ( n % 100 < 12 || n % 100 > 14 ) ? 1 : 2`,
    },
};

// compile plural expressions
for ( const language in PLURAL ) {
    if ( PLURAL[language].expression ) PLURAL[language].function = eval( `n => ${PLURAL[language].expression}` );
}

export default class Locale {
    #language;
    #nplurals;
    #pluralExpression;
    #pluralFunction;
    #messages;

    constructor ( data ) {
        if ( typeof data === "string" ) {
            this.#loadPoFile( data );
        }
        else if ( typeof data === "object" ) {
            this.#setLanguage( data.language );
            this.#messages = data.messages;

            if ( !PLURAL[this.#language] ) {
                this.#nplurals = data.nplurals;
                this.#pluralExpression = data.pluralExpression;
            }
        }
    }

    // properties
    get language () {
        return this.#language;
    }

    get nplurals () {
        if ( this.#nplurals === undefined ) {
            this.#nplurals = PLURAL[this.#language]?.nplurals || null;
        }

        return this.#nplurals;
    }

    get pluralExpression () {
        if ( this.#pluralExpression === undefined ) {
            this.#pluralExpression = PLURAL[this.#language]?.expression || null;
        }

        return this.#pluralExpression;
    }

    get pluralFunction () {
        if ( this.#pluralFunction === undefined ) {
            this.#pluralFunction = PLURAL[this.#language]?.function || null;

            if ( !this.#pluralFunction && this.pluralExpression ) {
                try {
                    this.#pluralFunction = eval( `n => ${this.pluralExpression}` );
                }
                catch ( e ) {
                    this.#pluralFunction = null;
                }
            }
        }

        return this.#pluralFunction;
    }

    // public
    i18n ( message, num = 0 ) {
        var translation = this.#messages[message];

        // plural
        if ( Array.isArray( translation ) ) {
            const idx = this.pluralFunction?.( num ) || 0;

            translation = translation[idx];
        }

        return ( translation || message ).replaceAll( "%d", num );
    }

    i18nNull ( message, num = 0 ) {
        var translation = this.#messages[message];

        // plural
        if ( Array.isArray( translation ) ) {
            const idx = this.pluralFunction?.( num ) || 0;

            translation = translation[idx];
        }

        if ( translation ) return translation.replaceAll( "%d", num );
    }

    toString () {
        return JSON.stringify( this, null, 4 );
    }

    toJSON () {
        const json = {};

        if ( this.#language ) json.language = this.#language;
        if ( this.nplurals ) json.nplurals = this.nplurals;
        if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
        if ( this.#messages ) json.messages = this.#messages;

        return json;
    }

    toPoFile () {
        var text = `msgid ""
msgstr ""
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
`;

        if ( this.#language ) text += `"Language: ${this.#language}\\n"\n`;

        if ( this.nplurals ) text += `Plural-Forms: nplurals=${this.nplurals || ""}; plural=${this.pluralExpression || ""};\\n\n`;

        for ( const [id, translation] of Object.entries( this.#messages ) ) {
            text += `\nmsgid ${this.#writePoString( id )}`;

            // plural
            if ( Array.isArray( translation ) ) {
                text += `msgid_plural ${this.#writePoString( id )}`;

                const nplurals = this.nplurals || translation.length || 1;

                for ( let n = 0; n < nplurals; n++ ) {
                    text += `msgstr[${n}] ${this.#writePoString( translation[n] )}`;
                }
            }

            // single
            else {
                text += `msgstr ${this.#writePoString( translation )}`;
            }
        }

        return text;
    }

    // protected
    #setLanguage ( language ) {
        this.#language = language;
    }

    #loadPoFile ( content ) {
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
                messages[fields.msgid] = [];

                for ( const [field, value] of Object.entries( fields ) ) {
                    if ( !field.startsWith( "msgstr[" ) ) continue;

                    const idx = +field.charAt( 7 );

                    if ( typeof idx !== "number" ) continue;

                    messages[fields.msgid][idx] = value;
                }
            }

            // single message
            else {
                messages[fields.msgid] = fields.msgstr;
            }
        }

        this.#messages = messages;

        if ( headers.language ) this.#setLanguage( headers.language );

        if ( !PLURAL[this.#language] && headers["plural-forms"] ) {
            this.#nplurals = +headers["plural-forms"].match( /nplurals=(\d+);/ )?.[1];

            this.#pluralExpression = headers["plural-forms"].match( /plural=([^;]+);/ )?.[1];
        }
    }

    #writePoString ( string ) {
        string = ( string ?? "" ).replaceAll( `"`, `\\"` );

        if ( string.includes( "\n" ) ) {
            let text = `""\n`;

            for ( const line of string.split( "\n" ) ) {
                text += `"${line}\\n"\n`;
            }

            return text;
        }
        else {
            return `"${string}"\n`;
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
