const mixins = require( "../../../mixins" );
const Proxy = require( "../../../proxy" );
const RotatingMixin = require( "../../mixins/rotating" );
const IPAddr = require( "../../../ip/addr" );
const IPSubnet = require( "../../../ip/subnet" );

module.exports = class ProxyLocalSubnet extends mixins( RotatingMixin, Proxy ) {
    #subnet;
    #proxy;

    $init ( url, options = {} ) {
        if ( typeof url === "string" ) url = new URL( url );

        if ( super.$init ) super.$init( url, options );

        this.subnet = url.searchParams.get( "subnet" );
    }

    get isHttp () {
        return true;
    }

    get isSocks () {
        return true;
    }

    get url () {
        const url = super.url;

        url.searchParams.set( "subnet", this.subnet.toString() );

        return url;
    }

    get subnet () {
        return this.#subnet;
    }

    set subnet ( value ) {
        this.#subnet = new IPSubnet( value );

        this.#proxy = Proxy.new( "local-static:", {
            "hostname": this.subnet.firstAddr.toString(),
        } );

        this._updated();
    }

    // CONNECT
    async connect ( url ) {
        if ( typeof url === "string" ) url = new URL( url );

        const proxy = await this._autoRotateProxy( { "protocol": url.protocol } );

        if ( !proxy ) return Promise.reject( "Unable to get proxy" );

        return proxy.connect( url );
    }

    // ROTATION
    async getProxy () {
        return this.#proxy;
    }

    async getRandomProxy () {
        return Proxy.new( "local-static:", {
            "hostname": this.subnet.getRandomAddr().toString(),
        } );
    }

    async rotateNextProxy () {
        var ip = new IPAddr( this.#proxy.ipAddr.ipNum.nextIPNumber() );

        if ( this.#subnet.contains( ip ) ) {
            this.#proxy = Proxy.new( "local-static:", {
                "hostname": ip.toString(),
            } );
        }
        else {
            this.#proxy = Proxy.new( "local-static:", {
                "hostname": this.subnet.firstAddr.toString(),
            } );
        }

        return this.#proxy;
    }

    async rotateRandomProxy () {
        this.#proxy = await this.getRandomProxy();

        return this.#proxy;
    }
};
