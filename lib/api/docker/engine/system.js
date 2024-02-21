// available filters:
// config: config name or ID
// container: container name or ID
// daemon: daemon name or ID
// event: event type
// image: image name or ID
// label: image or container label
// network: network name or ID
// node: node ID
// plugin: plugin name or ID
// scope: local or swarm
// secret: secret name or ID
// service: service name or ID
// type: container, image, volume, network, daemon, plugin, node, service, secret, config
// volume: volume name

// availble events:
// containers: attach, commit, copy, create, destroy, detach, die, exec_create, exec_detach, exec_start, exec_die, export, health_status, kill, oom, pause, rename, resize, restart, start, stop, top, unpause, update, prune
// images: delete, import, load, pull, push, save, tag, untag, prune
// volumes: create, mount, unmount, destroy, prune
// networks: create, connect, disconnect, destroy, update, remove, prune
// daemon: reload
// services: create, update, remove
// nodes: create, update, remove
// secrets: create, update, remove
// configs: create, update, remove
// builder: prune

export default Super =>
    class extends ( Super || class {} ) {

        // filters example: { "scope": ["swarm"], "type": ["service"] }
        async monitorSystemEvents ( { signal, options } = {} ) {
            return this._request( "get", "events", {
                "stream": true,
                signal,
                "params": options,
            } );
        }

        async getDataUsage () {
            return this._request( "get", "system/df" );
        }

        async getSystemInfo () {
            return this._request( "get", "info" );
        }

        async getVersion () {
            return this._request( "get", "version" );
        }
    };
