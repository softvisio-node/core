import Component from "#lib/app/component";
import sql from "#lib/sql";

export default class extends Component {

    // protected
    _configure () {
        return result( 200, { "enabled": !!this.config.uri } );
    }

    async _install () {
        return sql.new( this.config.uri );
    }
}
