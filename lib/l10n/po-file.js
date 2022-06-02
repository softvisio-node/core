import Locale from "#lib/l10n/locale";

export default class PoFile {
    #headers = {};
    #messages = {};

    #language;
    #nplurals;
    #pluralExpression;
    #locale;
    #toString;

    constructor ( content ) {
        if ( typeof content === "string" ) {
            this.#readPoFile( content );
        }
        else {
            this.#setHeaders( content.headers );
            this.#messages = content.messages;
        }
    }

    // properties
    get language () {
        return this.#language;
    }

    get nplurals () {
        return this.#nplurals;
    }

    get pluralExpression () {
        return this.#pluralExpression;
    }

    get locale () {
        this.#locale ??= new Locale( {
            "language": this.#language,
            "pluralExpression": this.pluralExpression,
            "messages": Object.fromEntries( Object.entries( this.#messages )
                .filter( ( [id, message] ) => !message.disabled )
                .map( ( [id, message] ) => [id, message.translations] ) ),
        } );

        return this.#locale;
    }

    // public
    toString () {
        this.#toString ??= this.#writePoFile();

        return this.#toString;
    }

    toJSON () {
        const json = {};

        if ( this.#language ) json.language = this.#language;
        if ( this.nplurals ) json.nplurals = this.nplurals;
        if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
        if ( this.#messages ) json.messages = this.#messages;

        return json;
    }

    // private
    #setHeaders ( headers ) {
        if ( !headers ) return;

        this.#headers = headers;

        const index = {};

        for ( const header in headers ) index[header.toLowerCase()] = header;

        if ( index["language"] ) {
            this.#language = headers[index.language];
        }
        else {
            this.#language = null;
        }

        if ( index["plural-forms"] ) {
            const pluralForms = headers[index["plural-forms"]];

            this.#nplurals = +pluralForms.match( /nplurals=(\d+);/ )?.[1];

            this.#pluralExpression = pluralForms.match( /plural=([^;]+);/ )?.[1];
        }
        else {
            this.#nplurals = null;

            this.#pluralExpression = null;
        }
    }

    // XXX
    #readPoFile ( content ) {
        const lines = content
            .trim()
            .split( "\n" )
            .map( line => line.trim() );

        var message = { "translations": [] };

        while ( lines.length ) {
            let line = lines.shift();

            // disabled message
            if ( line.startsWith( "#~ " ) ) {
                message.disabled = true;

                line = line.substring( 3 ).trim();
            }

            // empty line
            if ( line === "" ) {
                this.#addMessage( message );
                message = { "translations": [] };
            }

            // references
            else if ( line.startsWith( "#: " ) ) {
                message.references = line.substring( 3 ).trim();
            }

            // flags
            else if ( line.startsWith( "#, " ) ) {
                message.flags = line.substring( 3 ).trim();
            }

            // user comment
            else if ( line.startsWith( "# " ) ) {
                if ( message.userComments ) {
                    message.userComments += "\n" + line.substring( 2 ).trim();
                }
                else {
                    message.userComments = line.substring( 2 ).trim();
                }
            }

            // extracted comment
            else if ( line.startsWith( "#. " ) ) {
                if ( message.extractedComments ) {
                    message.extractedComments += "\n" + line.substring( 3 ).trim();
                }
                else {
                    message.extractedComments = line.substring( 3 ).trim();
                }
            }

            // msgid
            else if ( line.startsWith( "msgid " ) ) {
                lines.unshift( line.substring( 6 ).trim() );

                const string = this.#readPoString( lines );

                if ( string ) message.id = string;
            }

            // msgstr
            else if ( line.startsWith( "msgstr " ) ) {
                lines.unshift( line.substring( 7 ).trim() );

                const string = this.#readPoString( lines );

                if ( string ) message.translations[0] = string;
            }

            // msgid_plural
            else if ( line.startsWith( "msgid_plural " ) ) {
                lines.unshift( line.substring( 13 ).trim() );

                const string = this.#readPoString( lines );

                if ( string ) message.plural = string;
            }

            // msgstr[x]
            else if ( line.startsWith( "msgstr[" ) ) {
                const index = line.indexOf( "]" ),
                    idx = +line.substring( 7, index );

                if ( typeof idx !== "number" ) throw `Po invalid line: ${line}`;

                lines.unshift( line.substring( index + 2 ).trim() );

                const string = this.#readPoString( lines );

                if ( string ) message.translations[idx] = string;
            }
        }

        this.#addMessage( message );
    }

    #writePoFile () {
        var text = "";

        text += 'msgid: ""\n';

        text += this.#writePoString( "msgstr",
            Object.entries( this.#headers )
                .map( ( [key, value] ) => `${key}: ${value}` )
                .join( "\n" ) );

        for ( const [id, message] of Object.entries( this.#messages ) ) {
            text += "\n";

            const disabled = message.disabled ? "#~ " : "";

            // user comments
            if ( message.userComments ) {
                for ( const userComment of message.userComments.split( "\n" ) ) text += `${disabled}# ${userComment}\n`;
            }

            // references
            if ( message.references ) text += `${disabled}#: ${message.references}\n`;

            // flags
            if ( message.flags ) text += `${disabled}#, ${message.flags}\n`;

            // extracted comments
            if ( message.extractedComments ) {
                for ( const extractedComment of message.extractedComments.split( "\n" ) ) text += `${disabled}#. ${extractedComment}\n`;
            }

            text += this.#writePoString( "msgid", id, disabled );

            // plural
            if ( message.plural ) {
                text += this.#writePoString( "msgid_plural", message.plural, disabled );

                const nplurals = this.nplurals || message.translations?.length || 1;

                for ( let n = 0; n < nplurals; n++ ) {
                    text += this.#writePoString( `msgstr[${n}]`, message.translations?.[n], disabled );
                }
            }

            // single
            else {
                text += this.#writePoString( "msgstr", message.translations?.[0], disabled );
            }
        }

        return text;
    }

    // XXX
    #readPoString ( lines, disabled ) {
        var string = "";

        while ( lines.length ) {
            let line = lines.shift().trim();

            const originalLine = line;

            // disabled message
            if ( line.startsWith( "#~ " ) ) {
                line = line.substring( 3 ).trim();
            }

            if ( line.startsWith( '"' ) ) {

                // dequote
                line = line.slice( 1, -1 );

                string += line.replaceAll( "\\n", "\n" );
            }
            else {
                lines.unshift( originalLine );

                return string;
            }
        }

        return string;
    }

    #writePoString ( tag, string, disabled ) {

        // escape double quotes
        string = ( string ?? "" ).replaceAll( `"`, `\\"` );

        disabled = disabled ? "#~ " : "";

        if ( string.includes( "\n" ) ) {
            let text = `${disabled}${tag} ""\n`;

            for ( const line of string.split( "\n" ) ) {
                text += `${disabled}"${line}\\n"\n`;
            }

            return text;
        }
        else {
            return `${disabled}${tag} "${string}"\n`;
        }
    }

    #addMessage ( message ) {

        // headers
        if ( !message.id ) {
            if ( !message.translations[0] ) return;

            const headers = {};

            for ( const line of message.translations[0].split( "\n" ) ) {
                const idx = line.indexOf( ":" );

                if ( idx < 1 ) continue;

                const key = line.substring( 0, idx ).trim(),
                    value = line.substring( idx + 1 ).trim();

                headers[key] = value;
            }

            this.#setHeaders( headers );
        }

        // message
        else {
            const id = message.id;
            delete message.id;

            this.#messages[id] = message;
        }
    }
}
