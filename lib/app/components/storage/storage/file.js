export default class StorageFile {
    #id;
    #path;
    #imageId;
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
        this.#lastModified = new Date( data.last_modified );
        this.#contentType = data.content_type;
        this.#cacheControl = data.cache_control;
        this.#contentDisposition = data.content_disposition;
        this.#contentLength = data.content_length;
        this.#inactiveMaxAge = data.inactive_max_age;
        this.#expires = data.expired;
        this.#etag = data.hash;

        this.#headers = {
            "etag": data.hash,
            "accept-ranges": "bytes",
            "last-modified": this.#lastModified.toUTCString(),
        };

        if ( data.contentType ) this.#headers["content-type"] = data.contentType;
        if ( data.cacheControl ) this.#headers["cache-control"] = data.cacheControl;
        if ( data.contentDisposition ) this.#headers["content-disposition"] = data.contentDisposition;
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

    get headers () {
        return this.#headers;
    }

    // public
    setExpires ( value ) {
        this.#expires = value;
    }
}
