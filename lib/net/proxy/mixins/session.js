export default Super =>
    class extends ( Super || class {} ) {
        _buildOptions ( options ) {
            const _options = super._buildOptions( options );

            if ( options.session ) {
                if ( options.session === true || options.session === "true" ) _options.session = this.constructor.generateSession();
                else _options.session = options.session;
            }

            return _options;
        }
    };
