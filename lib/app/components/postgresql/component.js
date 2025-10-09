export default Super =>
    class extends Super {

        // protected
        async _checkEnabled () {
            return this.isRequired && process.platform === "linux";
        }

        async _install () {
            const postgreSql = await import( "./postgresql.js" );

            return new postgreSql.default( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }

        async _afterAppStarted () {
            return this.instance.start();
        }

        async _destroy () {
            return this.instance.destroy();
        }
    };
