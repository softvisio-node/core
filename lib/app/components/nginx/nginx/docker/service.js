import Events from "#lib/events";
import DnsWatcher from "#lib/dns/watcher";

export class DockerService extends Events {
    #id;
    #name;
    #hostname;
    #dnsWatcher;

    constructor ( config ) {
        super();

        this.#id = config.ID;
        this.#name = config.Spec.Name;
        this.#hostname = "tasks." + config.Spec.Name;

        if ( this.#hostname ) {
            this.#dnsWatcher = new DnsWatcher( this.#hostname, {

                // family: this.#nginx.config.listenIpFamily,
                "minInterval": 1_000,
                "maxInterval": 60_000,
                "step": 5_000,
            } )
                .on( "add", this.#onUpstreamsAdd.bind( this ) )
                .on( "delete", this.#onUpstreamsDelete.bind( this ) );
        }
    }

    // properties
    get id () {
        return this.#id;
    }

    get name () {
        return this.#name;
    }

    get hostname () {
        return this.#hostname;
    }

    // public
    start () {}

    stop () {
        this.#dnsWatcher?.stop();
    }

    restort () {
        this.#dnsWatcher?.restart();
    }

    update () {
        this.#dnsWatcher?.lookup( { "force": true } );
    }

    reset () {
        this.#dnsWatcher.reset();
    }

    // private
    #onUpstreamsAdd ( addresses ) {
        this.emit( "upstreamAdd", addresses );
    }

    #onUpstreamsDelete ( addresses ) {
        this.emit( "upstreamDelete", addresses );
    }
}
