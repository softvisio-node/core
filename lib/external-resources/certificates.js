import fs from "node:fs";
import Acme from "#lib/api/acme";
import Cloudflare from "#lib/api/cloudflare";
import env from "#lib/env";
import ExternalResourceBuilder from "#lib/external-resource-builder";
import Interval from "#lib/interval";

const UPDATE_INTERVAL = new Interval( "2 weeks", { "negative": true } ),
    ID = "softvisio-node/core/resources/certificates",
    DOMAIN = "local.softvisio.net";

env.loadUserEnv();

var cloudflareApi;

if ( process.env.CLOUDFLARE_KEY && process.env.CLOUDFLARE_EMAIL ) {
    cloudflareApi = new Cloudflare( process.env.CLOUDFLARE_KEY, process.env.CLOUDFLARE_EMAIL );
}
else if ( process.env.CLOUDFLARE_TOKEN ) {
    cloudflareApi = new Cloudflare( process.env.CLOUDFLARE_TOKEN );
}

export default class Datasets extends ExternalResourceBuilder {
    #res;

    // properties
    get id () {
        return ID;
    }

    // protected
    async _getEtag () {
        if ( !this.isExpired ) return result( 200 );

        const res = await this.#getCertificates();
        if ( !res.ok ) return res;

        return result( 200, res.data.fingerprint );
    }

    async _build ( location ) {
        const res = await this.#getCertificates();
        if ( !res.ok ) return res;

        fs.mkdirSync( `${ location }/${ DOMAIN }`, {
            "recursive": true,
        } );

        fs.writeFileSync( `${ location }/${ DOMAIN }/key.pem`, res.data.privateKey );

        fs.writeFileSync( `${ location }/${ DOMAIN }/certificate.pem`, res.data.certificate );

        return result( 200 );
    }

    async _getExpires () {
        const res = await this.#getCertificates();
        if ( !res.ok ) return res;

        return result( 200, UPDATE_INTERVAL.toDate( res.data.expires ) );
    }

    async _getMeta () {
        const res = await this.#getCertificates();
        if ( !res.ok ) return res;

        return result( 200, {
            "fingerprint": res.data.fingerprint,
            "expires": res.data.expires,
        } );
    }

    // private
    async #getCertificates () {
        if ( !cloudflareApi ) return result( [ 500, `Cloudflare API not defined` ] );

        if ( this.#res ) return this.#res;

        const acme = new Acme( {
            "provider": "letsencrypt",
            "test": false,
            "email": "root@softvisio.net",
            "accountKey": null,
        } );

        const res = await acme.getCertificate( {
            "domains": DOMAIN,
            "createChallenge": this.#createChallenge.bind( this ),
            "deleteChallenge": this.#deleteChallenge.bind( this ),
        } );

        this.#res = res;

        return this.#res;
    }

    async #createChallenge ( { type, domain, dnsTxtRecordName, httpLocation, token, content } ) {
        if ( type !== "dns-01" ) return false;

        var res;

        // get zone
        res = await this.#getDomainZone( domain );
        if ( !res.ok ) return false;

        const zone = res.data;

        // delete record, if exists
        await this.#deleteDnsRecord( dnsTxtRecordName, zone );

        // create record
        res = await cloudflareApi.createDnsRecord( zone.id, {
            "type": "TXT",
            "name": dnsTxtRecordName,
            content,
            "ttl": 60,
        } );

        return res.ok;
    }

    async #deleteChallenge ( { type, domain, dnsTxtRecordName, token, httpLocation } ) {
        if ( type !== "dns-01" ) return false;

        var res;

        // get zone
        res = await this.#getDomainZone( domain );
        if ( !res.ok ) return;

        const zone = res.data;

        await this.#deleteDnsRecord( dnsTxtRecordName, zone );
    }

    async #getDomainZone ( domain ) {
        const res = await cloudflareApi.getZones();
        if ( !res.ok ) return res;

        for ( const zone of res.data ) {
            if ( domain === zone.name || domain.endsWith( `.${ zone.name }` ) ) {
                return result( 200, zone );
            }
        }

        return result( [ 404, `Domain zone not found` ] );
    }

    async #deleteDnsRecord ( dnsTxtRecordName, zone ) {
        var res;

        // get records
        res = await cloudflareApi.getDnsRecords( zone.id );
        if ( !res.ok ) return;

        // delete record
        for ( const record of res.data ) {
            if ( record.type !== "TXT" ) continue;

            if ( record.name !== dnsTxtRecordName ) continue;

            res = await cloudflareApi.deleteDnsRecord( zone.id, record.id );

            return;
        }
    }
}
