export default class PoFileMessage {
    #id;
    #poFile;
    #disabled = false;
    #references;
    #flags;
    #translatorComments;
    #extractedComments;
    #context;
    #contextPrevious;
    #idPrevious;
    #pluralId;
    #pluralIdPrevious;
    #translations;

    constructor ( poFile, { id, disabled, references, flags, translatorComments, extractedComments, context, contextPrevious, idPrevious, pluralId, pluralIdPrevious, translations } = {} ) {
        this.#poFile = poFile;
        this.#id = id;
        this.#disabled = disabled;
        this.#references = new Set( references );
        this.#flags = new Set( flags );
        this.#translatorComments = translatorComments;
        this.#extractedComments = extractedComments;
        this.#context = context;
        this.#contextPrevious = contextPrevious;
        this.#idPrevious = idPrevious;
        this.#pluralId = pluralId;
        this.#pluralIdPrevious = pluralIdPrevious;
        this.#translations = translations;
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

    isFuzzy () {
        return this.#flags.has( "fuzzy" );
    }

    get isTranslated () {
        if ( this.isDisabled ) return false;

        if ( this.isFuzzy ) return false;

        // message not translated
        if ( !this.#translations[0] ) return false;

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
    toString () {
        let text = "";

        const currentPrefix = this.#disabled ? "#~ " : "",
            previousPrefix = this.#disabled ? "#~| " : "#| ";

        // translator comments
        if ( this.#translatorComments ) {
            for ( const translatorComment of this.#translatorComments.split( "\n" ) ) {
                text += `# ${translatorComment}\n`;
            }
        }

        // extracted comments
        if ( this.#extractedComments ) {
            for ( const extractedComment of this.#extractedComments.split( "\n" ) ) {
                text += `#. ${extractedComment}\n`;
            }
        }

        // references
        if ( this.#references?.size ) {
            for ( const reference of [...this.#references].sort() ) {
                text += `#: ${reference}\n`;
            }
        }

        // flags
        if ( this.#flags?.size ) text += `#, ${[...this.#flags].sort().join( ", " )}\n`;

        // previous msgctxt
        if ( this.#contextPrevious ) text += this.#writePoString( "msgctxt", this.#contextPrevious, previousPrefix );

        // previous msgid
        if ( this.#idPrevious ) text += this.#writePoString( "msgid", this.#idPrevious, previousPrefix );

        // previous msgid_plural
        if ( this.#pluralIdPrevious ) text += this.#writePoString( "msgid_plural", this.#pluralIdPrevious, previousPrefix );

        // msgctxt
        if ( this.#context ) text += this.#writePoString( "msgctxt", this.#context, currentPrefix );

        // msgid
        text += this.#writePoString( "msgid", this.#id, currentPrefix );

        // plural
        if ( this.#pluralId ) {
            text += this.#writePoString( "msgid_plural", this.#pluralId, currentPrefix );

            const nplurals = this.#poFile.nplurals || this.#translations?.length || 1;

            for ( let n = 0; n < nplurals; n++ ) {
                text += this.#writePoString( `msgstr[${n}]`, this.#translations?.[n], currentPrefix );
            }
        }

        // single
        else {
            text += this.#writePoString( "msgstr", this.#translations?.[0], currentPrefix );
        }

        return text;
    }

    toJSON () {
        return {
            "disabled": this.#disabled,
            "references": [...this.#references],
            "flags": [...this.#flags],
            "translatorComments": this.#translatorComments,
            "extractedComments": this.#extractedComments,
            "context": this.#context,
            "contextPrevious": this.#contextPrevious,
            "idPrevious": this.#idPrevious,
            "pluralId": this.#pluralId,
            "pluralIdPrevious": this.#pluralIdPrevious,
            "translations": this.#translations,
        };
    }

    // XXX
    merge ( message ) {}

    // private
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
}
