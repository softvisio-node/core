import mixins from "#lib/mixins";
import Base from "./base.js";
import Read from "./mixins/read.js";

export default class extends mixins( Read, Base ) {
    async API_read ( ctx, args = {} ) {
        return this.app.notifications.get( ctx );

        // const data = [];

        // const num = Math.floor( Math.random() * 5 );

        // for ( let n = 0; n < num; n++ ) {
        //     data.push( {
        //         "date": new Date(),
        //         "title": `Notification title`,
        //         "body": `What is Lorem Ipsum Lorem Ipsum is simply dummy text of the printing and typesetting industry Lorem Ipsum has been the industry's standard dummy text ever since the 1500s when an unknown printer took a galley of type and scrambled it to make a type specimen book it has?`,
        //     } );
        // }

        // return result( 200 );
    }
}
