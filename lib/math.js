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
}

export default new Math1();
