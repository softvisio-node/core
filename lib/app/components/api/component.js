import Component from "#lib/app/component";
import Api from "#lib/app/components/api/api";

export default class extends Component {

    // public
    getAcl () {
        return this.config.acl;
    }

    // protected
    async _install () {
        return new Api( this.app, this.config );
    }

    async _configureInstance () {
        const schema = this.components.getSchema( "api" );
        if ( !schema.ok ) return schema;

        return this.value.configure( schema.data );
    }

    async _init () {
        return this.value.init();
    }

    async _start () {
        return this.value.start();
    }

    async _shutDown () {
        await this.value.shutDown();
    }
}
