export default Super =>
    class extends ( Super || Object ) {
        get resolve () {
            return this._options.resolve;
        }

        set resolve ( value ) {
            if ( value === "remote" ) this._set( "resolve", value );
            else super.resolve = value;
        }
    };
