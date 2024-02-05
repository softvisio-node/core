export default class {
    #fileId;

    constructor ( fileId ) {
        this.#fileId = fileId;
    }

    // properties
    get mediaType () {
        return this.type;
    }

    get fileId () {
        return this.#fileId;
    }

    // public
    toJSON () {
        const json = this._getJson();

        json.type = this.type;
        json.fileId = this.#fileId;

        return json;
    }

    toMessage () {
        const data = this._toMessage();

        data[ this.mediaType ] = this.#fileId;

        return data;
    }

    toMediGroupItem () {
        const data = this._toMessage();

        data.type = this.mediaType;
        data.media = this.#fileId;

        return data;
    }
}
