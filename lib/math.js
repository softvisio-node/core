class Math1 {

    // public
    isBigInt ( value ) {
        return typeof value === "bigint";
    }

    abs ( value ) {
        if ( this.isBigInt( value ) ) {
            if ( value < 0n ) {
                return 0n - value;
            }
            else {
                return value;
            }
        }
        else {
            return Math.abs( value );
        }
    }

    trunc ( value, scale ) {
        if ( this.isBigInt( value ) ) {
            return value;
        }
        else if ( scale ) {
            scale = 10 ** scale;

            return Math.trunc( value * scale ) / scale;
        }
        else {
            return Math.trunk( value );
        }
    }

    round ( value, scale ) {
        if ( this.isBigInt( value, scale ) ) {
            return value;
        }
        else if ( scale ) {
            scale = 10 ** scale;

            return Math.round( value * scale ) / scale;
        }
        else {
            return Math.round( value );
        }
    }

    floor ( value, scale ) {
        if ( this.isBigInt( value ) ) {
            return value;
        }
        else if ( scale ) {
            scale = 10 ** scale;

            return Math.floor( value * scale ) / scale;
        }
        else {
            return Math.floor( value );
        }
    }

    ceil ( value, scale ) {
        if ( this.isBigInt( value ) ) {
            return value;
        }
        else if ( scale ) {
            scale = 10 ** scale;

            return Math.ceil( value * scale ) / scale;
        }
        else {
            return Math.ceil( value );
        }
    }
}

export default new Math1();
