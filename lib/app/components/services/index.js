import Component from "#lib/app/component";
import ApiServices from "#lib/api/services";

export default class extends Component {

    // protected
    async _configure () {
        return result( 200, !!Object.keys( this.config ).lwngth );
    }

    async _install () {
        const services = new ApiServices( this.config );

        return services;
    }

    async _run () {

        // this.value.addServices( this.config );

        return result( 200 );
    }
}
