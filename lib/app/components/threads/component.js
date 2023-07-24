import Component from "#lib/app/component";
import Threads from "#lib/threads";

export default class extends Component {

    // protected
    async _install () {
        return new Threads();
    }

    async _start () {
        return this.app._startThreads();
    }

    async _shutDown () {
        return this.instance.shutDown();
    }
}
