import Locale from "#lib/locale";

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
                .map( ( [id, message] ) => [id, message.msgStr] ) ),
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

    #readPoFile ( content ) {
        const lines = content
            .trim()
            .split( "\n" )
            .map( line => line.trim() );

        var message = { "msgStr": [] };

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
                message = { "msgStr": [] };
            }

            // references
            else if ( line.startsWith( "#: " ) ) {
                message.references ||= [];

                message.references.push( line.substring( 3 ).trim() );
            }

            // flags
            else if ( line.startsWith( "#, " ) ) {
                message.flags = line
                    .substring( 3 )
                    .split( "," )
                    .map( flag => flag.trim() )
                    .filter( flag => flag );
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
                const string = this.#readPoString( line.substring( 6 ).trim(), lines, message.disabled );

                if ( string ) message.id = string;
            }

            // msgstr
            else if ( line.startsWith( "msgstr " ) ) {
                const string = this.#readPoString( line.substring( 7 ).trim(), lines, message.disabled );

                if ( string ) message.msgStr[0] = string;
            }

            // msgid_plural
            else if ( line.startsWith( "msgid_plural " ) ) {
                const string = this.#readPoString( line.substring( 13 ).trim(), lines, message.disabled );

                if ( string ) message.msgIdPlural = string;
            }

            // msgstr[x]
            else if ( line.startsWith( "msgstr[" ) ) {
                const index = line.indexOf( "]" ),
                    idx = +line.substring( 7, index );

                if ( typeof idx !== "number" ) throw `Po invalid line: ${line}`;

                const string = this.#readPoString( line.substring( index + 2 ).trim(), lines, message.disabled );

                if ( string ) message.msgStr[idx] = string;
            }
        }

        this.#addMessage( message );
    }

    #writePoFile () {
        var text = "";

        text += 'msgid ""\n';

        text += this.#writePoString( "msgstr",
            Object.entries( this.#headers )
                .map( ( [key, value] ) => `${key}: ${value}\n` )
                .join( "" ) );

        for ( const [id, message] of Object.entries( this.#messages ) ) {
            text += "\n";

            const disabled = message.disabled ? "#~ " : "";

            // user comments
            if ( message.userComments ) {
                for ( const userComment of message.userComments.split( "\n" ) ) text += `${disabled}# ${userComment}\n`;
            }

            // extracted comments
            if ( message.extractedComments ) {
                for ( const extractedComment of message.extractedComments.split( "\n" ) ) text += `${disabled}#. ${extractedComment}\n`;
            }

            // references
            if ( message.references?.length ) {
                for ( const reference of message.references ) {
                    text += `${disabled}#: ${reference}\n`;
                }
            }

            // flags
            if ( message.flags?.length ) text += `${disabled}#, ${message.flags.join( ", " )}\n`;

            text += this.#writePoString( "msgid", id, disabled );

            // plural
            if ( message.msgIdPlural ) {
                text += this.#writePoString( "msgid_plural", message.msgIdPlural, disabled );

                const nplurals = this.nplurals || message.msgStr?.length || 1;

                for ( let n = 0; n < nplurals; n++ ) {
                    text += this.#writePoString( `msgstr[${n}]`, message.msgStr?.[n], disabled );
                }
            }

            // single
            else {
                text += this.#writePoString( "msgstr", message.msgStr?.[0], disabled );
            }
        }

        return text;
    }

    #readPoString ( firstLine, lines, disabled ) {

        // dequote
        var string = firstLine.slice( 1, -1 );

        while ( lines.length ) {
            let line = lines.shift().trim();

            const originalLine = line;

            // disabled line
            if ( line.startsWith( "#~ " ) ) {
                if ( disabled ) {
                    line = line.substring( 3 ).trim();
                }
                else {
                    lines.unshift( originalLine );
                    break;
                }
            }
            else if ( disabled ) {
                lines.unshift( originalLine );
                break;
            }

            if ( line.startsWith( '"' ) ) {

                // dequote
                string += line.slice( 1, -1 );
            }

            // eol
            else {
                lines.unshift( originalLine );
                break;
            }
        }

        // unescape
        return string.replaceAll( /\\["nt\\]/g, match => {
            if ( match === `\\"` ) return `"`;
            else if ( match === "\\n" ) return "\n";
            else if ( match === "\\t" ) return "\t";
            else if ( match === "\\\\" ) return "\\";
            else return match;
        } );
    }

    #writePoString ( tag, string, disabled ) {

        // escape
        string = ( string ?? "" ).replaceAll( /["\t\\]/g, match => {
            if ( match === `"` ) return `\\"`;
            else if ( match === "\t" ) return "\\t";
            else if ( match === "\\" ) return "\\\\";
        } );

        disabled = disabled ? "#~ " : "";

        if ( string.includes( "\n" ) ) {
            let text = `${disabled}${tag} ""\n`;

            text += `${disabled}"${string.replaceAll( "\n", `\\n"\n${disabled}"` )}"\n`;

            // remove last empty line
            if ( text.endsWith( `""\n` ) ) text = text.slice( 0, -3 );

            return text;
        }
        else {
            return `${disabled}${tag} "${string}"\n`;
        }
    }

    #addMessage ( message ) {

        // headers
        if ( !message.id ) {
            if ( !message.msgStr[0] ) return;

            const headers = {};

            for ( const line of message.msgStr[0].split( "\n" ) ) {
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
