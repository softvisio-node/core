export default class PoFileMessage {
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

    constructor ( { disabled, references, flags, translatorComments, extractedComments, context, contextPrevious, idPrevious, pluralId, pluralIdPrevious, translations } = {} ) {
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
    get disabled () {
        return this.#disabled;
    }

    get references () {
        return this.#references;
    }

    get flags () {
        return this.#flags;
    }
}
