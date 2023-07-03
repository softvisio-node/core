import Component from "#lib/app/component";
import sql from "#lib/sql";

export default class extends Component {

    // protected
    async _checkEnabled () {
        return !!this.config.uri;
    }

    async _install () {
        return sql.new( this.config.uri );
    }

    async _start () {
        return this.value.start();
    }

    async _shutDown () {
        return this.value.shutDown();
    }
}
