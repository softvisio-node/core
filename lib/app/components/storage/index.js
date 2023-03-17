import Component from "#lib/app/component";

export default class extends Component {

    // protected
    async _install () {
        console.log( this.config );
        process.exit();

        // return new Rpc( this.app, this.config );
    }

    // async _init () {
    //     return this.value.init();
    // }

    // async _run () {
    //     return this.value.run();
    // }
}
