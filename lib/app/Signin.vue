<template>
    <ext-panel layout='{"type":"card","animation":"slide"}' fullscreen="true" @ready="ready">
        <ext-panel layout="center">
            <ext-formpanel ref="signinForm" title="Sign In" width="300" height="350" shadow="true" scrollable="true">
                <ext-textfield name="username" label="User Name or Email" required="true" allowBlank="false"/>
                <ext-passwordfield name="password" label="Password" required="true"/>

                <ext-toolbar docked="bottom" layout='{"type":"hbox","align":"center"}'>
                    <ext-spacer/>
                    <Link text="Forot password?" @tap="showForgotPassword"/>
                    <ext-spacer/>
                    <ext-button ref="signinButton" text="Sign in" @tap="signin"/>
                </ext-toolbar>
            </ext-formpanel>
        </ext-panel>

        <ext-panel layout="center">
            <ext-formpanel ref="recoverForm" title="Recover Password" width="300" height="350" shadow="true" scrollable="true">
                <ext-textfield name="username1" label="User Name or Email" required="true" allowBlank="false"/>

                <ext-toolbar docked="bottom" layout='{"type":"hbox","align":"center"}'>
                    <ext-spacer/>
                    <Link text="Sign In" @tap="showSignin"/>
                    <ext-spacer/>
                    <ext-button ref="recoverButton" text="Recover Password" @tap="recover"/>
                </ext-toolbar>
            </ext-formpanel>
        </ext-panel>
    </ext-panel>
</template>

<script>
import Link from "#core/Link";

export default {
    "name": "Signin",

    "components": {
        "Link": Link,
    },

    "methods": {
        ready ( e ) {
            this.cmp = e.detail.cmp;
        },

        showSignin () {
            this.cmp.setActiveItem( 0 );
        },

        showForgotPassword () {
            this.cmp.setActiveItem( 1 );
        },

        async signin () {
            var form = this.$refs.signinForm.ext,
                submitButton = this.$refs.signinButton.ext;

            if ( form.validate() ) {
                submitButton.setDisabled( true );

                var res = await this.$store.dispatch( "session/signin", {
                    "username": form.getFields( "username" ).getValue(),
                    "password": form.getFields( "password" ).getValue(),
                } );

                if ( !res.isSuccess() ) {
                    Ext.toast( res.toString() );

                    submitButton.setDisabled( false );
                }
            }
        },

        async recover () {
            var form = this.$refs.recoverForm.ext,
                submitButton = this.$refs.recoverButton.ext;

            if ( form.validate() ) {
                submitButton.setDisabled( true );

                var res = await this.$store.dispatch( "session/recoverPassword", form.getFields( "username1" ).getValue() );

                if ( !res.isSuccess() ) {
                    Ext.toast( res.toString() );

                    submitButton.setDisabled( false );
                }
                else {
                    Ext.toast( "Password change instructions was sent to the email address, associated with your account.", 5000 );
                }
            }
        },
    },
};
</script>
