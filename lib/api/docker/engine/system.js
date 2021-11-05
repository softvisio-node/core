// Containers report these events: attach, commit, copy, create, destroy, detach, die, exec_create, exec_detach, exec_start, exec_die, export, health_status, kill, oom, pause, rename, resize, restart, start, stop, top, unpause, update, and prune

// Images report these events: delete, import, load, pull, push, save, tag, untag, and prune

// Volumes report these events: create, mount, unmount, destroy, and prune

// Networks report these events: create, connect, disconnect, destroy, update, remove, and prune

// The Docker daemon reports these events: reload

// Services report these events: create, update, and remove

// Nodes report these events: create, update, and remove

// Secrets report these events: create, update, and remove

// Configs report these events: create, update, and remove

// The Builder reports prune events

// Available filters:

// config=<string> config name or ID
// container=<string> container name or ID
// daemon=<string> daemon name or ID
// event=<string> event type
// image=<string> image name or ID
// label=<string> image or container label
// network=<string> network name or ID
// node=<string> node ID
// plugin= plugin name or ID
// scope= local or swarm
// secret=<string> secret name or ID
// service=<string> service name or ID
// type=<string> object to filter by, one of container, image, volume, network, daemon, plugin, node, service, secret or config
// volume=<string> volume name

export default Super =>
    class extends ( Super || Object ) {

        // XXX since, until, filter
        // JSON.stringify( { "scope": ["swarm"], "type": ["service"] }
        async monitorSystemEvents ( options ) {
            var params = {};

            if ( options ) {
                if ( options?.filters ) params.filters = JSON.stringify( options.filters );
            }

            const res = await this._stream( "events", params );

            if ( !res.ok ) return res;

            res.body.on( "data", data => this.emit( "event", JSON.parse( data ) ) );
        }

        async getDataUsage () {
            return this._request( "system/df" );
        }

        async getSystemInfo () {
            return this._request( "info" );
        }

        async getVersion () {
            return this._request( "veersion" );
        }
    };
