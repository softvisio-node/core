import mixins from "#lib/mixins";
import Events from "#lib/events";
import fetch from "#lib/fetch";
import Agent from "#lib/http/agent";

import ContainersMixin from "#lib/api/docker/engine/containers";
import ImagesMixin from "#lib/api/docker/engine/images";
import SystemMixin from "#lib/api/docker/engine/system";

// NOTE https://docs.docker.com/engine/api/latest/

const API_VERSION = "1.41";
const DEFAULT_SOCKET_PATH = "/var/run/docker.sock";

export default class DockerEngine extends mixins( ContainersMixin, ImagesMixin, SystemMixin, Events ) {
    #_agent;

    constructor () {
        super();
    }

    // properties
    get #agent () {
        this.#_agent ??= new Agent( { "socketPath": DEFAULT_SOCKET_PATH } );

        return this.#_agent;
    }

    // protected
    async _request ( path ) {
        const res = await fetch( "http://v" + API_VERSION + "/" + path, { "agent": this.#agent } );

        if ( !res.ok ) return result( res );

        const data = await res.json();

        return result( 200, data );
    }

    async _stream ( path ) {
        const res = await fetch( "http://v" + API_VERSION + "/" + path, { "agent": this.#agent } );

        return res;
    }
}
