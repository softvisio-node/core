// available filters:
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

// availble events:
// containers: attach, commit, copy, create, destroy, detach, die, exec_create, exec_detach, exec_start, exec_die, export, health_status, kill, oom, pause, rename, resize, restart, start, stop, top, unpause, update, and prune
// images: delete, import, load, pull, push, save, tag, untag, and prune
// volumes: create, mount, unmount, destroy, and prune
// networks: create, connect, disconnect, destroy, update, remove, and prune
// daemon: reload
// services: create, update, and remove
// nodes: create, update, and remove
// secrets: create, update, and remove
// configs: create, update, and remove
// builder: prune

export default Super =>
    class extends ( Super || Object ) {

        // filters example: { "scope": ["swarm"], "type": ["service"] }
        async monitorSystemEvents ( params ) {
            return this._stream( "events", params );
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
