import Locale from "#lib/locale";
import fs from "node:fs";
import PoFileMessage from "#lib/locale/po-file/message";

export default class PoFile {
    #headers = {};
    #messages;

    #language;
    #nplurals;
    #pluralExpression;
    #toString;
    #isTranslated;
    #sourcesBasePath;
    #sourcesInclude = [];
    #sourcesExclude = [];

    constructor ( content ) {
        if ( content ) {
            if ( typeof content === "string" ) {
                this.#readPoFile( content );
            }
            else {
                this.#setHeaders( content.headers );

                if ( content.messages ) {
                    this.#messages = {};

                    for ( const [id, message] of Object.entries( content.messages ) ) {
                        this.#messages[id] = new PoFileMessage( this, id, message );
                    }
                }
            }
        }
    }

    // static
    static fromFile ( path ) {
        const content = fs.readFileSync( path, "utf8" );

        return new this( content );
    }

    static loadDomains ( locales, poFilesLocation, { currency } = {} ) {
        const locale = new Locale();

        for ( const id of locales ) {
            const domain = new Locale( { id, currency } );

            const path = poFilesLocation + "/" + domain.language + ".po";

            if ( fs.existsSync( path ) ) {
                const poFile = PoFile.fromFile( path );

                domain.add( poFile.toLocale( id ) );
            }

            locale.domains.add( domain.id, domain );
        }

        return locale;
    }

    get messages () {
        return this.#messages;
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

    get isTranslated () {
        STOP: if ( this.#isTranslated == null ) {
            this.#isTranslated = false;

            if ( this.#messages ) {
                for ( const message of Object.values( this.#messages ) ) {

                    // skip disabled message
                    if ( message.isDisabled ) continue;

                    // message is not translated
                    if ( !message.isTranslated ) break STOP;
                }
            }

            this.#isTranslated = true;
        }

        return this.#isTranslated;
    }

    get sourcesBasePath () {
        return this.#sourcesBasePath;
    }

    get sourcesInclude () {
        return this.#sourcesInclude;
    }

    get sourcesExclude () {
        return this.#sourcesExclude;
    }

    addMessages ( messages ) {
        if ( messages instanceof PoFile ) messages = messages.messages;

        if ( messages ) {
            this.#messages ??= {};

            for ( const [id, message] of Object.entries( messages ) ) {
                if ( this.#messages[id] ) {
                    this.#messages[id].update( message );
                }
                else {
                    this.#messages[id] = new PoFileMessage( this, id, message );
                }
            }

            return this;
        }
    }

    // XXX
    mergeMessages ( poFile ) {
        const newMessages = poFile.toJSON().messages || {},
            messages = this.#messages || {};

        // procress old messages
        for ( const message of Object.values( messages ) ) {

            // mark old messages as disabled
            message.disabled = true;

            message.references = [];
        }

        for ( const [msgId, message] of Object.entries( newMessages ) ) {
            if ( messages[msgId] ) {
                messages[msgId].disabled = false;

                messages[msgId].references = message.references;
            }
        }

        if ( Object.keys( messages ).length ) {
            this.#messages = messages;
        }
        else {
            this.#messages = null;
        }

        this.#sort();
    }

    toString () {
        this.#toString ??= this.#writePoFile();

        return this.#toString;
    }

    toJSON () {
        return {
            "headers": this.#headers,
            "messages": this.#messages,
        };
    }

    toLocale ( id ) {
        const locale = {
            "id": id,
        };

        if ( this.#messages ) {
            for ( const message of Object.values( this.#messages ) ) {

                // skip disabled message
                if ( message.isDisabled ) continue;

                // message is not translated
                if ( !message.isTranslated ) continue;

                locale.messages ??= {};

                locale.messages[id] = message.translations;
            }
        }

        return new Locale( locale );
    }

    // private
    #setHeaders ( headers ) {
        if ( !headers ) return;

        this.#headers = headers;

        const index = {};

        // index headers
        for ( const header in headers ) {
            const indexedHeader = header.toLowerCase();

            index[indexedHeader] = header;

            if ( indexedHeader.startsWith( "x-poedit-searchpath-" ) ) {
                this.#sourcesInclude.push( headers[header] );
            }
            else if ( indexedHeader.startsWith( "x-poedit-searchpathexcluded-" ) ) {
                this.#sourcesExclude.push( headers[header] );
            }
        }

        if ( index["x-poedit-basepath"] ) this.#sourcesBasePath = headers[index["x-poedit-basepath"]];

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
            .split( "\n" )
            .map( line => line.trim() )
            .filter( line => line );

        var message = this.#addMessage();

        while ( lines.length ) {
            let line = lines.shift();

            let prefix, previous;

            // comment
            if ( line.startsWith( "#" ) ) {

                // disabled line
                if ( line.startsWith( "#~" ) ) {

                    // possible new message
                    if ( line.startsWith( "#~ msgid " ) ) {
                        message = this.#addMessage( message );
                    }

                    message.disabled = true;

                    if ( line.startsWith( "#~ " ) ) {
                        prefix = "#~ ";
                        line = line.substring( 3 ).trim();
                    }

                    // disabled previous line
                    else if ( line.startsWith( "#~| " ) ) {
                        prefix = "#~| ";
                        previous = true;
                        line = line.substring( 4 ).trim();
                    }
                }

                // previous line
                else if ( line.startsWith( "#| " ) ) {
                    prefix = "#| ";
                    previous = true;
                    line = line.substring( 3 ).trim();
                }

                // other comment
                else {

                    // try start new message
                    message = this.#addMessage( message );

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
                    if ( previous ) {
                        message.contextPrevious = string;
                    }
                    else {
                        message.context = string;
                    }
                }
            }

            // msgid
            else if ( line.startsWith( "msgid " ) ) {

                // try start new message
                if ( !previous != null ) message = this.#addMessage( message );

                const string = this.#readPoString( line.substring( 6 ).trim(), lines, prefix );

                if ( previous ) {
                    message.idPrevious = string;
                }
                else {
                    message.id = string;
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
                    if ( previous ) {
                        message.pluralIdPrevious = string;
                    }
                    else {
                        message.pluralId = string;
                    }
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

        // write headers
        text += this.#writePoString(
            "msgstr",
            Object.entries( this.#headers )
                .map( ( [key, value] ) => `${key}: ${value}\n` )
                .join( "" )
        );

        // write messages
        for ( const message of Object.values( this.#messages || {} ) ) {
            text += message + "\n";
        }

        return text.trim();
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

    // XXX
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
        if ( message ) {

            // message has no id
            if ( message.id == null ) {
                return message;
            }

            // headers
            else if ( message.id === "" ) {
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
                this.#messages ??= {};

                this.#messages[message.id] = new PoFileMessage( this, message.id, message );
            }
        }

        return {
            "id": null,
            "translations": [],
        };
    }

    #sort () {
        if ( !this.#messages ) return;

        this.#messages = Object.fromEntries( Object.entries( this.#messages ).sort( ( a, b ) => a.compare( b ) ) );
    }
}
