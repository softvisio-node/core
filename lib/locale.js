const PLURAL = {
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

class MsgId {
    #strings;
    #args;
    #id;

    constructor ( strings, args ) {
        this.#strings = strings;
        this.#args = args;
    }

    // properties
    get id () {
        this.#id ??= this.#strings.join( "${n}" );

        return this.#id;
    }

    // public
    toString () {
        return this.id;
    }

    translate ( translation ) {
        if ( !this.#args.length ) return translation ?? this.#id;

        var i = 0;

        return ( translation || this.id ).replaceAll( "${n}", () => this.#args[i++] );
    }
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
    i18n ( msgId, pluralMsgId, num ) {
        var translation = this.translate( msgId, pluralMsgId, num );

        if ( translation ) return translation;

        // fallback to English
        if ( pluralMsgId ) {
            translation = num === 1 ? msgId : pluralMsgId;
        }
        else {
            translation = msgId;
        }

        if ( translation instanceof MsgId ) {
            return translation.translate();
        }
        else {
            return translation;
        }
    }

    translate ( msgId, pluralMsgId, num ) {
        const translations = this.#messages[msgId]?.translations;

        if ( !translations ) return;

        var id, idx;

        // plural
        if ( pluralMsgId ) {
            id = pluralMsgId;
            idx = this.pluralFunction?.( num );
        }

        // single
        else {
            id = msgId;
            idx = 0;
        }

        const translation = translations[idx];

        if ( !translation ) return;

        if ( id instanceof MsgId ) {
            return id.translate( translation );
        }
        else {
            return translation;
        }
    }

    toString () {
        return JSON.stringify( this, null, 4 );
    }

    toJSON ( compact ) {
        const json = {};

        if ( compact ) {
            if ( this.#language ) json.language = this.#language;
            if ( !PLURAL[this.#language]?.expression && this.pluralExpression ) json.pluralExpression = this.pluralExpression;

            if ( this.#messages ) {
                json.messages = {};

                for ( const [id, message] of Object.entries( this.#messages ) ) {
                    json.messages[id] = {
                        "translations": message.translations,
                    };
                }
            }
        }
        else {
            if ( this.#language ) json.language = this.#language;
            if ( this.nplurals ) json.nplurals = this.nplurals;
            if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
            if ( this.#messages ) json.messages = this.#messages;
        }

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

        for ( const [id, message] of Object.entries( this.#messages ) ) {
            text += "\n";

            // comments
            if ( message.comments ) {
                for ( const comment of message.comments.split( "\n" ) ) text += `# ${comment}\n`;
            }

            // references
            if ( message.references ) text += `#: ${message.references}\n`;

            // flags
            if ( message.flags ) text += `#, ${message.flags}\n`;

            // notes
            if ( message.notes ) {
                for ( const note of message.notes.split( "\n" ) ) text += `#. ${note}\n`;
            }

            text += `msgid ${this.#writePoString( id )}`;

            // plural
            if ( message.plural ) {
                text += `msgid_plural ${this.#writePoString( message.plural )}`;

                const nplurals = this.nplurals || message.translations?.length || 1;

                for ( let n = 0; n < nplurals; n++ ) {
                    text += `msgstr[${n}] ${this.#writePoString( message.translations?.[n] )}`;
                }
            }

            // single
            else {
                text += `msgstr ${this.#writePoString( message.translations?.[0] )}`;
            }
        }

        return text;
    }

    // protected
    #setLanguage ( language ) {
        this.#language = language;
    }

    // XXX
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

// register msgid globally
if ( !global.msgid ) {
    Object.defineProperty( global, "msgid", {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        "value": function ( strings, ...args ) {
            return new MsgId( strings, args );
        },
    } );
}
