export default class PoFileMessage {
    #poFile;
    #id;
    #disabled = false;
    #references;
    #flags;
    #domains;
    #translatorComments;
    #extractedComments;
    #context;
    #contextPrevious;
    #idPrevious;
    #pluralId;
    #pluralIdPrevious;
    #translations;

    constructor ( poFile, id, { disabled, references, flags, domains, translatorComments, extractedComments, context, contextPrevious, idPrevious, pluralId, pluralIdPrevious, translations } = {} ) {
        this.#poFile = poFile;
        this.#id = id;
        this.#disabled = disabled;
        this.#references = new Set( references );
        this.#flags = new Set( flags );
        this.domains = new Set( domains );
        this.#translatorComments = new Set( translatorComments );
        this.#extractedComments = new Set( extractedComments );
        this.#context = context;
        this.#contextPrevious = contextPrevious;
        this.#idPrevious = idPrevious;
        this.#pluralId = pluralId;
        this.#pluralIdPrevious = pluralIdPrevious;
        this.#translations = translations;
    }

    // static
    static createPoString ( tag, string, prefix ) {
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

    // properties
    get id () {
        return this.#id;
    }

    get isDisabled () {
        return this.#disabled;
    }

    set isDisabled ( value ) {
        this.#disabled = !!value;
    }

    get pluralId () {
        return this.#pluralId;
    }

    get references () {
        return this.#references;
    }

    get flags () {
        return this.#flags;
    }

    get domains () {
        return this.#domains;
    }

    get context () {
        return this.#context;
    }

    get extractedComments () {
        return this.#extractedComments;
    }

    get translations () {
        return this.#translations;
    }

    get isFuzzy () {
        return this.#flags.has( "fuzzy" );
    }

    get isTranslated () {
        if ( this.isFuzzy ) return false;

        // message not translated
        if ( !this.#translations?.[0] ) return false;

        // check plural forms translated
        if ( this.#pluralId ) {
            if ( this.#translations.length !== this.#poFile.nplurals ) return false;

            for ( let n = 0; n < this.#translations.length; n++ ) {
                if ( !this.#translations[n] ) return false;
            }
        }

        return true;
    }

    // public
    // XXX
    toString () {
        let text = "";

        const currentPrefix = this.#disabled ? "#~ " : "",
            previousPrefix = this.#disabled ? "#~| " : "#| ";

        // translator comments
        if ( ( this.#translatorComments, length ) ) {
            for ( const translatorComment of this.#translatorComments ) {
                text += `# ${translatorComment}\n`;
            }
        }

        // XXX
        // extracted comments
        if ( this.#extractedComments ) {
            if ( this.#extractedComments.domains ) {
                text += `#. !domains: ${this.#extractedComments.domains.join( "," )}\n`;
            }

            if ( this.#extractedComments.comments ) {
                for ( const extractedComment of this.#extractedComments.comments ) {
                    text += `#. ${extractedComment}\n`;
                }
            }
        }

        // references
        if ( this.#references.size ) {
            let line;

            for ( const reference of [...this.#references].sort() ) {
                if ( !line ) {
                    line = "#: " + reference;
                }
                else if ( line.length + 1 + reference.length < 80 ) {
                    line += " " + reference;
                }
                else {
                    text += line + "\n";

                    line = "#: " + reference;
                }
            }

            if ( line ) text += line + "\n";
        }

        // flags
        if ( this.#flags?.size ) text += `#, ${[...this.#flags].sort().join( ", " )}\n`;

        // previous msgctxt
        if ( this.#contextPrevious ) text += this.constructor.createPoString( "msgctxt", this.#contextPrevious, previousPrefix );

        // previous msgid
        if ( this.#idPrevious ) text += this.constructor.createPoString( "msgid", this.#idPrevious, previousPrefix );

        // previous msgid_plural
        if ( this.#pluralIdPrevious ) text += this.constructor.createPoString( "msgid_plural", this.#pluralIdPrevious, previousPrefix );

        // msgctxt
        if ( this.#context ) text += this.constructor.createPoString( "msgctxt", this.#context, currentPrefix );

        // msgid
        text += this.constructor.createPoString( "msgid", this.#id, currentPrefix );

        // plural
        if ( this.#pluralId ) {
            text += this.constructor.createPoString( "msgid_plural", this.#pluralId, currentPrefix );

            const nplurals = this.#poFile.nplurals || this.#translations?.length || 1;

            for ( let n = 0; n < nplurals; n++ ) {
                text += this.constructor.createPoString( `msgstr[${n}]`, this.#translations?.[n], currentPrefix );
            }
        }

        // single
        else {
            text += this.constructor.createPoString( "msgstr", this.#translations?.[0], currentPrefix );
        }

        return text;
    }

    toJSON () {
        return {
            "disabled": this.#disabled,
            "references": [...this.#references],
            "flags": [...this.#flags],
            "domains": [...this.#domains],
            "translatorComments": [...this.#translatorComments],
            "extractedComments": [...this.#extractedComments],
            "context": this.#context,
            "contextPrevious": this.#contextPrevious,
            "idPrevious": this.#idPrevious,
            "pluralId": this.#pluralId,
            "pluralIdPrevious": this.#pluralIdPrevious,
            "translations": this.#translations,
        };
    }

    // XXX
    update ( { pluralId, references, flags, extractedComments, context } = {} ) {

        // plural id
        this.#pluralId ||= pluralId;

        // references
        if ( references ) {
            this.#references = new Set( [...this.#references, ...references] );
        }

        // flags
        if ( flags ) {
            this.#flags = new Set( [...this.#flags, ...flags] );
        }

        // extracted comments
        if ( extractedComments ) {
            this.#extractedComments = this.constructor.mergeExtractedComments( this.#extractedComments, extractedComments );
        }

        // context
        if ( context ) this.#context = context;
    }

    // XXX
    merge ( { pluralId, references, flags, extractedComments, context } = {} ) {

        // plural id
        if ( pluralId ) {
            if ( this.#pluralId !== pluralId ) {
                this.#pluralId = pluralId;

                this.#flags.add( "fuzzy" );
            }
        }
        else if ( this.#pluralId ) {
            this.#pluralId = null;

            this.#flags.add( "fuzzy" );

            this.#translations.length = 1;
        }

        // references
        if ( references ) {
            this.#references = new Set( [...references] );
        }
        else {
            this.#references = new Set();
        }

        // flags
        if ( flags ) {
            this.#flags = new Set( [...this.#flags, ...flags] );
        }

        // extracted comments
        this.#extractedComments = extractedComments;

        // context
        this.#context = context;
    }

    disable () {
        this.#disabled = true;
        this.#references = new Set();
        this.#context = null;
        this.#contextPrevious = null;
        this.#extractedComments = null;
    }

    compare ( message ) {
        if ( this.isDisabled && !message.isDisabled ) return 1;

        if ( !this.isDisabled && message.isDisabled ) return -1;

        return this.id.localeCompare( message.id );
    }

    setFuzzy () {
        this.#flags.add( "fuzzy" );
    }

    setTranslations ( translations ) {
        this.#translations = translations;
    }
}
