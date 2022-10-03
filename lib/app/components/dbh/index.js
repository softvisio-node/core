import Component from "#lib/app/component";
import sql from "#lib/sql";

export default class extends Component {

    // protected
    async _install () {
        return sql.new( this.config.uri );
    }
}
