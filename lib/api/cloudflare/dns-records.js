export default Super =>
    class extends ( Super || class {} ) {

        // https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-list-dns-records
        async getDnsRecords ( zoneId ) {
            return this._request( "get", `zones/${ zoneId }/dns_records` );
        }

        // https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-create-dns-record
        async createDnsRecord ( zoneId, data ) {
            return this._request( "post", `zones/${ zoneId }/dns_records`, null, data );
        }

        // https://developers.cloudflare.com/api/operations/dns-records-for-a-zone-delete-dns-record
        async deleteDnsRecord ( zoneId, recordId ) {
            return this._request( "delete", `zones/${ zoneId }/dns_records/${ recordId }` );
        }
    };
