import uuid from "#lib/uuid";

export default class {
    #id;
    #fileId;

    constructor ( id, fileId ) {
        this.#id = id || uuid();
        this.#fileId = fileId;
    }

    // properties
    get id () {
        return this.#id;
    }

    get mediaType () {
        return this.type;
    }

    get fileId () {
        return this.#fileId;
    }

    get supportCaption () {
        return true;
    }

    // public
    toJSON () {
        const json = this._getJson();

        json.type = this.type;
        json.id = this.#id;
        json.fileId = this.#fileId;

        return json;
    }

    toMessage ( options ) {
        var data = this._toMessage();

        data[ this.mediaType ] = this.#fileId;

        if ( options ) {
            data = {
                ...data,
                ...options,
            };
        }

        return data;
    }

    toMediGroupItem () {
        const data = this._toMessage();

        data.type = this.mediaType;
        data.media = this.#fileId;

        return data;
    }

    async send ( ctx, options ) {
        return ctx.send( this.sendMethod, this.toMessage( options ) );
    }
}
