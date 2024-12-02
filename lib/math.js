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

    trunc ( value ) {
        if ( this.isBigInt( value ) ) {
            return value;
        }
        else {
            return Math.trunk( value );
        }
    }

    round ( value ) {
        if ( this.isBigInt( value ) ) {
            return value;
        }
        else {
            return Math.round( value );
        }
    }

    floor ( value ) {
        if ( this.isBigInt( value ) ) {
            return value;
        }
        else {
            return Math.floor( value );
        }
    }

    ceil ( value ) {
        if ( this.isBigInt( value ) ) {
            return value;
        }
        else {
            return Math.ceil( value );
        }
    }
}

export default new Math1();
