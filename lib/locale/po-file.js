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
            "locale": this.#language,
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

    #readPoFile ( content ) {
        const lines = content
            .trim()
            .split( "\n" )
            .map( line => line.trim() );

        var message = { "translations": [] };

        while ( lines.length ) {
            let line = lines.shift();

            // empty line
            if ( line === "" ) {
                this.#addMessage( message );
                message = { "translations": [] };

                continue;
            }

            let prefix, previous;

            // comment
            if ( line.startsWith( "#" ) ) {

                // disabled line
                if ( line.startsWith( "#~ " ) ) {
                    prefix = "#~ ";
                    message.disabled = true;
                    line = line.substring( 3 ).trim();
                }

                // disabled previous line
                else if ( line.startsWith( "#~| " ) ) {
                    prefix = "#~| ";
                    message.disabled = true;
                    previous = true;
                    line = line.substring( 4 ).trim();
                }

                // previous line
                else if ( line.startsWith( "#| " ) ) {
                    prefix = "#| ";
                    previous = true;
                    line = line.substring( 3 ).trim();
                }

                // other comment
                else {

                    // reference
                    if ( line.startsWith( "#: " ) ) {
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

                    // translator comment
                    else if ( line.startsWith( "# " ) ) {
                        if ( message.translatorComments ) {
                            message.translatorComments += "\n" + line.substring( 2 ).trim();
                        }
                        else {
                            message.translatorComments = line.substring( 2 ).trim();
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
                    else {
                        throw `Po parsing error: ${line}`;
                    }

                    continue;
                }
            }

            // msgctxt
            if ( line.startsWith( "msgctxt " ) ) {
                const string = this.#readPoString( line.substring( 8 ).trim(), lines, prefix );

                if ( string ) {
                    if ( previous ) message.contextPrevious = string;
                    else message.context = string;
                }
            }

            // msgid
            else if ( line.startsWith( "msgid " ) ) {
                const string = this.#readPoString( line.substring( 6 ).trim(), lines, prefix );

                if ( string ) {
                    if ( previous ) message.idPrevious = string;
                    else message.id = string;
                }
            }

            // msgstr
            else if ( line.startsWith( "msgstr " ) ) {
                const string = this.#readPoString( line.substring( 7 ).trim(), lines, prefix );

                if ( string ) message.translations[0] = string;
            }

            // msgid_plural
            else if ( line.startsWith( "msgid_plural " ) ) {
                const string = this.#readPoString( line.substring( 13 ).trim(), lines, prefix );

                if ( string ) {
                    if ( previous ) message.pluralIdPrevious = string;
                    else message.pluralId = string;
                }
            }

            // msgstr[x]
            else if ( line.startsWith( "msgstr[" ) ) {
                const index = line.indexOf( "]" ),
                    idx = +line.substring( 7, index );

                if ( typeof idx !== "number" ) throw `Po invalid line: ${line}`;

                const string = this.#readPoString( line.substring( index + 2 ).trim(), lines, prefix );

                if ( string ) message.translations[idx] = string;
            }
            else {
                throw `Po parsing error: ${line}`;
            }
        }

        // add last message
        this.#addMessage( message );
    }

    #writePoFile () {
        var text = "";

        text += 'msgid ""\n';

        text += this.#writePoString(
            "msgstr",
            Object.entries( this.#headers )
                .map( ( [key, value] ) => `${key}: ${value}\n` )
                .join( "" )
        );

        for ( const [id, message] of Object.entries( this.#messages ) ) {
            text += "\n";

            const currentPrefix = message.disabled ? "#~ " : "",
                previousPrefix = message.disabled ? "#~| " : "#| ";

            // translator comments
            if ( message.translatorComments ) {
                for ( const userComment of message.translatorComments.split( "\n" ) ) text += `# ${userComment}\n`;
            }

            // extracted comments
            if ( message.extractedComments ) {
                for ( const extractedComment of message.extractedComments.split( "\n" ) ) text += `#. ${extractedComment}\n`;
            }

            // references
            if ( message.references?.length ) {
                for ( const reference of message.references ) {
                    text += `#: ${reference}\n`;
                }
            }

            // flags
            if ( message.flags?.length ) text += `#, ${message.flags.join( ", " )}\n`;

            // previous msgctxt
            if ( message.contextPrevious ) text += this.#writePoString( "msgctxt", message.contextPrevious, previousPrefix );

            // previous msgid
            if ( message.idPrevious ) text += this.#writePoString( "msgid", message.idPrevious, previousPrefix );

            // previous msgid_plural
            if ( message.pluralIdPrevious ) text += this.#writePoString( "msgid_plural", message.pluralIdPrevious, previousPrefix );

            // msgctxt
            if ( message.context ) text += this.#writePoString( "msgctxt", message.context, currentPrefix );

            // msgid
            text += this.#writePoString( "msgid", id, currentPrefix );

            // plural
            if ( message.pluralId ) {
                text += this.#writePoString( "msgid_plural", message.pluralId, currentPrefix );

                const nplurals = this.nplurals || message.translations?.length || 1;

                for ( let n = 0; n < nplurals; n++ ) {
                    text += this.#writePoString( `msgstr[${n}]`, message.translations?.[n], currentPrefix );
                }
            }

            // single
            else {
                text += this.#writePoString( "msgstr", message.translations?.[0], currentPrefix );
            }
        }

        return text;
    }

    #readPoString ( firstLine, lines, prefix ) {

        // dequote first line
        var string = firstLine.slice( 1, -1 );

        while ( lines.length ) {
            let line = lines[0].trim();

            if ( prefix ) {
                if ( line.startsWith( prefix ) ) {
                    line = line.substring( prefix.length ).trim();
                }
                else {
                    break;
                }
            }

            if ( !line.startsWith( '"' ) ) break;

            lines.shift();

            // dequote
            string += line.slice( 1, -1 );
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

    #writePoString ( tag, string, prefix ) {
        prefix ??= "";

        // escape
        string = ( string ?? "" ).replaceAll( /["\t\\]/g, match => {
            if ( match === `"` ) return `\\"`;
            else if ( match === "\t" ) return "\\t";
            else if ( match === "\\" ) return "\\\\";
        } );

        if ( string.includes( "\n" ) ) {
            let text = `${prefix}${tag} ""\n`;

            const lines = string.split( "\n" ),
                lastLine = lines.pop();

            for ( const line of lines ) text += `${prefix}"${line}\\n"\n`;

            if ( lastLine !== "" ) text += `${prefix}"${lastLine}"\n`;

            return text;
        }
        else {
            return `${prefix}${tag} "${string}"\n`;
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
            this.#messages[message.id] = message;
        }
    }
}
