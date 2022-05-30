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
    #translations;
    #nplurals;
    #pluralExpression;
    #pluralFunction;

    constructor ( data ) {
        if ( typeof data === "string" ) {
            this.#loadPoFile( data );
        }
        else if ( typeof data === "object" ) {
            this.#setLanguage( data.language );
            this.#translations = data.translations;

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
    i18n ( id, num ) {
        const translation = this.#translations[id];

        if ( !translation ) return;

        if ( translation.plural ) {
            num ??= 0;

            const idx = this.pluralFunction?.( num ) || 0,
                message = translation.messages[idx];

            if ( message ) return message.replaceAll( "%d", num );
        }
        else {
            return translation.messages[0];
        }
    }

    toJSON () {
        return {
            "language": this.#language,
            "nplurals": this.nplurals,
            "pluralExpression": this.pluralExpression,
            "translations": this.#translations,
        };
    }

    toPoFile () {
        var text = `msgid ""
msgstr ""
"Language: ${this.#language}\\n"
"MIME-Version: 1.0\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
"Content-Transfer-Encoding: 8bit\\n"
"Plural-Forms: nplurals=${this.nplurals || ""}; plural=${this.pluralExpression || ""};\\n"
`;

        for ( const [id, translation] of Object.entries( this.#translations ) ) {
            text += `\nmsgid "${id}"\n`;

            if ( translation.plural ) {
                text += `msgid_plural "${translation.plural}"\n`;

                for ( let n = 0; n < translation.messages.length; n++ ) {
                    text += `msgstr[${n}] "${translation.messages[n] || ""}"\n`;
                }
            }
            else {
                text += `msgstr "${translation.messages[0] || ""}"\n`;
            }
        }

        return text;
    }

    // protected
    #setLanguage ( language ) {
        this.#language = language;
    }

    #loadPoFile ( content ) {
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

        if ( headers.Language ) this.#setLanguage( headers.Language );

        this.#translations = translations;

        if ( !PLURAL[this.#language] && headers["Plural-Forms"] ) {
            this.#nplurals = +headers["Plural-Forms"].match( /nplurals=(\d+);/ )?.[1];

            this.#pluralExpression = headers["Plural-Forms"].match( /plural=([^;]+);/ )?.[1];
        }
    }
}
