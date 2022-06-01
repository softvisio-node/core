import locales from "#lib/l10n/locales";
import Locale from "#lib/l10n/locale";

export default class PoFile {
    #language;
    #nplurals;
    #pluralExpression;
    #messages;
    #locale;

    constructor ( content ) {
        this.#load( content );
    }

    // properties
    get language () {
        return this.#language;
    }

    get pluralExpression () {
        if ( this.#pluralExpression === undefined ) {
            this.#pluralExpression = locales[this.#language]?.expression || null;
        }

        return this.#pluralExpression;
    }

    // XXX
    get locale () {
        this.#locale ??= new Locale( {
            "language": this.#language,
            "messages": this.#messages,
            "pluralExpression": this.pluralExpression,
        } );

        return this.#locale;
    }

    // public
    toString () {
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

    toJSON () {
        const json = {};

        if ( this.#language ) json.language = this.#language;
        if ( this.nplurals ) json.nplurals = this.nplurals;
        if ( this.pluralExpression ) json.pluralExpression = this.pluralExpression;
        if ( this.#messages ) json.messages = this.#messages;

        return json;
    }

    // private
    // XXX
    #load ( content ) {
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

        if ( headers.language ) this.#language = headers.language;

        if ( !locales[this.#language] && headers["plural-forms"] ) {
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
