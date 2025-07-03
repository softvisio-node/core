import NginxApi from "#lib/api/nginx";

export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return this.config.enabled;
        }

        async _install () {
            return new NginxApi( this.config.url, this.app.env.name, this.app.env.serviceName );
        }

        async _destroy () {
            this.instance.destroy();
        }
    };
