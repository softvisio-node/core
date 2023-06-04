import Component from "#lib/app/component";
import Api from "#lib/app/components/api/api";

export default class extends Component {

    // public
    addAcl ( acl ) {
        if ( this.isConfigured ) return result( [400, `API component is already configured`] );

        for ( const [name, value] of Object.entries( acl ) ) {
            if ( this.config.acl[name] ) {
                return result( [400, `API acl "${name}" is already exists`] );
            }

            this.config.acl[name] = value;
        }

        return result( 200 );
    }

    // protected
    async _install () {
        return new Api( this.app, this.config );
    }

    async _configureInstance () {
        return this.value.configure();
    }

    async _init () {
        const schema = this.components.getSchema( "api" );
        if ( !schema.ok ) return schema;

        return this.value.init( schema.data );
    }

    async _run () {
        return this.value.run();
    }

    async _shutDown () {
        await this.value.shutDown();
    }
}
