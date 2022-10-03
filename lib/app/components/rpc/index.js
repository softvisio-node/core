import Component from "#lib/app/component";
import Rpc from "#lib/app/rpc";
import url from "node:url";

export default class extends Component {

    // protected
    async _install () {
        return new Rpc( this.app, {
            "apiSchema": url.pathToFileURL( this.location + "/rpc" ),
        } );
    }

    async _init () {
        const res = await this.value._init( {
            "apiSchema": url.pathToFileURL( this.location + "/rpc" ),
        } );

        if ( !res.ok ) return res;

        this.app.privateHttpServer.api( "/api", this.value );

        return res;
    }
}
