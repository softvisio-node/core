export default class PoFileMessage {
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

    constructor ( { poFile, disabled, references, flags, translatorComments, extractedComments, context, contextPrevious, idPrevious, pluralId, pluralIdPrevious, translations } = {} ) {
        this.#poFile = poFile;
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
    get isDisabled () {
        return this.#disabled;
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
    toString () {}

    toJSON () {}

    merge ( message ) {}
}
