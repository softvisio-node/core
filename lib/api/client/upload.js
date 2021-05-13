import Events from "#lib/events";
import Signal from "#lib/threads/signal";
import result from "#lib/result";

const STATUS_NEW = 0;
const STATUS_STARTED = 1;
const STATUS_ABORTED = 10;
const STATUS_DONE = 11;
const STATUS_ERROR = 12;

const STATUS = {
    [STATUS_NEW]: "Waiting",
    [STATUS_STARTED]: "Uploading",
    [STATUS_ABORTED]: "Aborted",
    [STATUS_DONE]: "Finished",
    [STATUS_ERROR]: "Error",
};

export default class Upload extends Events {
    #api;
    #method;
    #filename;
    #type;

    #status = STATUS_NEW;

    #signal = new Signal();
    #result;

    #loaded = 0;
    #progress = 0;
    #progressText;

    constructor ( api, method, file, onProgress ) {
        super();

        this.#api = api;
        this.#method = method;
        this.#filename = file.name;
        this.#type = file.type;

        if ( onProgress ) this.on( "progress", onProgress );
    }

    get filename () {
        return this.#filename;
    }

    get type () {
        return this.#type;
    }

    get statusText () {
        return STATUS[this.#status];
    }

    get result () {
        return this.#result;
    }

    get isNew () {
        return this.#status === STATUS_NEW;
    }

    get isStarted () {
        return this.#status === STATUS_STARTED;
    }

    get isAborted () {
        return this.#status === STATUS_ABORTED;
    }

    get isDone () {
        return this.#status === STATUS_DONE;
    }

    get isError () {
        return this.#status === STATUS_ERROR;
    }

    get isFinished () {
        return this.#status > STATUS_STARTED;
    }

    get loaded () {
        return this.#loaded;
    }

    get progress () {
        if ( this.#progress == null ) this.#progress = this.#loaded / this.size;

        return this.#progress;
    }

    get progressText () {
        var text = `${this.statusText} - ${Math.floor( this.progress * 100 )}%`;

        return text;
    }

    // public
    async start () {
        if ( this.isFinished ) return this.#result;

        // already started
        if ( !this.isStarted ) {
            this.#setStatus( STATUS_STARTED );

            this._start( this.#api, this.#method );
        }

        return this.#signal.wait();
    }

    abort () {
        if ( this.isFinished ) return;

        if ( !this.isStarted || this._abort() ) {
            this.#result = result( [400, `Aborted`] );

            this.#setStatus( STATUS_ABORTED );

            return true;
        }
        else {
            return false;
        }
    }

    // protected
    _setResult ( res ) {
        if ( this.isFinished ) return;

        this.#result = res;

        this.#setStatus( res.ok ? STATUS_DONE : STATUS_ERROR );
    }

    _setProgress ( loaded ) {
        if ( loaded == null || loaded === this.#loaded ) return;

        this.#loaded = loaded;
        this.#progress = null;

        this.#updated();
    }

    // private
    #setStatus ( status ) {
        if ( this.#status === status ) return;

        this.#status = status;

        this.#updated();

        if ( this.isFinished ) {

            // clear events listeners
            this.removeAllListeners();

            this.#signal.broadcast( this.#result );
        }
    }

    #updated () {
        this.#progressText = null;

        this.emit( "progress", this );
    }
}
