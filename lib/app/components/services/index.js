import Component from "#lib/app/component";
import ApiServices from "#lib/api/services";

export default class extends Component {

    // protected
    async _install () {
        return new ApiServices();
    }

    async _run () {
        this.value.addServices( this.config );

        return result( 200 );
    }
}
