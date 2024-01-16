import Component from "#lib/app/component";
import Server from "#lib/http/server";

export default class extends Component {
    #nginxEnabled;
    #address;
    #port;

    // protected
    async _install () {
        return new Server();
    }

    async _configureInstance () {
        this.#nginxEnabled = this.app.nginx;

        if ( this.#nginxEnabled ) {
            this.#address = `${this.app.env.tmpDir}/private-http-server.socket`;
            this.#port = null;

            this.config.address = "0.0.0.0";
        }
        else {
            this.#address = this.config.address;
            this.#port = this.config.port;
        }

        return result( 200 );
    }

    async _afterAppStarted () {
        const res = await this.instance.start( {
            "address": this.#address,
            "port": this.#port,
            "exclusive": this.config.exclusive,
        } );

        if ( res.ok ) {
            console.log( `Private HTTP server listening at: ${this.config.address}:${this.config.port}` );
        }
        else {
            console.log( `Private HTTP server unable bind to the ${this.#address}:${this.#port}` );
        }

        return res;
    }

    async _shutDown () {
        return this.instance.stop();
    }
}
