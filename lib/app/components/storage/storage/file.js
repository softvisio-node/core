import Interval from "#lib/interval";

export default class StorageFile {
    #id;
    #path;
    #imageId;
    #imagePath;
    #lastModified;
    #contentType;
    #cacheControl;
    #contentDisposition;
    #contentLength;
    #inactiveMaxAge;
    #expires;
    #etag;
    #headers;

    constructor ( data ) {
        this.#id = data.id;
        this.#path = data.path;
        this.#imageId = data.storage_image_id;
        this.#imagePath = data.image_path;
        this.#lastModified = new Date( data.last_modified );
        this.#contentType = data.content_type;
        this.#cacheControl = data.cache_control;
        this.#contentDisposition = data.content_disposition;
        this.#contentLength = data.size;
        this.#inactiveMaxAge = data.inactive_max_age ? Interval.new( data.inactive_max_age ) : null;
        this.#expires = data.expired;
        this.#etag = data.hash;

        this.#headers = {
            "etag": data.hash,
            "accept-ranges": "bytes",
            "last-modified": this.lastModified.toUTCString(),
        };

        if ( this.contentType ) this.#headers["content-type"] = this.contentType;
        if ( this.cacheControl ) this.#headers["cache-control"] = this.cacheControl;
        if ( this.contentDisposition ) this.#headers["content-disposition"] = this.contentDisposition;
    }

    // properties
    get id () {
        return this.#id;
    }

    get path () {
        return this.#path;
    }

    get imageId () {
        return this.#imageId;
    }

    get imagePath () {
        return this.#imagePath;
    }

    get lastModified () {
        return this.#lastModified;
    }

    get contentType () {
        return this.#contentType;
    }

    get cacheControl () {
        return this.#cacheControl;
    }

    get contentDisposition () {
        return this.#contentDisposition;
    }

    get contentLength () {
        return this.#contentLength;
    }

    get inactiveMaxAge () {
        return this.#inactiveMaxAge;
    }

    get expires () {
        return this.#expires;
    }

    get etag () {
        return this.#etag;
    }

    // public
    setExpires ( value ) {
        this.#expires = value;
    }

    getHeaders () {
        return { ...this.#headers };
    }
}
