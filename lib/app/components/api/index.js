import Component from "#lib/app/component";
import Api from "#lib/app/api";
import url from "node:url";

export default class extends Component {

    // protected
    async _install () {
        return new Api( this.app, this.app.dbh, {
            "dbSchema": url.pathToFileUrl( this.location + "/db" ),
            "apiSchema": url.pathToFileUrl( this.location + "/api" ),
        } );
    }

    async _init () {
        const res = await this.value._init( {
            "dbSchema": url.pathToFileUrl( this.location + "/db" ),
            "apiSchema": url.pathToFileUrl( this.location + "/api" ),
        } );

        if ( !res.ok ) return res;

        this.app.privateHttpServer.api( "/api", this.value );

        return res;
    }
}
