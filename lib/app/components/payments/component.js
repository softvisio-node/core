import Payments from "./payments.js";

export default Super =>
    class extends Super {

        // properties
        get aclConfig () {
            const acl = {
                "main": {
                    "roles": {
                        "administrator": {
                            "permissions": [

                                //
                                "payments/**",
                            ],
                        },
                        "payments-account-creator": {
                            "name": l10nt( "Payments account creator" ),
                            "description": l10nt( "Can create payments accounts" ),
                            "permissions": [

                                //
                                "payments/account:create",
                            ],
                        },
                    },
                },
                "payments": {
                    "roles": {
                        "owner": {
                            "name": l10nt( `Owner` ),
                            "description": l10nt( `Payments account owner` ),
                            "permissions": [

                                //
                                "acl:*",
                                "payments/account:*",
                                "payments/account/**",
                                "!payments/account:create",
                            ],
                        },
                    },
                },
            };

            return acl;
        }

        // protected
        async _install () {
            return new Payments( this.app, this.config );
        }

        async _init () {
            return this.instance.init();
        }
    };
