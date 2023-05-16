import Component from "#lib/app/component";
import ApiServices from "#lib/api/services";

export default class extends Component {

    // protected
    async _install () {
        const services = new ApiServices( this.config );

        return services;
    }

    async _run () {

        // this.value.addServices( this.config );

        return result( 200 );
    }
}
