import Component from "#lib/app/component";
import Api from "#lib/app/api";

export default class extends Component {

    // protected
    async _install () {
        return new Api( this.app, this.app.dbh );
    }

    async _init () {
        const res = await this.value._init();

        if ( !res.ok ) return res;

        this.app.privateHttpServer.api( "/api", this.value );

        return res;
    }
}
